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

### Run 4 — oracle-IRM loss + bed augmentation, started 2026-10-07

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
  - (run 4 in progress — final counts recorded at completion)
