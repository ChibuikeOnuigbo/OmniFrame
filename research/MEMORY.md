# OmniFrame OSS research memory

## Method and boundaries

This is a ranked, explicit corpus, not a claim that every open-source editor was studied. Repository metadata was queried through GitHub on 2026-09-20 and preserved in `research/repository-metadata.jsonl`. Each record contains the repository default branch, exact branch-head commit, GitHub-reported SPDX license, stars, and retrieval date. Three permissively licensed repositories were shallow-cloned under `/tmp` for structural inspection; those clones are research-only and are not shipped or copied into OmniFrame.

No source code was copied from this corpus. Behavioral and architectural observations are used only as independent design references. GPL projects are references, not dependencies. `NOASSERTION` is treated as requiring manual license review, never as permissive.

## Ranked corpus

1. **OpenCut-app/OpenCut** — directly relevant open-source CapCut alternative; MIT; commit `400f097becba5db0fbc305d5a65348cb81c20356`. Shallow clone inspected. Its monorepo separates web/API/desktop concerns and demonstrates that editor UX, persistence, and platform shells benefit from explicit boundaries. OmniFrame retains its independently written Zustand/canvas/Tauri architecture.
2. **olive-editor/olive** — mature NLE interaction reference; GPL-3.0; commit `7e0e94abf6610026aebb9ddce8564c39522fac6e`. Reference only because GPL-3.0 is outside OmniFrame's MIT/Apache shipping policy.
3. **KDE/kdenlive** — professional multi-track editing reference; GPL-3.0; commit `acdc35977558152740125afd3f6e69f3bc04bc07`. Reference only.
4. **mltframework/shotcut** — mature cross-platform Qt/MLT editor; GPL-3.0; commit `61869c2392e0f3a7926972371db0f9b212a12fa0`. Reference only.
5. **OpenShot/openshot-qt** — desktop NLE and keyframe UX reference; GitHub API returned `NOASSERTION`; commit `9004af74b02c67e507190e9950b5fc690fb0a900`. No shipping use without manual license verification.
6. **jliljebl/flowblade** — timeline workflow reference; GPL-3.0; commit `f03417ae0add749e4f208a98429e9dd980b47076`. Reference only.
7. **pitivi/pitivi** — GStreamer-based editor reference; GitHub mirror returned `NOASSERTION`; commit `fd4a0b3f899ef2549fa89a205d6ea5cda61dd25b`. Reference only pending upstream license verification.
8. **mifi/lossless-cut** — focused cut/export workflow reference; GPL-2.0; commit `20f2e34687a691dd15b18c030d108b3b66d44098`. Reference only.
9. **ozmartian/vidcutter** — focused clip cutting reference; GPL-3.0; commit `db6818f11bbb4d5598dfc5ceeddf7f81c7078499`. Reference only.
10. **blender/blender** — compositing, animation, and video-sequence architecture reference; API returned `NOASSERTION`; commit `95bb6e2d328af1b537c4fcba6e07ebd371033abe`. Reference only.
11. **NatronGitHub/Natron** — node compositing reference; GPL-2.0; commit `3763d805d7d277d10af10025ae41af677682b3e6`. Reference only.
12. **remotion-dev/remotion** — React/programmatic video ecosystem reference; API returned `NOASSERTION`; commit `362acd67293e8860805f5b630f34b518822a2f30`. No shipping use without package-level license review.
13. **Vanilagy/mediabunny** — browser media parsing/writing reference; MPL-2.0; commit `bad03f2f0bd5b6caf346d3706cb0a0c63bd221a2`. MPL is not on the current MIT/Apache-only shipping allowlist, so reference only.
14. **ffmpegwasm/ffmpeg.wasm** — browser FFmpeg boundary reference; MIT; commit `f876f907c7e9b9bf51d4ed0b913a855a63ae63fc`. Shallow clone inspected. Package separation (`core`, `ffmpeg`, `types`, `util`) supports isolating a future processing adapter from editor state. No code copied.
15. **xzdarcy/react-timeline-editor** — timeline component reference; MIT; commit `4148f4a837dd767ea66807560d05bc7b65c7e578`. Shallow clone inspected. Its package split between engine/timeline/docs reinforces separating timeline geometry from execution. OmniFrame's implementation remains independent.
16. **openvideodev/react-video-editor** — browser editor comparison point; API returned `NOASSERTION`; commit `9a8c5296da4b258f66dfb7ad73de96be62478bca`. Reference only.
17. **moviemasher/moviemasher.js** — browser media-editor reference; MPL-2.0; commit `d87af5622290fdccedeaad2334b2cd16b0d7cd06`. Reference only under current policy.

## License decision

Permissive metadata alone does not authorize blind copying. OpenCut, ffmpeg.wasm, and react-timeline-editor reported MIT and were inspected only for boundaries and behavior. All GPL repositories remain non-shipping references. MPL repositories remain non-shipping under the project's stricter current allowlist. `NOASSERTION` repositories remain blocked until their exact files/packages are manually verified. No AGPL, noncommercial, source-available, or unknown-license implementation is shipped.

## Applied independent conclusions

- Timeline values must remain in logical seconds; pixel positions are projections of zoom. OmniFrame now browser-verifies this at 8 and 8000 px/s.
- Track lock must guard mutations in state, not only style controls. OmniFrame now rejects move, both trims, split, delete, and invalid locked destinations.
- Media ingestion and editor placement are separate operations. OmniFrame keeps a reusable asset library and now implements real HTML5 library-to-timeline drag/drop.
- Browser export needs lifecycle ownership. OmniFrame uses one reusable MediaRecorder session because packaged Chromium emitted truncated/headerless files when encoders were recreated repeatedly.
- Platform packaging belongs outside editor state. The Tauri 2 shell is isolated in `src-tauri/`; web behavior does not depend on native APIs.
- Unsupported panels must remain explicitly described as planned placeholders. Research did not justify exposing fake effect, mask, tracking, text, or 3D operations.

## Evidence paths

- Exact API metadata: `research/repository-metadata.jsonl`
- API query errors, if any: `research/repository-errors.txt`
- Browser feature results: `qa/reports/advanced-results.json`
- Browser trace: `qa/traces/advanced-workflow.zip`
- Browser recording: `qa/recordings/page@1c3407f6e7489d4bc4a0b5c255510d77.webm`
- Repeated export validation: `qa/reports/advanced-media-validation.txt`
- Tauri environment probe: `qa/reports/tauri-info.txt`
- Tauri build attempt: `qa/reports/tauri-build-attempt.txt`
