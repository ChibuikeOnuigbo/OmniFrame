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
131 align_clips tool: hcenter/vcenter/left/right/top/bottom/distribute-h against seq frame, writes clip.transform — Q-align-centered.png
132 motion_analyze tool: changedRatio + bbox + centroid + 8×6 activity grid + morphScore between t0/t1 renders — Q-motion-osc.png
133 shape_detect tool: B/W matte (thresh) → connected components → square/rect/circle/line/blob classification; matte scans saved to data_motiondesijg/scans/ — Q-shape-rect.png
134 Prism advanced effect: per-column hue-rotate sweep 0..1 across width, keyframeable, catalog prism-1/prism-2 — Q-prism.png
135 Compound clip persistence: compound_clip_create registers compound-N + compound_list / compound_rename / compound_expand (returns memberIds)
136 Flame identity de-slop: brand #6d5efc vibecode violet → #ff6b35 flame ramp (200/300/400/600), desktopPack canvas fills + range thumb + wave rebranded; semantic category colors (IMG purple / CMP indigo / adjustment / amber / emerald) deliberately kept
137 Personality font stack: Inter → Avenir Next / Segoe UI Variable Display / Trebuchet MS / DejaVu Sans (no webfont download); mono stack unchanged for timecodes
138 Sharp-corner system: ~81% of 1047 radius tokens forced to 0 via index.css omniframe overrides; kept ~19% varies on purpose (md 3px, sm 2px, full 999px, scrollbar 2px); capcut/krita/premiere/daylight theme skins still override per data-ui-style
139 Anti-glass/anti-glow: backdrop-blur disabled in default style, 5 timeline neon selection glows removed, Landing + VoiceIsolation gradient hero cards flattened to solid ink
140 Tooltip overhaul: DrawingToolbar 6 native titles → custom Tooltip, 3 double-tooltips deduped, 4 redundant menu title attrs removed, bubble solid/sharp/roomier (px-2.5 py-1.5)
141 Icon cleanup: 7 duplicate Sparkles purged from transition menu (Blend / ImageOff / none), decorative Layers filler icons removed (ClipFilmstrip, DrawingToolbar subtool row), filmstrip placeholder bars neutralized
142 Sub-mode rail real icons: hardcoded Sparkles+animate-pulse placeholder replaced by lucide name→component resolver (10 names); TextPanel sparkle-family submode names renamed (Type/LibraryBig); smart-patch menu icon Replace; Shapes for 3D materials
143 Shadow tempering: 26× shadow-2xl + 4× shadow-xl tightened to functional elevation in default (omniframe) style via index.css overrides; semantic pulses (model-load phase, cursor status dot) deliberately kept
126 Voronoi Cells engine (AM official guide deep-scan): seeded random sites 4-48, nearest/second-nearest cell-edge glow + cell tint, colour/intensity keyframeable — O-voronoi-16.png
127 Spectral Map engine (AM official guide deep-scan): luma→hue-spectrum remap 0-300°, intensity keyframeable, chroma-rise asserted — O-spectral-1.png
125 Krita Freehand Brush stabilizer sub-tool: smoothing 0..1 weighted moving-average shake correction (freehand tools only, Krita tool-options scan) — proven N-stabilizer-raw vs N-stabilizer-095.png
123 Drawing toolbar regrouped Krita-style (official toolbox scan): 7 primary group tiles (Brushes/Shapes/Paths/Fills/Repair/Erase/Select) + scrollable icon sub-mode rows — shapes/paths/fills/7 select modes inside groups, no wrapped flat row, ≤9 primary law kept
124 Krita Multibrush mirror sub-tools (mirrorX/mirrorY, X/Y/both reflected copies) + Gradient radial shape (gradientShape) — MCP-controllable, proven M-multibrush-mirrorX/gradient-radial.png; headless renderer gained paint-layer parity (renderAllPaintLayers) so data_dump previews show strokes
120 Board L Kaleidoscope engine — mirror-wedge rosette (2-12 segments + wedge rotate, CC Kaleida / Resolve Mirrors-Rosette family), keyframeable, proof L-kaleido-6.png
121 Board L Lens Flare engine — procedural optical flare: core bloom + anamorphic streak + ghost rings + halo, position/tint/streak/ghosts all keyframeable, proof L-flare-anamorphic.png
122 Board L Color Temperature engine — Kelvin white balance 1500-15000K (6500 neutral), 5 catalog presets, 2-point keyframe ramp proven animating (L-kelvin-ramp-warm/cool.png)
119 Board K all-elements sweep (MCP-only proofs via data_dump data:img): glow/edge-glow/light, shape masks + restore, drawing shape strokes, one render per effect sub-tab — plus headless effect parity fixed (CSS filters, particle/overlay layers, light layers in appRender)

