# test_ans_result — graded answer pack

Every uploaded board (sources/) analysed, converted to video, and solved.
All renders go through the MCP utility layer (`tools/mcp/`): OOP tools,
chunked-JSON returns (sha256-manifested), and a FrameProvider so any frame of
any mp4 can be pulled on demand.

## Layout
- `A_analysis.mp4 … E_analysis.mp4` — each source board converted to video (ken-burns + decoded callouts).
- `A_composition/variant-01..10.mp4` — board A: roto-mask character + bg replaced with parchment + height-chart/overlay layering. **10 results** (composition/effects question).
- `B_inpaint/variant-01..10.mp4` — board B: matte/roto + 10 inpaint/smart-patch car-removal strategies, each with a measured blend-quality delta (lower = cleaner blend; best = blur-fill 0.0181). **10 results**.
- `C_composition/variant-01..10.mp4` — board C: bg replacement × 10, each logging 15 edit ops (composition, lighting, speed curve, entrance, cc) = **150 edits total**. **10 results**.
- `D_tank_fill/solution.mp4` — board D puzzle: cut obj (ctrl+x), computed 4×4 grid (cell 70×72) fills the tank exactly; placements in the sidecar JSON.
- `E_move/solution.mp4` — board E puzzle solved THE OMNIFRAME WAY: masking sub-tool draws a rectangle over the EXISTING black rectangle in the image (no new elements), position keyframe 1 set at its original position, end key at the destination rectangle, then the FULL composition is rendered (plate + masked layer + key diamonds + curve plot HUD). Sidecar carries the app-format descriptor (ClipVisualMask rectangle + ClipAnimation PropertyCurve keyframes, easing via src/lib/speedCurves.ts) and 48 per-frame key evaluations. QA: `node qa/move-composition-unit.mjs`.
- Every mp4 has a `.json` sidecar (full ToolResult + chunk manifest). `INDEX.json` lists all files.

## Pull any frame (preview-friendly)
    node tools/mcp/cli.mjs get_frame --params '{"video":"test_ans_result/C_composition/variant-03.mp4","index":20}'
    node tools/mcp/cli.mjs get_frame --params '{"video":"…mp4","index":20,"dataUrl":true}' --chunks
    node tools/mcp/cli.mjs list            # all tools + schemas
    node tools/mcp/cli.mjs <tool> --params '{…}' --chunks   # streamed chunks

## Speed curves (board C) shipped into the editor
15 presets in `src/lib/speedCurves.ts`, clip field `speedCurve`, remap applied
in playback media sampling, UI = RightPanel "Speed Curves" main tool with the
segment carousel of 15 beneath (user UI law). QA: `node qa/speed-curves-unit.mjs`.
