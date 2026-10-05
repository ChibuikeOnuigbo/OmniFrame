# OmniFrame AI Denoise — `omni-denoise-v1`

An in-house neural speech denoiser: trained in Python, exported to **ONNX**, and
run **in the browser** (onnxruntime-web / the same runtime that powers
transformers.js-style model loading) and **natively in the desktop build**
(python sidecar + onnxruntime). One model file, three runtimes:

| Runtime | Where | How |
| --- | --- | --- |
| Browser (WASM) | `src/lib/aiDenoise.ts` | `onnxruntime-web`, SIMD, 1 thread |
| Desktop (native) | `src-tauri` command `ai_denoise_wav` | pipes WAV through `scripts/python/denoise_onnx.py` (onnxruntime CPU) |
| Python (training/tests) | `scripts/python/` | NumPy reference + onnxruntime parity checks |

## What counts as noise

Acoustic noise is **any unwanted sound** — it does not have to be random.
Hum, hiss, clicks and static are noise, but so are other people's
conversations, road traffic, or a neighbor's song, whenever the wanted signal
is *your* voice. Signal-to-noise ratio (SNR) simply compares the strength of
the wanted signal against everything else; the higher the SNR the cleaner the
audio. Two consequences drove the design:

1. The model is trained against **structured interference, not just random
   noise**: SFX (hum, clicks, rain, keyboard, traffic, drone, siren),
   competing-voice babble, and full songs.
2. A song that is padded on heavily enough — several songs plus SFX stacked —
   becomes broadband mush that *functions* as noise even though each layer is
   structured music. That case is a first-class training and test input.

## Architecture

RNNoise-style recurrent spectral masker, ~137k parameters (588 KB ONNX):

```
audio ─► STFT (n_fft 512, hop 128, hann, 16 kHz)
      ─► x = (log10(|S| + 1e-4) − MU) / STD          per frame, 257 bins
      ─► GRU(257 → 96)                                state carries across frames
      ─► Dense(96 → 96, ReLU) → Dense(96 → 257, sigmoid)   soft mask m ∈ (0,1)
      ─► |Ŝ| = m^α · |S_mix|                          α = strength
      ─► ISTFT with the mixture's phase (overlap-add)
```

The ONNX graph unrolls the GRU over 64-frame blocks; the hidden state is an
explicit input/output so blocks chain seamlessly across any clip length.

## Training data (all synthesized, deterministic seeds)

* **Wanted voice** — the speech fixture, RMS-normalized ("clear and a little
  loud"), augmented with random pitch (0.8–1.3×), tempo, EQ and gain so one
  recording behaves like many speakers.
* **Interference** — 12 procedural generators (white/pink/brown noise, mains
  hum, clicks, keyboard, rain, traffic, drone, siren, song, padded song stack)
  plus **babble**: 2–4 delayed pitch-shifted copies of the corpus.
* **Song** — chord pads + bassline + kick + hats at a random tempo/key.
* **Heavily padded song** — several songs + traffic + noise stacked until the
  interference is effectively noise (the brief's "song that hence turns to
  noise" case).
* **Mixing** — random SNR in −8…+12 dB (babble 0…+10 dB, because the brief
  wants the *main* voice dominant — "main consistent voice with high ratio").

Target: soft Wiener mask `|Sc| / (|Sc| + |Sn|)`; loss MSE vs the predicted
mask. Adam, exponential LR decay 2e-3 → 2e-4, 8000 steps, batch 8 × 64 frames.

## Retraining

```bash
pip install numpy scipy onnx onnxruntime soundfile   # + Python 3.11
python3 scripts/python/train_denoiser.py 8000        # ~15 min CPU
python3 scripts/python/test_model.py                 # parity + eval cases
```

Artifacts: `public/models/omni-denoise-v1.onnx` (deployed),
`public/models/omni-denoise-v1.json` (constants), `qa/models/*.npz` (weights).

## Evaluation

`scripts/python/test_model.py` (writes `qa/reports/ai-denoise-model.json`):

| Case | Interference | SNR | Expected |
| --- | --- | --- | --- |
| white_noise | white noise | 0 dB | Δ SI-SDR > 0 |
| babble | competing voices (main voice dominant) | +6 dB | Δ SI-SDR > 0 |
| song | procedural song | −3 dB | Δ SI-SDR > 0 |
| heavily_padded_song | song stack (≈ noise) | −8 dB | Δ SI-SDR > 0 |

Parity NumPy ↔ ONNX is asserted at < 1e-4. The browser path is tested by
`qa/ai-denoise-model-e2e.mjs` (loads the same ONNX in the app, denoises noisy
speech, asserts SI-SDR improvement).

## UI

* **Clip inspector → Audio** (video *and* audio clips): Volume, Voice
  Isolation (engine dropdown incl. *AI Denoise ONNX*), Loudness Normalization.
* **Left dock → Audio panel**: engine selector (DSP crossover / spectral /
  AI Denoise ONNX) plus the existing clip picker, mode and strength controls.
* Selecting **AI Denoise ONNX** with *Keep Vocal* routes the clip through the
  model; the DSP crossover handles *Remove Vocal* (karaoke) as before.

## Loudness normalization (companion feature)

`src/lib/loudness.ts` implements ITU-R BS.1770-4 integrated loudness
(K-weighting → 400 ms blocks at 100 ms hops → absolute −70 LUFS and relative
−10 LU gating). Verified against the standard anchor (1 kHz sine at −20 dBFS
⇒ −23.0 LUFS). *Normalize* applies `gain = target − measured` as the clip
volume, so it flows through preview playback and export mixing. Common
targets: −16 LUFS (podcast/speech), −14 LUFS (music streaming).