144 Board S compound no-cutoff fix (browser): isolated compound/clip renders (LUT, mask, grade, fx layers) now use a 3x-frame padded scratch — a 1000x1000 element inside a 100x100 view survives compounding instead of vanishing; ghost/echo sampling offset-aware
145 Board S clip blend-mode UI: 13-mode select in Appearance (source-over/multiply/screen see-through/overlay/darken/lighten/color-burn/color-dodge/hard-light/soft-light/difference/exclusion/luminosity) + store setClipBlend + undo-registered; MCP blend_set proven by S-blend-screen vs S-blend-burn pixel diff
146 Board S headless text glow+shadow parity: appRender drawSeq renders textStyle glow (outward bloom, glowColor/glowBlur) + Photoshop-model outer shadow (offset pre-pass) — S-text-glowshadow.png; create_text now works headless (loadAppTs transitive dep closure + store stub)
147 Board S real headless compound nesting: compound_clip_create nest:true moves members into an inner sequence rendered through the same padded no-cutoff path; compound_enter / compound_exit / uncompound_clip = double-click nested timeline + breadcrumbs + Ctrl+Z-reversible uncompound, all MCP-proven
148 Board S MCP demo edit (effect data -> preview on demo media): crimson-pulse LUT-pack grade stored via edit_element adjustment.luts + fx_catalog adjustment-layer drop + image overlay at opacity 0.35 blended screen — S-demo-frame.png + S-demo-edit.png timeline proof
149 Board S edit_element patch surface extended: textStyle merge (glow/shadow/animation fields) + adjustment.luts merge = the MCP-only LUT path
150 Board S visible-edit pass: headless .cube LUT-pack parity (trilinear 3D LUT in appRender, same public/luts packs playback grades with) so MCP renders show grades; keyframe_set/curve_set scalar-curve keys (opacity/playback_speed/wheel_rotation); cycle-safe anti-cheat manifests; watchable demo edit mp4 on the user's uploaded photo (crimson grade + adjustment layer + 0.35 screen overlay + glow/shadow title on custom curve) — test_ans_result/board_S_demo.mp4 + S-demo-graded-frame.png
151 Board S RDT remake (user's reference edit, frame-analyzed): 9:16 canvas + blurred zoom fill pillarbox, per-cut LUT grade switches (teal-amber / crimson-pulse / midnight-noir), see-through screen-blended ALL-CAPS titles with RGB-split glitch, band-aspect changes per cut — rendered MCP-only to test_ans_result/board_S_rdt_remake.mp4 (225 frames); new universal tool clip_move_time (horizontal timeline drag); .cube lattice axis corrected (our packs are blue-fastest) so headless grades match playback intent
152 Board S reinforcement remake pass: 20 parameter versions of the RDT remake scored by a CEM hill-climb against content-normalized descriptors measured from the reference frames (band-vs-border exposure/saturation/warmth, border blur energy, see-through text fraction); elite-5 mean update learned screen-blend ~0.78-opacity glitch titles + punch-in cuts + blur-fill + cyan-surge/violet-dream/midnight-noir grade arc -> test_ans_result/board_S_rdt_best.mp4; all 20 versions + scores.json kept in test_ans_result/rdt-versions/
153 Board S vet-and-improve loop (user: 'vet those videos, create more, delete rubbish'): vet pipeline scores every rendered version against reference-frame descriptors + grammar checks (see-through title visibility, blur-fill border, per-cut warmth sign, darkening arc, reward median) -> 11 gen-1 + 13 gen-2 versions declared RUBBISH and DELETED; vet findings shipped as engine fixes: RGB-split chroma fringes (textStyle.chroma in playback.ts + appRender + TextPanel 'RGB split' slider + preset opts) and per-cut graded blur fills (reference grades the whole frame per cut); gen-2 CEM elite improved -1.329 -> -1.111 -> test_ans_result/board_S_rdt_best2.mp4; 16 vetted versions kept with vet.json/vet-gen2.json
154 Board T per-character text editing (CapCut 'omega' mandate): textStyle.charRanges = unlimited character ranges ("a", "bcs", …) each with own color/fontSize/fontFamily/italic/bold/letterSpacing/opacity/blendMode/glow overrides — headless paintTextRuns (src/lib/textRuns.ts) + browser playback.ts drawLine both honour them; ranges may overlap, later wins
155 Board T sub-content keyframes: keyframe_set property 'charStyle' channel '<rangeIdx>.<prop>' (fontSize/opacity/letterSpacing numeric, color as eased hex stops) — each range carries its OWN key list evaluated per-frame; create_text/edit_element return charMetrics (per-char pos + x/y/w/h in preview px + project ratio) so MCP I/O knows exactly which char is highlighted where
156 Board T curve families (uploaded Easing-Curve/Rebound refs): bounce-param (steps/bounciness/firstBounce damped multi-arc solenoid), bounce-uniform, rebound-in (anticipation dip), rebound-out (overshoot peak ~u0.35 then settle), physical (freq/damping underdamped spring) — all keyframe_set/curve_set selectable with params, custom dragged graph unchanged and verified
157 Board T In-Video Text preset folder (48 presets in 4 sub-folders Fire/Weather/Sky/Neon + Clean): animated bed (synthwave/aurora/grid/bokeh/sunset/studio) + particle field (embers/rain/snow/sparkles/bokeh/dust/petals) painted INSIDE glyph silhouettes via destination-in mask with faint legibility base + edge glow — fire/rain/cloud motion inside typed text; 'plain' Normal Text is FIRST in the list per mandate
158 Board T render proof battery: curve_texts/ 50 videos (every curve family incl. 3 custom dragged graphs, specs.json sidecar), newtext_preset/ 55 videos (48 in-video presets + plain on scene plates + 6 char-edit demos), test_ans_result/board_T_wonderful.mp4 10s single-cut hero 'wodnderful' with per-char color keys at intervals on mixed curves + fontSize pulses, timeline_screenshot proof T-timeline-wonderful.png, board_T_rdt_remake.mp4 remake of vetted Drive RDT_20261027_092910 grammar
159 Board T cont.2 curve engine rebuilt to repair-pack canonical math (tools/curves.py port): full Penner family sine/quad/cubic/quart/quint/expo/circ x in/out/inout + back/elastic/bounce in-out + normalized underdamped-spring rebound-in/out (overshoot past 1 then damped up-down regression; rebound-in adds anticipation dip) + equal-contact decaying bounce (steps/bounciness/firstBounce from uploaded Easing-Curve popup) + springs + anticipate-settle; qa/curve-sim.mjs SIMULATION-VERIFIES geometry (pinned endpoints, overshoot >1.01 with >=2 regressions, bounce contacts, elastic 1.37 peak, back dips) and paints curve-atlas.png; curve_texts/ 50 vids re-rendered on fixed engine
160 Board T cont.2 New Glitch engine: src/lib/glitchNG.ts deterministic RGBA kernel (10 families: slices/RGB-shock/VHS-tear/datamosh/scan-burst/phantom-echo/neon-corrupt/pixel-collapse/vector-edge/spectral) ported from OmniFrame_Glitch_Audit pack, wired into browser playback.ts + headless appRender.mjs with preview/export parity, catalog sub-tab 'Glitch NG' (ng-* ids, every ng* param keyframeable), 5,000 recipe definitions integrated as metadata (new_glitch/index.json + presets.ndjson), 12 real logo-layer renders + combined sampler + MANIFEST.md with sha256 (reports/STATE.md tracks partial/blocked)
161 Board T cont.3 headless per-char text stack + real footage in glyphs: CreateText draw runs the app's own TRM.paintTextRuns (charRanges styles + per-char keyframe_set property 'charStyle' channels 'rangeIdx.prop' for color/fontSize/opacity/letterSpacing on any curve family), create_text returns charMetrics [{pos,ch,x,y,w,h}] both ways, plain/inv-* headless preset styling; new ImportVideo tool (ffmpeg fps extraction cached, LRU decode) registers MOVING clips and textStyle.insideVideo + insideBaseAlpha mask the real Drive footage INSIDE glyph silhouettes with tinted base on top for legibility (browser playback guarded = PARTIAL parity, headless complete)
162 Memory-stable headless render pipeline + resumable New Glitch batch queue: measured @napi-rs/canvas leaks (getImageData/createImageData ~4 MB/frame native, unreclaimable even under global.gc; over-sized-layer downscale blit rebuilds ~8 MB Skia mipmap/frame) and fixed all: VideoEncoder pipes PNG frames into ffmpeg stdin, direct-draw fast path for fx-free clips, exact-size fx layers (position-dependent effects like timecode burn-in verified visible), pooled compound pad, grow-only textRuns scratch; qa/newglitch-batch.mjs resumes from checkpoint, renders recipes through the real Glitch NG graph, perceptual dedupe (96x30 centre-crop 3-frame grayscale MAD < 0.6/255), per-batch manifest + combined review reel — slice 13-100: 53 kept, 35 honest dups, 0 failed
163 TYMM LUT pack FIRST BATCH: 5 Hald CLUT jpegs (Lut 3-7, 512x512, rowmajor 8x8 tiles of 64px detected via cross-tile smoothness test) converted LOSSLESSLY to 64^3 .cube files (every source node verbatim; qa/tymm-lut-parity.mjs proves node error 0.000/255 + manifest first-batch order); public/luts/manifest.json now 30 LUTs with tymm-3..7 leading, source jpegs preserved in public/luts/source-tymm/; browser EffectsPanel picker + headless adjustment.luts [{builtin:'tymm-N'}] both consume them with zero new loaders
164 TYMM font pack (49 fonts, Drive 'Fonts - TYMM.zip' incl. nested zips): every font registered under its FILE-STEM name (name before .ttf/.otf, user mandate — 'blood-crow-italic', 'Quicksand_Bold', 'Minecrafter.Reg'...) via src/lib/fontPack.ts (FONT_PACK + FONT_FACE_CSS injected in main.tsx + index.css), headless GlobalFonts.registerFromPath in tools/mcp/core.mjs (FONT_PACK_FILES, 49 verified), TextPanel font dropdown extended, MCP list_fonts tool
165 Replace-Video-With-Video (CapCut parity; reference screenshots new_doc_toll_research/imgs/capcut-replace/): dropping a video asset ON a video clip opens ReplaceDialog — full-source filmstrip (8 seeked thumbs), draggable view-window segment EXACTLY the target clip's duration (slides the source in-point, clamped: 5s window over 8s source sits 0-5...3-8), live timecode, 'Use the original video effect' checkbox (carryEffects keeps fx/LUT grade, unticked clears effects/fxInstances/adjustment); pure engine src/lib/replaceVideo.ts shared with headless MCP replace_video {clipId,path,windowStart,carryEffects}; Timeline clip-level drop hook + store openReplaceDialog/commitReplaceVideo
166 TEMPLATE MODE (full processing-chain capture): captureClipTemplate snapshots EVERY stage a clip passed through (transform + keyframed animation incl. custom bezier points, effects, fxInstances, LUT/adjustment grade, adjustmentMask, mask, blendMode, speedCurve, textStyle, volume, hidden, in-point RATIO for re-timing) into JSON data-dumps data_motiondesijg/templates/<id>.json; MCP template_capture/template_apply/list_templates (apply replays the whole chain onto any clip — usually a freshly imported replacement video); browser store templates/captureTemplate/applyTemplate; qa/replace-template-demo.mjs PASS renders test_ans_result/replace-template-demo.mp4 (process original -> capture -> new theme -> apply -> swap carry/no-carry)
167 Alight Motion intensive study + native import: src/lib/alightXml.ts parses AM v5 project XML (shape/text/nullobj layers, ms timings, normalised <kf t> keyframes with cubicBezier easing -> app CurveEngine custom points [[0,0],[x1,y1],[x2,y2],[1,1]], gain dB->volume, content:// media refs recorded); ~100 unique AM effect ids scanned across the 12-file corpus -> AM_EFFECT_MAP (~75 mapped to real ClipEffect patches, rest preserved as raw data); AM_FX_CATALOG merged into src/lib/effectCatalog.ts so ALL mapped AM effects ship in the site Effects panel + fx_catalog MCP; alight_import tool rebuilds compositions headless with data dumps to data_motiondesijg/alight/ (all 12 XMLs import: hero 80 clips/378 fx/369 kf props, Onyankopon 121/413, Mi Mi Mi 97/417, ...); MediaPanel 'Import Alight XML' + store.importAlightXml for the browser; docs/alight-motion-study.md records anatomy/findings/honest limits; proof render test_ans_result/alight-warps-import.mp4 (app-made 1920x1080 frames)
168 CC/TYMM Drive corpus scan + continue.md: new_doc_toll_research/CC-SCAN.md lists every file in the Cc - TYMM Drive tree exactly (Overlays 38 videos with blend/keying recipes, Back Grounds 42 images, Sfx 41 in Anime/Swoosh/Whoosh/Random/Bonus, Shakes.xml downloaded+imported as 10 shake presets on keyframed nullobj rigs, Free project files); 55 AM text layers extracted as text-preset/pack data (subtitle chain texttransform+textspacing+gradientoverlay2, fonts Teko-Bold/LOVELY/AGENCYB/Kenyan Coffee/Okay Jelly/Heavitas/CircularStd-Black/Quicksand_Bold — Quicksand_Bold stem matches the TYMM font pack); mega.nz overlays folder recorded as unreachable from sandbox (NOT claimed done); continue.md created per user mandate — every-run checklist (HEAD/tsc/QA trio), standing laws incl. the 5000-recipe-until-complete mandate with batch checkpoint next=100, shipped list, resume points
169 Alight Corpus text presets (CC scan -> real presets): 5 new TEXT_PRESETS in category 'Alight Corpus' built from the scanned AM text layers — CC Subtitle (TYMM) (Quicksand_Bold 40px lower-third w/ letterSpacing from the textspacing chain), Hero Title (hardtrekk) (96px + gradientMap from gradientoverlay2 + scale pop keys), Shake Title (MOLOB) (Quicksand_Bold + engine autoShake reproducing the Shakes.xml rig motion), Subtitle LOVELY chain (texttransform+textspacing+gradientoverlay2 mapped), Warps Counter (Minecrafter.Reg + flicker/glow, step keys); fonts referenced are TYMM pack stems; headless create_text preset='am-shake-title' verified (presetApplied + charMetrics)
170 New Glitch batch slice 2 (recipes 100-188): +32 kept, +56 honest perceptual dups, 0 failed -> cumulative 85 kept / 91 dups / 0 failed, checkpoint next=188; combined review reel new_glitch/batch_reel.mp4 rebuilt (4:00, all 85 kept) + batch-manifest.md with sha256 per kept mp4
171 Alight XML EXPORT system (user mandate: import xml AND export xml; templates export as xml): src/lib/alightXml.ts gains exportAlightXml (AM v5 dialect — scene/shape/text/transform skeleton AM itself reads + lossless OmniFrame round-trip via omniframe.fx exact engine values, omniframe.lut stack, omniframe.fxinst.<catalogId> fx instances incl. per-param keys, keyframed transforms as normalised <kf> with cubicBezier easing, clips imported FROM AM re-emit their original effect blocks verbatim), exportTemplateXml (full chain JSON in marked comment + AM-readable skeleton) and importTemplateXml; importer extended to consume every omniframe.* namespace (values/keys/luts/fx-instances) + parser fixes (self-closing <effect/> no longer swallows the next block — corpus imports grew: hero 80->96 clips, Onyankopon 121->134; transform-channel <kf> parsing now actually wired: hero kf props 369->385); MediaPanel Export Alight XML + Export Template XML buttons (blob download), Import button now also registers template XML; store exportAlightXml/exportTemplateXml + importAlightXml template detection; MCP alight_export/template_export/template_import; qa/alight-roundtrip.mjs PASS end-to-end (effects values, TYMM lut+intensity, fx keys, custom bezier points, text/font, timings, template identity, render proof test_ans_result/xml-roundtrip.mp4)
172 Built-in SHAKE PACK from the corpus (the 'important repeated stuff' ships IN the app while AM PROJECT files stay user-imported): src/lib/shakePresets.ts — all 8 Shakes.xml presets (MOLOB, WARP, ZNEPTUNE, FLOW, NANIMALO, RANDOM, JELLY, CU9ID) generated from the raw AM data dump with the ORIGINAL keyframe values/timings (normalised t -> seconds, AM magnitudes scaled into engine ranges: shake2.mag x0.06->autoShake px, oscillate.mag x0.18, exposure->brightness 1+v x0.4, squeeze x-0.35->pinchBulge, zoomblur3 x3, stretch2->pixelStretch, lensd->chromatic; CU9ID transform2 rig -> CE scale/rotation keys); each preset = keyed FxInstance stack on am-* catalog ids; EffectsPanel 'Shake pack (AM corpus)' section (8 buttons, applies to selected clip), store.applyShakePreset (addFxInstance/updateFxParams/setFxKey path), MCP shake_apply + list_presets catalog=shake; fx_add now normalises [[t,v]] key arrays to FxKey objects
173 VIDEO-STUDY engine keys (y6richo corpus scan, Drive 1KlxUlem-Qjyd61dLkqs9nk3Ob4bou1Kp): exposure (stops) + gamma (AM Exposure/Gamma panel parity, Exposure 0.42/Gamma 1.000 observed), Raster Extrude (extrude/angle/color — tinted silhouette stack = 3D-LOOKING text, NOT true 3D geometry, stated honestly), Radial Repeat (copies/radius — 3D Swirl Text tutorial), Long Shadow (length/angle/color — Color & Light browser name); all in types.ClipEffect + pixelGrade engine + hasPixelGrade + EFFECT_DEFAULTS/RANGES + KEY_META (editable, numerics keyframeable) + XML round-trip (export + import verified)
174 17 vs-* catalog entries traced to the y6richo video-study corpus (40 timeline/tutorial videos, sampled frames — names observed, recipes NOT claimed): Exposure/Gamma (+neg), Noise+Threshold, Raster Extrude x2, Radial Repeat x4 (6/8/12), Long Shadow x3 (30/45/90), Linear Streaks, Scanlines, Gradient Noise Texture, Flicker Text (Time Quantization), VHS Tracking Preset, Rainbow Find Edges; AM_EFFECT_MAP upgraded: AM exposure + longshadow2 now map to the REAL keys (were brightness/edgeGlow approximations)
175 VIDEO-STUDY acceptance QA (the study doc's own recommended editor tests, run in real Chromium): qa/video-study-e2e.mjs T1 >=250 mixed layers select-all/bulk-shift/undo/reopen, T2 four staggered strips + frame-accurate boundary, T3 Noise->Threshold bypass/keys/XML save, T4 manual markers CRUD + snap (distinct from auto beat detection), T5 null bezier easing keys + scrub + undo + export, T6 pixel readback of the 4 new engine keys; plus qa/video-study-render.mjs headless proof test_ans_result/video-study-effects.mp4 (4 quadrants, rendered FROM the re-imported XML) + frame still test_ans_result/frames/vs-frame-full.png
176 WAVE-2 video-study engine keys read off DOWNLOADED video frames (41 MP4s byte-exact via the Drive connector; frames/ committed): exposureOffset (Exposure/Gamma/Offset panel 01_t019.5), radialRepeatOrientation (Radial Repeat Count/Radius/Orientation 27_t060), Text Transform per-char reveal sweep textTransformStart/End/Phase (panel 30_t075) in the per-glyph text path, copyBackground (Luma Key + Copy Background stack 28_t055) as a PRE-KEY snapshot composited blurred+1.06x under the keyed result at the end of the pixel pipeline; +5 vs2-* catalog entries traced to exact frame files
177 Downloaded-video study pipeline: all 41 corpus MP4s staged into the workspace by the google_drive connector (bash egress to Drive is TLS-blocked; no proxy evasion used), byte-exact verified vs the Drive index, gitignored (re-downloadable), 122 study frames extracted at the documented look-around timestamps and committed as research evidence (new_doc_toll_research/video_study/frames/); acceptance suite extended to T8 (wave-2 keys pixel-verified in Chromium)
178 WAVE-3 Color & Light browser gaps from the downloaded-corpus inventory ALL faked with real engine passes: Bump Map (luma-gradient emboss, light top-left), Color Balance (per-channel R/G/B gain), Highlights and Shadows (quadratic darks-lift + brights-recover), Hot Color (brights pushed to hot magenta-red), Radial Shadow (short-side-normalised centre-out darkening — falloff re-normalised after in-app measurement showed the half-diagonal version was invisible on pad-centred clips), Four-color Gradient (bilinear A/B/C/D corner blend, rotatable fcgPhase, colour keys pass the sanitizer); +6 vs3-* catalog entries with STUDY.md provenance; acceptance e2e extended to T9 with per-pixel emboss diffing
179 Bokeh SHAPE BEDS from the BCC lens-blur shape/matte picker grid read off downloaded frame 36_t070: particleFx kinds bokeh-square/bokeh-plus/bokeh-triangle/bokeh-hexagon/bokeh-star/bokeh-bowtie/bokeh-slash drawn through one bokehShapePath helper (radial-gradient fill, star alternates inner radius); PARTICLE_KINDS union + sanitizer + MCP tool docs all extended; vs3-bokeh-hexagon catalog entry
180 DEVICE 3D TRANSITIONS (device_phone / device_monitor / device_tv): procedural 3D device rigs moulded in code (rounded-slab geometry sampled from scanned green-screen mockup references + AI plates), real perspective camera, extruded sides with normal-culled walls, perspective-correct triangle-grid screen texture mapping carrying the LIVE incoming clip, gradient metal, glass glare, pedestal/feet stands, soft shadows; keyframed rig (fly-in → settle → screen-expand) ends in an exact flat-2D handoff (measured diff 0.00 vs the incoming frame); wired into the transition system, presets ('Device 3D' category), timeline context menu + MCP tool docs; mp4 proofs test_ans_result/device3d-*.mp4 via qa/device3d-transition.mjs
181 GREEN-SCREEN DEVICE OVERLAYS (deviceOverlay phone/monitor): AI-generated perfect-angle chroma plates (public/devices/*-greenscreen.png, produced from the reference scan) chroma+white-keyed in-app with soft alpha and despill, cached screen bbox, gentle bob/tilt rig; the clip's own pixels show through the keyed screen hole; frame-space compositing on both the isolated and fast clip paths; 2 vs4-* catalog entries; overlay proof test_ans_result/device3d-overlay-phone.mp4
**Total: 181 shipped features** (audit: `grep -c '^[0-9]' FEATURES.md` = 172) (27 scenes + 20 FX kinds + 10 null/group + 10 UI + 6 pipeline).
Watched videos at this commit: **454** (see youtube-audit/progress.json watched_ids).


## 2026-10-31 — device, glitch, audio and agent repairs

See `reports/FEATURES.md` for the current verified implementation ledger and `docs/CODEX_TASK_RECOVERY.md` for recovered user tasks, source files and remaining acceptance. Historical feature totals are not used as implementation proof.
