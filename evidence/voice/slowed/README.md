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

A toggle next to the model picker (**Correct slowed + reverb**, on by default)
disables it; the action log reports `Slowed production correction ×F` when it
fires.

Everything below ran through the real app pipeline (dev server + the app's own
modules and actions) by [`qa/voice-slowed-fix-e2e.mjs`](../../../qa/voice-slowed-fix-e2e.mjs) —
**18/18 PASS** on 12 Oct 2026, report: [`qa/reports/voice-slowed-fix.json`](../../../qa/reports/voice-slowed-fix.json). Memory-constrained action cases use one separation pass and short excerpts; full-track production-strength results are separately documented below.

## Results

| Case | Check | Result |
| --- | --- | --- |
| A | real "ultra slowed" track detected | **×1.45** picked on the full 108 s track (grid ×1.15→0.002, ×1.3→0.277, **×1.45→0.440**, ×1.6→0.337; native voice-detectability 0.0005) |
| C | normal-speed mix untouched | factor 1 after **one** Silero pass (baseline 0.823 = clearly voiced at native speed — the cheap guard) |
| B | synthetic slowed mix, forced fix | On the 5 s slowed fixture, corrected separation gains **0.79 dB SI-SDR** vs direct (20.75 vs 19.96 dB against ground truth); output restored to the **exact** input length (220,500 samples). One pass on this memory-constrained run; case N separately checks the DSP averaging core. |
| D | real 60–64 s excerpt through the user-facing action | Auto correction fired at ×1.45 and preserved exact timing; on this prominent-vocal excerpt it did not degrade the output (voice-like energy 0.983→0.991, recovery 0.100→0.108). |
| E | real 78–82 s buried-vocal excerpt, forced ×1.45 | At one pass, voice-like energy **50.1% → 68.7%** (+18.6 percentage points), Silero mean at natural pitch 0.608→0.709 (+16.6%); measured recovery vs the mix **81% → 170%**; timing exact. The test gate requires >10% mean gain and >10 percentage points—not parity or perceptual quality. |
| F | 5 s instrumental mix (harmonic pad) through the auto action | Detection scans all 4 factors—the pad scores 0.02–0.05 on Silero at every speed but never decisively—and correctly returns **factor 1**; acapella stays near-silent (**−63.2 dB** below the mix), timing exact. |
| R | resampler fidelity | the polyphase sinc in `renderAtRate` measures **67.2 dB** (×1.45) / **76.6 dB** (×4/3) bandlimited round-trip SNR — WebAudio's `playbackRate` rendering, which the feature originally used, measures **10.5–11.4 dB** (audible grit on every speed-fixed output) |
| G | **natural-pitch output** | keep_vocal with `speedOutput: 'natural'` returns the acapella at the corrected speed — 4 s input became **2.759 s** at ×1.45; asset is named `… · natural pitch`. Silero heard the raw output directly (mean 0.967, 99% voiced); peak |sample| 0.710, zero non-finite. |
| N | **native DSP core** (new) | the compiled C++→wasm core (`native/dsp-core/omni_dsp.cpp`, ~11 KB) is instantiated through the real app pipeline, and every DSP op above ran natively with **max|diff| 0.0 vs the pure-JS fallbacks** (resample, LS de-leak, pass averaging, peak scale — bit-identical, not just within tolerance; 2.3–2.5× faster on the 108 s track) |
| M | **model-load progress** (new) | a web model download streams real byte counts into a smooth monotonic progress card — phases download → compile → ready, 100% only when true, auto-dismiss on success; the same pipeline covers Demucs v4 (174 MB, streamed through the worker boundary), the roto/SAM catalog (4–170 MB), denoise and Silero. Desktop loads from disk so its cards flash by |

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
- **Buried vocals** (e.g. 78–84 s): the full-track artifacts show a large
  detectability gain; the current 4 s in-page excerpt (78–82 s) improves
  voice-like energy **50.1% → 68.7%** at 1-pass (case E). The exact gain varies
  with the crop; this is a small excerpt, not full-song parity.
- **Full-track aggregate**: vocal-like energy 23.2% → 45.0%, voiced frames
  13.0% → 30.1%, +2.9 dB (see the
  [vet report](../../../qa/reports/voice-realtrack-vet-track2.json) and the
  [realworld pack](../realworld/README.md)).
- One section (18–30 s) measures slightly *better* without the fix — the
  correction is a per-track decision, not a per-section one, and the
  aggregate is strongly positive.

