# OmniFrame STATE — Mega-turn cont.: XML export/import + Shake pack (2026-10-29)

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
