# Resumed editor work and PR branch

The user explicitly requested pushing the saved work to a new branch so they can create the PR. `807e8f1bbf36c86a75fe925041f6c0cb672fb20a` was pushed and independently verified on `codex/omniframe-editor-improvements`. Latest `origin/main` (`d9214115`, including PR #6 and the new runner audit) was merged into this working branch. No push to main, force-push, PR creation or environment configuration publication was performed.

Open the PR comparison: https://github.com/ChibuikeOnuigbo/OmniFrame/compare/main...codex/omniframe-editor-improvements?expand=1

## Functional fixes

Universal headless video renders were ignoring `clip.speedCurve`, although browser playback already used the shared `src/lib/speedCurves.ts` functions. `tools/mcp/appRender.mjs` now uses those same functions for direct, masked/effect, temporal-echo and nested sequence source clocks. Timeline animation/effect clocks remain distinct from media sampling. Source in-points and clip start offsets remain respected. `list_presets(catalog='speed')` now reads the shared catalog rather than the older copied helper.

The established `edit_element` tool validates all 15 speed IDs and supports `null` to clear a curve. The live bridge also exposes speed curves, source inPoint and volume with validation, one history step, undo/redo and `.omni` round-trip coverage. No task-shaped tool or duplicate UI panel was added. Tool counts remain 23 live / 69 headless.

Creating a real compound from clips later on the timeline previously left children at absolute parent times, producing a blank lead-in. Children are now rebased to the nested timeline; ordinary ungroup restores their new parent position. Ungrouping a source-trimmed or nonlinearly retimed compound fails explicitly because baking its retime into children is not implemented. General transformed/effected ungroup equivalence is not established.

Linear imported-video audio is supported. Nonlinear speed-remapped audio, time effects and nested compound audio still fail explicitly in headless export; users can request `audio:false` for silent visual diagnostics. This increment does not implement audio time stretching.

## Executed checks and actual exports

- `qa/speed-curves-render-e2e.mjs`: all 15 shared curves; 120 exact decoded-source pixel comparisons across four times and direct/masked paths; clip offset plus source inPoint; invalid curve does not partially mutate the clip; 15 actual 54-frame moving MP4s. Source is original FFmpeg test footage. These are diagnostic clips, not the requested 150 character edits or independent reference recreations.
- `qa/compound-source-clock-unit.mjs`: real nonzero-start grouping preserves pixels, nested hold curve changes the source clock, moved ungroup restores placement, unsupported retimed ungroup is rejected.
- TypeScript and production build passed. Audio export, project reset, standalone patch compositor and 63-step universal tool regression passed. Fresh live MCP, context-menu viewport and responsive workbench browser checks passed; live MCP now checks clock/volume validation, atomic failure, undo/redo and saved project data.
- `qa/render-kinetic-word-study.mjs`: an original 4.5-second 540×960 word-stack study, authored through universal tools with five staggered text clips, position/rotation/opacity curves, a real nested group, gentle group motion and shared particle background. 108 decoded frames / 108 distinct hashes; actual preview inspected. It is inspired by the supplied short's visible timeline grammar; it is not a full source recreation or a newly implemented 3D camera.

Evidence: `evidence_video/speed-curves/manifest.json`, sibling MP4s and timeline/tool traces; `evidence_video/reala/motion design/kinetic-word-stack.mp4`.

## Newly acquired sources and actual review

Drive full downloads now work under the published unrestricted policy. Actual downloads were hashed and checked: the 100,904-byte collection manifest; the 11,065,415-byte original `8hjWrzum_vQ` timeline video (27.632 s, 1080×1920, 59.94 fps, H.264/AAC); and the 3,323,095-byte correct BrandBird RAR. See `research/new_study_vdieos/access-refresh.json`. Raw mirrors and source caches remain outside the product repository.

Three native-resolution frames at 3/18/24 s were visually inspected and stored as source evidence. They show staggered blue word rows with diamond keys, yellow camera rows, red null rows, beat markers, a creation tray, orange/black typography scenes, waveform-like graphics, scanline textures and streak/echo-like imagery. Labels do not prove exact effect recipes or parenting relationships. Source audio was not listened to, and complete creator catalogs were not watched.

`drive-collection-index.json` normalizes **259 manifest records / 60 archive plans**. Its original `downloaded` claims are preserved as `manifestClaim`, not treated as new transfers or viewing. The manifest contains video, short, audio and archive records; this count is not 259 newly studied videos.

The correct BrandBird mirror was extracted and served locally. Real onboarding dismissal, loading an original test image and opening the Background panel were exercised at 390/768/1440 px. It uses a bottom scrolling tool strip on phones and retains the selected image above its panel. Observed body widths were 409/782/1440 px, so its own small-screen overflow is not a pattern to copy. The mirror has missing service-worker/external assets; requests outside localhost were blocked. Screenshots and errors are preserved in `research/new_study_vdieos/brandbird-responsive/`; account, network editing and export acceptance are not claimed.

yt-dlp was retried against the requested short and Hancybox UI tutorial. Direct YouTube still returns proxy CONNECT 403 despite the published unrestricted setting. No tunnel/gateway bypass was used. The user-provided Drive mirror supplied the short. Hancybox's complete catalog, the full pack pagination/asset cutouts, separate RDT scene clips, all historical quiz outputs and all-5,000 full-motion acceptance remain unfinished.
