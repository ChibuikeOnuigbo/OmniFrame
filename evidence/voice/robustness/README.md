# Voice isolation — robustness & generalization tests (listen pack)

Edge cases and mix types the main study does not cover, with the input and
output side by side so you can play them straight from the repo. Everything
was produced by the real app engine (Demucs v4 htdemucs, 3-pass
shift-averaged + LS cross-talk removal, VAD gate where noted).

## Where everything lives

| What | Where |
|---|---|
| **This pack** (edge cases, MP3 pairs) | `evidence/voice/robustness/` |
| Main listen pack (showcase A/B, DSP comparison) | `evidence/voice/listen/` |
| Full-fidelity WAVs of the main study (input, ground-truth stems) | `evidence/voice/` (`mix-showcase-input.wav`, `mix-showcase-clean-voice.wav`, `mix-showcase-clean-music.wav`) |
| Robustness scores (PASS/FAIL + numbers) | `qa/reports/voice-demucs-robustness.json` |
| Main study scores | `qa/reports/voice-demucs-model.json`, `qa/reports/voice-tts-mix-isolation.json` |
| Test source assets (TTS voices, synthesized beds) | `qa/assets/voice/` |
| The test scripts themselves | `qa/voice-demucs-robustness-e2e.mjs`, `qa/voice-demucs-model-e2e.mjs` |

## Edge cases (through the real app, 7/7 PASS)

Every `input-*.mp3` pairs with its `output-*` file. SI-SDR is measured
against the exact known clean voice; the PASS bar is 14 dB.

| Case | Files | Result |
|---|---|---|
| **Mono input** (phone voice memo — 6 s, voice + chord pad) | `input-mono.mp3` → `output-mono-keep-vocal-demucs.mp3` | **16.4 dB**, output correctly stereo |
| **48 kHz input** (real-browser context rate — exercises the resample path that headless 44.1 kHz tests never touch) | `input-48k.mp3` → `output-48k-keep-vocal-demucs.mp3` | **25.9 dB**, duration exact (6.000 s) |
| **0.5 s clip** (shorter than one model chunk) | `output-short-clip-keep-vocal-demucs.mp3` | works, zero non-finite samples |
| **Two overlapping speakers** (male + female at once) | `input-duo.mp3` → `output-duo-keep-vocal-demucs.mp3` | **32.5 dB** vs both-voices reference — Demucs keeps both voices |

## Generalization matrix (offline, exact app pipeline)

New voices × new beds, scored against ground truth (3-pass + LS, no gate):

| Mix | Voice SI-SDR | Music bleed | Difficulty |
|---|---|---|---|
| numbers (m1) + **broadband ambient noise** | 11.3 dB | −34.7 dB | **hard — the model's weak spot** |
| staccato (f1) + arp synth | 16.1 dB | −41.9 dB | medium |
| mono: numbers + chord pad (robustness case 1) | 16.4 dB | — | medium |
| technical (f1) + full-band bed (main study) | 20.4 dB | −56.2 dB | hard music, clean result |
| conversation (m1) + drums (variant study) | 25.0 dB | −78.6 dB | easy |

### Honest limits

- **Broadband noise is not music.** Demucs is trained on musical stems; on
  the ambient-noise bed it reaches 11.3 dB — usable (noise clearly reduced,
  voice clearly on top) but far from its music results. For noisy
  recordings, the in-house **AI-Denoise engine** (built for noise) is the
  better first choice; the engine dropdown offers both.
- The VAD pause gate (on for keep-vocal in the app) further cleans the
  pauses on every case above — the offline matrix numbers are measured
  without it.
