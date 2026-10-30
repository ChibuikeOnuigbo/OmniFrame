
## Increment 2026-10-30b (wave-3 turn)
- Rollback #9 recovered (fetch + reset --hard origin 96b3b1fd + npm ci + pip; vite restarted). The
  gitignored videos/ cache was wiped by the rollback — study artifacts (frames, findings) unaffected;
  re-downloadable via connector ids (noted in STUDY.md, no silent gap).
- Wave-3: remaining Color & Light browser gaps implemented as real engine passes (bumpMap emboss,
  colorBalanceR/G/B, shadows/highlights quadratic curves, hotColor bright-mix, radialShadow
  short-side falloff, fourColorGradient bilinear A-D blend with fcgPhase) + 7 bokeh shape-bed
  particle kinds from frame 36_t070. 7 vs3-* catalog entries. sanitizer passes fcg colours.
- Debug trail: radialShadow first measured invisible in-app (falloff normalised to canvas
  half-diagonal — clip is pad-centred, dd never left the flat zone); direct-import probe proved the
  engine correct; re-normalised to short-side half → T9 passes (61.4 → 57.1).
- Acceptance e2e 9/9; regressions green (universal-tools 69, video-study-render, alight-roundtrip,
  tymm-lut-parity, replace-template). FEATURES = 179.
# OmniFrame STATE — Mega-turn cont.: XML export/import + Shake pack (2026-10-29)

## Batch slice 5 (2026-10-30) — rebuilt runner, versions 364..563 rendered
- Rollback #8 had wiped the UNTRACKED glitch_batch.mjs + data/glitch_recipes.json. The runner was
  REBUILT from the committed artifacts (checkpoint.json, sigs.json, 183 recipe JSONs): seed=7919n+237
  and the palette/bg cycle verified exact against history; the per-param rng draw order is NOT
  recoverable, so >=364 use a fresh documented mulberry32 derivation whose ranges bracket every
  historical value (stated in the script header — not claimed identical to the original).
- Two rebuild bugs found and fixed by bisect: (1) clip_stretch{4,4} no-ops in historical recipes
  BLANK the render in the current harness (8KB static vs 98KB real) — omitted now; (2) first dedupe
  attempt quantised luma sigs to 4 decimals and false-duped 97/98 of a slice — rolled back. Final
  scheme: sha256 over the 48x15x12 gray-grid bytes, sigkeys.json seeded from the 183 historical
  mp4s with the same extractor; historical float sigs.json frozen at 183 (its original extractor is
  not bit-reproducible; cross-era dup rate therefore differs from the historical ~48% — honest).
- Slice result: versions 364..563 ALL KEPT (200 real renders, 39-62KB, spot-check mean luma 104 /
  4679 colors), 0 dups vs the 383-key store, 0 failed. next=564 of 5000, kept=383, dups=168.

## Increment 2026-10-30 (download + frame-study turn)
- User mandate: download the Drive videos. Bash egress to Drive/googleapis is TLS-blocked (probed); NO evasion used; the Drive connector's download_file staged all 41 MP4s into the workspace — byte-exact vs index, gitignored, 122 frames committed.
- Rollback #8 recovered (reset --hard origin 6ca905c9 + npm ci + pip imageio-ffmpeg/Pillow).
- Wave-2 effects from frames: exposureOffset, radialRepeatOrientation, Text Transform (Start/End/Phase per-char), copyBackground (pre-key under-copy); 5 vs2-* catalog entries; FEATURES 177; acceptance e2e 8/8 PASS.
- NOT implemented (honest): BCC matte shape-picker variety (plus/hexagon/bowtie), AM browser taxonomy recategorisation (FX_CATS capped at 9 by standing constraint), 3D Tracker, true 3D.
- Glitch batch still at next=364 (slice 5 pending).

## Increment 2026-10-29 (video-study turn)
- Scanned Drive folder 1KlxUlem-Qjyd61dLkqs9nk3Ob4bou1Kp (41 MP4s + 2 docs + 2 sheets): research dump new_doc_toll_research/video_study/ (folder-index.json, STUDY.md). Honest: doc middle sections beyond 4.2 truncated by Drive API limit; videos are sampled-frame research only; MP4s NOT downloaded.
- Gap-closed with REAL engine keys: exposure/gamma, Raster Extrude (look, not true 3D), Radial Repeat, Long Shadow + 17 vs-* catalog entries + AM map upgrades; XML export/import verified for all new keys.
- QA green: video-study acceptance e2e (6/6 tests, real Chromium), video-study render proof mp4, alight-roundtrip PASS, universal-tools PASS (69 tools), replace-template PASS, tymm-lut-parity PASS.
- Rollback #7 recovered this turn (fetch+reset --hard origin 56236c2a + npm ci + pip imageio-ffmpeg + Pillow).
- NOT MEASURED: >=80% similarity vs AM (no metric); mega.nz still unreachable; CC media bytes still not downloaded; doc middle sections unavailable.