**Detection needs context.** A short clip of *only* buried vocals does not
fire detection standalone (the mix buries the voice even when sped up); it
fires on hook-bearing material — in practice on whole tracks, which is exactly
what the app processes. The current E2E confirms the 78–82 s excerpt alone
returns factor 1; case E therefore forces the ×1.45 factor chosen on the full
track to measure recovery in that buried-vocal window.

**The natural-pitch finding (why "still horrible" was right).** Measured on
the full track with the committed v3 artifacts: the SAME separated stems
score **87.7%** voice-like energy at natural pitch but only **43–45%** at the
slowed time base — the vocals were always in there; playing them back at the
edit's slowed pitch (deep, muddy, reverb-smeared) is what sounds bad. The
acapella *cannot* be both timeline-aligned and natural-pitched — so the app
now offers both: **restore timing** (default, frame-aligned) or **Vocals at
natural pitch** (toggle; the output comes back at the track's original
tempo, e.g. 6.0 s → 4.14 s at ×1.45). Full-track proof:
[output-track2-keep-vocal-naturalpitch-v3.mp3](../realworld/output-track2-keep-vocal-naturalpitch-v3.mp3)
(88% voice-like energy, +2.9 dB, zero clipping —
[vet report](../../../qa/reports/voice-realtrack-vet-track2-v3.json)).

**CI limits, stated plainly.** The browser sandbox can OOM when the sped
signal crosses Demucs' 5.85 s chunk stride or when multiple passes retain too
much WASM memory. The current E2E uses a 5 s slowed synthetic fixture and 4 s
real excerpts (×1.45 produces 5.8 s) at one pass, keeping each model run to one
chunk. The production-default (3-pass, full track) behavior is validated
offline in the [realworld evidence pack](../realworld/README.md) — same
algorithm, larger memory budget. The legacy suites also exceed this instance's memory —
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

Real track: **UPAST · HELLBLADE (Ultra Slowed)** — 60–64 s window (case D,
through the app's isolation action; shortened to keep ×1.45 inference within a
single Demucs chunk):

| | File |
| --- | --- |
| Input (slowed mix) | [`input-realtrack-segment.mp3`](input-realtrack-segment.mp3) |
| Old behavior (direct separation) | [`output-realtrack-direct-keep-vocal-demucs.mp3`](output-realtrack-direct-keep-vocal-demucs.mp3) |
| **New default (auto speed-fix ×1.45)** | [`output-realtrack-speedfix-keep-vocal-demucs.mp3`](output-realtrack-speedfix-keep-vocal-demucs.mp3) |

Real track: **78–82 s buried-vocal window** (case E — where the fix pays off;
forced ×1.45 through the real separator; 4 s source excerpt):

| | File |
| --- | --- |
| Input (slowed mix) | [`input-realtrack-buried-segment.mp3`](input-realtrack-buried-segment.mp3) |
| Direct separation | [`output-realtrack-buried-direct-keep-vocal-demucs.mp3`](output-realtrack-buried-direct-keep-vocal-demucs.mp3) |
| **Speed-fixed (×1.45, timing restored)** | [`output-realtrack-buried-speedfix-keep-vocal-demucs.mp3`](output-realtrack-buried-speedfix-keep-vocal-demucs.mp3) |

Synthetic showcase (TTS voice + pad bed; 3.75 s native fixture slowed ×0.75 to
5 s — exact ground truth, case B):

| | File |
| --- | --- |
| Input (slowed ×0.75) | [`input-showcase-slowed-x075.mp3`](input-showcase-slowed-x075.mp3) |
| Direct separation | [`output-showcase-slowed-direct-keep-vocal-demucs.mp3`](output-showcase-slowed-direct-keep-vocal-demucs.mp3) |
| **Speed-fixed (×4/3, timing restored)** | [`output-showcase-slowed-speedfix-keep-vocal-demucs.mp3`](output-showcase-slowed-speedfix-keep-vocal-demucs.mp3) |

Real track: **natural-pitch acapella** (case G, 4 s window at 1-pass; the
full-track production-strength version is linked above):

| | File |
| --- | --- |
| **Vocals at natural pitch (×1.45, not slowed back)** | [`output-realtrack-naturalpitch-keep-vocal-demucs.mp3`](output-realtrack-naturalpitch-keep-vocal-demucs.mp3) |

The full-track before/after pairs (all 108 s, production strength) live in
[`evidence/voice/realworld/`](../realworld/README.md).

Instrumental input (case F, 5 s — detection correctly declines; acapella of a
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
