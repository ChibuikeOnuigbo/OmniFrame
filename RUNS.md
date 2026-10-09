# Model training runs

Honest, exact training records for the in-house models. Every count below is
read from the trainer's own checkpoint/log output — nothing extrapolated.

## omni-unified-v1 — unified isolation + denoise + normalize (Req 17)

- **Script**: `scripts/python/train_unified.py` (on-the-fly corpus, fully
  deterministic per step; checkpoint/resume).
- **Architecture** (`UnifiedNet`): Linear(771→192)+ReLU → GRU(192, 1 layer) →
  sigmoid mask head (192→257) + loudness head (mean-pooled states → 192→32→1
  sigmoid → gain dB in ±12). **426,387 parameters**, exported to ONNX
  (opset 18, weights inlined) at `public/models/omni-unified-v1.onnx`.
- **Domain**: 16 kHz mono, STFT n_fft 512 / hop 128 / centered, hann window
  matching the JS runner formula exactly (`js_hann`), rfft layout (257 bins),
  per-frame normalization `log10(|S|+1e-4)`, MU −0.3883 / STD 0.7965
  (measured on this corpus via `--recalibrate`), 3-frame context stack.
- **Corpus (synthesized per step, ground truth known)**: random crop of one
  of 6 TTS voice fixtures × one of 5 music beds at −5…+15 dB voice/music SNR
  × white/pink/hum noise at 0…30 dB SNR; targets are the clean components
  (mask: clean voice magnitude; loudness head: the finalizer-equivalent gain
  to −18 dBFS RMS, ±12 dB window, near-silence skip).
- **Loss**: L1 in log10-magnitude domain + 0.3 × L1(gain dB).
- **Batch**: 16 snippets × 0.5 s (63 STFT frames) → 1,008 frames per step.

### Run 0 — ABORTED at 22,000 steps (corpus bug)

The first run trained 22,000 steps before a browser-parity investigation
revealed the music beds were being read **raw** (44.1 kHz stereo files fed
to the 16 kHz pipeline unresampled): every bed played ~3x slowed and
pitch-shifted down. The model reached +11 dB SI-SNR on corpus-style mixes
but +0.0 dB on correctly-decoded (true-pitch) beds in the browser — the
decisive clue. `load_wav_mono` now FFT-resamples to 16 kHz (bandlimited,
verified: no energy above 7.9 kHz after resampling). Checkpoint discarded;
MU/STD re-measured on the fixed corpus (-0.3685 / 0.7878) and synced to the
trainer, the JS runner and the E2E.

### Run 1 — fixed corpus, INTERRUPTED by a sandbox reset at ~20,000 steps

The workspace reset (gitignored files wiped) discarded the checkpoint.
Recovery: all code was pushed; the trainer now also writes a
model-only snapshot (1.7 MB) that gets COMMITTED, so future resets resume
from the last committed weights instead of restarting.

### Run 2 — ABORTED at 30,000 steps (loss upgrade)

Oracle analysis on the E2E mix: the ideal-ratio mask (|V|/|X|, mix phase)
reaches **+9.74 dB SI-SNR**, but the magnitude-L1-only objective left the
model's mask 0.39 L1 away from oracle after 30k steps (+1.7 dB SI-SNR,
plateauing). Run 3 adds a direct L1(mask, oracle_IRM) supervision term —
the standard strongest signal for ratio masking — and restarts (the 30k
steps were ~25 min of compute).

### Run 3 — ABORTED at 25,000 steps (bed augmentation)

Oracle-IRM supervision worked (+3.07 dB at 10k vs +0.5 dB run 2) but a
per-bed breakdown at 20k showed the harmonic beds are the bottleneck:
arp-synth +2.5 dB / pad-chords +3.1 dB vs drums-groove +8.8 dB /
full-band +8.2 dB at 0 dB SNR. Only 2 of 5 bed draws are harmonic, so the
hard cases were under-sampled.