## Increment 2026-10-29 (XML export turn, part 2)
- Browser UI: template mode in clip context menu (Capture / Apply submenu); built-in Shake pack section in EffectsPanel; Media panel Export Alight XML / Export Template XML buttons.
- QA (all green this turn): `ALIGHT XML ROUND-TRIP QA: PASS` (proof test_ans_result/xml-roundtrip.mp4); NEW `REPLACE+TEMPLATE UI E2E: PASS` (real Chromium via vite dev :5173 — replace window math, drag clamp to 3 s, carry-effects+LUT, template capture→XML→idempotent re-import→chain replay, project XML round-trip in browser, TYMM LUTs first batch, 98 stem font faces, shake pack 8 buttons + NANIMALO 7-fx apply); universal-tools PASS (69 tools); replace-template PASS; tymm-lut-parity PASS.
- Glitch batch slice 3: recipes 188→276 validated IN-APP, checkpoint next=276, 145 kept / 119 dup-skipped / 0 failed, batch_reel.mp4 rebuilt 00:09:40.
- Glitch batch slice 4: recipes 276→364 validated IN-APP, checkpoint next=364, 183 kept / 169 dup-skipped / 0 failed, batch_reel.mp4 rebuilt 00:12:12.
- NOT MEASURED: ≥80% similarity vs AM (no declared metric). mega.nz corpus still unreachable. CC media bytes (~120MB) still not downloaded.

Branch `arena/212bca02-omniframe`. Previous: Board T cont.3 (QA PASS 63/59).
This increment: user Drive asset acquisition (fonts/LUTs/Alight XMLs/CC scan),
Replace-Video-With-Video, TEMPLATE MODE, Alight Motion import, continue.md.

## Completed (cont. — verified this increment)

- **XML EXPORT/IMPORT (user directive):** project + templates export as
  Alight-Motion-dialect XML; the Import button/`alight_import` read AM project
  XML AND OmniFrame template XML. Round-trip is LOSSLESS for OmniFrame data
  (omniframe.fx exact values / omniframe.lut / omniframe.fxinst incl. keys /
  normalised transform kf with cubicBezier). AM corpus PROJECT files stay
  OUT of the app bundle — research dir only; users import/export.
  `qa/alight-roundtrip.mjs` PASS; proof `test_ans_result/xml-roundtrip.mp4`.
  Parser fixes raised corpus import fidelity (hero 80→96 clips; transform-kf
  parsing actually wired: hero 369→385 keyed props).
- **Built-in SHAKE PACK** (the repeated corpus material ships IN the app):
  all 8 Shakes.xml presets with ORIGINAL keyframe values/timings →
  EffectsPanel section, store.applyShakePreset, MCP shake_apply,
  list_presets catalog=shake. fx_add normalises [[t,v]] keys.
- Universal tools QA now **69 tools** PASS; replace-template + LUT parity +
  tsc + vite build all green. Rollback #6 at turn start recovered
  (reset --hard origin + npm ci + pip imageio-ffmpeg).

## Completed (previous increment)

- **Assets acquired + extracted** (Drive → `new_doc_toll_research/`, staging in
  gitignored `google_drive/`): 49 fonts (nested zips unpacked), 8 LUT jpegs
  (5 real 512² Hald CLUTs + 3 preview photos), 12 Alight Motion v5 XMLs
  (hero/warps/cc-5plus1/cc-tymm/Onyankopon/Evergreen/Shakes + 5 PF projects),
  2 CapCut Replace-popup screenshots. Rollback #5 at turn start recovered via
  `git fetch origin && git reset --hard origin/arena/212bca02-omniframe` + npm ci.
- **TYMM LUTs = FIRST BATCH** (`public/luts/manifest.json` tymm-3…7 lead the
  30 entries): LOSSLESS Hald→cube conversion — layout empirically detected
  (rowmajor 8×8 tiles of 64px via cross-tile smoothness), 64³ cubes store
  every source node verbatim. `qa/tymm-lut-parity.mjs` PASS: node error
  0.000/255 for all 5; browser picker + headless `builtin` path consume them
  unchanged. Sources preserved in `public/luts/source-tymm/`.
