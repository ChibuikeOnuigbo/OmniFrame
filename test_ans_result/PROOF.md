# PROOF — the app did the work

1. **Recipes, not agent code**: every mp4 in this pack was rendered by
   `run_recipe` executing universal tool calls (tools/mcp/recipes/*.json).
   Sidecars name `tool:"render_export"` and carry the full step trace.
2. **Timeline screenshots** (evidence/timeline-*.png, 62 files): drawn by the
   app's own renderer src/lib/timelineSnapshot.ts — tracks (cutout/paste/overlay
   rows separate from plates), MASK badges, keyframe diamonds per curve,
   selection outline, playhead, and the ✓/✗ MCP call log.
3. **Live app**: boot `npm run dev`; RightPanel → MCP Console shows every
   window.omniMCP call as it happens; `omniMCP.call('timeline_screenshot')`
   returns data:img of the live timeline; `omniMCP.call('snapshot')` the preview.
4. **Agent eyes/hands**: only snapshot/data:img dumps for seeing; only universal
   tool calls for acting (vow.md universal-tools + proof laws).
5b. **No-slide proof**: evidence/E-snap-hold-a.png and -hold-b.png are
   byte-identical (md5), E-snap-jump.png differs — omniframe steps, not slides.
5. **QA**: node qa/universal-tools-unit.mjs (trace contains only universal
   steps, keys/mask asserted, data:img dumps verified).
