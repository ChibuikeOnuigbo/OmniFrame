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
