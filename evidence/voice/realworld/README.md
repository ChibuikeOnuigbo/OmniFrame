# Voice isolation — real tracks (study, vetting & the v2 fix)

The user listened to the first pass on these two tracks and called it a
failure — correctly for one of them. Instead of guessing, the failure was
studied with a dedicated DSP + neural analysis tool
([`qa/voice_realtrack_study.py`](../../../qa/voice_realtrack_study.py)) that
audits **where vocal-like energy actually goes** (Silero VAD v5 as the
primary voice detector, harmonic-comb / formant / HNR features as secondary
evidence, tempo analysis for slowed-edit detection) and **vets** any fix
before/after. Play every file below by clicking it.

## Track 2 — UPAST · HELLBLADE (Ultra Slowed) — FIXED in v2

**Diagnosis.** The track measures 117.5 BPM — but it is an *ultra-slowed*
edit. Scanning speed factors on the raw mix showed vocals becoming clearly
detectable only when the audio is sped back up (Silero on the raw mix:
0.0% at ×1.00 → 26% of frames firing at ×1.36 ≈ 160 BPM, the likely
original tempo). In other words: **the vocals are pitched so far down that
they fall outside the pitch range Demucs learned as "vocals"** — the
direct separation recovered only a smeared fraction (23% vocal-like energy,
13% of frames voiced). That is the failure you heard.

**Fix (v2).** Speed-normalize before separation, then slow the stems back:

1. resample ×1.36 (117.5 → ~160 BPM),
2. run the full app pipeline (2 shift-averaged passes, finite-aware
   averaging, LS cross-talk removal),
3. slow vocals + instrumental back to original time.

**Vetted result** (same tool, same measurement):

| | v1 (direct) | **v2 (speed-normalized)** |
|---|---|---|
| vocal-like energy in acapella | 23.2% | **45.0% (+2.9 dB)** |
| voiced frames | 13.0% | **30.1%** |
| artifacts (flux outliers / non-finite) | 0 / 0 | 0 / 0 |

| Mode | Files |
|---|---|
| Input | [`UPAST (Ultra Slowed) - HELLBLADE.mp3`](../../../UPAST%20%28Ultra%20Slowed%29%20-%20HELLBLADE.mp3) |
| Keep Vocal v1 (direct — the failed one) | [`output-track2-keep-vocal-demucs.mp3`](output-track2-keep-vocal-demucs.mp3) |
| **Keep Vocal v2 (speed-normalized)** | → [`output-track2-keep-vocal-demucs-v2.mp3`](output-track2-keep-vocal-demucs-v2.mp3) |
| Remove Vocal v1 (direct) | [`output-track2-remove-vocal-demucs.mp3`](output-track2-remove-vocal-demucs.mp3) |
| **Remove Vocal v2 (speed-normalized)** | → [`output-track2-remove-vocal-demucs-v2.mp3`](output-track2-remove-vocal-demucs-v2.mp3) |

A/B the two acapellas: v2 keeps markedly more of the vocal and drops more
of the beat. Vet report: [`qa/reports/voice-realtrack-vet-track2.json`](../../../qa/reports/voice-realtrack-vet-track2.json).

## Track 1 — DJ UNIVXRSEL · DROLLXD SLOWED — nothing to isolate

**Diagnosis.** This one *sounds* like a separation failure (the acapella is
near-silent), but the study shows the model was **right**:

- vocals stem at −34 dBFS (0.1% of the separated energy);
- **no stem contains vocal-like content** — Silero over all four stems:
  vocals 0.004, other 0.001, drums 0.000, bass 0.005 mean probability;
- the track stays vocal-dead at every speed correction tried (×1.0 … ×2.17
  on the raw mix: ≤ 0.004 mean);
- instrumental ≈ the original mix (23.4 dB similarity), tempo 64.6 BPM —
  a slowed **instrumental** DJ edit.

If there are vocals in there, they are so processed (reverb wash, formant
shift) that neither the separator nor a dedicated voice detector can find
them. The near-silent acapella is the correct output — the same behavior
the [no-vocals fixture](../robustness/README.md) test verifies on purpose.

| Mode | Files |
|---|---|
| Input | [`DJ UNIVXRSEL - DROLLXD SLOWED - DJ UNIVXRSEL.mp3`](../../../DJ%20UNIVXRSEL%20-%20DROLLXD%20SLOWED%20-%20DJ%20UNIVXRSEL.mp3) |
| Keep Vocal (acapella — correctly near-silent) | [`output-track1-keep-vocal-demucs.mp3`](output-track1-keep-vocal-demucs.mp3) |
| Remove Vocal (karaoke ≈ the original) | [`output-track1-remove-vocal-demucs.mp3`](output-track1-remove-vocal-demucs.mp3) |

## The study tool

[`qa/voice_realtrack_study.py`](../../../qa/voice_realtrack_study.py)
(numpy + onnxruntime) — subcommands:

```
python3 qa/voice_realtrack_study.py speed   <input>            # tempo + slowed-edit detection, speed factors
python3 qa/voice_realtrack_study.py audit   <input> [stems]    # where did the vocal energy go
python3 qa/voice_realtrack_study.py vet     <old> <new>        # before/after verdict
python3 qa/voice_realtrack_study.py yield   <file>             # one-line vocal yield
python3 qa/voice_realtrack_study.py refine  <vocals> <other>   # mask-recover vocal content from 'other'
```

Audit reports from this study: [track1](../../../qa/reports/voice-realtrack-study-track1.json),
[track2](../../../qa/reports/voice-realtrack-study-track2.json).

## Notes

- Derivatives of the user's own files, personal evaluation — same
  personal/research-use terms as the Demucs weights
  ([`src/lib/demucs/LICENSE.md`](../../../src/lib/demucs/LICENSE.md)).
- Synthetic studies with exact ground-truth scoring:
  [`evidence/voice/listen/`](../listen/README.md) (main),
  [`evidence/voice/robustness/`](../robustness/README.md) (edge cases).
- Speed normalization is currently an offline technique (documented here);
  the in-app pipeline runs at native speed.
