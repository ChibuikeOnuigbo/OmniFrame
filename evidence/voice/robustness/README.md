# Voice isolation — robustness & generalization tests (listen pack)

Edge cases and mix types the main study does not cover, in **both modes**
(keep_vocal = isolate the voice, remove_vocal = extract the instrumental),
with input and output side by side so you can play them straight from the
repo. Everything was produced by the real app engine (Demucs v4 htdemucs,
shift-averaged passes + LS cross-talk removal; VAD gate where noted).

## Where everything lives

Every path below is clickable:

| What | Where |
|---|---|
| **This pack** — edge-case pairs, both modes | this folder ([file list](..)) |
| Main listen pack — showcase A/B, DSP comparison, variant | [`evidence/voice/listen/`](../listen/) |
| Full-fidelity WAVs of the main study (input + ground-truth stems) | [`evidence/voice/`](..) — e.g. [`mix-showcase-input.wav`](../mix-showcase-input.wav), [`mix-showcase-clean-voice.wav`](../mix-showcase-clean-voice.wav), [`mix-showcase-clean-music.wav`](../mix-showcase-clean-music.wav) |
| Robustness scores (PASS/FAIL + numbers) | [`qa/reports/voice-demucs-robustness.json`](../../../qa/reports/voice-demucs-robustness.json) |
| Main study scores | [`qa/reports/voice-tts-mix-isolation.json`](../../../qa/reports/voice-tts-mix-isolation.json) (run [`qa/voice-demucs-model-e2e.mjs`](../../../qa/voice-demucs-model-e2e.mjs) to reprint the neural scores) |
| Test source assets (TTS voices, synthesized beds) | [`qa/assets/voice/`](../../../qa/assets/voice/) |
| The test scripts | [`qa/voice-demucs-robustness-e2e.mjs`](../../../qa/voice-demucs-robustness-e2e.mjs) (this suite), [`qa/voice-demucs-model-e2e.mjs`](../../../qa/voice-demucs-model-e2e.mjs) (main study) |

## Edge cases — keep_vocal (through the real app, 9/9 PASS)

Click an input, then its output, and A/B them. SI-SDR is measured against
the exact known clean voice; the PASS bar is 14 dB.

| Case | Input → Output | Result |
|---|---|---|
| **Mono input** (phone voice memo — voice + chord pad, 6 s) | [`input-mono.mp3`](input-mono.mp3) → [`output-mono-keep-vocal-demucs.mp3`](output-mono-keep-vocal-demucs.mp3) | **16.4 dB**, output correctly stereo |
| **48 kHz input** (real-browser context rate — exercises the resample path that 44.1 kHz headless tests never touch) | [`input-48k.mp3`](input-48k.mp3) → [`output-48k-keep-vocal-demucs.mp3`](output-48k-keep-vocal-demucs.mp3) | **25.9 dB**, duration exact (6.000 s) |
| **0.5 s clip** (shorter than one model chunk; voice-only input) | → [`output-short-clip-keep-vocal-demucs.mp3`](output-short-clip-keep-vocal-demucs.mp3) | works, zero non-finite samples |
| **Two overlapping speakers** (male + female at once) | [`input-duo.mp3`](input-duo.mp3) → [`output-duo-keep-vocal-demucs.mp3`](output-duo-keep-vocal-demucs.mp3) | **32.5 dB** vs both-voices reference — Demucs keeps both voices |

## Edge cases — remove_vocal (instrumental / karaoke)

| Case | Input → Output | Result |
|---|---|---|
| **Mono input** — instrumental through the upmix path | [`input-mono.mp3`](input-mono.mp3) → [`output-mono-remove-vocal-demucs.mp3`](output-mono-remove-vocal-demucs.mp3) | **19.9 dB** vs clean music (bar 14) |
| **48 kHz input** — instrumental through the resample path | [`input-48k.mp3`](input-48k.mp3) → [`output-48k-remove-vocal-demucs.mp3`](output-48k-remove-vocal-demucs.mp3) | **23.7 dB**, duration exact |
| **Voice-only mix** — nothing left to keep | [`input-duo.mp3`](input-duo.mp3) → [`output-duo-remove-vocal-demucs.mp3`](output-duo-remove-vocal-demucs.mp3) | residue **−58.8 dBFS** — 45.9 dB below the mix, effectively silent |

## Generalization matrix (offline, exact app pipeline)

New voices × new beds, scored against ground truth (3-pass + LS, no gate).
Vocal SI-SDR / music bleed, plus instrumental SI-SDR for remove_vocal:

| Mix | Voice | Music bleed | Instrumental | Difficulty |
|---|---|---|---|---|
| [`numbers + broadband ambient noise`](input-mix-numbers-ambient.mp3) → [`keep vocal`](output-mix-numbers-ambient-keep-vocal-demucs.mp3) | 11.3 dB | −34.7 dB | 13.9 dB | **hard — the model's weak spot** |
| [`staccato + arp synth`](input-mix-staccato-arp.mp3) → [`keep vocal`](output-mix-staccato-arp-keep-vocal-demucs.mp3) | 16.1 dB | −41.9 dB | 18.9 dB | medium |
| mono: [`numbers + chord pad`](input-mono.mp3) (edge case 1) | 16.4 dB | — | 19.9 dB | medium |
| technical + full-band bed (main study — [`pack`](../listen/README.md)) | 20.4 dB | −56.2 dB | 19.5 dB | hard music, clean result |
| conversation + drums (variant study — [`pack`](../listen/README.md)) | 25.0 dB | −78.6 dB | 25.6 dB | easy |

### Honest limits

- **Broadband noise is not music.** Demucs is trained on musical stems; on
  the ambient-noise bed it reaches 11.3 dB — usable (noise clearly reduced,
  voice clearly on top) but far from its music results. For noisy
  recordings, the in-house **AI-Denoise engine** (built for noise) is the
  better first choice; the engine dropdown in the app offers both.
- The VAD pause gate (on for keep_vocal in the app) further cleans the
  pauses on every case above — the matrix numbers are measured without it.
