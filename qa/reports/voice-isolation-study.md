# OmniFrame Voice Isolation — Full Engineering Study

**Scope:** 1,000-iteration statistical stress run of the voice-isolation DSP + a full UI end-to-end pass (TTS voice + synthesized music, mixed in-page, isolated through the real product modal, verified with FFmpeg).

**Verdict in one line:** The engine is a fast, deterministic, real-time-capable *mid/side crossover DSP* — excellent at removing stereo-panned beds from a center voice (+8.5 dB median separation), weak on centered beds, and the four "model" choices are labels only. Karaoke mode buys SNR at the cost of instrumental fidelity. The study also surfaced and fixed a real UI bug: the isolation modal ignored the user's clip selection whenever it was opened with an initial clip.

**Artifacts**

| Artifact | Path |
| --- | --- |
| 1,000-run stress harness | `qa/voice-isolation-stress-1000-e2e.mjs` |
| 1,000-run results + aggregates | `qa/reports/voice-isolation-stress-1000.json` |
| UI E2E (real modal flow) | `qa/voice-tts-mix-isolation-e2e.mjs` |
| UI E2E report | `qa/reports/voice-tts-mix-isolation.json` |
| Music-bed generator | `qa/generate-music-beds.mjs` |
| Isolated output (evidence) | `evidence/voice/mix-showcase-isolated.wav` |
| Screenshots (evidence) | `evidence/voice/voice-isolation-modal-mixture.png`, `evidence/voice/voice-isolation-combined-timeline.png` |
| DSP implementation | `src/lib/voiceIsolation.ts` |

---

## 1. Architecture

The subsystem lives in `src/lib/voiceIsolation.ts` and is pure PCM math — no ML model, no WebAssembly, no server. The pipeline:

```
MediaAsset (blob URL)
  → fetch + AudioContext.decodeAudioData          (progress 10→30%)
  → isolateVoiceFromAudioBuffer()                 (progress 55%)   ← all DSP
  → encodeAudioBufferToWav()  (16-bit PCM RIFF)   (progress 80%)
  → computeBufferWaveform() (256-bin peaks)
  → executeVoiceIsolationForClip()
       • new MediaAsset "[Vocal Isolated · <model>] <name>.wav"
       • ensureTrack('audio'), clip sample-synced to source (start/inPoint/duration)
       • source clip muted to volume 0 (non-destructive handoff)
```

`processVoiceIsolation` has an offline fallback: if fetch/decode fails it substitutes a synthetic 3 s 440 Hz tone instead of failing. That makes the pipeline unbreakable in mock tests but can mask real load failures — worth keeping in mind (see §8).

**UI surface:** `VoiceIsolationPanel` (Audio tab) opens `VoiceIsolationModal` with `openVoiceModal(activeClipId || targetClipId || first clip)`; the modal exposes mode (Keep/Remove), strength slider, model dropdown, speech-formant focus, band overrides.

## 2. The DSP, precisely

Both modes operate on the stereo mid/side decomposition `M = (L+R)/2`, `S = (L−R)/2`, using a Chamberlin state-variable filter (SVF) as a 12 dB/oct 2-band crossover with Butterworth Q = 0.7071, coefficient `f = 2·sin(π·fc/fs)`.

**`remove_vocal` (karaoke).** A bass crossover at `vocalBandLow` (140 Hz) and an air crossover at `vocalBandHigh` (7.5 kHz) split each channel into three bands. Bass below 140 Hz is summed to mono and kept (`preserveBass`). Above 7.5 kHz, stereo air is kept verbatim. In the vocal band the mid is attenuated by strength and the side is mirrored:

```
outL = bassMono + (S + (1−strength)·M) + airL
outR = bassMono + (−S + (1−strength)·M) + airR
```

So a perfectly centered (M-only) vocal is multiplied by `(1−strength)` — −22 dB at the default strength 0.92 — while anything panned survives.

**`keep_vocal` (isolation).** A single mid channel is extracted, then dynamically gated by stereo-dominance: two 6 ms one-pole envelope followers track |S| and |M|, and the suppression gain

```
g = clamp(1 − strength · 1.25 · (envS / envM), 0.04, 1.0)
vocal = M · g
```

kills passages where side energy dominates (instruments) and passes passages where the center dominates (speech). With `speechFormantFocus` (default on) the result is bandpassed 130 Hz → 6.5 kHz by two cascaded SVFs and rendered dual-mono.

