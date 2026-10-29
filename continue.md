# CONTINUE.md — read this EVERY run (stateless safety)

**Mandate (user):** this file must exist and be checked on EVERY run. If a
session died mid-work, resume from here. Never claim false completion; report
only what is verified shipped.

## Standing laws (always active)

1. **5000-recipe mandate:** keep producing glitch/effect recipes until 5,000
   are rendered + validated IN-APP (combined MP4 + manifest per batch;
   checkpoint `new_glitch/batch/checkpoint.json` — **next = 364**; 183 kept /
   91 dups / 0 failed so far (slices 13–100 and 100–188)). Bounded honest sets + md indexes for mass
   renders; user rates keep/delete/improve. **After every special task, go
   BACK to the 5000 recipes and keep adding.**
2. **Universal-tools / MCP-only law:** boards solved by universal tools only
   (`qa/universal-tools-unit.mjs` must stay PASS: 63 steps, 59+ tools, no
   task-shaped tools).
3. **STATE.md honesty** (`reports/STATE.md`): only verified-shipped claims;
   similarity NEVER claimed ≥80% without a declared metric.
4. **FEATURES ledger** (`reports/FEATURES.md`): every shipped feature appended.
5. Exact spellings: `new_doc_toll_research`, `data_motiondesijg`. Never delete
   user media. ≤9 primary items per section. emu_im_save.
6. Preview/export parity: browser + headless share `src/lib/*` engines.

## Every-run checklist

- [ ] `git status` / HEAD matches `origin/arena/212bca02-omniframe` (rollback
      pattern seen 5×: recover with `git fetch origin && git reset --hard
      origin/arena/212bca02-omniframe`; then `npm ci` if node_modules is gone)
- [ ] `npx tsc --noEmit -p .` clean
- [ ] `node qa/universal-tools-unit.mjs` → PASS
- [ ] `node qa/replace-template-demo.mjs` → PASS (demo-process-and-swap test:
      original video processed → template_capture → NEW video → template_apply
      → replace_video carry/no-carry → `test_ans_result/replace-template-demo.mp4`)
- [ ] `node qa/tymm-lut-parity.mjs` → PASS (lossless 64³ TYMM LUTs)
- [ ] `node qa/alight-roundtrip.mjs` → PASS (XML export/import round-trip:
      project + template + shake pack; proof test_ans_result/xml-roundtrip.mp4)
- [ ] continue the batch queue (`qa/newglitch-batch.mjs`, checkpoint next=364)
- [x] video-study corpus scan (Drive 1KlxUlem…): 41-video index + gap analysis in new_doc_toll_research/video_study/; acceptance tests green (`node qa/video-study-e2e.mjs` against vite :5173, `node qa/video-study-render.mjs` headless proof)
- [ ] update STATE.md + FEATURES.md, commit, push to the session branch

## Shipped this line of work (verified)

- **TYMM LUTs = FIRST BATCH** in `public/luts/manifest.json` (tymm-3…tymm-7,
  lossless Hald→cube 64³, node error 0.000/255; sources kept in
  `public/luts/source-tymm/`). Browser: EffectsPanel LUT picker; headless:
  `adjustment.luts [{builtin:'tymm-5'}]` via appRender loadCubeLut.
- **TYMM fonts (49)** in `public/fonts/`, named by FILE STEM (user mandate):
  `src/lib/fontPack.ts` (FONT_PACK + FONT_FACE_CSS injected in main.tsx and
  index.css), headless `GlobalFonts.registerFromPath` in `tools/mcp/core.mjs`
  (FONT_PACK_FILES), TextPanel dropdown extended, MCP `list_fonts`.
- **Replace-Video-With-Video** (CapCut parity, screenshots in
  `new_doc_toll_research/imgs/capcut-replace/`): drop a video ON a video clip
  → ReplaceDialog (filmstrip + draggable window = target clip duration +
  "Use the original video effect" checkbox). Pure engine
  `src/lib/replaceVideo.ts`; store `openReplaceDialog/commitReplaceVideo`;
  MCP `replace_video {clipId,path,windowStart,carryEffects}`.
- **TEMPLATE MODE:** `template_capture` dumps EVERY processing stage
  (transform+keys, effects, fxInstances, LUT grade, masks, blend, speed,
  textStyle, volume, in-point ratio) to `data_motiondesijg/templates/<id>.json`;
  `template_apply` replays it onto any clip; `list_templates`; browser store
  `captureTemplate/applyTemplate/templates`.
- **Alight Motion study + import:** `src/lib/alightXml.ts` (parser incl.
  shape/text/nullobj layers, normalised kf + cubicBezier→custom curve points,
  ~100 AM effect ids → AM_EFFECT_MAP; mapped ones merged into the site fx
  catalog `src/lib/effectCatalog.ts`), MCP `alight_import` (dumps to
  `data_motiondesijg/alight/`), MediaPanel "Import Alight XML" button +
  `store.importAlightXml`. All 12 corpus XMLs import (see
  `docs/alight-motion-study.md`). Proof: `test_ans_result/alight-warps-import.mp4`.
- **XML EXPORT/IMPORT (user mandate):** MediaPanel exports the project and the
  latest template as Alight-Motion-dialect XML (lossless round-trip through
  omniframe.* namespaces); Import button reads AM projects AND template XMLs.
  MCP: alight_export / template_export / template_import. AM project files are
  NOT bundled in the app — users import/export XML.
- **Built-in SHAKE PACK:** all 8 Shakes.xml presets with original keyframe
  values (EffectsPanel section, store.applyShakePreset, MCP shake_apply,
  list_presets catalog=shake).
- **CC/TYMM Drive scan:** `new_doc_toll_research/CC-SCAN.md` (Overlays 38,
  Back Grounds 42, Sfx 41 in 5 subfolders, Shakes.xml imported, text-preset
  data incl. Quicksand_Bold stem match with the font pack; mega.nz recorded
  as unreachable from sandbox — NOT claimed done).

## Open items (resume here)

- 5000 recipes: continue from checkpoint **next=276** (batch_reel.mp4 = 12:12 combined review of all 183 kept, 0 failed; user keep/delete/improve rating pending).
- mega.nz overlay folder when network allows (or user drops files into
  `new_doc_toll_research/`).
- Overlays/Sfx/Back Grounds media: download + wire as an in-app pack browser
  entry when the user wants the bytes locally (names catalogued already).
- AM import gaps (honest): content:// media = placeholders (re-link via
  replace_video), group nesting + masks data-only, gradient fills raster flat.
- Browser insideVideo parity, headless .omni export, roto feather calibration,
  UI workspaces, Tauri (blocked) — from ARENA_MASTER_PROMPT P0 list.

- `URL=http://localhost:5173/#studio node qa/replace-template-ui-e2e.mjs` → REPLACE+TEMPLATE UI E2E: PASS (real Chromium: replace window math/drag clamp/carry, template capture→XML→re-import→chain replay, project XML round-trip in browser, TYMM LUT first batch, shake pack UI + NANIMALO apply).
