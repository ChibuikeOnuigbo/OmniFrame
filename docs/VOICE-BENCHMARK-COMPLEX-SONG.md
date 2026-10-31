# Voice isolation / vocal reduction — complex-song benchmark

Recheck of every shipped separation engine against the hardest user file in
the repo, `UPAST (Ultra Slowed) - HELLBLADE.mp3` (108.3 s — slowed + heavy
reverb, the DeVoice-style worst case: pitched-down, smeared vocals whose
reverb tails sit in the stereo side).

## How it was tested (real product code, no re-implementations)

- Decode: `tools/voice_benchmark.py` (soundfile -> 44.1 kHz float32 stereo).
- DSP engine: `qa/voice-complex-song-run.mjs` bundles the actual
  `src/lib/voiceIsolation.ts` and calls `isolateVoiceFromAudioBuffer`
  (remove_vocal + keep_vocal, strength 0.92) in Node.
- Neural engine: `qa/voice-demucs-song-run.mjs` loads the real
  `public/models/htdemucs.onnx` (174 MB, `npm run fetch:demucs`) through the
  vendored product code (`ONNXHTDemucs.forward` + `separateTracks`
  overlap-add) via onnxruntime-web WASM in Node — the same runtime the
  browser ships. Full-track STFT exceeds sandbox memory, so Demucs is
  measured on a 45 s excerpt (10 s-55 s); DSP is measured on both.
- Metrics ("pool" = pooled frame statistics): 25 ms frames, 10 ms hop,
  stereo power (never mono-mixed — (L+R)/2 would cancel the side channel),
  reporting mean +/- std and p10/p50/p90 for frame RMS (dBFS), spectral
  centroid, and vocal-band (140 Hz-7.5 kHz) energy fraction. "Vocal-active"
  frames are labelled heuristically from the keep-vocal stem (no ground
  truth stems exist for this song), so cross-engine suppression numbers are
  comparative, not absolute SI-SDR.

## Bug found and fixed by this recheck

The Demucs **vocals stem contained 17,332 NaN samples**: the last 2,476
samples of every 7.8 s chunk. Cause: `istft` in `src/lib/demucs/dsp.js`
subtracted the center-padding `nFft` even when an explicit output length
was given, so `ispec`'s crop read past the array end (2,476 = the exact
shortfall). Fixed to torch semantics (explicit length is final), plus a
non-finite guard in the overlap-add normalizer in `src/lib/demucs/apply.js`.
After the fix: **0 non-finite samples** in all stems, demucs chunked parity
suite still 6/6.

## Improvement shipped (DSP remove_vocal)

Slowed + reverb leaks voice into the stereo side, which pure center
cancellation cannot touch. Added a vocal-activity gate: envelope followers
(3 ms attack / 150 ms release) estimate center dominance of the vocal band;
while a centered voice is active, side energy is trimmed (strength-scaled,
0.25 floor); while stereo content dominates, the side passes untouched.

### Full song (108.3 s), DSP before -> after

| metric | before | after |
|---|---|---|
| vocal-band suppression, vocal frames | 6.91 dB | 8.12 dB |
| vocal-band suppression, non-vocal | 5.84 dB | 9.17 dB |
| whole-signal suppression, vocal frames | 1.76 dB | 1.95 dB |
| instrumental retention, non-vocal | -2.87 dB | -4.77 dB |
| instrumental RMS mean +/- std (dBFS) | -13.91 +/- 18.68 | -14.78 +/- 19.44 |
| instrumental centroid mean | 2661.0 Hz | 2882.0 Hz |

### 45 s excerpt, three engines

| metric | DSP before | DSP after | Demucs (htdemucs) |
|---|---|---|---|
| vocal-band suppression, vocal frames | 7.05 dB | 8.17 dB | 5.58 dB |
| whole-signal suppression, vocal frames | 2.15 dB | 2.39 dB | 3.64 dB |
| instrumental retention, non-vocal | -2.17 dB | -2.83 dB | -0.83 dB |
| vocal stem RMS mean +/- std (dBFS) | -8.64 +/- 4.17 | -8.64 +/- 4.17 | -18.83 +/- 8.91 |
| vocal-band fraction, vocal stem | 0.778 | 0.778 | 0.905 |
| instrumental centroid mean | 2743.0 Hz | 2971.0 Hz | 1851.0 Hz |

## Reading the numbers honestly

- The DSP vocal-band suppression figures flatter the DSP engine: the
  vocal-active labels come from its own keep-vocal stem, and center
  cancellation suppresses *everything* centered in that band (voice and
  instruments alike; see the retention cost). It is a karaoke extractor,
  not a separator.
- Demucs is the real separator: quietest, sparsest vocal stem
  (-18.83 dB mean with phrase-level dynamics), 0.90
  vocal-band concentration, best music retention
  (-0.83 dB) and an instrumental
  centroid closest to the mix (no karaoke brightening). The benchmark ran
  it **raw** — the product pipeline additionally applies slowed-track
  speed correction and the Silero VAD speech gate, which target exactly
  this song class and were not part of this offline run.
- DSP whole-signal suppression stays ~2 dB because bass (<140 Hz, kept in
  mono) and air (>7.5 kHz, kept) bands dominate total energy on this song;
  that preservation is by design.

## Graphs

- `evidence/voice/bench-after-curves.png`, `-spectrograms.png`,
  `-pooled.png` (full song, DSP after; `bench-before-*` for the old engine)
- `evidence/voice/excerpt/` — the same 45 s through all three engines
  (curves, spectrograms, pooled charts, stats JSON)

## Regression coverage for this wave

`qa/demucs-chunked-parity.mjs` 6/6, `qa/audio-isolation-panel-e2e.mjs` PASS,
`qa/audio-vocal-patch-e2e.mjs` PASS, `qa/demucs-model-unavailable-e2e.mjs`
6/6, `npm run typecheck` clean.
