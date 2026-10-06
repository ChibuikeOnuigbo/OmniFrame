# Voice Isolation — input ↔ output pairs (listen pack)

The actual audio the voice-isolation test runs on, and what the model produced
— committed here so you can play them straight from the repo. Every
`input_(name).mp3` pairs with its `output_(name).mp3` (same duration, A/B them
directly).

| Pair | Input | Output | What to listen for |
|---|---|---|---|
| 1 | `input_mix-showcase.mp3` (20s) | `output_mix-showcase.mp3` | TTS narration mixed at 0 dB SNR with the full-band music bed → **Keep Vocal** at 0.92 strength. The music/instruments collapse, the narration survives, sub-80 Hz rumble disappears. |
| 2 | `input_test-audio-6s.mp3` (6s) | `output_test-audio-6s-keep-vocal.mp3` | The shared E2E fixture → **Keep Vocal** (isolated voice). |
| 3 | `input_test-audio-6s.mp3` (6s) | `output_test-audio-6s-remove-vocal.mp3` | Same fixture → **Remove Vocal** (instrumental, bass preserved). |

Full-fidelity sources for pair 1 (the study case) sit one level up:

- Input: `evidence/voice/mix-showcase-input.wav`
- Output (what the app produced): `evidence/voice/mix-showcase-isolated.wav`

## How these were produced

1. `qa/voice-tts-mix-isolation-e2e.mjs` builds the mixture from the TTS corpus
   (`qa/assets/voice/tts-f1-technical.mp3`) + the deterministic music bed
   (`qa/generate-music-beds.mjs`), imports both through the real media panel,
   runs **Keep Vocal** through the real UI, and saves the produced WAV. That
   run passes 24 checks, including FFmpeg verification: side channel −200 dB
   (instruments fully collapsed), sub-80 Hz −8 dB, speech band ±0.1 dB.
2. `qa/voice-isolation-listen-pack.mjs` runs the production
   `executeVoiceIsolationForClip()` (`src/lib/voiceIsolation.ts`, model
   `omni-voicetarget`) on `qa/fixtures/test-audio-6s.ogg` for both modes and
   encodes all pairs to MP3 (libmp3lame, -q:a 2) into this folder.

Regenerate: `node qa/voice-tts-mix-isolation-e2e.mjs && node qa/voice-isolation-listen-pack.mjs`