- **49 fonts registered by FILE STEM** (user mandate, not zip name):
  `public/fonts/` + `src/lib/fontPack.ts` (@font-face css injected main.tsx +
  index.css) + headless `GlobalFonts.registerFromPath` (FONT_PACK_FILES = 49
  verified) + TextPanel dropdown + MCP `list_fonts`.
- **Replace-Video-With-Video** (CapCut parity): video-asset drop ON a video
  clip → ReplaceDialog (filmstrip, draggable window = target clip duration,
  timecode, “Use the original video effect” checkbox); pure engine
  `src/lib/replaceVideo.ts`; MCP `replace_video` with windowStart clamping +
  carryEffects clear-list. QA PASS incl. no-carry clearing 3 stages.
- **TEMPLATE MODE**: `template_capture` dumps EVERY processing stage (incl.
  animation curves w/ bezier points, LUT grade, masks, speed, textStyle,
  in-point ratio) to `data_motiondesijg/templates/*.json`; `template_apply`
  replays the chain on new footage; `list_templates`; browser store actions.
  `qa/replace-template-demo.mjs` PASS (20 steps) →
  `test_ans_result/replace-template-demo.mp4` (3 s, 640×360, h264 — process
  original → capture → new theme → apply → swap both carry modes → render).
- **Alight Motion study + import**: `src/lib/alightXml.ts` (regex parser runs
  browser+headless identically: shape/text/nullobj layers, ms timings,
  normalised kf + cubicBezier→CurveEngine custom points, gain→volume);
  ~100 AM effect ids scanned, ~75 mapped to real engine patches as
  `AM_FX_CATALOG` MERGED INTO the site Effects catalog; MCP `alight_import`
  (+ dumps to `data_motiondesijg/alight/`); MediaPanel “Import Alight XML” +
  `store.importAlightXml`. **All 12 corpus XMLs import** (hero 80 clips/378
  mapped fx/369 keyframed props; Onyankopon 121/413; Mi Mi Mi 97/417; Shakes
  10 presets/34 fx/47 kf). Proof render
  `test_ans_result/alight-warps-import.mp4` (app-made frames, 6.3% non-black —
  media layers are honest placeholders: `content://` refs unresolvable off
  device; re-link via replace_video which carries the AM chain).
  `docs/alight-motion-study.md` records the full anatomy + limits.
- **CC/TYMM scan**: `new_doc_toll_research/CC-SCAN.md` — exact Drive-API
  listings (Overlays 38, Back Grounds 42, Sfx 41 across 5 subfolders, Shakes,
  Cc, Free), overlay usage recipes (screen/lighten/chromaKey/lumaKey), 55 AM
  text layers extracted as pack data (subtitle chain
  texttransform+textspacing+gradientoverlay2; Quicksand_Bold font stem matches
  the TYMM pack). mega.nz folder: recorded unreachable (allowlist) — NOT done.
- **continue.md created** (user mandate): every-run checklist + standing laws
  incl. the 5000-recipe-until-complete mandate (batch checkpoint next=100),
  shipped list, honest resume points.
- QA: UNIVERSAL TOOLS QA PASS (63 steps, **65 tools** — +replace_video,
  template_capture/apply, list_templates, list_fonts, alight_import);
  replace-template demo PASS; LUT parity PASS; tsc --noEmit clean;
  `vite build` succeeds.

## Partial

- Batch queue: checkpoint **next=188** of 5000 — slice 2 (100–188) ran this
  turn: cumulative 85 kept / 91 honest dups / 0 failed; combined review reel
  new_glitch/batch_reel.mp4 (4:00) + batch-manifest.md regenerated. Recipes
  13–188 are digital-slice family variants (high dup rate is the dedupe
  working); later families start at higher indices.
- AM import: group nesting, masks and gradient fills are data-only (not
  re-rendered); unmapped AM ids preserved raw on clips + dumps.
- CC Overlays/Sfx/Back Grounds bytes: catalogued, not downloaded (~120 MB —
  on request).
- insideVideo in BROWSER playback: guarded/partial (headless complete).
- Headless .omni export = schema dump, not a store-produced file.

## Failed / blocked

- mega.nz overlay folder: unreachable from sandbox allowlist (recorded in
  CC-SCAN.md; nothing claimed).
- Desktop Tauri installer: BLOCKED (no Rust toolchain).
- ≥80% similarity claims: NOT MEASURED anywhere (no declared metric).
- UI workspace rebuild (BrandBird/CapCut refs): not started.

## Preservation

- No user media deleted (fonts_stage intermediate removed after extraction;
  originals remain in Drive + `new_doc_toll_research/tymm/fonts/`).
- `google_drive/` staging stays gitignored; study MP4s and data-dumps live in
  git per vow.md §2.
