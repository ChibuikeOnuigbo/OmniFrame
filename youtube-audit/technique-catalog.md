# Technique catalog — evidence-level labelled

**Rule applied:** a technique is listed only where the evidence level named in
its row actually establishes it. Chapter titles and description prose are
*author-declared intent*, not observed settings. No setting value anywhere in
this file is invented; where nothing was observable, the row says so.

## Spaceless (@spaceless2041) — bpUZkFVX6NY (METADATA_ONLY: author chapters)

Workflow order declared by the author's own chapters (AE 2020):
1. Masking / Rotobrush (0:48) — subject separation before any comp work.
2. Background color (2:14) — replacing/grading the plate behind the roto.
3. Background smoke/fog (3:02) — atmospheric overlay behind subject.
4. Background particles (3:35) — particulate overlay layer.
5. Character color (4:32) — grade pass on the roto'd subject.
6. Character edge glow (4:59) — rim/edge light on subject silhouette.
7. Character glow — eyes (6:28) — localized point glow (anime eye shine).
8. Ambient/mood lighting (7:30) — scene-wide light wash.
9. Foreground overlays (7:55) — atmospherics in FRONT of subject (depth).
10. Optical flare (8:34) — lens-flare accent.
11. Finishing touches (9:17) + bonus tip (9:42).
Supporting facts: free fog & particle overlay pack offered by the author
(link in description) — i.e. stock overlay assets, not procedural, for steps 3/4/9.
NOT established (footage blocked): mask feather/values, curve settings, blend
modes, opacities, flare plugin identity, colour values.

## sebastian — M2_vjAseOns (METADATA_ONLY: title/related cluster)
Declared subject: relighting scenes with AE **composition lights** (Point/Spot
comp lights). Related-cluster topics on the same page: remap+compositing,
3D depth-map compositing without Blender, "eye-catching 3D scenes".
NOT established: light parameters, falloff, intensity, placement.
(OmniFrame already ships a point/spot light layer effect — `ClipEffect.light*`
— which mirrors this technique family at tool level.)

## kai (@Keditz123) — Tvd7qiK_gUA (METADATA_ONLY + CODE asset)
Chapters: PS asset prep → retouch/layering → hair animation → eye blink → head
movement/final edit (manga-animation workflow).
CODE-level evidence (downloaded .jsx, owner-shared): puppet-pin hair rig —
per-pin wiggle oscillation driven by a global null with slider-controlled
amplitude/frequency/phase/delay/loop counts (41 sliders, 6 angle + 5 point
controls; expression builders ampExp/freqExp/delayExp/loopsExp/
phaseLocatorExp; runHairRig/buildHairNull/findPuppetPins). This establishes the
MECHANISM (procedural wiggle expressions over puppet pins), not on-screen look.
NOT established: pin counts per strand, mesh expansion, render settings.

## PAX (@paxeditz) — 9o8GT1Iurv0 (METADATA_ONLY)
Alight Motion (AMZ) AMV; 3-beat structure Intro/Edit/Loop; Chainsaw Man source;
song "2000" (vowl. & Sace). NOT established: any effect, timing, or transition
detail (no chapters beyond the 3 beats, no footage).

## Channel-level tool signals from inventory titles (250 videos, title text only)
Titles across the six channels recurrently name: Alight Motion, After Effects,
CapCut; techniques named in titles include twixtor/slow-mo, shake, glow,
velocity, beat-sync, mask transitions, cc (colour-grade) packs, 4K remotes,
overlay packs. These are *title keywords*, catalogued for demand mapping only
(see transition_pillars/ for the generated index that consumes them).
