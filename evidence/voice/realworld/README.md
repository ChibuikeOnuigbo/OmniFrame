# Voice isolation — real tracks (the user's own files)

Full-length runs of the neural separator on the two real music tracks
committed at the repo root, in **both modes** — click any link to play.

Engine: the exact app pipeline (Demucs v4 htdemucs, 2 shift-averaged passes,
finite-aware averaging, LS cross-talk removal; VAD gate not applied — sung
vocals keep their full energy). No ground truth exists for commercial music,
so there are no SI-SDR scores here — judge by ear.

## Track 1 — DJ UNIVXRSEL · DROLLXD SLOWED (3:05)

| Mode | Files | What the model found |
|---|---|---|
| Input | [`DJ UNIVXRSEL - DROLLXD SLOWED - DJ UNIVXRSEL.mp3`](../../../DJ%20UNIVXRSEL%20-%20DROLLXD%20SLOWED%20-%20DJ%20UNIVXRSEL.mp3) | — |
| Keep Vocal (acapella) | → [`output-track1-keep-vocal-demucs.mp3`](output-track1-keep-vocal-demucs.mp3) | **near-silent — correctly so.** The vocals stem sits at −34 dBFS (0.1% of the separated energy): this slowed DJ edit is effectively an instrumental, and the model refuses to hallucinate a voice (same behavior as the [no-vocals fixture](../robustness/README.md) test). |
| Remove Vocal (karaoke) | → [`output-track1-remove-vocal-demucs.mp3`](output-track1-remove-vocal-demucs.mp3) | instrumental ≈ the original mix (23.4 dB similarity) — nothing vocal to remove, so everything is kept. |

## Track 2 — UPAST · HELLBLADE (Ultra Slowed) (1:48)

| Mode | Files | What the model found |
|---|---|---|
| Input | [`UPAST (Ultra Slowed) - HELLBLADE.mp3`](../../../UPAST%20%28Ultra%20Slowed%29%20-%20HELLBLADE.mp3) | — |
| Keep Vocal (acapella) | → [`output-track2-keep-vocal-demucs.mp3`](output-track2-keep-vocal-demucs.mp3) | a real vocal performance — the vocals stem carries **15.7%** of the track's energy at −14.4 dBFS. |
| Remove Vocal (karaoke) | → [`output-track2-remove-vocal-demucs.mp3`](output-track2-remove-vocal-demucs.mp3) | the beat survives and the vocal is gone — the instrumental differs from the mix by 5.7 dB, i.e. a large vocal portion really was lifted out. |

## Notes

- These are derivatives of the user's own files, for personal evaluation —
  same personal/research-use terms as the Demucs weights (see
  [`src/lib/demucs/LICENSE.md`](../../../src/lib/demucs/LICENSE.md)).
- Synthetic studies with exact ground-truth scoring live in
  [`evidence/voice/listen/`](../listen/README.md) (main study) and
  [`evidence/voice/robustness/`](../robustness/README.md) (edge cases +
  generalization matrix, both modes).
- To reproduce in the app: import the track, select the clip, open the audio
  inspector → voice isolation → engine **htdemucs-v4**, mode Keep / Remove
  Vocal. Full-track runs take a while on WASM; WebGPU (real hardware) is
  much faster.
