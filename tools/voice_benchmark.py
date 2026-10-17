#!/usr/bin/env python3
"""Voice-isolation benchmark for OmniFrame's engines on a real complex song.

Steps:
  decode   MP3 -> mono-mixed stereo float32 raw + meta (44.1 kHz)
  analyze  mix/instrumental/vocal float32 raws -> graphs + stats JSON with
           frame pooling (mean / std / percentiles) and vocal-band energy.

The separation itself runs the REAL product code (src/lib/voiceIsolation.ts)
via qa/voice-complex-song-run.mjs — this script only decodes and measures,
so the numbers describe the shipped DSP engine, not a re-implementation.
"""
import json
import sys
from pathlib import Path

import numpy as np

import os
WORK = Path(os.environ.get("VOICE_BENCH_DIR", "/tmp/voice-bench"))
SR = 44100


def cmd_decode(mp3: str) -> None:
    import soundfile as sf

    data, sr = sf.read(mp3, always_2d=True, dtype="float32")
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    if sr != SR:
        # linear resample to the engine's canonical rate
        n_new = int(round(len(data) * SR / sr))
        x_old = np.linspace(0, 1, len(data), endpoint=False)
        x_new = np.linspace(0, 1, n_new, endpoint=False)
        data = np.stack([np.interp(x_new, x_old, data[:, ch]) for ch in range(2)], axis=1)
    WORK.mkdir(parents=True, exist_ok=True)
    data.astype(np.float32).tofile(WORK / "mix.f32")
    meta = {"sr": SR, "frames": int(len(data)), "seconds": len(data) / SR, "source": mp3}
    (WORK / "mix.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta))


def load_stereo(name: str) -> np.ndarray:
    raw = np.fromfile(WORK / name, dtype=np.float32)
    return raw.reshape(-1, 2)


def frame_series(x: np.ndarray, win_ms=25.0, hop_ms=10.0) -> tuple[np.ndarray, np.ndarray]:
    """Per-frame RMS (dBFS) and spectral centroid; returns (times, dict)."""
    win = int(SR * win_ms / 1000)
    hop = int(SR * hop_ms / 1000)
    n_frames = 1 + max(0, (len(x) - win) // hop)
    rms = np.empty(n_frames)
    cent = np.empty(n_frames)
    window = np.hanning(win).astype(np.float64)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for f in range(n_frames):
        seg = x[f * hop : f * hop + win].astype(np.float64)
        # Stereo power: side (reverb) energy must count, so never mono-mix
        # before measuring — (L+R)/2 would cancel the side channel.
        rms[f] = np.sqrt(np.mean(seg**2) + 1e-12)
        spec = np.zeros(len(freqs))
        for ch in range(seg.shape[1]):
            spec += np.abs(np.fft.rfft(seg[:, ch] * window))
        spec += 1e-9
        cent[f] = float((spec * freqs).sum() / spec.sum())
    times = (np.arange(n_frames) * hop + win / 2) / SR
    return times, {"rms": rms, "centroid": cent}


def band_energy_ratio(x: np.ndarray, lo=140.0, hi=7500.0, win_ms=25.0, hop_ms=10.0) -> np.ndarray:
    """Fraction of per-frame energy inside the vocal band (140 Hz - 7.5 kHz)."""
    win = int(SR * win_ms / 1000)
    hop = int(SR * hop_ms / 1000)
    n_frames = 1 + max(0, (len(x) - win) // hop)
    window = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    mask = (freqs >= lo) & (freqs <= hi)
    out = np.empty(n_frames)
    for f in range(n_frames):
        seg = x[f * hop : f * hop + win].astype(np.float64)
        power = np.zeros(int(win // 2) + 1)
        for ch in range(seg.shape[1]):
            power += np.abs(np.fft.rfft(seg[:, ch] * window)) ** 2
        out[f] = power[mask].sum() / (power.sum() + 1e-12)
    return out


def center_signal(x: np.ndarray) -> np.ndarray:
    return ((x[:, 0] + x[:, 1]) * 0.5).reshape(-1, 1)


def pool_stats(values: np.ndarray) -> dict:
    """Mean/std pooling summary of a per-frame series (the 'pool')."""
    v = np.asarray(values, dtype=np.float64)
    return {
        "mean": float(v.mean()),
        "std": float(v.std()),
        "min": float(v.min()),
        "p10": float(np.percentile(v, 10)),
        "p50": float(np.percentile(v, 50)),
        "p90": float(np.percentile(v, 90)),
        "max": float(v.max()),
    }


def cmd_analyze(tag: str) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    out_dir = Path("evidence/voice")
    out_dir.mkdir(parents=True, exist_ok=True)
    mix = load_stereo("mix.f32")
    instr = load_stereo(f"instr-{tag}.f32")
    vocal = load_stereo(f"vocal-{tag}.f32")

    t_mix, s_mix = frame_series(mix)
    _, s_ins = frame_series(instr)
    _, s_voc = frame_series(vocal)
    db = lambda r: 20 * np.log10(np.maximum(r, 1e-6))

    mix_band = band_energy_ratio(mix)
    ins_band = band_energy_ratio(instr)
    voc_band = band_energy_ratio(vocal)

    # Estimated vocal-active frames: center-channel vocal-band energy of the
    # isolated vocal stem above its own 40th percentile (heuristic label,
    # used only to contrast vocal vs non-vocal frame behaviour).
    _, s_voc_center = frame_series(center_signal(vocal))
    voc_level = db(s_voc_center["rms"])
    active = voc_level > np.percentile(voc_level, 40)

    def suppression_db(ref: np.ndarray, out: np.ndarray, frames: np.ndarray) -> float:
        ref_db = db(ref[frames])
        out_db = db(out[frames])
        return float(np.mean(ref_db - out_db))

    stats = {
        "tag": tag,
        "seconds": float(len(mix) / SR),
        "frames": int(len(t_mix)),
        "rms_dbfs_pool": {
            "mix": pool_stats(db(s_mix["rms"])),
            "instrumental": pool_stats(db(s_ins["rms"])),
            "vocal": pool_stats(db(s_voc["rms"])),
        },
        "spectral_centroid_hz_pool": {
            "mix": pool_stats(s_mix["centroid"]),
            "instrumental": pool_stats(s_ins["centroid"]),
            "vocal": pool_stats(s_voc["centroid"]),
        },
        "vocal_band_energy_fraction_pool": {
            "mix": pool_stats(mix_band),
            "instrumental": pool_stats(ins_band),
            "vocal": pool_stats(voc_band),
        },
        "vocal_active_frame_fraction": float(active.mean()),
        "vocal_band_suppression_db": {
            "vocal_active_frames": suppression_db(
                np.sqrt(mix_band) * s_mix["rms"], np.sqrt(ins_band) * s_ins["rms"], active
            ),
            "non_vocal_frames": suppression_db(
                np.sqrt(mix_band) * s_mix["rms"], np.sqrt(ins_band) * s_ins["rms"], ~active
            ),
        },
        "center_vocal_suppression_db": {
            "vocal_active_frames": suppression_db(s_mix["rms"], s_ins["rms"], active),
            "non_vocal_frames": suppression_db(s_mix["rms"], s_ins["rms"], ~active),
        },
        "instrumental_energy_retention_nonvocal_db": float(
            np.mean(db(s_ins["rms"][~active]) - db(s_mix["rms"][~active]))
        ),
        "frames_std_rms_db": {
            "mix": float(db(s_mix["rms"]).std()),
            "instrumental": float(db(s_ins["rms"]).std()),
            "vocal": float(db(s_voc["rms"]).std()),
        },
    }

    # ---- Graphs ---------------------------------------------------------
    fig, axes = plt.subplots(3, 1, figsize=(14, 8), sharex=True)
    axes[0].plot(t_mix, db(s_mix["rms"]), lw=0.6, label="mix", color="#888")
    axes[0].plot(t_mix, db(s_ins["rms"]), lw=0.6, label="instrumental (remove_vocal)", color="#38bdf8")
    axes[0].plot(t_mix, db(s_voc["rms"]), lw=0.6, label="vocal (keep_vocal)", color="#f59e0b")
    axes[0].set_ylabel("frame RMS (dBFS)")
    axes[0].set_title(f"Voice isolation on complex slowed song — {tag}")
    axes[0].legend(loc="lower left", fontsize=8)
    axes[0].grid(alpha=0.25)

    axes[1].plot(t_mix, mix_band, lw=0.6, label="mix vocal-band fraction", color="#888")
    axes[1].plot(t_mix, ins_band, lw=0.6, label="instrumental", color="#38bdf8")
    axes[1].plot(t_mix, voc_band, lw=0.6, label="vocal stem", color="#f59e0b")
    axes[1].set_ylabel("vocal-band energy fraction")
    axes[1].legend(loc="lower left", fontsize=8)
    axes[1].grid(alpha=0.25)

    axes[2].plot(t_mix, s_mix["centroid"] / 1000, lw=0.6, label="mix centroid", color="#888")
    axes[2].plot(t_mix, s_ins["centroid"] / 1000, lw=0.6, label="instrumental", color="#38bdf8")
    axes[2].plot(t_mix, s_voc["centroid"] / 1000, lw=0.6, label="vocal stem", color="#f59e0b")
    axes[2].set_ylabel("spectral centroid (kHz)")
    axes[2].set_xlabel("time (s)")
    axes[2].legend(loc="upper right", fontsize=8)
    axes[2].grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_dir / f"bench-{tag}-curves.png", dpi=90)
    plt.close(fig)

    # Spectrograms (first 60 s)
    excerpt = int(min(60, len(mix) / SR) * SR)
    fig, axes = plt.subplots(3, 1, figsize=(14, 9), sharex=True)
    for ax, sig, title, cmap in [
        (axes[0], mix, "mix", "magma"),
        (axes[1], instr, "instrumental (remove_vocal)", "viridis"),
        (axes[2], vocal, "vocal (keep_vocal)", "plasma"),
    ]:
        mono = sig[:excerpt].mean(axis=1)
        ax.specgram(mono, NFFT=2048, Fs=SR, noverlap=1024, cmap=cmap, vmin=-90, vmax=-20)
        ax.set_ylim(0, 8000)
        ax.set_ylabel("Hz")
        ax.set_title(title, fontsize=9)
    axes[2].set_xlabel("time (s, first 60 s)")
    fig.tight_layout()
    fig.savefig(out_dir / f"bench-{tag}-spectrograms.png", dpi=90)
    plt.close(fig)

    # Pooled stats chart: mean +/- std bars
    fig, axes = plt.subplots(1, 3, figsize=(14, 4))
    names = ["mix", "instrumental", "vocal"]
    for ax, key, pool, ylabel in [
        (axes[0], None, stats["rms_dbfs_pool"], "frame RMS dBFS (mean ± std)"),
        (axes[1], None, stats["spectral_centroid_hz_pool"], "centroid Hz (mean ± std)"),
        (axes[2], None, stats["vocal_band_energy_fraction_pool"], "vocal-band fraction (mean ± std)"),
    ]:
        means = [pool[n]["mean"] for n in names]
        stds = [pool[n]["std"] for n in names]
        ax.bar(names, means, yerr=stds, capsize=4, color=["#888", "#38bdf8", "#f59e0b"])
        ax.set_ylabel(ylabel, fontsize=8)
        ax.grid(alpha=0.25, axis="y")
    fig.suptitle(f"Pooled frame statistics (mean/std pool) — {tag}")
    fig.tight_layout()
    fig.savefig(out_dir / f"bench-{tag}-pooled.png", dpi=90)
    plt.close(fig)

    (out_dir / f"bench-{tag}-stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "decode":
        cmd_decode(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == "analyze":
        cmd_analyze(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)
