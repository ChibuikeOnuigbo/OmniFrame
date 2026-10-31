#!/usr/bin/env python3
"""Reproduce the DeVoice/OmniFrame first-minute reference measurements.

The historical DeVoice stems are not checked out in the working tree. Extract
or supply the reference MP3s without adding them to Git, e.g.:

  mkdir -p /tmp/devoice-reference
  git show 22ecf32:Vocal_1791637488052.mp3 > /tmp/devoice-reference/vocal.mp3
  git show 22ecf32:'Other stems_1791637479716.mp3' > /tmp/devoice-reference/other.mp3
  python3 -m venv /tmp/devoice-reference/venv
  /tmp/devoice-reference/venv/bin/pip install numpy onnxruntime
  /tmp/devoice-reference/venv/bin/python qa/devoice_reference_study.py \\
    --source 'UPAST (Ultra Slowed) - HELLBLADE.mp3' \\
    --vocal /tmp/devoice-reference/vocal.mp3 \\
    --other /tmp/devoice-reference/other.mp3 \\
    --app-vocals evidence/voice/realworld/output-track2-keep-vocal-demucs-v3.mp3

Audio is decoded to 44.1 kHz through the repository's bundled ffmpeg. The
sample alignment is only for confirming the likely source; the VAD comparison
uses the same unshifted first-minute timeline for the two acapellas. Silero
energy/frames are diagnostics, not ground truth or a quality/parity score.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import voice_realtrack_study as study  # noqa: E402


def mono(data: np.ndarray) -> np.ndarray:
    return np.nan_to_num(data.mean(axis=0), nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)


def correlation(a: np.ndarray, b: np.ndarray) -> float:
    n = min(len(a), len(b))
    x = a[:n].astype(np.float64, copy=False)
    y = b[:n].astype(np.float64, copy=False)
    x = x - x.mean()
    y = y - y.mean()
    den = np.sqrt(np.dot(x, x) * np.dot(y, y))
    return float(np.dot(x, y) / den) if den > 0 else 0.0


def aligned_correlation(source: np.ndarray, stems_sum: np.ndarray, stem_lag: int) -> float:
    """Positive lag means the decoded stem sum starts later than the source."""
    n = min(len(source), len(stems_sum))
    if stem_lag >= 0:
        if stem_lag >= n:
            return 0.0
        return correlation(source[:n - stem_lag], stems_sum[stem_lag:n])
    shift = -stem_lag
    if shift >= n:
        return 0.0
    return correlation(source[shift:n], stems_sum[:n - shift])


def best_sample_alignment(source: np.ndarray, stems_sum: np.ndarray, max_lag_samples: int) -> tuple[int, float]:
    """Coarse decimated search followed by full-rate local refinement."""
    decimation = 10
    a = source[::decimation]
    b = stems_sum[::decimation]
    coarse_limit = max_lag_samples // decimation
    coarse_lag = max(
        range(-coarse_limit, coarse_limit + 1),
        key=lambda lag: aligned_correlation(a, b, lag),
    )
    center = coarse_lag * decimation
    low = max(-max_lag_samples, center - decimation)
    high = min(max_lag_samples, center + decimation)
    lag = max(range(low, high + 1), key=lambda value: aligned_correlation(source, stems_sum, value))
    return lag, aligned_correlation(source, stems_sum, lag)


def envelope_correlation(source: np.ndarray, stems_sum: np.ndarray, sr: int, window_ms: float = 100.0) -> dict:
    n = min(len(source), len(stems_sum))
    width = round(sr * window_ms / 1000.0)
    count = n // width
    if count < 2:
        raise ValueError("not enough audio for envelope correlation")
    a = source[:count * width].reshape(count, width)
    b = stems_sum[:count * width].reshape(count, width)
    rms_a = np.sqrt(np.mean(a * a, axis=1) + 1e-18)
    rms_b = np.sqrt(np.mean(b * b, axis=1) + 1e-18)
    corr = float(np.corrcoef(np.log10(rms_a), np.log10(rms_b))[0, 1])
    return {"window_ms": window_ms, "windows": count, "log_rms_correlation": corr}


def yield_summary(data: np.ndarray) -> dict:
    result = study.vocal_yield(data)
    keys = (
        "seconds", "vocal_like_energy_frac", "vocal_like_frames_frac",
        "silero_mean", "silero_frames_over_50", "silero_peak", "rms_dbfs",
    )
    return {key: float(result[key]) for key in keys}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="full source mix MP3/WAV")
    parser.add_argument("--vocal", required=True, help="DeVoice vocal-stem MP3/WAV")
    parser.add_argument("--other", required=True, help="DeVoice accompaniment/other-stem MP3/WAV")
    parser.add_argument("--app-vocals", required=True, help="OmniFrame acapella MP3/WAV")
    parser.add_argument("--duration-seconds", type=float, default=60.0)
    parser.add_argument("--max-lag-ms", type=float, default=100.0)
    parser.add_argument("--json", default=None, help="optional report path")
    args = parser.parse_args()

    source_data, source_sr = study.read_audio(args.source)
    vocal_data, vocal_sr = study.read_audio(args.vocal)
    other_data, other_sr = study.read_audio(args.other)
    app_data, app_sr = study.read_audio(args.app_vocals)
    rates = {source_sr, vocal_sr, other_sr, app_sr}
    if rates != {study.SR}:
        raise SystemExit(f"expected all inputs at {study.SR} Hz after decode; got {sorted(rates)}")
    requested = round(args.duration_seconds * study.SR)
    n = min(requested, source_data.shape[1], vocal_data.shape[1], other_data.shape[1], app_data.shape[1])
    if n < study.WIN:
        raise SystemExit("inputs are too short for a useful first-minute comparison")

    source = mono(source_data[:, :n])
    vocal = vocal_data[:, :n].astype(np.float32, copy=False)
    other = other_data[:, :n].astype(np.float32, copy=False)
    stems_sum = mono(vocal + other)
    app_vocal = app_data[:, :n].astype(np.float32, copy=False)

    max_lag = round(args.max_lag_ms * study.SR / 1000.0)
    lag, sample_corr = best_sample_alignment(source, stems_sum, max_lag)
    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "source_mix": Path(args.source).name,
            "reference_vocal": Path(args.vocal).name,
            "reference_other": Path(args.other).name,
            "app_vocals": Path(args.app_vocals).name,
            "reference_origin_commit": "22ecf32",
        },
        "duration_seconds": n / study.SR,
        "sample_rate_hz": study.SR,
        "source_match": {
            "sum_of_devoice_stems": {
                "envelope": envelope_correlation(source, stems_sum, study.SR),
                "sample_correlation_at_zero_lag": aligned_correlation(source, stems_sum, 0),
                "sample_correlation_after_alignment": sample_corr,
                "stem_delay_samples": lag,
                "stem_delay_ms": lag * 1000.0 / study.SR,
                "alignment_search_limit_ms": args.max_lag_ms,
            },
        },
        "silero_vocal_yield": {
            "devoice_vocal": yield_summary(vocal),
            "devoice_other": yield_summary(other),
            "omniframe_app_output_first_minute": yield_summary(app_vocal),
        },
        "caveat": "Silero VAD is a voice-likelihood heuristic, not a separator-quality ground truth; the sample alignment only identifies the likely source.",
    }
    try:
        import onnxruntime as ort
        report["onnxruntime_version"] = ort.__version__
    except Exception:
        pass
    report["numpy_version"] = np.__version__

    output = json.dumps(report, indent=2, ensure_ascii=False)
    print(output)
    if args.json:
        Path(args.json).write_text(output + "\n", encoding="utf-8")
        print(f"\nreport written to {args.json}")


if __name__ == "__main__":
    main()
