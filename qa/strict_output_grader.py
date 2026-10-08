#!/usr/bin/env python3
"""
strict_output_grader.py — strict, sample-level grading of voice-isolation
outputs (keep_vocal acapellas AND remove_vocal instrumentals).

WHY THIS EXISTS
---------------
The JS E2E harness proves mechanics (lengths, no errors, relative gains).
This tool grades the CONTENT strictly, from signal physics + the shipped
Silero VAD, the way a human listener would:

  * sample-level integrity: non-finite, clipping, DC, silence, noise floor
  * SPEECH detection — Silero VAD v5 run frame-by-frame over the output
  * SONG / INSTRUMENTAL / BEAT detection — harmonic vs percussive energy
    (HPSS-style median split), onset density + beat regularity, spectral
    flatness; each content class gets a 0-100 rating
  * the 5% contract (the user's bar): a keep_vocal output must contain
    MORE THAN 5% speech AND speech must dominate music by MORE THAN 5
    points; a remove_vocal output is the vice-versa — residual speech
    UNDER 5%, music present OVER 5% and dominating speech by over 5 points.
    Speech frames are EXCLUDED from music frames (an acapella is a harmonic
    signal — counting harmonic frames as "music" would fail every good
    acapella), and keep_vocal outputs whose speech is undetectable at the
    slowed time base are re-measured across a speed grid (asetrate via the
    bundled ffmpeg) because Silero cannot hear pitch-shifted-down vocals —
    that is the physics the speed-fix feature exists for.

Grades: A = dominance > 40 pts · B > 20 · C > 5 (PASS) · D = 0-5 (marginal)
        F = < 0 (wrong content won)

Usage
-----
  python3 qa/strict_output_grader.py grade <file> <keep_vocal|remove_vocal|mix> [more files ...]
  python3 qa/strict_output_grader.py evidence        # grade the whole evidence pack
  python3 qa/strict_output_grader.py evidence --json qa/reports/strict-audio-grades.json

numpy + onnxruntime + the bundled ffmpeg binary; reuses the Silero runner
from qa/voice_realtrack_study.py.
"""
from __future__ import annotations

import glob
import json
import os
import sys
from dataclasses import dataclass, asdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_realtrack_study import (  # noqa: E402
    FFMPEG, HOP, SR, WIN, artifact_metrics, frame_signal, read_audio,
    silero_posterior, spectral_flux,
)

# ----------------------------------------------------------------------------
# 1. sample-level integrity
# ----------------------------------------------------------------------------

