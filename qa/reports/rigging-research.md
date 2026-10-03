# Rigging Mode — source research

Sources: [mangacut.com](https://mangacut.com/), [mangacutpro.com](https://mangacutpro.com/),
[YouTube tutorial `iEhAkrFPVcA`](https://www.youtube.com/watch?v=iEhAkrFPVcA) (MugiwarHaki,
13:55, 66K views), r/MangaCut, Google Play listing, APK release notes, TikTok
discover pages.

**Cannot be retrieved:** the TikTok at
`tiktok.com/@mugiwarhaki/video/7691843002888736033` returns HTTP 403 to
automated fetches, and I have no vision, so no video was actually *watched* —
the YouTube material here comes from its fetched transcript and chapter
markers, not from viewing frames.

## What MangaCut is

"The CapCut for Manga Animation", by **MugiwarHaki** (same person as the
TikTok account). The complaint it exists to solve: the standard workflow is
mask body parts in Ibis Paint → export → import into CapCut/Alight Motion →
manually reassemble every part in place. MangaCut keeps masking, rigging,
keyframing and export in one app, which the author claims is 2–3× faster.

## The pipeline (3 steps)

**01 Mask.** Import a panel. A segmenter generates candidate parts you can tap
to select. Manual tools: lasso and brush with adjustable width. Two modes —
**mask** (add to the region) and **exclude** (subtract). A **fill** step closes
holes that would otherwise drop pixels from the mask. Parts are renamed
immediately, with **L/R** recommended in the name for left/right limbs. A
one-button **green screen** check makes stray pixels obvious.

Critical detail the tutorial stresses: **paint beyond the mask edge**. Because
parts move relative to each other, you must inpaint underneath so gaps never
open. Specifically, the neck is painted longer because the head will move, and
the face is repainted under the ear so the ear can animate without revealing a
hole.

**02 Rig.** Import straight from a masking project. Two things happen here:

- **Layer order.** Parts are reordered so occlusion matches the original panel
  (the tutorial fixes a hand that was rendering behind a leg when it should be
  in front).
- **Parent/child + pivot.** You pick a part and choose its parent: *when the
  parent moves, the child moves*. Each part also gets a **pivot point**, which
  determines how it rotates. The body/chest is parented so it drives the legs,
  then each arm is chained down from the shoulder.

**03 Animate.** Per-part keyframes, then an easing/graph editor, then the
**wind effect** for hair and clothing.

## Feature list beyond the three steps

- **Bend** — added in 1.0.26, for curving a limb instead of hinging it at a joint.
- **Puppet** — a TikTok update post describes "bend and **puppet** tools", i.e.
  pin-based deformation like After Effects' Puppet Tool.
- Rename layers in the rigging step (1.0.26).
- Fill tool in repaint mode; zoom in rigging/animation (1.0.26).
- Import audio/music and copy/paste keyframes (1.0.37).
- Smart easing; wind/hair dynamics.

## Body-part vocabulary

Mangacutter (the sibling web segmenter) exports ten named parts, which is a
sensible default taxonomy:

`hair · face · torso · shirt · arms · hands · pants · legs · feet`

MangaCut Pro segments: "face, hair, hands, clothing, or a character".

## Standard 2D rigging theory (for the parts MangaCut leaves implicit)

A 2D rig is four things: **joints** (where it bends), **bones** (connecting
them), **control handles** (what the animator grabs), and a **hierarchy**
(parent/child, usually rooted at the hips — rotating the spine carries the arms
and head because they are children of it). Bones are not anatomy; they are a
simplified structure covering only the articulations a shot needs.

Plain bone rigs rotate flat artwork and can leave hard breaks at elbows and
knees, which is why **deformers** (mesh warp / envelope) exist — they bend the
artwork so a limb curves rather than hinges. That is exactly the gap MangaCut's
**bend** feature fills.

## What this means for OmniFrame

OmniFrame already has the surrounding machinery: cutout characters with
transforms and keyframe offsets, a mask/selection subsystem, a graph editor
with bezier interpolation, and paint layers. What it does **not** have, and
what rigging actually requires:

1. A character decomposed into **named parts** rather than one flat cutout.
2. A **parent/child hierarchy** so one part drives its descendants.
3. A **pivot** per part, so rotation happens about the joint rather than the
   part's centre.
4. **Bend** deformation so limbs curve instead of hinging.
5. **Puppet pins** for free-form deformation.
6. **Secondary motion** (wind/follow-through) for hair and cloth.
