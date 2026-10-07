# Slowed-track auto-fix — in-app speed normalization (E2E evidence)

"Slowed + reverb" edits (the dominant remix format on TikTok/YouTube) pitch the
whole production down — and the vocals drop below the pitch range Demucs
learned as "vocals". The fix, proven offline in the
[real-track study](../realworld/README.md), is now **automatic in the app**:

1. **Detect** — [`detectSlowedFactor`](../../../src/lib/vad.ts) runs Silero VAD
   on the clip. If the voice is already clearly detectable at native speed,
   stop after one cheap pass (normal and instrumental tracks: no-op). Otherwise
   candidate speed-ups (×1.15 / 1.3 / 1.45 / 1.6) are scanned; a factor is
   accepted only when voice detectability jumps decisively (≥3× mean, ≥5×
   voiced frames).
2. **Separate at the corrected speed** — the clip is resampled ×F faster
   (playbackRate semantics = the same pitch+time coupling the edits use), then
   run through the normal Demucs multi-pass pipeline.
3. **Restore the timing** — both stems are slowed back and padded/trimmed to
   the **exact input length**, so the isolated clip stays frame-aligned with
   the timeline.

A toggle next to the model picker (**Auto-fix slowed tracks**, on by default)
disables it; the action log shows `Slowed production detected (×F)` when it
fires.

Everything below ran through the real app pipeline (dev server + the app's own
modules and actions) by [`qa/voice-slowed-fix-e2e.mjs`](../../../qa/voice-slowed-fix-e2e.mjs) —
**12/12 PASS**, report: [`qa/reports/voice-slowed-fix.json`](../../../qa/reports/voice-slowed-fix.json).

## Results

| Case | Check | Result |
| --- | --- | --- |
| A | real "ultra slowed" track detected | **×1.45** picked on the full 108 s track (grid ×1.15→0.002, ×1.3→0.274, **×1.45→0.445**, ×1.6→0.335; native voice-detectability 0.0005) |
| C | normal-speed mix untouched | factor 1 after **one** Silero pass (baseline 0.823 = clearly voiced at native speed — the cheap guard) |
| B | synthetic slowed mix, forced fix | speed-corrected separation **+0.76 dB SI-SDR** vs direct (19.19 vs 18.43 dB against the slowed ground-truth voice); output restored to the **exact** input length (264,600 samples) |
| D | real track through the user-facing action | detection fired in the action log (×1.45), timing exact, and the fix **never degraded** the output on a prominent-vocal window (voice-like energy 0.981→0.992, recovery 0.405→0.419) |
| E | real track, buried-vocal window (78–84 s), forced ×1.45 | voice-like energy **51.9% → 78.3%**, Silero mean at natural pitch 0.444 → 0.679, voice recovery vs the mix **123% → 386%**, timing exact |
| F | instrumental mix (harmonic pad) through the auto action | detection scans all 4 factors — the pad scores 0.02–0.05 on Silero at every speed but never decisively — and correctly returns **factor 1**; acapella stays near-silent (**−63.5 dB** below the mix), timing exact |

## The honest picture (what the fix does and does not do)

Measuring the committed full-track outputs
([v1 direct](../realworld/output-track2-keep-vocal-demucs.mp3) vs
[v2 speed-fixed](../realworld/output-track2-keep-vocal-demucs-v2.mp3)) window
by window showed the gain is **not uniform**:

- **Prominent hooks** (42–66 s): direct separation already recovers the vocals
  even slowed; the fix is roughly neutral there (case D proves
  non-degradation). Silero *hearing* slowed vocals is also not the same as
  Demucs *separating* them — the loudest hook (42–51 s) is natively
  detectable by Silero (0.45–0.53) yet still benefits from the fix overall.
- **Buried vocals** (e.g. 78–84 s): the big win — 3× detectability on the
  full-track artifacts, and **51.9% → 78.3%** voice-like energy at 1-pass
  in-page (case E).
- **Full-track aggregate**: vocal-like energy 23.2% → 45.0%, voiced frames
  13.0% → 30.1%, +2.9 dB (see the
  [vet report](../../../qa/reports/voice-realtrack-vet-track2.json) and the
  [realworld pack](../realworld/README.md)).
- One section (18–30 s) measures slightly *better* without the fix — the
  correction is a per-track decision, not a per-section one, and the
  aggregate is strongly positive.

**Detection needs context.** A 6 s clip of *only* buried vocals does not fire
detection standalone (the mix buries the voice even when sped up); it fires on
hook-bearing material — in practice on whole tracks, which is exactly what the
app processes. Case E therefore forces the factor the full-track detection
chose (×1.45) to demonstrate the recovery on a buried-vocal window.

