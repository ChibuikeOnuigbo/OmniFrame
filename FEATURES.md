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

**Total: 77 shipped features** (audit: `grep -c '^[0-9]' FEATURES.md` = 77) (27 scenes + 20 FX kinds + 10 null/group + 10 UI + 6 pipeline).
Watched videos at this commit: **344** (see youtube-audit/progress.json watched_ids).
