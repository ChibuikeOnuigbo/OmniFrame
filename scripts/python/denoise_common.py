"""
OmniFrame AI Denoiser — shared core (data synthesis, STFT, model, ONNX export).

Pipeline (16 kHz mono):
    audio -> STFT (n_fft 512, hop 128, hann, centered)
          -> feature  x = log10(|S| + 1e-4),  normalized (x - MU) / STD
          -> GRU denoiser  -> per-frame soft mask  m in (0, 1)
          -> |S_hat| = m^alpha * |S_mix|,  phase from the mixture
          -> ISTFT (overlap-add)

The model is an RNNoise-style recurrent masker: it looks at one frame of the
normalized log-magnitude spectrum at a time, keeps a hidden state across
frames, and predicts how much of each frequency bin belongs to the *wanted*
voice. Everything that is not the wanted voice is, by the acoustic definition
of noise, "any unwanted sound" — hum, hiss, clicks, traffic, or a whole song
padded on top until it turns to noise. The mask suppresses it all.

Pure NumPy training (no PyTorch needed); the ONNX export unrolls the GRU for
a fixed block length so the exact same arithmetic runs in onnxruntime-web,
onnxruntime (desktop sidecar) and the NumPy reference.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import signal as dsp

SR = 16000
N_FFT = 512
HOP = 128
FREQ_BINS = N_FFT // 2 + 1  # 257
EPS = 1e-4

# Feature normalization constants (frozen after a data pass; shipped in the
# model JSON so every runtime normalizes identically).
MU = -2.6
STD = 0.55

HIDDEN = 96
BLOCK = 64  # frames per ONNX block; GRU state carries across blocks


# ----------------------------------------------------------------------------
# STFT / ISTFT (frame-based, centered; mirrors the TypeScript implementation)
# ----------------------------------------------------------------------------

def hann(n: int) -> np.ndarray:
    w = np.hanning(n + 1)[:n]
    return w


_WINDOW = hann(N_FFT).astype(np.float64)


def stft(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Centered STFT. Returns (magnitude [F, T], phase [F, T])."""
    x = np.asarray(x, dtype=np.float64)
    xp = np.pad(x, (N_FFT // 2, N_FFT // 2), mode="reflect")
    n_frames = 1 + max(0, (len(xp) - N_FFT) // HOP)
    if n_frames <= 0:
        n_frames = 1
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n_frames)[:, None]
    frames = xp[idx] * _WINDOW
    Z = np.fft.rfft(frames, axis=1)  # [T, F]
    return np.abs(Z).T.astype(np.float64), np.angle(Z).T.astype(np.float64)


def istft(mag: np.ndarray, phase: np.ndarray, length: int) -> np.ndarray:
    """Overlap-add ISTFT (synthesis window = analysis window; COLA at hop/4)."""
    Z = mag * np.exp(1j * phase)  # [F, T]
    frames = np.fft.irfft(Z.T, n=N_FFT, axis=1)  # [T, N_FFT]
    frames *= _WINDOW
    out = np.zeros(N_FFT + HOP * (frames.shape[0] - 1) + N_FFT)
    win_sum = np.zeros_like(out)
    for t in range(frames.shape[0]):
        o = t * HOP
        out[o : o + N_FFT] += frames[t]
        win_sum[o : o + N_FFT] += _WINDOW**2
    win_sum[win_sum < 1e-8] = 1.0
    out /= win_sum
    out = out[N_FFT // 2 : N_FFT // 2 + length]
    return out[:length]


# ----------------------------------------------------------------------------
# Voice corpus + noise bank (deterministic, seeded)
# ----------------------------------------------------------------------------

def load_voice(path: str, rng: np.random.Generator) -> np.ndarray:
    """Load the speech fixture at 16 kHz mono, RMS-normalized ('clear and a
    little loud', as the brief puts it)."""
    import soundfile as sf

    d, sr = sf.read(path, always_2d=True)
    d = d.mean(axis=1)
    if sr != SR:
        d = dsp.resample_poly(d, SR, sr)
    d = d[: SR * 6]
    rms = float(np.sqrt((d**2).mean())) + 1e-9
    return (d / rms * 0.20).astype(np.float64)


def augment_voice(voice: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Pitch/tempo/EQ augmentation to widen one speaker into many voices."""
    out = voice
    # pitch shift by resampling (up/down ratio as coprime-ish integers)
    ratio = rng.uniform(0.8, 1.3)
    from fractions import Fraction

    frac = Fraction(ratio).limit_denominator(24)
    shifted = dsp.resample_poly(out, frac.denominator, frac.numerator)
    # random crop/pad back to similar length
    target = rng.integers(SR * 3, SR * 6)
    if len(shifted) >= target:
        start = rng.integers(0, len(shifted) - target + 1)
        shifted = shifted[start : start + target]
    else:
        shifted = np.pad(shifted, (0, target - len(shifted)))
    # gentle random EQ
    kind = rng.choice(["flat", "low", "high", "band"])
    if kind == "low":
        b, a = dsp.butter(2, 2000 / (SR / 2), btype="low")
        shifted = dsp.lfilter(b, a, shifted)
    elif kind == "high":
        b, a = dsp.butter(2, 300 / (SR / 2), btype="high")
        shifted = dsp.lfilter(b, a, shifted)
    elif kind == "band":
        b, a = dsp.butter(2, [250 / (SR / 2), 3600 / (SR / 2)], btype="band")
        shifted = dsp.lfilter(b, a, shifted)
    # random gain
    return shifted * rng.uniform(0.7, 1.4)


def _pinkish(n: int, rng: np.random.Generator, exponent: float) -> np.ndarray:
    white = rng.standard_normal(n)
    f = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n)
    freqs[0] = freqs[1]
    f = f / freqs ** (exponent / 2)
    out = np.fft.irfft(f, n)
    return out / (np.abs(out).max() + 1e-9)


def synth_white(n, rng):  # noqa: ANN001
    return rng.standard_normal(n) * 0.3


def synth_pink(n, rng):  # noqa: ANN001
    return _pinkish(n, rng, 1.0) * 0.3


def synth_brown(n, rng):  # noqa: ANN001
    return _pinkish(n, rng, 2.0) * 0.35


def synth_hum(n, rng):  # noqa: ANN001
    t = np.arange(n) / SR
    base = rng.choice([50.0, 60.0])
    out = np.zeros(n)
    for h in range(1, 7):
        out += np.sin(2 * np.pi * base * h * t + rng.uniform(0, 6.28)) / h
    out += synth_white(n, rng) * 0.02
    return out / (np.abs(out).max() + 1e-9) * 0.4


def synth_clicks(n, rng):  # noqa: ANN001
    out = np.zeros(n)
    for _ in range(rng.integers(4, 40)):
        p = rng.integers(0, n - 200)
        dur = rng.integers(20, 180)
        burst = rng.standard_normal(dur) * np.exp(-np.arange(dur) / (dur / 3))
        out[p : p + dur] += burst * rng.uniform(0.3, 1.0)
    return out * 0.5


def synth_keyboard(n, rng):  # noqa: ANN001
    out = np.zeros(n)
    t = 0
    while t < n:
        dur = rng.integers(200, 900)
        p = min(t, max(0, n - dur))
        burst = rng.standard_normal(dur) * np.exp(-np.arange(dur) / 60)
        b, a = dsp.butter(2, [800 / (SR / 2), 5000 / (SR / 2)], btype="band")
        burst = dsp.lfilter(b, a, burst) * rng.uniform(0.4, 1.0)
        out[p : p + dur] += burst
        t += int(dur + rng.uniform(30, 300) * SR / 1000)
    return out * 0.4


def synth_rain(n, rng):  # noqa: ANN001
    out = _pinkish(n, rng, 1.2) * 0.25
    out += synth_clicks(n, rng) * 0.05
    b, a = dsp.butter(2, 5000 / (SR / 2), btype="high")
    return dsp.lfilter(b, a, out) * 0.5


def synth_traffic(n, rng):  # noqa: ANN001
    out = _pinkish(n, rng, 1.6) * 0.4
    # slow amplitude swells (passing cars)
    t = np.arange(n) / SR
    for _ in range(rng.integers(1, 4)):
        rate = rng.uniform(0.05, 0.25)
        out *= 1 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t + rng.uniform(0, 6.28)))
    b, a = dsp.butter(2, 900 / (SR / 2), btype="low")
    return dsp.lfilter(b, a, out) * 0.7


def synth_drone(n, rng):  # noqa: ANN001
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 10):
        out += np.sin(2 * np.pi * 110 * k * t + rng.uniform(0, 6.28)) / k
    out += _pinkish(n, rng, 1.0) * 0.08
    return out / (np.abs(out).max() + 1e-9) * 0.45


def synth_siren(n, rng):  # noqa: ANN001
    t = np.arange(n) / SR
    f = 700 + 300 * np.sin(2 * np.pi * 0.4 * t)
    out = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return out * 0.25


def synth_song(n, rng):  # noqa: ANN001
    """Procedural song: chord pads + bassline + kick + hats (seeded)."""
    t = np.arange(n) / SR
    bpm = rng.uniform(88, 132)
    beat = 60.0 / bpm
    root = rng.uniform(196, 262)  # G3..C4
    progression = rng.choice([[0, 5, 7, 5], [0, 3, 5, 7], [0, 7, 5, 3], [0, 5, 3, 7]])
    out = np.zeros(n)
    # chord pads (additive synth)
    bar = beat * 4
    for i in range(int(n / SR / bar) + 1):
        semis = progression[i % len(progression)]
        freqs = [root * 2 ** ((semis + s) / 12) for s in (0, 4, 7)]
        seg = (t >= i * bar) & (t < (i + 1) * bar)
        for f in freqs:
            out[seg] += np.sin(2 * np.pi * f * t[seg]) * 0.5
            out[seg] += np.sin(2 * np.pi * 2 * f * t[seg]) * 0.15
    # bass
    for i in range(int(n / SR / beat) + 1):
        semis = progression[(i // 4) % len(progression)]
        f = root / 2 * 2 ** (semis / 12)
        seg = (t >= i * beat) & (t < (i + 1) * beat)
        env = np.exp(-4 * (t[seg] - i * beat))
        out[seg] += np.sin(2 * np.pi * f * t[seg]) * env * 0.9
    # kick
    for i in range(int(n / SR / beat) + 1):
        p = int(i * beat * SR)
        if p + 4000 > n:
            break
        tt = np.arange(3000) / SR
        out[p : p + 3000] += np.sin(2 * np.pi * (55 + 30 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14) * 1.1
    # hats
    for i in range(int(n / SR / (beat / 2)) + 1):
        p = int(i * (beat / 2) * SR)
        if p + 1200 > n:
            break
        burst = rng.standard_normal(1000) * np.exp(-np.arange(1000) / 90)
        b, a = dsp.butter(2, 7000 / (SR / 2), btype="high")
        out[p : p + 1000] += dsp.lfilter(b, a, burst) * 0.25
    out = out / (np.abs(out).max() + 1e-9)
    return out * 0.5


def synth_song_stack(n, rng):  # noqa: ANN001
    """'Heavily padded song': several songs + SFX stacked until the
    interference is broadband mush — structured audio that *functions* as
    noise because none of it is the wanted signal."""
    out = synth_song(n, rng) + 0.7 * synth_song(n, rng)
    out += 0.5 * synth_traffic(n, rng)
    out += 0.3 * synth_white(n, rng)
    return out / (np.abs(out).max() + 1e-9) * 0.6


NOISE_BANK = {
    "white": synth_white,
    "pink": synth_pink,
    "brown": synth_brown,
    "hum": synth_hum,
    "clicks": synth_clicks,
    "keyboard": synth_keyboard,
    "rain": synth_rain,
    "traffic": synth_traffic,
    "drone": synth_drone,
    "siren": synth_siren,
    "song": synth_song,
    "song_stack": synth_song_stack,
}


def synth_babble(n: int, rng: np.random.Generator, voice: np.ndarray) -> np.ndarray:
    """Competing voices: delayed, pitch-shifted copies of the corpus (the
    classic cocktail-party interference)."""
    out = np.zeros(n)
    for _ in range(rng.integers(2, 5)):
        v = augment_voice(voice, rng)
        d = rng.integers(0, max(1, len(v)))
        v = np.roll(v, d)
        out[: min(n, len(v))] += v[: min(n, len(v))] * rng.uniform(0.3, 0.7)
    if len(out) < n:
        out = np.pad(out, (0, n - len(out)))
    return out[:n] * rng.uniform(0.5, 1.0)


def make_mixture(
    voice: np.ndarray,
    rng: np.random.Generator,
    n_samples: int,
    snr_db: float | None = None,
    noise_kind: str | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, str, float]:
    """Returns (mixture, clean, noise, noise_kind, snr_db)."""
    if snr_db is None:
        # Babble is the hardest interference (same instrument as the target);
        # the brief wants the *main* voice dominant, so competing voices are
        # mixed mostly below the main voice.
        snr_db = float(rng.uniform(0, 10)) if noise_kind == "babble" else float(rng.uniform(-8, 12))
    clean = augment_voice(voice, rng)
    if len(clean) < n_samples:
        reps = int(np.ceil(n_samples / len(clean)))
        clean = np.tile(clean, reps)
    start = rng.integers(0, len(clean) - n_samples + 1)
    clean = clean[start : start + n_samples]

    if noise_kind is None:
        noise_kind = str(rng.choice(list(NOISE_BANK.keys()) + ["babble"] * 2))
    if noise_kind == "babble":
        noise = synth_babble(n_samples, rng, voice)
    else:
        noise = NOISE_BANK[noise_kind](n_samples, rng)

    # scale noise to the target SNR
    p_clean = float((clean**2).mean()) + 1e-12
    p_noise = float((noise**2).mean()) + 1e-12
    noise = noise * np.sqrt(p_clean / p_noise / (10 ** (snr_db / 10)))
    return clean + noise, clean, noise, noise_kind, snr_db


# ----------------------------------------------------------------------------
# Features / targets
# ----------------------------------------------------------------------------

def feature(mag: np.ndarray) -> np.ndarray:
    """log-magnitude -> normalized. mag [F, T] -> x [F, T]."""
    return (np.log10(mag + EPS) - MU) / STD


def target_mask(mag_clean: np.ndarray, mag_noise: np.ndarray) -> np.ndarray:
    """Soft Wiener-style mask |Sc| / (|Sc| + |Sn|)."""
    return (mag_clean / (mag_clean + mag_noise + 1e-8)).clip(0, 1)


# ----------------------------------------------------------------------------
# GRU denoiser (NumPy reference with manual backprop)
# ----------------------------------------------------------------------------

class GruDenoiser:
    """frame-wise: GRU(257 -> H) -> Dense(H -> H, relu) -> Dense(H -> 257, sigmoid)"""

    NAMES = [
        "Wz", "Uz", "bz", "Wr", "Ur", "br", "Wh", "Uh", "bh",
        "W1", "b1", "W2", "b2",
    ]

    def __init__(self, hidden: int = HIDDEN, seed: int = 7) -> None:
        self.H = hidden
        rng = np.random.default_rng(seed)
        I = FREQ_BINS
        # Xavier-ish init; GRU update/reset biases start at 1 (helps early
        # training keep state)
        self.W = {
            "Wz": rng.normal(0, (1 / I) ** 0.5, (hidden, I)),
            "Uz": rng.normal(0, (1 / hidden) ** 0.5, (hidden, hidden)),
            "bz": np.ones(hidden),
            "Wr": rng.normal(0, (1 / I) ** 0.5, (hidden, I)),
            "Ur": rng.normal(0, (1 / hidden) ** 0.5, (hidden, hidden)),
            "br": np.ones(hidden),
            "Wh": rng.normal(0, (1 / I) ** 0.5, (hidden, I)),
            "Uh": rng.normal(0, (1 / hidden) ** 0.5, (hidden, hidden)),
            "bh": np.zeros(hidden),
            "W1": rng.normal(0, (1 / hidden) ** 0.5, (hidden, hidden)),
            "b1": np.zeros(hidden),
            "W2": rng.normal(0, (1 / hidden) ** 0.5, (FREQ_BINS, hidden)),
            "b2": np.zeros(FREQ_BINS),
        }

    # -- forward ------------------------------------------------------------
    def forward(self, X: np.ndarray, h0: np.ndarray | None = None) -> tuple[np.ndarray, list[dict]]:
        """X [B, T, F] -> mask [B, T, F]; cache for backward."""
        B, T, _ = X.shape
        H = self.H
        h = np.zeros((B, H)) if h0 is None else h0.copy()
        cache: list[dict] = []
        masks = np.zeros((B, T, FREQ_BINS))
        for t in range(T):
            x = X[:, t, :]  # [B, F]
            xz = x @ self.W["Wz"].T + self.W["bz"]
            xr = x @ self.W["Wr"].T + self.W["br"]
            xh = x @ self.W["Wh"].T + self.W["bh"]
            hz = h @ self.W["Uz"].T
            hr = h @ self.W["Ur"].T
            hh_in = h @ self.W["Uh"].T
            z = _sig(xz + hz)
            r = _sig(xr + hr)
            hh = np.tanh(xh + r * hh_in)
            h_new = (1 - z) * h + z * hh
            d1 = np.maximum(h_new @ self.W["W1"].T + self.W["b1"], 0)
            m = _sig(d1 @ self.W["W2"].T + self.W["b2"])
            masks[:, t, :] = m
            cache.append(dict(x=x, h_prev=h, xz=xz, xr=xr, xh=xh, hz=hz, hr=hr,
                              hh_in=hh_in, z=z, r=r, hh=hh, h=h_new, d1=d1, m=m))
            h = h_new
        return masks, cache

    # -- backward -----------------------------------------------------------
    def backward(self, cache: list[dict], dmask: np.ndarray) -> dict[str, np.ndarray]:
        B = cache[0]["x"].shape[0]
        H = self.H
        g = {n: np.zeros_like(w) for n, w in self.W.items()}
        dh_next = np.zeros((B, H))
        for t in reversed(range(len(cache))):
            c = cache[t]
            # --- head: mask = sigmoid(W2 @ relu(W1 h + b1) + b2) ---
            dm = dmask[:, t, :]  # [B, F]
            s2 = c["m"] * (1 - c["m"])
            dm_sig = dm * s2              # dL/d(pre-sigmoid)
            g["W2"] += dm_sig.T @ c["d1"]  # [F, H]
            g["b2"] += dm_sig.sum(0)
            dd1_act = dm_sig @ self.W["W2"] * (c["d1"] > 0)  # [B, H] through ReLU
            g["W1"] += dd1_act.T @ c["h"]
            g["b1"] += dd1_act.sum(0)
            dh = dd1_act @ self.W["W1"].T + dh_next
            # --- GRU: h_new = (1-z) h_prev + z * hh ---
            h_prev, z, r, hh = c["h_prev"], c["z"], c["r"], c["hh"]
            dz = dh * (hh - h_prev)            # dL/dz
            dhh = dh * z                       # dL/dhh
            dh_prev_direct = dh * (1 - z)      # path through (1-z) h_prev
            dhh_pre = dhh * (1 - hh**2)        # through tanh
            dr = (dhh_pre * c["hh_in"]) @ self.W["Uh"].T
            dhh_in = dhh_pre * r
            dz_pre = dz * z * (1 - z)
            dr_pre = dr * r * (1 - r)
            g["Wz"] += dz_pre.T @ c["x"]
            g["bz"] += dz_pre.sum(0)
            g["Uz"] += dz_pre.T @ h_prev
            g["Wr"] += dr_pre.T @ c["x"]
            g["br"] += dr_pre.sum(0)
            g["Ur"] += dr_pre.T @ h_prev
            g["Wh"] += dhh_pre.T @ c["x"]
            g["bh"] += dhh_pre.sum(0)
            g["Uh"] += dhh_in.T @ h_prev
            dh_prev = (
                dh_prev_direct
                + (dz_pre @ self.W["Uz"])
                + (dr_pre @ self.W["Ur"])
                + (dhh_in @ self.W["Uh"])
            )
            dh_next = dh_prev
        return g

    def loss_grad(self, X: np.ndarray, M_target: np.ndarray, weights: np.ndarray | None = None) -> tuple[float, dict]:
        masks, cache = self.forward(X)
        if weights is None:
            weights = np.ones_like(M_target)
        diff = (masks - M_target) * weights
        loss = float((diff**2).sum() / max(1, X.shape[0] * X.shape[1] * FREQ_BINS))
        grads = self.backward(cache, 2.0 * diff / max(1, X.shape[0] * X.shape[1] * FREQ_BINS))
        return loss, grads


def _sig(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


class Adam:
    def __init__(self, params: dict, lr: float = 2e-3) -> None:
        self.lr = lr
        self.m = {k: np.zeros_like(v) for k, v in params.items()}
        self.v = {k: np.zeros_like(v) for k, v in params.items()}
        self.t = 0

    def step(self, params: dict, grads: dict, clip: float = 5.0) -> None:
        self.t += 1
        for k in params:
            g = grads[k]
            gn = float(np.linalg.norm(g))
            if gn > clip:
                g = g * (clip / gn)
            self.m[k] = 0.9 * self.m[k] + 0.1 * g
            self.v[k] = 0.999 * self.v[k] + 0.001 * g * g
            mhat = self.m[k] / (1 - 0.9**self.t)
            vhat = self.v[k] / (1 - 0.999**self.t)
            params[k] -= self.lr * mhat / (np.sqrt(vhat) + 1e-8)


# ----------------------------------------------------------------------------
# Metrics
# ----------------------------------------------------------------------------

def si_sdr(est: np.ndarray, ref: np.ndarray) -> float:
    est = est - est.mean()
    ref = ref - ref.mean()
    a = float(np.dot(est, ref) / (np.dot(ref, ref) + 1e-12))
    s_target = a * ref
    e_noise = est - s_target
    return float(10 * np.log10((np.dot(s_target, s_target) + 1e-12) / (np.dot(e_noise, e_noise) + 1e-12)))


def residual_noise_db(est: np.ndarray, clean_scaled: np.ndarray) -> float:
    """Energy of (output - clean reference) in dB — the noise left behind."""
    resid = est - clean_scaled
    return float(10 * np.log10((resid**2).mean() + 1e-12))


# ----------------------------------------------------------------------------
# ONNX export (unrolled GRU block; state carried between blocks)
# ----------------------------------------------------------------------------

def export_onnx(model: GruDenoiser, path: str, block: int = BLOCK) -> None:
    import onnx
    from onnx import helper, TensorProto

    H, F = model.H, FREQ_BINS
    W = {k: v.astype(np.float32) for k, v in model.W.items()}
    nodes = []
    # shared initializers
    inits = []
    # transposed weight initializers for MatMul
    for k in ["Wz", "Uz", "Wr", "Ur", "Wh", "Uh", "W1", "W2"]:
        wt = W[k].T.copy()
        inits.append(helper.make_tensor(f"{k}T", TensorProto.FLOAT, wt.shape, wt.flatten().tolist()))
    for k in ["bz", "br", "bh", "b1", "b2"]:
        v = W[k].reshape(1, -1)
        inits.append(helper.make_tensor(k, TensorProto.FLOAT, v.shape, v.flatten().tolist()))
    inits.append(helper.make_tensor("SHAPE_X", TensorProto.INT64, [2], [1, F]))
    inits.append(helper.make_tensor("SHAPE_M", TensorProto.INT64, [3], [1, 1, F]))

    # inputs: X [1, T, F], H0 [1, H]
    X = helper.make_tensor_value_info("X", TensorProto.FLOAT, [1, block, F])
    H0 = helper.make_tensor_value_info("H0", TensorProto.FLOAT, [1, H])
    out_mask = helper.make_tensor_value_info("MASK", TensorProto.FLOAT, [1, block, F])
    out_h = helper.make_tensor_value_info("HOUT", TensorProto.FLOAT, [1, H])

    # split the sequence into per-frame slices [1, 1, F]
    frame_names = [f"fr{t}" for t in range(block)]
    nodes.append(helper.make_node("Split", ["X"], frame_names, axis=1, num_outputs=block))

    h = "H0"
    mask_parts = []
    for t in range(block):
        p = f"t{t}"
        nodes.append(helper.make_node("Reshape", [frame_names[t], "SHAPE_X"], [f"{p}_x"]))
        # gates
        nodes.append(helper.make_node("MatMul", [f"{p}_x", f"WzT"], [f"{p}_xz"]))
        nodes.append(helper.make_node("Add", [f"{p}_xz", "bz"], [f"{p}_xz2"]))
        nodes.append(helper.make_node("MatMul", [h, f"UzT"], [f"{p}_hz"]))
        nodes.append(helper.make_node("Add", [f"{p}_xz2", f"{p}_hz"], [f"{p}_zpre"]))
        nodes.append(helper.make_node("Sigmoid", [f"{p}_zpre"], [f"{p}_z"]))
        nodes.append(helper.make_node("MatMul", [f"{p}_x", f"WrT"], [f"{p}_xr"]))
        nodes.append(helper.make_node("Add", [f"{p}_xr", "br"], [f"{p}_xr2"]))
        nodes.append(helper.make_node("MatMul", [h, f"UrT"], [f"{p}_hr"]))
        nodes.append(helper.make_node("Add", [f"{p}_xr2", f"{p}_hr"], [f"{p}_rpre"]))
        nodes.append(helper.make_node("Sigmoid", [f"{p}_rpre"], [f"{p}_r"]))
        nodes.append(helper.make_node("MatMul", [f"{p}_x", f"WhT"], [f"{p}_xh"]))
        nodes.append(helper.make_node("Add", [f"{p}_xh", "bh"], [f"{p}_xh2"]))
        nodes.append(helper.make_node("MatMul", [h, f"UhT"], [f"{p}_hhin"]))
        nodes.append(helper.make_node("Mul", [f"{p}_r", f"{p}_hhin"], [f"{p}_rh"]))
        nodes.append(helper.make_node("Add", [f"{p}_xh2", f"{p}_rh"], [f"{p}_hhpre"]))
        nodes.append(helper.make_node("Tanh", [f"{p}_hhpre"], [f"{p}_hh"]))
        # h_new = (1-z) h + z hh
        nodes.append(helper.make_node("Constant", [], [f"{p}_one"], value_floats=[1.0]))
        nodes.append(helper.make_node("Sub", [f"{p}_one", f"{p}_z"], [f"{p}_1mz"]))
        nodes.append(helper.make_node("Mul", [f"{p}_1mz", h], [f"{p}_a"]))
        nodes.append(helper.make_node("Mul", [f"{p}_z", f"{p}_hh"], [f"{p}_b"]))
        nodes.append(helper.make_node("Add", [f"{p}_a", f"{p}_b"], [f"{p}_h"]))
        # head
        nodes.append(helper.make_node("MatMul", [f"{p}_h", f"W1T"], [f"{p}_d1p"]))
        nodes.append(helper.make_node("Add", [f"{p}_d1p", "b1"], [f"{p}_d1p2"]))
        nodes.append(helper.make_node("Relu", [f"{p}_d1p2"], [f"{p}_d1"]))
        nodes.append(helper.make_node("MatMul", [f"{p}_d1", f"W2T"], [f"{p}_mp"]))
        nodes.append(helper.make_node("Add", [f"{p}_mp", "b2"], [f"{p}_mp2"]))
        nodes.append(helper.make_node("Sigmoid", [f"{p}_mp2"], [f"{p}_m"]))
        nodes.append(helper.make_node("Reshape", [f"{p}_m", "SHAPE_M"], [f"{p}_m3"]))
        mask_parts.append(f"{p}_m3")
        h = f"{p}_h"
    nodes.append(helper.make_node("Concat", mask_parts, ["MASK"], axis=1))
    nodes.append(helper.make_node("Identity", [h], ["HOUT"]))

    graph = helper.make_graph(nodes, "omni_denoise_v1", [X, H0], [out_mask, out_h], inits)
    model_proto = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 18)])
    model_proto.ir_version = 9
    onnx.checker.check_model(model_proto)
    onnx.save(model_proto, path)


def onnx_block_infer(session, mag: np.ndarray, alpha: float = 1.0) -> np.ndarray:
    """Run the ONNX model over a full magnitude spectrogram [F, T], carrying
    GRU state across BLOCK-frame chunks. Returns the mask [F, T]."""
    F = FREQ_BINS
    x = feature(mag).T.astype(np.float32)  # [T, F]
    T = x.shape[0]
    h = np.zeros((1, HIDDEN), dtype=np.float32)
    masks = np.zeros((T, F), dtype=np.float32)
    n_blocks = (T + BLOCK - 1) // BLOCK
    for b in range(n_blocks):
        chunk = np.zeros((1, BLOCK, F), dtype=np.float32)
        seg = x[b * BLOCK : (b + 1) * BLOCK]
        chunk[0, : len(seg)] = seg
        out = session.run(["MASK", "HOUT"], {"X": chunk, "H0": h})
        m, h = out
        n = min(BLOCK, T - b * BLOCK)
        masks[b * BLOCK : b * BLOCK + n] = m[0, :n]
    return (masks.T**alpha).astype(np.float64)


def denoise_waveform(session, x: np.ndarray, alpha: float = 1.0) -> np.ndarray:
    """Full pipeline: waveform -> STFT -> ONNX mask -> ISTFT."""
    mag, phase = stft(x)
    mask = onnx_block_infer(session, mag, alpha)
    return istft(mask * mag, phase, len(x))


def model_json(path: str) -> dict:
    return {
        "name": "omni-denoise-v1",
        "architecture": "gru-spectral-masker",
        "sr": SR,
        "nFft": N_FFT,
        "hop": HOP,
        "hidden": HIDDEN,
        "block": BLOCK,
        "mu": MU,
        "std": STD,
    }


def save_json(obj: dict, path: str) -> None:
    Path(path).write_text(json.dumps(obj, indent=2))
