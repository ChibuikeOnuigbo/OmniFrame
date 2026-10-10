#!/usr/bin/env python3
"""
200-run stress test of the shipped voice-isolation / noise-reduction model
(public/models/omni-denoise-v1.onnx) — the exact artifact the app runs in
the browser and on the desktop sidecar.

Two interference families, 100 runs each (200 total):
  • "noise"  — speech + everyday noise from the full bank (white, pink,
               brown, hum, clicks, keyboard, rain, traffic, drone, siren,
               babble) at random SNRs in [-6, +12] dB
  • "song"   — speech + music (song / heavily padded song) at random SNRs
               in [-10, +6] dB

Every run builds a fresh mixture (deterministic per-run seed), denoises it
with the ONNX model, and scores SI-SDR before/after, noise suppression,
voice correlation and inference time. Report + representative WAVs
(best / median / worst run per family) are written for listening.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf

import denoise_common as dc

ROOT = Path(__file__).resolve().parents[2]
ONNX_PATH = ROOT / "public/models/omni-denoise-v1.onnx"
AUDIO_DIR = ROOT / "evidence/audio/stress200"
REPORT_PATH = ROOT / "qa/reports/denoise-stress-200.json"

RUNS_PER_FAMILY = 100
SECONDS = 5
NOISE_KINDS = [
    "white", "pink", "brown", "hum", "clicks", "keyboard",
    "rain", "traffic", "drone", "siren", "babble",
]
SONG_KINDS = ["song", "song_stack"]


def si_sdr(est: np.ndarray, ref: np.ndarray) -> float:
    return dc.si_sdr(est, ref)


def run_family(sess, voice, family: str, kinds, snr_lo: float, snr_hi: float) -> list[dict]:
    rows = []
    for i in range(RUNS_PER_FAMILY):
        rng = np.random.default_rng(10_000 + i if family == "noise" else 20_000 + i)
        kind = kinds[i % len(kinds)]
        snr = float(rng.uniform(snr_lo, snr_hi))
        n = dc.SR * SECONDS
        mix, clean, noise, _, actual_snr = dc.make_mixture(voice, rng, n, snr_db=snr, noise_kind=kind)

        t0 = time.perf_counter()
        est = dc.denoise_waveform(sess, mix, alpha=1.0)
        infer_ms = (time.perf_counter() - t0) * 1000.0

        sdr_in = si_sdr(mix, clean)
        sdr_out = si_sdr(est, clean)
        noise_before = float((noise**2).mean())
        resid = est - clean
        noise_after = float((resid**2).mean())
        supp_db = 10 * np.log10(noise_before / (noise_after + 1e-12))
        voice_corr = float(np.corrcoef(est, clean)[0, 1])

        rows.append({
            "run": i + 1,
            "family": family,
            "interference": kind,
            "snrDb": round(actual_snr, 1),
            "siSdrBeforeDb": round(sdr_in, 2),
            "siSdrAfterDb": round(sdr_out, 2),
            "deltaSiSdrDb": round(sdr_out - sdr_in, 2),
            "noiseSuppressionDb": round(supp_db, 1),
            "voiceCorrelation": round(voice_corr, 3),
            "rmsIn": round(float(np.sqrt((mix**2).mean())), 4),
            "rmsOut": round(float(np.sqrt((est**2).mean())), 4),
            "inferMs": round(infer_ms, 1),
            "_audio": {"mix": mix, "out": est, "clean": clean},
        })
        flag = "+" if sdr_out - sdr_in > 0 else " "
        print(
            f"[{family} {i+1:3d}/{RUNS_PER_FAMILY}] {kind:<10} snr {actual_snr:+5.1f} dB  "
            f"SI-SDR {sdr_in:+6.2f} → {sdr_out:+6.2f} ({flag}{sdr_out - sdr_in:+5.2f})  "
            f"supp {supp_db:5.1f} dB  corr {voice_corr:.3f}  {infer_ms:5.0f} ms"
        )
    return rows


def summarize(rows: list[dict]) -> dict:
    deltas = np.array([r["deltaSiSdrDb"] for r in rows])
    sup = np.array([r["noiseSuppressionDb"] for r in rows])
    corr = np.array([r["voiceCorrelation"] for r in rows])
    ms = np.array([r["inferMs"] for r in rows])
    return {
        "runs": len(rows),
        "deltaSiSdrMeanDb": round(float(deltas.mean()), 2),
        "deltaSiSdrMedianDb": round(float(np.median(deltas)), 2),
        "deltaSiSdrP05Db": round(float(np.percentile(deltas, 5)), 2),
        "deltaSiSdrP95Db": round(float(np.percentile(deltas, 95)), 2),
        "deltaSiSdrMinDb": round(float(deltas.min()), 2),
        "deltaSiSdrMaxDb": round(float(deltas.max()), 2),
        "positiveRuns": int((deltas > 0).sum()),
        "positiveRatePct": round(float((deltas > 0).mean() * 100), 1),
        "noiseSuppressionMeanDb": round(float(sup.mean()), 1),
        "voiceCorrMean": round(float(corr.mean()), 3),
        "inferMsMean": round(float(ms.mean()), 1),
        "inferMsMax": round(float(ms.max()), 1),
    }


def save_representative(rows: list[dict], family: str) -> None:
    """Persist best / median / worst run audio for listening (9 WAVs)."""
    by_delta = sorted(rows, key=lambda r: r["deltaSiSdrDb"])
    picks = {
        "worst": by_delta[0],
        "median": by_delta[len(by_delta) // 2],
        "best": by_delta[-1],
    }
    for label, row in picks.items():
        tag = f"{family}-{label}-run{row['run']}-{row['interference']}-{row['snrDb']:+.1f}db"
        for part in ("mix", "out", "clean"):
            data = np.clip(row["_audio"][part], -1, 1)
            sf.write(AUDIO_DIR / f"{tag}-{part}.wav", data, dc.SR, subtype="PCM_16")


def canonical_demos(sess, voice) -> None:
    """The two headline scenarios, saved for direct A/B listening:
    speech + noise  →  corrected,   speech + song  →  corrected."""
    demos = [
        ("noise", "white", 0.0, 4242),
        ("song", "song", -3.0, 7777),
    ]
    for family, kind, snr, seed in demos:
        rng = np.random.default_rng(seed)
        mix, clean, _, _, _ = dc.make_mixture(voice, rng, dc.SR * SECONDS, snr_db=snr, noise_kind=kind)
        est = dc.denoise_waveform(sess, mix, alpha=1.0)
        for part, data in (("mix", mix), ("out", est), ("clean", clean)):
            sf.write(
                AUDIO_DIR / f"canonical-{family}-{part}.wav",
                np.clip(data, -1, 1), dc.SR, subtype="PCM_16",
            )
        print(
            f"canonical {family}: {kind} @{snr:+.0f} dB  "
            f"SI-SDR {si_sdr(mix, clean):+.2f} → {si_sdr(est, clean):+.2f}"
        )


def alpha_sweep(sess, voice) -> list[dict]:
    """Song suppression is gentle at alpha 1.0 by design; show what a
    stronger mask exponent does so the trade-off is visible."""
    rows = []
    for alpha in (1.0, 1.4, 1.8):
        deltas, corrs = [], []
        for i in range(40):
            rng = np.random.default_rng(30_000 + i)
            kind = "song" if i % 2 == 0 else "song_stack"
            snr = float(rng.uniform(-6, 3))
            mix, clean, _, _, _ = dc.make_mixture(voice, rng, dc.SR * SECONDS, snr_db=snr, noise_kind=kind)
            est = dc.denoise_waveform(sess, mix, alpha=alpha)
            deltas.append(si_sdr(est, clean) - si_sdr(mix, clean))
            corrs.append(float(np.corrcoef(est, clean)[0, 1]))
        row = {
            "alpha": alpha,
            "meanDeltaDb": round(float(np.mean(deltas)), 2),
            "positiveRatePct": round(float(np.mean([d > 0 for d in deltas]) * 100), 1),
            "voiceCorrMean": round(float(np.mean(corrs)), 3),
        }
        rows.append(row)
        print(f"alpha {alpha:.1f}: song mean Δ {row['meanDeltaDb']:+.2f} dB  positive {row['positiveRatePct']}%  corr {row['voiceCorrMean']}")
    return rows


def main() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    sess = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    voice = dc.load_voice(
        str(ROOT / "qa/fixtures/test-audio-6s.ogg"), np.random.default_rng(1234)
    )

    print(f"model: {ONNX_PATH.name} ({ONNX_PATH.stat().st_size // 1024} KB)")
    print(f"voice fixture: 6 s speech, SR {dc.SR}\n")
    canonical_demos(sess, voice)
    print()

    noise_rows = run_family(sess, voice, "noise", NOISE_KINDS, -6.0, 12.0)
    print()
    song_rows = run_family(sess, voice, "song", SONG_KINDS, -10.0, 6.0)

    # Persist best/median/worst audio per family BEFORE stripping buffers.
    save_representative(noise_rows, "noise")
    save_representative(song_rows, "song")
    for rows in (noise_rows, song_rows):
        for r in rows:
            r.pop("_audio", None)

    noise_sum = summarize(noise_rows)
    song_sum = summarize(song_rows)
    all_deltas = [r["deltaSiSdrDb"] for r in noise_rows + song_rows]
    overall = {
        "runs": 200,
        "deltaSiSdrMeanDb": round(float(np.mean(all_deltas)), 2),
        "positiveRuns": int(sum(1 for d in all_deltas if d > 0)),
        "positiveRatePct": round(float(np.mean([d > 0 for d in all_deltas]) * 100), 1),
    }

    print("\n---- alpha sweep (song family, 40 runs) ----")
    sweep = alpha_sweep(sess, voice)

    # SNR-sliced stats: where interference is at least as loud as the voice
    # (SNR <= 0) is the model's core job; quiet interference (SNR > 0) has
    # little to remove so deltas shrink toward zero by construction.
    def slice_stats(fam: str, lo: float, hi: float) -> dict:
        sel = [r for r in noise_rows + song_rows if r["family"] == fam and lo <= r["snrDb"] <= hi]
        d = [r["deltaSiSdrDb"] for r in sel]
        return {
            "runs": len(sel),
            "meanDeltaDb": round(float(np.mean(d)), 2),
            "positiveRatePct": round(float(np.mean([x > 0 for x in d]) * 100), 1),
        }

    noise_hard = slice_stats("noise", -99, 0)
    song_hard = slice_stats("song", -99, 0)

    print("\n================ SUMMARY ================")
    print(f"noise @ SNR<=0 : {json.dumps(noise_hard)}")
    print(f"song  @ SNR<=0 : {json.dumps(song_hard)}")
    print(f"NOISE family : {json.dumps(noise_sum)}")
    print(f"SONG  family : {json.dumps(song_sum)}")
    print(f"OVERALL      : {json.dumps(overall)}")

    # Per-interference breakdown, so weak spots are visible.
    breakdown = {}
    for r in noise_rows + song_rows:
        key = f"{r['family']}/{r['interference']}"
        breakdown.setdefault(key, []).append(r["deltaSiSdrDb"])
    per_kind = {
        k: {
            "runs": len(v),
            "meanDeltaDb": round(float(np.mean(v)), 2),
            "positiveRatePct": round(float(np.mean([d > 0 for d in v]) * 100), 1),
        }
        for k, v in sorted(breakdown.items())
    }
    print("\nper-interference:")
    for k, v in per_kind.items():
        print(f"  {k:<14} mean Δ {v['meanDeltaDb']:+6.2f} dB   positive {v['positiveRatePct']:5.1f}%   ({v['runs']} runs)")

    report = {
        "suite": "denoise-stress-200",
        "model": dc.model_json(str(ONNX_PATH)),
        "runtime": f"onnxruntime {ort.__version__} (CPU)",
        "voiceFixture": "qa/fixtures/test-audio-6s.ogg (48 kHz mono speech, resampled to 16 kHz)",
        "design": {
            "noiseFamily": f"{RUNS_PER_FAMILY} runs, kinds {NOISE_KINDS}, SNR uniform[-6,+12] dB",
            "songFamily": f"{RUNS_PER_FAMILY} runs, kinds {SONG_KINDS}, SNR uniform[-10,+6] dB",
        },
        "summary": {
            "noise": noise_sum,
            "song": song_sum,
            "overall": overall,
            "noiseAtSnrLe0": noise_hard,
            "songAtSnrLe0": song_hard,
        },
        "alphaSweepSong": sweep,
        "perInterference": per_kind,
        "runs": noise_rows + song_rows,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2))

    failures = []
    # Bars follow the model's documented design intent: a magnitude masker
    # that must never damage the voice (competing-voice babble and
    # quiet-interference runs are reported, not gated).
    if noise_sum["deltaSiSdrMeanDb"] < 2.0:
        failures.append(f"noise family mean Δ {noise_sum['deltaSiSdrMeanDb']} < 2 dB")
    if noise_hard["positiveRatePct"] < 90.0:
        failures.append(f"noise @ SNR<=0 positive rate {noise_hard['positiveRatePct']}% < 90%")
    if song_sum["deltaSiSdrMeanDb"] <= 0.0:
        failures.append(f"song family mean Δ {song_sum['deltaSiSdrMeanDb']} <= 0 dB")
    if overall["deltaSiSdrMeanDb"] < 2.0:
        failures.append(f"overall mean Δ {overall['deltaSiSdrMeanDb']} < 2 dB")

    print(f"\nreport: {REPORT_PATH}")
    print(f"audio : {AUDIO_DIR} (best/median/worst per family, in/out/clean)")
    if failures:
        print("FAILURES:")
        for f in failures:
            print(f"  - {f}")
        raise SystemExit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
