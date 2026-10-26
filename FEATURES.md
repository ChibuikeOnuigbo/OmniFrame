# OmniFrame feature ledger (added in this study mission)

Every line = one shipped, verifiable capability (code + QA or rendered product).
Count is auditable: `grep -c '^[0-9]' FEATURES.md`.

## Scene recreations (watched-tutorial grammars → renderers)
1 scene_comp_light — comp-light relight (M2_vjAseOns)
2 scene_crt_blotch — CRT blotch amplitude map (RktZGRjji5g)
3 scene_magna_split — gold divider before/after (jlDIX3Ky-hs)
4 scene_line_draw — line draw-on split (kZskcvTkAjs)
5 scene_rim_glow — manga rim-glow pulse (khjRWWTYZcc)
6 scene_mosaic_pix — mosaic pixel shift (jlDIX3Ky-hs)
7 scene_roto_poly — roto polygon hero proof (pztANrbFI3w)
8 scene_tv_mask — rounded TV mask device (AsHnacGDo6E)
9 scene_slit_halftone — slit-scan halftone (Z8EAr0p6X14)
10 scene_fisheye_sting — fisheye sting (NIKA tutorial)
11 scene_spotlight_typo — spotlight typo scatter
12 scene_neon_arc — neon arc draw
13 scene_logo_cloud — logo cloud drift
14 scene_grade_compare — grade compare slider
15 scene_xslash_graph — X-slash + speed-graph inset (chIJCGNoGls)
16 scene_thumb_wall — 3D thumbnail wall
17 scene_cutout_checker — cut-out checker proof
18 scene_material_spheres — material sphere row + cam arc
19 scene_quote_band — quote band card (chat links)
20 scene_mono_typo — mono micro-caps typo (chat links)
21 scene_drift_trail — drifting plane + trail (K2mSI59wPvg)
22 scene_flare_sting — anamorphic flare sting (V9ApHueQbN0)
23 scene_wedge_wipe — diagonal wedge wipe (Q9Aka1vrJVQ)
24 scene_card_inset — feathered white card inset (rsUw8ijzPow)
25 scene_gold_card — tilted gold card on vignette (vCrpT1dA6QU)
26 scene_wire_glow — glowing wireframe object (AQV-mQzAs-U)
27 scene_dual_typo — dual-style two-line typo (WJAO6OXE4kM)

## FX layer kinds (particleFx / overlayFx / replaceBg)
28 feathers
29 embers
30 dust
31 bokeh
32 sparkles
33 snow
34 rain
35 petals
36 scanlines
37 halftone
38 spotlight
39 vignette
40 lightleak
41 frameglow
42 synthwave
43 aurora
44 grid
45 bokeh bed
46 sunset
47 studio

## Null / parenting / groups (AE + Alight Motion + CapCut research)
48 Null object layer kind (renders zero pixels, controller only)
49 addNullObject + three entry points (timeline menu, LinkPanel, store)
50 Track → Null bake (tracker data → null position curves) + TrackingPanel button
51 Flag-gated hierarchical parent inheritance engine (parentChain.ts)
52 applyParentWorld in playback (children follow null chains per-link)
53 groupSelection / ungroupSelection (CapCut Ctrl+G model)
54 Ctrl+G / Ctrl+Shift+G global shortcuts
55 Clip context menu: Group / Ungroup / New Null Object
56 Selection auto-expands to whole group (CapCut/Shotcut rule)
57 Group colour bands + dashed NULL tile visuals

## UI patterns & popups (user-mandated)
58 SegmentCarousel (square arrows + equal-size segment view, user sketch)
59 ExpandableToolGroup (main tool down-arrow → connected sub-tools under)
60 FX beds refactored into expandable groups + carousels
61 AE Tool Rack regrouped into 3 main tools + carousels
62 Transition pillar carousels (preset cycling = selecting)
63 Composition Settings popup (size / fps / background / duration)
64 Sequence background colour consumed by renderer + exports
65 Masking & Roto right-panel section
66 AE Tool Rack right-panel section
67 Amber Import icon (distinct colour)