**CI limits, stated plainly.** The test sandbox (~3.9 GB RAM) OOMs the
renderer above ~6 s of separation at 2 passes (or 3 passes at any length), so
the E2E runs 6 s windows at reduced strength: B at 2-pass, D at 1-pass through
the full action path, E at 1-pass through the real separator. The
production-default (3-pass, full track) behavior is validated offline in the
[realworld evidence pack](../realworld/README.md) — same algorithm, bigger
canvas. The legacy suites also exceed this instance's memory —
[`qa/voice-demucs-model-e2e.mjs`](../../../qa/voice-demucs-model-e2e.mjs)
(20 s mix × 3 passes) and
[`qa/voice-demucs-robustness-e2e.mjs`](../../../qa/voice-demucs-robustness-e2e.mjs)
(two-evaluate action cases) both OOM here regardless of code path (probed with
the raw separator); their recorded evidence stands from the roomier instance
they ran on — the [listen pack](../listen/README.md) (model scoring, +20.4 dB
SI-SDR) and
[robustness report](../../../qa/reports/voice-demucs-robustness.json) (9/9). On this instance, the no-op regressions for the
detector are cases C (voiced mix) and F (instrumental) through the same action
path.

## Listen for yourself

Real track: **UPAST · HELLBLADE (Ultra Slowed)** — 60–66 s window (case D,
through the app's isolation action):

| | File |
| --- | --- |
| Input (slowed mix) | [`input-realtrack-segment.mp3`](input-realtrack-segment.mp3) |
| Old behavior (direct separation) | [`output-realtrack-direct-keep-vocal-demucs.mp3`](output-realtrack-direct-keep-vocal-demucs.mp3) |
| **New default (auto speed-fix ×1.45)** | [`output-realtrack-speedfix-keep-vocal-demucs.mp3`](output-realtrack-speedfix-keep-vocal-demucs.mp3) |

Real track: **78–84 s buried-vocal window** (case E — where the fix pays off;
forced ×1.45 through the real separator):

| | File |
| --- | --- |
| Input (slowed mix) | [`input-realtrack-buried-segment.mp3`](input-realtrack-buried-segment.mp3) |
| Direct separation | [`output-realtrack-buried-direct-keep-vocal-demucs.mp3`](output-realtrack-buried-direct-keep-vocal-demucs.mp3) |
| **Speed-fixed (×1.45, timing restored)** | [`output-realtrack-buried-speedfix-keep-vocal-demucs.mp3`](output-realtrack-buried-speedfix-keep-vocal-demucs.mp3) |

Synthetic showcase (TTS voice + pad bed, slowed ×0.75 — exact ground truth,
case B):

| | File |
| --- | --- |
| Input (slowed ×0.75) | [`input-showcase-slowed-x075.mp3`](input-showcase-slowed-x075.mp3) |
| Direct separation | [`output-showcase-slowed-direct-keep-vocal-demucs.mp3`](output-showcase-slowed-direct-keep-vocal-demucs.mp3) |
| **Speed-fixed (×4/3, timing restored)** | [`output-showcase-slowed-speedfix-keep-vocal-demucs.mp3`](output-showcase-slowed-speedfix-keep-vocal-demucs.mp3) |

The full-track before/after pairs (all 108 s, production strength) live in
[`evidence/voice/realworld/`](../realworld/README.md).

Instrumental input (case F — detection correctly declines; acapella of a
vocal-free mix):

| | File |
| --- | --- |
| **Keep Vocal output (near-silent, correct)** | [`output-instrumental-keep-vocal-demucs.mp3`](output-instrumental-keep-vocal-demucs.mp3) |

## Rerun

```bash
npm run dev                 # :5173
node qa/voice-slowed-fix-e2e.mjs
```

Requires `npm run fetch:demucs` (htdemucs + Silero VAD ONNX weights) and the
real track at the repo root
([`UPAST (Ultra Slowed) - HELLBLADE.mp3`](../../../UPAST%20%28Ultra%20Slowed%29%20-%20HELLBLADE.mp3)).
Cases cache per-step in tmp and resume after crashes.

## Notes

- Derivatives of the user's own files, personal evaluation — same
  personal/research-use terms as the Demucs weights
  ([`src/lib/demucs/LICENSE.md`](../../../src/lib/demucs/LICENSE.md)).
- Related packs: [`listen`](../listen/README.md) (main scoring),
  [`robustness`](../robustness/README.md) (edge cases),
  [`realworld`](../realworld/README.md) (full-track study & the v2 fix).