**What this is and isn't.** This is the classic "center-channel extraction" family used by karaoke hardware since the 1980s, upgraded with an envelope-driven gate. It exploits *spatial* (panning) cues and coarse *spectral* (speech-band) cues. It has no way to separate two sources occupying the same channel and the same band — e.g. a centered mono synth pad under a voice — because nothing in the signal distinguishes them. That limitation is exactly what the 1,000-run study quantifies.

## 3. The model dropdown is cosmetic

Four `VoiceIsolationModel` tags exist (`omni-voicetarget`, `htdemucs-v4`, `bs-roformer-lite`, `dsp-crossover-fast`). The tag is only used for the progress string and the asset name prefix — it never enters `isolateVoiceFromAudioBuffer`. The stress harness verified this directly: the same (voice, mode, strength, focus) input processed under all four tags produced **byte-identical WAV output** (`checks.modelTagsEquivalent: true`). All model rows in the results differ only by which mixtures they happened to be assigned (cycled), e.g. keep-gain medians 7.9/8.5 dB across tags — pure sampling noise.

This is an honesty problem in the product UI more than an engineering one: a user choosing "htdemucs-v4" reasonably believes a Hybrid Transformer Demucs network is running locally. It isn't; there is no model, and the names imply otherwise. Recommendation in §8.

## 4. Methodology

**Voice corpus.** Six TTS clips (2 speakers: female technical/questions/staccato, male conversation/numbers/slow), tracked in `qa/assets/voice/*.mp3`, ~20 s each, decoded at 44.1 kHz stereo.

**Music beds.** Five deterministic synthesized beds (`qa/generate-music-beds.mjs`, seeds fixed, 20 s, 44.1 kHz stereo), designed to span the one dimension this DSP can actually discriminate — **side-energy fraction** ‖S‖²/‖x‖²:

| Bed | Content | Side-energy fraction |
| --- | --- | --- |
| `pad-chords.wav` | slow hard-panned chord pads | 53.4% |
| `arp-synth.wav` | panned arpeggio synth | 50.0% |
| `ambient-noise.wav` | decorrelated stereo noise wash | 49.6% |
| `full-band.wav` | drums + bass + pads + arps (dense mix) | 5.3% |
| `drums-groove.wav` | centered kick/snare/hats groove | 0.4% |

**Mixtures.** Each run: voice normalized to mid-RMS 0.16, bed gain set by `10^(−SNR/20)` for target SNR, mixed to stereo, then processed by the production `isolateVoiceFromAudioBuffer` in-page. Grid = 6 voices × 5 beds × 5 SNRs (−10…+10 dB) × 2 modes × 4 strengths × 2 focus = 2,400 combos, sampled uniformly with coprime stride 7 over 1,000 iterations (plus a unit-pass cache — 176 cached reference passes — since DSP is invariant across SNR-identical configs).

**Metrics.**

- **separationGain** (dB): output SNR vs input SNR of voice-vs-bed — how much *cleaner* the voice became (`keep_vocal`), or how much bed got removed relative to what remained (`remove_vocal`, bed SNR improvement).
- **ΔSI-SDR** (dB): scale-invariant SDR of the *kept* stem against its ground truth — fidelity of the desired signal, where negative means the output resembles the wrong source.
- **Superposition residual:** `out(voice+bed) ≟ out(voice) + out(bed)`; the DSP is linear except for the keep-mode envelope gate, so this measures gate non-linearity.
- **Determinism:** re-runs must be bit-exact. **NaN/Inf sweep** on every output.

**Runtime:** 1,000 full mix+process cycles in 19.8 s wall = **6.2 ms average per 20 s stereo mixture** (~3,200× faster than real time in-page), zero non-finite runs, bit-exact determinism confirmed.

## 5. Results — 1,000 runs

### 5.1 By mode

| Mode | n | separationGain median | mean | p10 | p90 | ΔSI-SDR median |
| --- | --- | --- | --- | --- | --- | --- |
| `keep_vocal` | 501 | **+8.5 dB** | +10.4 | +0.5 | +24.7 | **+0.3 dB** |
| `remove_vocal` | 499 | **+6.1 dB** | +3.9 | −4.2 | +9.9 | **−5.1 dB** |