### Run 4 — ABORTED at 35,000 steps (architecture sizing)

Bed augmentation improved the easy beds (ambient +5.2 -> +6.1) but the
harmonic ceiling held (arp-synth +2.9, pad-chords +3.6 at 30k; E2E mix
+3.45 dB) — the 426K model is capacity-limited on voice-vs-pad harmonic
discrimination, not data-limited.

### Run 5 — FINAL architecture (hidden 224, ctx 5, 655K params), started 2026-10-07

- Same as run 3 plus: 80% of bed crops get a random pitch/speed factor
  (0.72-1.4, FFT-domain bandlimited resample) and 50% random time-reversal
  — multiplies effective harmonic-interference variety. The voice (target)
  is never augmented.

- Command: `python3 scripts/python/train_unified.py --steps 1000000
  --save-every 10000 --threads 2`
- Throughput: ~20 optimizer steps/s (measured on run 0; same config).
- **Progress** (updated per checkpoint; `step` is optimizer updates, each
  consuming 16 × 63 = 1,008 labeled frames). Reference points from run 1
  (same fixed corpus, same seed):
  - step 10,000: mask loss 0.337, gain loss 2.54 dB; +2.6 dB SI-SNR on the
    hard E2E mix, +3.4..+7.2 dB on training-distribution mixes; browser
    runner bit-faithful vs torch (mask parity 2.1e-6).
  - run 2 reference points (magnitude-L1 only): step 10k +0.5 dB / 30k
    +1.7 dB SI-SNR on the E2E mix, mask-vs-oracle L1 0.385.
  - run 3 reference points: 10k +3.07 dB / 20k +3.28 dB on the E2E mix;
    training-distribution mean improvement +6.37 dB at 20k; per-bed at 0 dB
    SNR: drums +8.8, full-band +8.2, ambient +5.2, pad-chords +3.1,
    arp-synth +2.5.
  - run 4 reference points (30k, warm-started from run 3's 20k): ambient
    +6.1, arp-synth +2.9, drums +9.0, full-band +8.5, pad-chords +3.6;
    E2E mix +3.45 dB.
  - (run 5 in progress — final counts recorded at completion)
  - **run 5 live**: step 10k E2E +3.19 dB (per-bed @0 dB: drums +9.83,
    full-band +8.91, ambient +5.40, pad-chords +3.01, arp +1.69); sandbox
    reset #7 forced a model-only warm restart (fresh optimizer) at 10k —
    step 20k E2E +2.35 dB (ambient +5.28, arp +2.03, drums +8.64,
    full-band +7.93, pad +3.81), irm 0.160, keep_vocal GRADE A on both
    strict-grader evidence mixes (87.2% / 86.4% speech, +82.8 / +83.2
    content dominance); step 70k E2E **+3.15 dB**, irm 0.137, gain 1.76 dB,
    parity mask 3.2e-6 / gain 0.0000 dB.
  - **finalizer wired @70k** (was designed in commit 1c3e2f3 — wasm
    `omni_normalize` + bit-verified JS fallback — but the pipeline call
    site was never committed): every engine's output is now DC-blocked and
    RMS-normalized to −18 dBFS (0.98 peak ceiling, +12/−6 dB gain window,
    <−50 dBFS skipped). E2E bars updated to the post-normalization
    contract: keep loudness −19.60 dBFS (window −30..−12), remove lands
    exactly −18.00, music preservation is now CONTENT-based (SI-SNR vs the
    bed: 5.75 dB vs mix baseline 0.5 dB, bar +3 dB over mix), strength
    knob gain-invariant (gentle 2.61 < default 3.10 dB SI-SNR). 16/17
    PASS; remaining fail is the training bar: keep SI-SNR +3.10 vs
    mix+6 = +3.99.
  - step 110k: keep SI-SNR **+3.82 dB** (0.17 dB under the mix+6 bar),
    music content 6.70 dB vs mix 0.5 (+6.2 over mix), loudness −19.83,
    remove −18.00 exact, parity mask 4.0e-6 / gain 0.0000 dB, irm 0.150.
  - **step 160k: the E2E keep bar CROSSED — 17/17 ALL PASS.** keep SI-SNR
    **+4.04 dB ≥ mix+6 (−2.01+6 = +3.99)**, music content 7.01 dB vs mix
    0.5 (+6.5 over mix), remove −18.00 exact, irm 0.121. Self-check SNR
    13.92 dB.
  - **step 160k strict-grader evidence: all three unified outputs GRADE
    A.** keep noisy-speech 83.4% speech +77.8; keep song 86.4% +82.7;
    **remove_vocal residual speech 0.00%** (<5% bar; 16.4% at 20k),
    music 79.6% +79.6 dominance. Pack 17/28 — every remaining fail is a
    documented pre-finalizer historical artifact, none from the current
    3-engine stack.
  - step 310k: keep SI-SNR **+4.34 dB** (margin +0.35 over the mix+6
    bar), music content 7.38 dB (+6.9 over mix), self-check 14.14 dB,
    E2E 17/17 PASS. All bars holding with growing margin.
  - **step 510k (halfway):** keep +4.31 dB, music 7.23 dB, self-check
    15.97 dB (steady climb: 13.92 @160k → 14.14 @310k → 15.97 @510k),
    E2E 17/17 PASS. Bars stable above the contract.
  - step 700k: keep **+4.40 dB** (best yet; +0.41 over bar), music 7.39
    dB, self-check 15.54 dB, E2E 17/17 PASS. Trajectory 160k→700k:
    +4.04 → +4.34 → +4.31 → +4.40.
  - **sandbox reset #8** (2026-10-08 ~11:45 UTC) destroyed the on-disk
    700k→1.02M segment: the optimizer state, the two unpushed snapshot
    commits (@800k, @910k) and the finished 1.02M export were lost; the
    last PUSHED snapshot (@700k, d8f4d55) survived. Pre-reset reference
    numbers (measured before the loss, same run/seed/architecture):
    @800k keep +4.37, @910k keep **+4.56**, @1.02M keep **+4.64** with
    E2E 18/18 ALL PASS and strict-grader evidence all GRADE A (keep
    84.5/87.1% speech; remove 0.00% residual speech, 79.6% music) —
    the re-run below must re-earn those numbers.
  - **re-run from the @700k snapshot** (warm start, fresh optimizer, same
    discipline as the 10k restart): target 1,020,000 total optimizer
    steps (>1000k requirement). Recovery: fetch+reset --hard, pip/npm
    reinstall, beds+voice fixtures regenerated, htdemucs.onnx refetched
    (3rd time), vite + trainer restarted.
  - **step 1,020,000 — RUN 5 COMPLETE (2026-10-08 ~16:15 UTC).** The final
    weights' path consumed 700k (segments 1–2) + 320k (re-run) =
    **1,020,000 optimizer updates**. Final numbers: keep SI-SNR
    **+4.28 dB** (bar mix+6 = +3.99, margin +0.29), music content 7.20 dB
    vs mix 0.5 (+6.7 over mix), remove separation 18.2 dB (keep −4.28 vs
    remove −13.93), loudness −20.11 dBFS (finalizer −18 target window),
    remove lands exactly −18.00, parity mask 7.5e-6 / gain 0.0000 dB,
    self-check 14.20 dB. **E2E 18/18 ALL PASS.** Strict grader @1.02M:
    keep noisy-speech 83.96% speech +79.6 (GRADE A), keep song 85.71%
    +80.9 (GRADE A), **remove_vocal 0.00% residual speech / 79.57% music /
    +79.6 (GRADE A)**, RNNoise 81.28% +78.1 (GRADE A). The re-run's final
    numbers sit ~0.3 dB under the lost pre-reset 1.02M export (+4.64) —
    the honest cost of the reset #8 warm restart; every bar still passes.
  - Run 5 total wall time: ~16.5 h across 8 sandbox resets/restarts;
    irm_loss 0.297 (10k) → 0.121 (best, 160k) → 0.128 (final).

## Regression sweep 2026-10-08 (post-finalizer, req 17 "keep testing and improving")

- **Sandbox reset #10** (~20:55 UTC): working tree wiped mid-sweep, zero loss
  of pushed work (2979f24 safe). Recovery + full fix re-application landed as
  6029042 — this time committed immediately after verification (the reset
  lesson, honored).
- Sweep results (all green): inspector-audio-all-clips **27/27** (stale
  "AI Denoise ONNX offered" checks replaced with two-way mode-gating
  verification — keep_vocal must offer AI Denoise+RNNoise+Demucs+unified,
  remove_vocal must hide the keep-only engines), audio-waveform 9/9,
  ai-denoise 11/11, loudness 7/7, rnnoise E2E, audio-section-context-dismiss,
  omni-unified E2E, marker-audiometer 19, voice-isolation 30, media-library
  20, timeline-controls 16, context-menu 62, timeline-ruler 37, rubber-band
  25, gap-tools 31, tooltip-dock 17, boundary-clips, timeline-rebuild,
  landing 25, supreme-master-command 14/14, marker-navigation 12/12,
  stress 109, advanced 43, e2e.mjs smoke, master-rebuild, voice-slowed-fix
  18/18, voice-tts-mix-isolation 24, voice-isolation-stress-1000 (1000
  iterations, 3/3 checks), source-preview-oop-tracks, sidebar-segmentation
  21/21, collapse-popout 49, panels-cursor-declutter 18/18, ui-declutter,
  cursor-frame, cursor-visibility, ratio-dropdown, cluster-fixer,
  compound-clip, drawing-layout, keyframe-graph-3d, layout-selection-mask,
  masking-tracking 12/12, onion-skin, pointer-events, recolor-chair 6/6,
  fill-hair-recolor, responsiveness, blender-rotation, three-d-video-plane,
  towel-masking 39, krita-transparency, unified-preview-text-effects 21,
  omniframe cluster (clean-infill, mode-drawing-mask, mode-vetting,
  recolor-blend 20, selection-masking), roto-isolation-browser 13 PASS +
  3 SKIP (held-out fixtures not redistributable — expected).
- **demucs robustness 9/9 PASS** after environment + product fixes:
  - Product: inter-pass WASM heap reclaim wait 1.5 s → 8 s on the WASM path
    (RSS profiling: ~3 GB heap mostly back ~3 s after worker terminate but
    keeps settling; 1.5 s let pass 2 OOM the renderer on a 4 GB machine).
    Confirmed by direct experiment that a second session.run in the SAME
    worker also OOMs (heap grows monotonically per run) — the
    throwaway-worker-per-pass design is correct and now documented.
  - Test env: --disable-gpu (audio-only cases, ~100 MB back) +
    speedNormalize:false on the synthetic fixtures (slowed path covered by
    voice-slowed-fix 18/18) + **a 2 GB swapfile** — the decisive lever: two
    sequential ~3.1 GB pass spikes + ~450 MB node/vite/chromium overhead
    exceed the 3.9 GB sandbox by ~100-200 MB; with swap the full
    strength-0.75 two-pass profile passes (mono/48kHz/short/two-speakers,
    both modes, 7 separations, 9/9).
  - demucs model E2E re-verified post-reset: 6/6, identical numbers
    (SI-SDR 18.38, bleed −50.41, pauses −19.3 below speech).
  - Parity suites re-verified: chunked 6/6, native-dsp 20/20, rnnoise ALL.
- Probe-noise fix: isDemucsModelAvailable now caches its session promise
  (the inspector re-mounts per clip selection; uncached, it re-HEADed the
  174 MB asset's metadata and chromium dedup-aborts the rapid duplicates —
  net::ERR_ABORTED request-failure noise). audio-waveform/advanced/stress
  filters now allow the known-benign aborted /models/* HEADs.
- Sandbox ops notes (resets #9/#10): playwright's bundled ffmpeg can't be
  installed (cdn.playwright.dev blocked) — @ffmpeg-installer/ffmpeg via npm
  dropped into ~/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux works for
  video recording (advanced-e2e). opencv-python-headless needed for the
  OpenCV frame-inspection suites. Swap: `sudo fallocate -l 2G /swapfile &&
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon
  /swapfile` (passwordless sudo available; swap dies with each reset).

## Audit + bundle round 2026-10-09 (post-reset #11)

- **Sandbox reset #11** (~1 h after #10, mid-build): recovery via the
  documented sequence — reset --hard to 6f22ae2, pip/npm install, fixtures +
  htdemucs.onnx regenerated, ffmpeg workaround, `sudo bash
  scripts/ensure-swap.sh`, vite restart. Zero loss.
- **Bundle**: production build verified (first time in the sweep). Lazy-load
  onnxruntime-web (vad.ts was its only static importer): main JS 1840 ->
  1435 KB (-22%, gzip 485 -> 375 KB); ORT now splits into its own chunk and
  is NOT fetched on initial load (verified against vite preview: single
  index-*.js request, app renders, zero errors). 5 ineffective dynamic
  imports fixed (loudness/rotoBrush/aiDenoise in store.ts, self-importing
  rotoModels in store/rotoMask.ts); 8 warnings -> 4 (rest intentional).
- **UI audits all clean** (first zero-findings state): affordance 0 (was 84
  TINY + 1 dup-testid) via CollapseChip 20 -> 24 px hit target + unique
  inspector-rail-float-btn testid; overflow 0 (was 13 CLIP) — the CLIP rule
  now honors scrollable descendants (reachability), the left-panel finding
  was a false positive (probe: column sums exactly; inner scroller scrolls);
  strict audit 0 findings; density 0; drawing-2d 101/101.
- Non-E2E qa scripts all run: rigging-unit 43/43, rigging-smoke 15/15,
  source-scan, chair probes.
- Post-change verification: ai-denoise 11/11, rnnoise E2E, loudness 7/7,
  omni-unified E2E, voice-isolation 30, demucs model E2E 6/6 (18.4 dB),
  rotomask 19/19, roto-isolation 13 PASS + 3 known SKIPs, towel-masking
  39/39, voice-slowed-fix 18/18 (VAD-heavy path through lazy ORT),
  panels-cursor-declutter 18/18, collapse-popout 49, sidebar-segmentation
  21/21, tooltip-dock 17, e2e smoke, tsc clean.

## Guard + a11y round 2026-10-09 (post-reset #12)

- **Sandbox reset #12**: recovery via the new one-command
  `scripts/recover-sandbox.sh` (git reset, swap, pip, npm, fixtures, model,
  ffmpeg workaround) — idempotent, wrote it after 12 resets.
- **New guards**: qa/demucs-model-unavailable-e2e.mjs (weights blocked →
  graceful degradation, 6/6) with an actionable download-error message in
  demucs-worker.ts; qa/bundle-budget-e2e.mjs (production build + preview:
  exactly one initial JS file, 1.6 MB/480 KB decoded/compressed budgets,
  ORT must stay deferred, FCP recorded — 6/6, currently 1401 KB/364 KB,
  FCP 328 ms).
- **axe-core accessibility** (new qa/axe-a11y-e2e.mjs): 14 surfaces
  scanned. First run found real issues on 13/14; fixed all ten classes —
  pinch-zoom was blocked (viewport meta), 7 effect sliders unlabeled
  (critical), aria-label on non-interactive trim divs, 7 accessible-name
  mismatches (visible text not in the name), title-only select label,
  low-contrast 9px subtitles. Now 14/14 clean; touched-component E2Es
  re-verified green.
