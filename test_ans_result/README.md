# test_ans_result — answers produced BY THE APP's universal tools

Law (vow.md): no task-shaped tools, no agent pixel-work. The layer exposes the
app's MAJOR tools; puzzles are recipes (plain JSON call lists); the agent's
eyes are `snapshot` / `data:img` dumps; the app renders everything.

## Universal tool catalog (29)
project_new · omniframe_mode · import_media · new_background · click · select ·
mask_draw · mask_clear · roto_mask · keyframe_set · curve_set · transform_set ·
duplicate_paste · blend_set · effect_set · remove_background · fill_composition_area ·
compound_clip_create · context_menu · create_text · edit_element · smart_patch ·
snapshot · render_export · inspect · data_dump · help · list_presets · run_recipe

    node tools/mcp/cli.mjs help                     # explains every tool + app function catalog
    node tools/mcp/cli.mjs list_presets --params '{"catalog":"text","limit":10,"dataImg":true}'
    node tools/mcp/cli.mjs data_dump --params '{"withImages":true,"times":[0,1]}'   # data:img for vision models
    node tools/mcp/cli.mjs run_recipe --params '{"file":"tools/mcp/recipes/board_E_move.json"}'

## Recipes (data, not code)
- board_E_move.json — click existing rect → mask_draw over it → pos1 key → end key at destination → ease-in-out → full comp render.
- board_D_tank.json — cut obj (duplicate_paste) → mask → 3×3 paste grid fills tank (sizes/pos computed from snapshot).
- board_A_roto.json ×10 — mask character + parchment bg replace + height-chart/smoke overlay layering (blend/opacity variants).
- board_B_inpaint ×10 — smart_patch strategies (clone/blur/gradient) with feather + donor.
- board_C_key ×10 — replaceBg beds + luma-key bg removal + keyed entrances + lighting/chromatic effects.

## Board K — MCP-driven ALL-ELEMENTS sweep (no py/ffmpeg authoring anywhere)
Every proof pixel comes from the app: `data_dump` data:img previews decoded straight to
`evidence/K-*.png` (16 frames). Sweep asserts, through MCP registry calls only: glow → edge glow →
light layer (each visibly different), rectangle mask → inverted feathered ellipse → mask_clear
restore, drawing shape strokes (rectangle/star/polygon/bezier/fill, normalized points), and one live
render per Effects sub-tab (glitch/motion/color/blur/distort/retro/light/particles). The sweep also
forced headless effect parity: CSS-filter keys, particle/overlay layers and light layers now apply in
appRender exactly as in playback.

## Board J — CapCut-style effect system (drop-on-clip, closed container, keyframes)
Effects tab (9 sub-tabs, 9,170 real presets — honest count, every tile renders) + fx instances:
dropped onto image/video/compound clips (full clip length, white trim handles, closed container
clamped every drag step), per-property keyframes (◆ at playhead), standalone effect clips grade every
track BELOW them, glitch moved out of transitions into keyframeable effects, context-menu quick-add,
Del/Backspace deletes the active effect, Ctrl+Y = redo alongside Ctrl+Shift+Z.
Recipe `tools/mcp/recipes/board_J_effects.json` (3 variants) → `J_effects/fx-{glitch-keyframed,ranged-vhs,layer-noir}.mp4`;
evidence frames `evidence/J-fx-*.png` (glitch early≠late proves the keyframed intensity; ranged clean≠graded
proves the inner range; noir frame proves the layer grades everything below). MCP tools: fx_catalog / fx_add /
fx_update / fx_remove (48 tools total).
Follow-ups (same board): keyframe diamonds render on the fx bars; FX Stack gained precise In/Length
inputs; dropped fx names join the clip effects badge; the Effects dock auto-widens +96px; and
`new_doc_toll_research/effects-tutorials.html` holds the generated tutorial corpus — 9,170 real
tutorials (23 step cards, 12 rendered proofs, full recipe index, official AM crosswalk).

## Board I — GAP queue (am_research sweep)
AM Oscillate (official Magnitude/Frequency/Angle/Wave/Phase), turbulent warp, lasso_select polygon
selection. Recipe `tools/mcp/recipes/board_I_gaps.json` (3 variants) → `I_gaps/gaps-{all,oscillate,turbulent}.mp4`;
frames `evidence/I-gaps-*.png` (osc-a vs osc-b prove the wobble moves).

## Board H — AE one-framer family (MatttVfx j3Lt0dU1Lok)
`effect_set` keys minimax/minimaxAngle/minimaxMode, vhs, dirColorize(+From/To/Angle) in pixelGrade
applyOneFramer. Recipe `tools/mcp/recipes/board_H_oneframer.json` (3 variants) →
`H_oneframer/oneframer-{all,vhs,minimax-colorize}.mp4`; frames `evidence/H-oneframer-*.png`.