Read: isolation typically buys ~8.5 dB of voice-over-bed cleanliness while barely touching voice fidelity (+0.3 dB SI-SDR — i.e. the voice comes out essentially intact). Karaoke mode removes ~6 dB of vocal but **degrades the kept instrumental by ~5 dB SI-SDR** (p10 −15.3, min −62): the subtraction leaks the vocal's spectral residue into the instrumental and, on hard-panned beds, the mirrored side channel (`−S` into the opposite speaker) folds bed content where it didn't exist. Karaoke here is a loudness/SNR trick, not a stem.

### 5.2 By bed — the headline finding

| Bed | side-energy | keep gain (median) | remove gain (median) |
| --- | --- | --- | --- |
| `arp-synth` | 50.0% | **+24.7 dB** | **−3.7 dB** |
| `ambient-noise` | 49.6% | +15.4 dB | +6.3 dB |
| `pad-chords` | 53.4% | +12.1 dB | −0.4 dB |
| `full-band` | 5.3% | +2.0 dB | +8.3 dB |
| `drums-groove` | 0.4% | **+0.5 dB** | **+8.5 dB** |

**Separation quality is almost entirely a function of the bed's stereo width, not of SNR, voice, strength, or focus.** Hard-panned beds (arp, pads, ambient) are trivially removable (+12 to +25 dB). Centered beds defeat keep-mode (+0.5 dB on `drums-groove` — statistically nothing) because a centered snare *is* mid energy and passes the gate just like a voice. Conversely karaoke mode works *best* on centered beds (+8.5 dB) — where the vocal is also centered and `(1−strength)·M` cancellation bites — and fails on hard-panned beds, whose side content is mirrored rather than removed. The two modes are near-complementary mirrors of the same panning cue.

### 5.3 By SNR — invariance

| Input SNR | −10 dB | −5 dB | 0 dB | +5 dB | +10 dB |
| --- | --- | --- | --- | --- | --- |
| keep gain (median) | 8.5 | 8.5 | 8.5 | 8.5 | 8.5 |
| keep ΔSI-SDR (median) | +1.0 | +1.4 | +0.6 | −0.3 | −0.9 |