def sample_integrity(data: np.ndarray) -> dict:
    x = data.mean(axis=0)
    n = int(x.size)
    nonfinite = int((~np.isfinite(x)).sum())
    clean = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
    peak = float(np.abs(clean).max()) if n else 0.0
    rms = float(np.sqrt(np.mean(clean ** 2))) if n else 0.0
    dc = float(np.abs(clean.mean())) if n else 0.0
    # frame RMS for silence/noise-floor analysis
    frames = max(1, n // HOP)
    fr = clean[: frames * HOP].reshape(frames, HOP)
    fr_rms = np.sqrt(np.mean(fr ** 2, axis=1))
    active = fr_rms > 1e-4
    silent_frac = float(1.0 - active.mean()) if frames else 1.0
    floor_db = float(20 * np.log10(max(1e-9, np.percentile(fr_rms, 10)))) if frames else -999.0
    rms_db = float(20 * np.log10(max(1e-9, rms)))
    peak_db = float(20 * np.log10(max(1e-9, peak)))
    return {
        "samples": n,
        "duration_s": round(n / SR, 3),
        "nonfinite_samples": nonfinite,
        "clipped_samples": int((np.abs(clean) >= 0.999).sum()),
        "peak_dbfs": round(peak_db, 2),
        "rms_dbfs": round(rms_db, 2),
        "dc_offset": round(dc, 6),
        "silent_fraction": round(silent_frac, 4),
        "noise_floor_db": round(floor_db, 1),
    }


# ----------------------------------------------------------------------------
# 2. speech (Silero — the primary, neural detector)
# ----------------------------------------------------------------------------

def _asetrate_speed(data: np.ndarray, factor: float) -> np.ndarray:
    """Play `data` `factor`x faster (asetrate: pitch+time together) via the
    bundled ffmpeg — same semantics as the app's renderAtRate."""
    import subprocess, tempfile, wave as wavmod
    x = np.clip(data.T, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "in.wav")
        dst = os.path.join(td, "out.wav")
        with wavmod.open(src, "wb") as w:
            w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run([FFMPEG, "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
                        "-i", src, "-af", f"asetrate={int(SR * factor)},aresample={SR}", dst],
                       check=True)
        out, _ = read_audio(dst)
    return out


def speech_metrics(data: np.ndarray, speed_probe: bool = False) -> dict:
    """Silero speech detection. With speed_probe=True (keep_vocal grading),
    if the output is speech-poor at its own speed — the signature of a
    slowed edit — re-measure across the speed grid and keep the best; a
    real acapella of a slowed song only becomes Silero-hearable when played
    back at the corrected rate."""
    p = silero_posterior(data)
    if len(p) == 0:
        return {"voiced_fraction": 0.0, "mean": 0.0, "peak": 0.0,
                "longest_voiced_run_s": 0.0, "longest_gap_s": 0.0}
    v = p > 0.5
    def longest(run: np.ndarray) -> float:
        best = cur = 0
        for b in run:
            cur = cur + 1 if b else 0
            best = max(best, cur)
        return best
    frame_s = 512 / 16000
    base = {
        "voiced_fraction": round(float(v.mean()), 4),
        "mean": round(float(p.mean()), 4),
        "peak": round(float(p.max()), 4),
        "longest_voiced_run_s": round(longest(v) * frame_s, 2),
        "longest_gap_s": round(longest(~v) * frame_s, 2),
    }
    if not speed_probe or base["voiced_fraction"] >= 0.05:
        return base
    # slowed edit: probe the speed grid (same range the app auto-detects)
    best = base
    for factor in (1.3, 1.45, 1.6, 1.15):
        try:
            sped = _asetrate_speed(data, factor)
        except Exception:
            break
        m = speech_metrics(sped, speed_probe=False)
        if m["voiced_fraction"] > best["voiced_fraction"] + 0.02:
            best = m
            best["speed_factor_heard_at"] = factor
        if best["voiced_fraction"] >= 0.30:
            break  # clearly heard — stop probing
    best["probed_speeds"] = True
    return best


# ----------------------------------------------------------------------------
# 3. song / instrumental / beat detection (DSP content analysis)
# ----------------------------------------------------------------------------

def _hpss_split(mag: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Harmonic/percussive split: per-bin temporal median = harmonic part."""
    k = 9  # ~210 ms window at HOP 1024 / 44100
    pad = k // 2
    padded = np.pad(mag, ((pad, pad), (0, 0)), mode="edge")
    harm = np.zeros_like(mag)
    for i in range(mag.shape[0]):
        harm[i] = np.median(padded[i:i + k], axis=0)
    perc = np.maximum(mag - harm, 0.0)
    return harm, perc


def music_metrics(data: np.ndarray, voiced_fraction: float | None = None) -> dict:
    """Song / instrumental / beat content analysis. Voiced (speech) frames
    are excluded from the music fraction — an acapella is fully harmonic,
    and without this subtraction every good acapella would grade as
    "music". Silero's per-frame probabilities are aligned to STFT frames
    by nearest-in-time mapping."""
    f = frame_signal(data)
    mag = f.mag
    total_e = mag.sum() + 1e-9
    harm, perc = _hpss_split(mag)

    # per-frame energies
    h_e = harm.sum(axis=1)
    p_e = perc.sum(axis=1)
    a_e = mag.sum(axis=1)
    active = a_e > np.percentile(a_e, 20) + 1e-9

    harmonic_fraction = float(h_e.sum() / total_e)
    percussive_fraction = float(p_e.sum() / total_e)

    # musical frames: harmonic or percussive energy clearly above the frame
    # noise floor (spectral flatness low = tonal, or strong transient)
    flat = np.exp(np.mean(np.log(mag + 1e-9), axis=1)) / (np.mean(mag, axis=1) + 1e-9)
    tonal = flat < 0.15
    musical = active & (tonal | (p_e > 2.0 * np.percentile(p_e, 50) + 1e-9))
    # subtract speech: get Silero per-frame probabilities aligned in time
    sil = silero_posterior(data)  # 32 ms frames at 16 kHz
    if len(sil):
        sil_t = (np.arange(len(sil)) + 0.5) * 0.032
        stft_t = f.times
        nearest = np.abs(stft_t[:, None] - sil_t[None, :]).argmin(axis=1)
        voiced_frames = sil[nearest] > 0.5
    else:
        voiced_frames = np.zeros(mag.shape[0], dtype=bool)
    music_frames = musical & ~voiced_frames
    music_fraction = float(music_frames.mean())
    voiced_in_active = float((voiced_frames & active).mean())

    # beat: onset envelope peaks -> inter-onset regularity
    flux = spectral_flux(mag)
    thr = flux.mean() + 1.5 * flux.std()
    peaks = np.where((flux[1:-1] > flux[:-2]) & (flux[1:-1] > flux[2:]) & (flux[1:-1] > thr))[0] + 1
    onsets_per_s = len(peaks) / max(1e-9, len(flux) * HOP / SR)
    ioi = np.diff(peaks) * (HOP / SR)
    beat_regularity = 0.0
    bpm = 0.0
    if len(ioi) >= 8:
        med = float(np.median(ioi))
        good = ioi[(ioi > 0.8 * med) & (ioi < 1.25 * med)]
        if len(ioi):
            beat_regularity = float(len(good) / len(ioi))
        if med > 0:
            bpm = round(60.0 / med, 1)
    beat_fraction = float(percussive_fraction * beat_regularity)

    # content-class ratings (0-100): what a listener would call this file
    voiced = voiced_fraction if voiced_fraction is not None else float(voiced_frames.mean())
    instrumental_rating = round(100.0 * harmonic_fraction * (1.0 - min(1.0, voiced * 4)), 1)
    beat_rating = round(100.0 * min(1.0, beat_fraction * 2.5), 1)
    song_rating = round(100.0 * min(1.0, voiced * 3.0) * min(1.0, harmonic_fraction * 2.0), 1)
    classes = {
        "song_with_vocals_pct": song_rating,
        "instrumental_pct": instrumental_rating,
        "beat_percussive_pct": beat_rating,
    }
    return {
        "music_fraction": round(music_fraction, 4),
        "harmonic_fraction": round(harmonic_fraction, 4),
        "percussive_fraction": round(percussive_fraction, 4),
        "onsets_per_s": round(float(onsets_per_s), 2),
        "beat_regularity": round(beat_regularity, 3),
        "bpm_estimate": bpm,
        "content_ratings": classes,
    }


# ----------------------------------------------------------------------------
# 4. grading — the 5% contract
# ----------------------------------------------------------------------------

@dataclass
class Grade:
    file: str
    expected: str            # keep_vocal | remove_vocal | mix
    integrity: dict
    speech: dict
    music: dict
    speech_pct: float        # voiced fraction * 100
    music_pct: float         # music fraction * 100
    dominance_pts: float     # speech - music (or music - speech by mode)
    grade: str               # A/B/C/D/F
    pass_: bool
    verdict: str


def grade_file(path: str, expected: str) -> Grade:
    data, _ = read_audio(path)
    integ = sample_integrity(data)
    sp = speech_metrics(data, speed_probe=(expected == "keep_vocal"))
    grade_audio = data
    if expected == "keep_vocal" and sp.get("speed_factor_heard_at"):
        # the output is on a slowed time base — grade the content at the
        # speed where the voice is actually hearable, for BOTH detectors
        grade_audio = _asetrate_speed(data, sp["speed_factor_heard_at"])
    mu = music_metrics(grade_audio, voiced_fraction=sp["voiced_fraction"])
    speech_pct = round(sp["voiced_fraction"] * 100, 2)
    music_pct = round(mu["music_fraction"] * 100, 2)

    if expected == "silent":
        # keep_vocal on an instrumental-only input: the correct output is
        # near-silence (the E2E F case) — nothing to keep
        dominance = round(0.0, 2)
        ok = speech_pct < 5.0 and music_pct < 5.0
        verdict = (f"expected near-silence: speech {speech_pct}% / music {music_pct}% "
                   f"(both must be <5%)")
    elif expected == "keep_vocal":
        dominance = round(speech_pct - music_pct, 2)
        # strict bars: speech > 5% AND dominance > 5 points (hard fail below)
        ok = speech_pct > 5.0 and dominance > 5.0
        verdict = (f"keep_vocal: speech {speech_pct}% vs music {music_pct}% "
                   f"(needs speech >5% and dominance >5pts)")
    elif expected == "remove_vocal":
        dominance = round(music_pct - speech_pct, 2)
        ok = speech_pct < 5.0 and music_pct > 5.0 and dominance > 5.0
        verdict = (f"remove_vocal: residual speech {speech_pct}% vs music {music_pct}% "
                   f"(needs speech <5%, music >5%, music dominance >5pts)")
    else:  # mix: informational, no pass/fail
        dominance = round(speech_pct - music_pct, 2)
        ok = True
        verdict = f"mix reference: speech {speech_pct}% / music {music_pct}%"

    # integrity hard-fails regardless of content
    hard_fail = (integ["nonfinite_samples"] > 0 or integ["clipped_samples"] > 0
                 or integ["silent_fraction"] > 0.95)
    if hard_fail:
        ok = False
        verdict += f" — INTEGRITY FAIL (nonfinite {integ['nonfinite_samples']}, clipped {integ['clipped_samples']}, silent {integ['silent_fraction']:.0%})"

    if expected == "silent":
        letter = "A" if ok else "F"  # dominance letters don't apply to silence
    else:
        d = abs(dominance)
        letter = "F" if not ok else ("A" if d > 40 else "B" if d > 20 else "C")
    return Grade(path, expected, integ, sp, mu, speech_pct, music_pct,
                 dominance, letter, ok, verdict)


# ----------------------------------------------------------------------------
# 5. evidence-pack grading
# ----------------------------------------------------------------------------

def grade_evidence() -> list[Grade]:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ev = os.path.join(root, "evidence", "voice")
    plan: list[tuple[str, str]] = []
    # slowed pack: keep_vocal acapellas vs instrumentals by filename
    for p in sorted(glob.glob(os.path.join(ev, "slowed", "*.mp3"))):
        base = os.path.basename(p)
        if base.startswith("output-instrumental"):
            # keep_vocal on an instrumental-only input — correct answer is
            # near-silence (E2E case F)
            plan.append((p, "silent"))
        elif base.startswith("output-realtrack-naturalpitch"):
            plan.append((p, "keep_vocal"))
        elif base.startswith("input-"):
            plan.append((p, "mix"))
        elif "test-audio-6s-keep-vocal" in base or "track1-keep-vocal" in base:
            plan.append((p, "silent"))  # fixtures with no vocals — correct keep_vocal output is near-silence
        elif base.startswith("output-"):
            plan.append((p, "keep_vocal"))
    # realworld + listen packs (best effort: outputs are acapellas)
    for sub in ("realworld", "listen"):
        for p in sorted(glob.glob(os.path.join(ev, sub, "*.mp3"))):
            base = os.path.basename(p)
            if "instrumental" in base or "remove" in base:
                plan.append((p, "remove_vocal"))
            elif "test-audio-6s-keep-vocal" in base or "track1-keep-vocal" in base:
                plan.append((p, "silent"))
            elif base.startswith("output-") or "acapella" in base or "vocal" in base.lower():
                plan.append((p, "keep_vocal"))
            elif base.startswith("input-"):
                plan.append((p, "mix"))
    # engines pack (Req 17): per-engine outputs through the real app path;
    # expected modes come from the collector's manifest.json
    manifest = os.path.join(ev, "engines", "manifest.json")
    if os.path.exists(manifest):
        import json as _json
        with open(manifest) as f:
            for job in _json.load(f).get("jobs", []):
                p = os.path.join(ev, "engines", job["name"] + ".wav")
                if os.path.exists(p):
                    plan.append((p, job["mode"]))
    return [grade_file(p, e) for p, e in plan]


def main() -> None:
    args = sys.argv[1:]
    json_out = None
    if "--json" in args:
        i = args.index("--json")
        json_out = args[i + 1]
        args = args[:i] + args[i + 2:]

    if not args:
        print(__doc__)
        return
    cmd = args[0]
    grades: list[Grade]
    if cmd == "grade":
        if len(args) < 3:
            print("usage: grade <file> <keep_vocal|remove_vocal|mix> [...]")
            return
        grades = [grade_file(args[1], args[2])]
    elif cmd == "evidence":
        grades = grade_evidence()
    else:
        # treat as a single file to describe (informational)
        grades = [grade_file(cmd, "mix")]
        json_out = json_out  # noqa

    print(f"{'GRADE':<6}{'EXPECT':<14}{'SPCH%':>7}{'MUSC%':>7}{'DOM':>7}  FILE")
    passed = 0
    for g in grades:
        if g.expected != "mix":
            passed += g.pass_
        mark = g.grade if g.expected != "mix" else "·"
        print(f"{mark:<6}{g.expected:<14}{g.speech_pct:>7.2f}{g.music_pct:>7.2f}{g.dominance_pts:>+7.1f}  {os.path.basename(g.file)}")
    n_graded = sum(1 for g in grades if g.expected != "mix")
    print(f"\n{passed}/{n_graded} graded outputs PASS the 5% contract")
    for g in grades:
        if not g.pass_ and g.expected != "mix":
            print(f"  FAIL {os.path.basename(g.file)} — {g.verdict}")
            print(f"       integrity: {json.dumps(g.integrity)}")

    if json_out:
        with open(json_out, "w") as f:
            json.dump({"date": __import__("datetime").datetime.now().isoformat(),
                       "grades": [asdict(g) for g in grades]}, f, indent=2)
        print(f"\nwrote {json_out}")


if __name__ == "__main__":
    main()
