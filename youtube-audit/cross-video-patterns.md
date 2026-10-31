# Cross-video / cross-creator patterns — from reached evidence levels only

## Pattern 1 — The compositing stack is canonical and ordered
Spaceless' chapter list (the only complete workflow declaration obtained)
matches the standard AMV comp stack: **roto/mask → background replace/grade →
background atmospherics (fog/particles) → subject grade → subject rim/eye
glow → ambient light → foreground atmospherics → flare → finish**. The
back-to-front ordering (atmospherics BOTH behind and in front of the subject)
is the depth cue every creator in this set sells; it is also exactly the
layer-order OmniFrame's adjustment/effect-clip model already supports.

## Pattern 2 — Stock overlay assets over procedural generation
Spaceless ships a free fog & particle pack; scenepacks.com (studied at catalog
level) sells per-title scene packs; the Drive folder supplied for this mission
contains raw anime clips + twixtor renders. Creators in this circle assemble
**asset stacks** (clips + overlays + packs) more than they synthesize effects —
argument for OmniFrame's pack/overlay pipeline over pure shader effects.

## Pattern 3 — Wiggle/expression rigs for organic motion
Keditz' .jsx proves the manga-motion technique: puppet pins + per-pin
oscillation expressions (amp/freq/phase/delay/loops) under a global null.
Same family as Alight Motion's "wave/twist" presets named in channel titles.
OmniFrame equivalents that exist today: puppet warp (`drawPuppetWarp`) +
CurveEngine; a wiggle-expression layer would close this gap (banked in
effect.md, not built).

## Pattern 4 — Light as a transition/comp tool, not just a grade
sebastian's whole video = relighting with comp lights; Spaceless devotes two
chapters to ambient/mood light + optical flare. Light here is **compositing
glue** (matches scene to background), consistent with the light-pillar
transition presets already shipped (light_* family).

## Pattern 5 — Structure over duration in AMVs
PAX' 3-beat Intro/Edit/Loop and Spaceless' 10-minute chaptered tutorial show
the same discipline: beats/segments first, effects inside them. Mirrors the
marker/auto-beat grid shipped earlier (0.50–7.50s anchors).

## Differences between creators (evidence-limited)
- Spaceless: AE, chaptered long-form teaching, gives assets away.
- Keditz: AE + Photoshop prep, ships the rig script itself (code-first teaching).
- PAX: Alight Motion, short-form result-only (no teaching metadata).
- sebastian: AE comp-light niche, small channel, technique-single videos.
- Deppey/Avoid/Mattt/chosens: inventory titles only (AE/VFX-flavoured); no
  per-video text obtained this run — listed INVENTORIED, not analysed.

## What would upgrade each pattern to footage-level
Any unblock route (owner `YT_COOKIES` secret or residential worker) → batch
re-run yields frames/spectra → patterns 1-5 become VISUAL_ANALYSIS_COMPLETE
with observable settings (blend modes, opacities, flare shapes, cut timing).
