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

---

## Round 2 — additional sources (Oct 2026)

### New source: launch video `youtube.com/watch?v=xrqZVRkxnuA`
*"New BEST (Easy) Way to create Manga Animation"* — MugiwarHaki, 12 May 2026,
2:36, 4.6K views / 154 likes. This is the video linked as "Watch Demo" from
mangacut.com, i.e. the canonical pitch. **Full transcript retrieved.**

It states the problem MangaCut exists to solve, in the author's own words:

- "You open Ibis Paint to cut your character parts, your gallery gets spammed
  with 30 masks, you import everything in CapCut, waste time putting your
  character back together, and then finally you can animate."
- **"So, you move one part, and then you manually need to readjust every other
  part."** ← this is the whole thesis. Rigging = never doing that again.
- "And if you want to go further with **hair effects**, luckily you'll have all
  the time you need during the next decade." ← wind/hair is positioned as the
  thing that is prohibitively slow in every other tool.
- On rigging: *"you basically create a skeleton of your character, so that each
  part of the body is linked to another part. For example, this arm — if I move
  the [hand], in CapCut I would need to adjust the other part, like the
  forearm."*
- **"The skeleton you just built is working inside your timeline."** ← the rig
  is not a side artefact; it is live during animation.
- Masking has **"a secret tool to click on a body part, and it gets instantly
  detected"** — tap-to-segment, no lasso needed for the common case.
- He tested "all the workflows, including Blender, Vegas Pro, or After Effects"
  before building it.

### mangacut.com (re-fetched, now with full copy)
Headline is **"Rigged in 1 tap"**. Three value props, in order:
1. Mask Layers & Body Parts — "Isolate any limb. Inpaint seamlessly."
2. **Auto Body Rigging** — "Move one part. The skeleton adapts the rest. Don't
   waste time readjusting other body parts."
3. Smart Easing & FX — "Smooth motion, dynamic wind on hair and clothes."

Confirms iOS + Android + web. Demo video is `xrqZVRkxnuA` (above).

### The TikTok (recovered via discover pages, direct fetch still 403)
The target video is captioned: *"i tried making toji manga animation with this
app 🤯 app is called mangacut #manga #animation #manganimation #mangaedit
#capcut | jjk manga animation tutorial | that one toji manga edit"*.
It is a **step-by-step Toji (Jujutsu Kaisen) tutorial** — "animate manga panels
and moving body parts with the MangaCut app".

The same author's other tutorials, all following the identical shape:
- **Gojo** manga animation, one app (1.2K likes)
- **Makima / Chainsaw Man** (17.5K likes) — "manga speed effects"
- **Bachira headbop** — explicitly "timing, frames, and export tips"
- **CSM / Chainsaw Man** (6.2K likes)
- A feature video: *"why Mangacut beats CapCut for manga animation and how to
  use its **bend and puppet tools** to animate panels and characters."*

So the repeatable recipe being taught is: pick a character panel → mask the
parts → auto-rig → animate a specific motion (headbop, speed lines, limb
movement) → export.

### User-reported friction (Play Store reviews, worth not repeating)
- "I would like to have **cursor offset** too cuz it still is a bit hard to see
  even when using the assistants already there" — on-screen controls obscure
  the pointer during precise work.
- "it's good but not for me … the ad made it look easy" — the gap between
  marketing and the learning curve is real; onboarding should teach the
  hierarchy concept, not just expose the controls.

### Consolidated workflow (now confirmed from 4 independent sources)
```
1. MASK      tap-to-detect or lasso each part; inpaint the hole behind it
2. REPAINT   extend edges beyond the mask so gaps never open when parts move
3. RIG       one-tap auto-skeleton; fix layer order; set pivot per part
4. ANIMATE   per-part keyframes on the timeline, skeleton live
5. EASE      graph editor
6. FX        wind on hair/clothes
7. EXPORT    MP4
```

### What this changed about the build
- **"Rigged in 1 tap"** is the headline feature, so auto-rig must be the
  primary action on screen, not a utility button tucked in a sub-panel.
- **"Each part linked to another part"** means the parent/child tree is the
  product. The skeleton overlay and the parent picker are the core UI.
- **"Working inside your timeline"** → the rig must drive keyframes on the
  timeline, not live in an isolated preview.