separationGain is constant across SNR (by construction — it's a ratio), and ΔSI-SDR only drifts slightly: the gate's `envS/envM` ratio, not absolute level, drives suppression. In plain terms: the engine behaves the same whether the music is 3× louder or 3× quieter than the voice. No SNR-based tuning is needed by users.

### 5.4 By strength

| Strength | 0.50 | 0.75 | 0.92 (default) | 1.00 |
| --- | --- | --- | --- | --- |
| keep gain (median) | 6.3 | 10.4 | 13.2 | **14.3 dB** |
| remove gain (median) | 4.5 | 7.8 | 7.7 | 5.6 |

Strength is the real user lever in keep mode: monotone, +8 dB from 0.5 → 1.0. But strength 1.0 also drags ΔSI-SDR down on loud passages (gate floor 0.04 → −28 dB crushing during transients) — the default 0.92 is a sensible knee. In remove mode there is no free lunch: mid-band cancellation at strength 1.0 destroys instrument body faster than it removes the last vocal dBs (gain *drops* from 7.7 → 5.6).

### 5.5 By voice and focus — non-factors

Voice medians span 8.4–8.5 dB keep gain and 4.2–7.7 dB remove gain across all six TTS clips: speaker, gender, pace and content are non-factors — as expected for a panning-based method (the voice is always centered). Speech-formant focus leaves keep gain unchanged (8.5 both) and shifts ΔSI-SDR by ~1 dB (−0.4 on vs +0.6 off): the 130 Hz–6.5 kHz bandpass trims rumble/air but its benefit is *tonal*, not measurable separation.

## 6. UI end-to-end (real product flow) — 24/24 PASS

`qa/voice-tts-mix-isolation-e2e.mjs` drives the actual product, no store shortcuts for the user path:

1. Builds a 20 s mixture **in-page** (TTS technical-narration voice at 0 dB SNR over `full-band.wav`) using the production `encodeAudioBufferToWav`.
2. Imports mixture + bed through the real media panel (`panel-all-import-input`), adds both to the timeline via the `Add … to timeline` buttons — combined session verified (3 audio clips, ripple-inserted, one audio track).
3. Opens **Voice Isolation → Settings** from the Audio panel, selects the *mixture* clip in the modal's dropdown, Keep Vocal @ 0.92, executes.
4. Store assertions: isolated clip `[Vocal Isolated · omni-voicetarget] mix-showcase.wav` created **sample-synced** with the source (start 20 s, duration 20 s), source clip muted to volume 0, asset registered with a 256-bin waveform.
5. Downloads the app-encoded WAV and measures with FFmpeg:

| Measurement | Mixture | Isolated | Check |
| --- | --- | --- | --- |
| Stereo side RMS | −28.5 dB | **−200 dB** | side collapsed (dual-mono output) |
| Sub-80 Hz (kick/rumble) | −18.5 dB | −26.4 dB | −7.9 dB, 130 Hz HP working |
| Speech band 300 Hz–3 kHz | −19.0 dB | −19.1 dB | preserved within 0.1 dB |
| >7.5 kHz air | −33.6 dB | −35.5 dB | attenuated (12 dB/oct slope) |
| >10 kHz | −36.0 dB | −39.1 dB | attenuated further up the slope |

The speech band surviving to within 0.1 dB while the side channel drops to digital silence is the cleanest single picture of what this engine does: **it removes space, not timbre.**

## 7. Bug found by the study (fixed)

Driving the real modal exposed a genuine UI defect in `VoiceIsolationModal.tsx`: the target-clip `<select>` was controlled by `selectedClipId`, but a `useEffect` with `[initialClipId, audioVideoClips, selectedClipId]` deps re-ran on *every* state change and reset `selectedClipId` back to `initialClipId` whenever the modal had been opened with a specific clip (which is how the Audio panel always opens it). Net effect: **the dropdown was a no-op** — users could change the selection, watch it render, and the execute action would silently process the original clip. The E2E caught it exactly this way (it selected the mixture clip and the app isolated the music bed instead).

**Fix:** sync only on `(re)open` — the effect now gates on `isOpen` and depends on `[isOpen, initialClipId]` only, with the invariant documented in a comment. Verified by the now-passing E2E plus `tsc --noEmit`.

Two E2E-hardening lessons also captured in the harness: clicking a left-tab that is already active *collapses* the dock (tests must open tabs via store state), and `addClipToTrack` silently no-ops on locked/type-mismatched tracks — both made the original "button clicked but no clip" symptom ambiguous to debug.

## 8. Recommendations

1. **Fix the model dropdown's honesty (high priority).** Either rename the options to describe what they are (`fast`, `balanced`, `aggressive` presets that actually map to strength/band presets), or implement a real difference (e.g. `dsp-crossover-fast` skipping the envelope gate, a true 4-band crossover variant). Naming cosmetic options after well-known ML models (`htdemucs-v4`, `bs-roformer-lite`) misrepresents the processing.
2. **Centered-bed failure is the product's real gap.** Keep-mode is near-useless on mono/centered music (0.5 dB). If a real ML stem separator is out of scope, at minimum (a) detect low side-energy and warn the user ("this mix looks mono — isolation will have little effect"), and (b) consider a spectral-temporal fallback (e.g. harmonic/percussive median filtering on the mid channel) for the centered case.
3. **Karaoke should be labeled a "vocal cut" not "instrumental".** At −5 dB SI-SDR median the output is an effect, not a stem. Preserving bass (<140 Hz, already done) is right; consider also limiting the mirrored-side reconstruction so hard-panned content isn't folded across channels.
4. **Keep strength default at 0.92.** The data shows 1.0 buys +1.1 dB separation but costs fidelity on transients; 0.5 is never worth it.
5. **Guard the decode fallback.** `processVoiceIsolation`'s catch-all substitution of a 3 s 440 Hz tone means a genuine load failure yields a *plausible-looking* isolated clip of the wrong audio. At minimum log the failure to console and mark the asset name with a `(fallback)` suffix.
6. **Keep the E2E pair as regression gates.** The 1,000-run harness (19.8 s) is cheap enough for CI; it pins determinism, model-tag equivalence, NaN-freedom, and the bed-width behavior envelope.

## 9. Reproducing

```bash
node qa/generate-music-beds.mjs            # deterministic beds (auto-run if missing)
node qa/voice-isolation-stress-1000-e2e.mjs          # 1,000-run study  (ITERATIONS=N to override)
node qa/voice-tts-mix-isolation-e2e.mjs              # UI flow, needs the dev server on :5173
```

Dev server: `npm run dev` (harness expects `http://localhost:5173/#studio`).

---

*Generated 2026-10-04 · 1,000 iterations, 19.8 s wall, 6.2 ms/mixture · determinism ✔ · model-tag equivalence ✔ · non-finite outputs 0*