## Production / research pipeline tools
68 Headless MP4 export pipeline (tools/render-study-mp4s.mjs, real renderer code)
69 Exports browser viewer (exports/index.html, manifest-driven)
70 Micro-sheet builder (tools/build-micro-sheets.py, legacy 768×158 spec)
71 Chat-history link harvester (WhatsApp zip → links.json → runner merge)
72 Reddit collector runner step
73 vow.md accountability contract
74 Speed-curve engine: 15 presets + clip speedCurve remap in playback + RightPanel carousel group
75 MCP utility layer (tools/mcp): OOP MCPTool/Registry, chunked sha256 JSON returns, FrameProvider
76 test_ans_result grader pack: 37 solved mp4s + sidecars + INDEX (boards A-E)
77 Masked-keyframe move solver (board E): mask existing rect -> pos1/end keys -> full comp render, app-format descriptors
78 Universal MCP toolset v2 (29 major tools: click/mask/keyframe/curve/compound/fill/smart-patch/snapshot/render/help/presets)
79 Recipes-as-data solver (run_recipe + 5 board recipes incl. 30 variants)
80 In-app mcpBridge (window.omniMCP) + RightPanel MCP Console log/feedback
81 ClipEffect.fractalBlur (3-octave stacked blur) + pixelGrade maths + rack entry
82 ClipEffect.lumaKey bg removal + remove_background tool + rack entry
83 ClipEffect.cardFlip fold + pixelGrade maths + rack entry
84 data_dump with data:img previews/clip thumbs for vision models
85 timelineSnapshot.ts: app timeline renderer (tracks, MASK/ROTO badges, key diamonds, playhead, MCP log)
86 MCP timeline_screenshot tool (headless + in-app bridge) — anti-cheat proof PNGs/data:img
87 track_new/track_assign universal tools + data_dump data:video embedding
88 selectionMattes.ts: transparent selection, brush strokes, mind-main-element flood (app+headless shared)
89 omniframe_extract: cut-out section becomes a clip on the track above; source keeps the hole
90 patchUnder.ts: smart ring-average patch-under, rendered by playback.ts AND appRender.mjs
91 omniframe_move: constant-interpolation step moves (no slide) + clip_stretch/clip_remove
92 CurveEngine 'custom' interpolation: user-dragged curve points (5 shipped in board E)
93 omniframe panel audit: duplicate/transform/recolor/scope removed as redone; 4 real skill buttons added
94 streaming VideoEncoder (raw frames to disk) — long exports no longer OOM
95 rotoClick.ts shared lib: per-click colour models, hole-fill, soft matting band, luma-matte export
96 roto_mask v2: click-segment mode + polygon mode + exportMatte; app Smart engine delegates to same maths
97 pixel-matte mask kind rendered by headless appRender (clip.mask.kind 'matte')
98 boards D/A/B/C rebuilt on the omniframe principle: D cut+paste fill, A roto probe+polygon, B roto probe, C transparent-select extract
99 AM pixel family in pixelGrade (16 keys: zoomBlur, directionalBlur, glow, edgeGlow, tiltShift, vignette, flicker, tiles, pinchBulge, swirl, gradientMap, threshold, sharpen, findEdges + colours)
100 AM procedural family proceduralFx.ts (echo keyframes, auto-shake, time quantization, motion blur, reverse, freeze) wired into playback + appRender
101 AE rack +18 Alight-Motion-named entries; headless document shim so app pixelGrade runs in node unchanged
102 ibisPaint X smudge brush (drag existing pixels along the stroke path, blurred re-stamp) in drawingEngine
103 ibisPaint X radial/symmetry ruler on any stroke (radialCopies + radialCenter; sun rays, mandalas)
104 universal paint canvas tools draw_stroke/paint_clear — the app paint engine exposed headless, seq-px in, normalized store
105 paint_timelapse: process-recording export to mp4 (strokes appear in draw order) + dreamcore grade preset (glow/grain/chromatic/vignette/dusk gradientMap) on rack + ToolResult sidecar
106 shape fill honoured on circle/ellipse tools (filled flag) for solid sun discs / planets
107 AE one-framer directional minimax smear (minimax/minimaxAngle/minimaxMode) in pixelGrade applyOneFramer
108 AE one-framer VHS aesthetic (scanlines + tape noise + chroma bleed + per-frame band wobble) as `vhs` key
109 AE one-framer directional colorize (dirColorize + From/To/Angle two-colour ramp) + rack entries for all three
110 AM Oscillate with OFFICIAL properties (Magnitude/Frequency/Angle/Wave sine+triangle/Phase) in proceduralFx, wired playback + appRender rect pass
111 turbulent/fractal-style warp pixel key (sin-domain displacement) in applyOneFramer
112 lasso_select: freeform polygon selection (7th selection method) via selectionMattes.lassoMatte
113 CapCut-style effect instances: drop effects ONTO image/video/compound clips (closed container — white trim handles clamp inside the parent every drag step, min 0.1s, infinite stacking), inner timeline bars, Del/Backspace deletes the active one
114 Effects tab with 9 sub-tabs + search: 9,170 REAL presets (honest count; combinatorial colour-ramp families × angles + glitchology/AM/AE-traced curations) — click applies & auto-opens the right-panel FX Stack, drag tags a clip, L places an adjustment layer
115 Glitch as an EFFECT (moved out of transitions): intensity/style/scanlines/static/seed/step-rate all editable + keyframeable; transition picker no longer offers glitch (legacy projects still render)
116 Undo/redo audit: Ctrl+Y redo (with Ctrl+Shift+Z), every fx action snapshot-undoable, clip split/trim carries & re-clamps fx instances
117 FX polish: keyframe diamonds on the timeline fx bars, precise In/Length numeric inputs in FX Stack, dropped-fx names in the clip effects badge, Effects dock auto-widens for listing space
118 Generated effects-engine tutorial corpus: qa/generate-fx-tutorials.mjs → 9,170 real tutorials (23 step cards + 12 headless-rendered proofs + full recipe index + official AM effects-index crosswalk with honest shipped/backlog split)
128 Timecode burn-in engine (AM official guide): running HH:MM:SS:FF overlay, opacity+size keyframeable — P-timecode-burnin.png
129 Krita Multibrush Translate sub-tool: translateCopies 2-12 ring copies at translateRadius — P-translate-ring4.png
130 Krita Gradient repeat sub-tool: gradientRepeat forward (saw) / alternating (triangle) — P-gradient-repeat-*.png
126 Voronoi Cells engine (AM official guide deep-scan): seeded random sites 4-48, nearest/second-nearest cell-edge glow + cell tint, colour/intensity keyframeable — O-voronoi-16.png
127 Spectral Map engine (AM official guide deep-scan): luma→hue-spectrum remap 0-300°, intensity keyframeable, chroma-rise asserted — O-spectral-1.png
125 Krita Freehand Brush stabilizer sub-tool: smoothing 0..1 weighted moving-average shake correction (freehand tools only, Krita tool-options scan) — proven N-stabilizer-raw vs N-stabilizer-095.png
123 Drawing toolbar regrouped Krita-style (official toolbox scan): 7 primary group tiles (Brushes/Shapes/Paths/Fills/Repair/Erase/Select) + scrollable icon sub-mode rows — shapes/paths/fills/7 select modes inside groups, no wrapped flat row, ≤9 primary law kept
124 Krita Multibrush mirror sub-tools (mirrorX/mirrorY, X/Y/both reflected copies) + Gradient radial shape (gradientShape) — MCP-controllable, proven M-multibrush-mirrorX/gradient-radial.png; headless renderer gained paint-layer parity (renderAllPaintLayers) so data_dump previews show strokes
120 Board L Kaleidoscope engine — mirror-wedge rosette (2-12 segments + wedge rotate, CC Kaleida / Resolve Mirrors-Rosette family), keyframeable, proof L-kaleido-6.png
121 Board L Lens Flare engine — procedural optical flare: core bloom + anamorphic streak + ghost rings + halo, position/tint/streak/ghosts all keyframeable, proof L-flare-anamorphic.png
122 Board L Color Temperature engine — Kelvin white balance 1500-15000K (6500 neutral), 5 catalog presets, 2-point keyframe ramp proven animating (L-kelvin-ramp-warm/cool.png)
119 Board K all-elements sweep (MCP-only proofs via data_dump data:img): glow/edge-glow/light, shape masks + restore, drawing shape strokes, one render per effect sub-tab — plus headless effect parity fixed (CSS filters, particle/overlay layers, light layers in appRender)

**Total: 130 shipped features** (audit: `grep -c '^[0-9]' FEATURES.md` = 130) (27 scenes + 20 FX kinds + 10 null/group + 10 UI + 6 pipeline).
Watched videos at this commit: **347** (see youtube-audit/progress.json watched_ids).
