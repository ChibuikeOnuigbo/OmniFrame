# Null Objects (AE / Alight Motion) & Groups (CapCut) — research + OmniFrame implementation

Multi-source doc study (Adobe helpx, Alight Motion support, CapCut help/community docs,
Shotcut forum semantics, community guides). Everything below that OmniFrame now
implements is mapped in §4.

## 1. After Effects — Null Object (Layer > New > Null Object, Ctrl/Cmd+Alt+Shift+Y)

- A null is an **invisible layer with the full transform property set** (Position,
  Scale, Rotation, Anchor Point) that **renders no pixels**. It exists to be a parent /
  controller. Appears in the comp panel as a 100×100 px outline with handles; its anchor
  defaults to the TOP-LEFT of that square (a classic gotcha — centre it before using it
  as a pivot). [Adobe layer-properties doc; mtmograph; filmit guide]
- **Parenting semantics** (Adobe): child transforms become *relative to the parent*;
  parent move/scale/rotation carries every child; the relation is one-way; children keep
  their own animation on top; parenting **cannot be keyframed** (you cannot parent at one
  time and unparent at another); Shift-while-parenting snaps the child onto the parent;
  Alt/Option + Parent:None unparents while preserving world position (no jump).
- **Inheritance rules**: position/scale/rotation inherit; **opacity does NOT inherit**
  from a null parent (filmit guide — surprises everyone once).
- **Null ≠ group folder**: parenting does not hide, effect-group or precomp layers.
  Effects across layers = adjustment layer; effect stacking as one unit = precomp.
  Nulls = transform control only.
- **Expression-control host**: Expression Controls effects (Slider/Point/Color…) are
  routinely put on nulls; cameras/lights get Point-Of-Interest linked to a null's
  position so a draggable square aims the camera (Adobe doc).
- **Null generators**: Window > Create Nulls From Paths.jsx (one null per vertex);
  Animation > Keyframe Assistant > Null Controllers for Positional/Path Points (2025:
  per-point controller nulls linked by expressions). These differ from parenting: they
  link POSITION only, leaving scale/rotation free (Adobe create-nulls doc).
- **Guide Layer** switch: right-click null > Guide Layer → excluded from renders AND
  nested comps while staying fully active as a controller.
- Hierarchy chains (finger→hand→arm→body) are the foundation of character rigs; nulls
  are the usual root controllers ("super parent" — Storyblocks).

## 2. Alight Motion — Layer Parenting & Null Objects (support article 10536997444369)

- Same one-way parent→child model: parent position/rotation/scale drive the child
  **regardless of overlap or distance**; **layer order on the timeline does not affect
  parent relationships** (important: parenting is not stacking).
- Null objects = invisible layers purpose-built for parenting; AM's null is a first-class
  layer type you add like any layer, then parent graphics/effects layers to it.
- Rotation hinges on the parent's axis; scale grows/shrinks the child proportionately.

## 3. CapCut — Groups (desktop) & Compound Clips

- **Group** = saved multi-selection: select clips (Ctrl/Shift-click across tracks) →
  right-click > Group or **Ctrl+G**; ungroup **Ctrl+Shift+G**. Mobile has NO grouping
  (desktop-only feature; community-confirmed since 2022).
- Group semantics: clicking any member selects the whole group; dragging/trimming one
  member moves **all members in sync across tracks** (the killer use: keep overlays +
  audio glued to a main-track clip while rippling the timeline); groups persist with the
  project; groups cannot overlap (a clip belongs to at most one group).
- Group ≠ Compound Clip: **Alt+G** creates a compound clip (nested mini-timeline, effects
  apply to the unit, double-click to enter, Alt+Shift+G / "Undo compound clip" to
  dissolve). A group keeps items on the same timeline, linked for movement only
  (capcutguide comparison table).
- Workflow lore: group everything right of a cut (Ctrl+]) then delete → ripple-safe
  deletes; lock + group combos for surgical timeline surgery (r/CapCut).
- Shotcut's equivalent documents the selection UX we mirror: grouped members show a
  **different outline colour** than plain selection; Alt-click selects a single member
  against the group; Ctrl-click removes one member from the current selection.

## 4. What OmniFrame now implements (this branch)

| Source behaviour | OmniFrame implementation |
|---|---|
| AE/AM null = invisible transform-controller layer | `MediaKind 'null'`; `addNullObject()` store action; timeline "New Null Object" (clip context menu + LinkPanel "+ Null"); null renders **no pixels** (skipped in `renderFrame`), dashed-outline tile labelled NULL in the timeline |
| AE parenting inheritance (pos/scale/rot, not opacity) | `src/lib/parentChain.ts` `buildParentChain()` + `PlaybackEngine.applyParentChain()`: parent world matrices (translate→rotate→scale about comp centre) compose under `drawClip`/`drawTextClip`; opacity untouched |
| AE cycle safety | `createParentRelationship` already refused cycles; chain builder also stops on revisit |
| AM "layer order irrelevant" | chain follows `parentRelationships`, never track order |
| CapCut Group Ctrl+G / Ungroup Ctrl+Shift+G | `groupSelection()` / `ungroupSelection()` store actions + timeline clip context-menu items + global shortcuts Ctrl+G / Ctrl+Shift+G |
| CapCut "click member = whole group selected" | selection expansion via `expandGroupSelection()` in `parentChain.ts`, applied where timeline selection is set |
| CapCut group persists, no overlap | `GroupInstance.memberIds` in project state; `groupSelection` strips members from other groups first |
| Shotcut group outline colour | grouped timeline tiles carry a per-group coloured top band + Layers glyph |
| AE guide-layer invisibility in nests | nulls skipped in compound contents too (same drawClip path) |

Honesty note: expression-control hosting, Create-Nulls-from-Paths generators and
compound-clip nesting are documented above but NOT implemented yet (OmniFrame already
has a separate compound-clip kind); they are the next research-to-code candidates.