## Board G — NothingxArt ibisPaint X sunset (shorts/2yAZqtdc_qk)
Painted on the universal paint canvas with `draw_stroke` (gradient sky, filled sun disc, 12-ray radial
ruler, smudge clouds, reflections, silhouette bezier, birds), exported as an ibisPaint-style process
recording with `paint_timelapse` — plain (`G_paint/paint-timelapse.mp4`) and with the dreamcore grade
(`G_paint/dreamcore-timelapse.mp4` + final pngs). Mid/early frames `evidence/G-timelapse-{mid,early}.png`
prove strokes appear in draw order (sun finished while the second hill is still undrawn).
Recipe `tools/mcp/recipes/board_G_sunset.json`; study note `Study_edits_videos/nothingxart-sunset-2yAZqtdc_qk.md`.

## Board F — Alight Motion family
effect_set carries every AM-named key; evidence/F-*.png are per-effect frame
proofs, F_amfx/procedural.mp4 shows echo+shake+strobe+motion-blur on a moving
clip, timefx.mp4 shows reverse+freeze. See
Study_edits_videos/handbox-rewatch-alightmotion.md for the rewatch mapping.

## Same principle on every board
D: object is CUT out (roto click -> extract -> patch under) and the cut piece
fills the tank grid. A: roto click-matte exported as luma proof + polygon roto
mask for the composition. B: roto clicks probe the patch region (luma proof).
C: transparent-select (ignore black) -> extract -> patch under replaces the
old remove_background shortcut. Evidence luma mattes: evidence/*-luma*.png.

## Omniframe law (board E)
One import, stretch 1s->10s->24s, compound, cycle all six selection methods
(logged), transparent selection chosen, extract cut-out to track above,
patch-under the hole, 5 flash holds x2s (constant, byte-identical frames),
15 curve segments incl. 5 custom dragged curves on the CUT-OUT, eased move to
destination. See PROOF.md + the research PDF for the audit.

## Tracks & timeline proof
Cutouts/pastes/overlays live on their own tracks (track_new/track_assign);
each recipe ends with timeline_screenshot → evidence/timeline-*.png drawn by
src/lib/timelineSnapshot.ts (same code runs inside the booted app via
window.omniMCP.call('timeline_screenshot') → data:img).

## Proof & feedback
- every mp4 sidecar: `tool:"render_export"` + full recipe trace + inspect dump (never a puzzle name).
- snapshots in */snap-*.png and evidence/ are taken THROUGH the snapshot tool.
- booted app: RightPanel → MCP Console shows the live window.omniMCP call log
  (✓/✗ per call, copy-log-json); window.omniMCP.call('snapshot') returns data:img
  of the real preview canvas. QA: node qa/universal-tools-unit.mjs.

## Board L — backlog→engine proofs (2026-10-26)
App-made only (data_dump data:img), never python/ffmpeg authoring:
- L-base.png — clean baseline frame (imported qa/shots/01-home.png)
- L-kaleido-6.png — 6-wedge mirror rosette (kaleidoSegments=6)
- L-flare-anamorphic.png — core bloom + horizontal anamorphic streak + ghost rings (flare-0)
- L-kelvin-3200.png / L-kelvin-10000.png — tungsten warm cast vs deep-shade cool cast (R−B channel shift asserted)
- L-kelvin-ramp-warm.png / L-kelvin-ramp-cool.png — same instance, 2-point colorTemp keyframe ramp sampled at t=0.1 / t=1.4 (animation asserted)
QA assertions: visibility diff ≥300 px vs base; flare lifts luminance (screen blend); 3200K shifts R−B warmer by >6; 10000K cooler than 3200K by >6; ramp animates; catalog exposes kaleido params. UNIVERSAL TOOLS QA: PASS, 0 FAIL.

## Board M — Krita-scan sub-tools + paint parity (2026-10-26)
App-made only (data_dump data:img after renderFrame gained renderAllPaintLayers parity):
- M-base.png / M-line-plain.png — baseline vs single line stroke
- M-multibrush-mirrorX.png — line + reflected copy across vertical centre axis (Krita Multibrush mirror)
- M-gradient-linear.png / M-gradient-radial.png — Krita Gradient tool shapes (linear ramp vs radial from stroke start)
- M-sym-single.png / M-multibrush-sym8.png — radialCopies=8 symmetry ring vs single dab
QA assertions: line visible ≥100 px diff; mirror adds reflected copy; radial ≠ linear ≥300 px; sym-8 ≠ single ≥200 px. UNIVERSAL TOOLS QA: PASS, 0 FAIL.
