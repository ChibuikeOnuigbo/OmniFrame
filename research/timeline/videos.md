# Professional Video Editor Timeline Video Research

This document records the empirical video research conducted across professional desktop and web NLEs, analyzing clip manipulation, track creation, vertical dragging, transition boundaries, snapping, and timeline zooming.

---

## 1. CapCut Desktop Beginner & Advanced Timeline Workflow
- **URL:** `https://www.youtube.com/watch?v=C5O353fpPwM`
- **Timestamps / Ranges Studied:**
  - `02:15 - 04:30`: Clip placement on the main magnetic track vs. upper overlay tracks.
  - `06:10 - 08:45`: Trimming, blade splitting, and gapless auto-ripple behavior.
  - `11:20 - 13:50`: Vertical dragging to create overlay tracks, audio detachment, and snapping.
- **Observed Interactions:**
  - **Magnetic Track 1:** Track 1 acts as a primary storyline (similar to Final Cut Pro). Clips placed on Track 1 automatically close gaps unless free-layering mode is toggled on.
  - **Vertical Drag to Create Track:** When a clip is dragged vertically above Track 1 or existing overlay tracks, a glowing insertion bounding guide appears indicating "Track 2 / Overlay Track". Releasing the mouse instantly instantiates the track and docks the clip.
  - **Ghost Clip Representation:** While dragging, the clip remains at its original position semi-transparently (or represented by a shaded ghost outline) while a live ghost block follows the cursor with timecode tooltip and snapping guidelines.
  - **Playhead Scrubbing:** Frame-accurate scrub with audio scrubbing preview; ruler ticks dynamically subdivide into frames (e.g. 05f, 10f, 15f, 20f, 25f at 30fps) as zoom increases.
- **What OmniFrame Should Adopt:**
  - Distinct drop-target insertion lines when hovering between tracks or above the topmost track.
  - Ghost clip preview maintaining exact clip duration and aspect ratio during drag, rather than mutating store state continuously on every mousemove.
  - Frame-accurate ruler tick scaling with continuous smooth zoom.
- **What Should NOT Be Copied:**
  - Forced auto-magnetic snapping on all tracks without an explicit toggle (professional editors require freeform placement on secondary tracks without unexpected ripple collisions).

---

## 2. Adobe Premiere Pro Transition Boundary & Media Handle Workflow
- **URL:** `https://www.youtube.com/watch?v=-ctmmRdr60M`
- **Timestamps / Ranges Studied:**
  - `01:05 - 03:20`: Dragging transitions from Effects panel onto clip cut points.
  - `04:10 - 06:40`: Insufficient media handles warning dialog ("Insufficient media. This transition will contain repeated frames").
  - `07:15 - 09:30`: Transition alignment modes (Center at Cut, Start at Cut, End at Cut) and interactive edge dragging in timeline.
- **Observed Interactions:**
  - **Transition as Discrete Timeline Object:** The transition is represented as a distinct rectangular block centered or aligned over the cut between Clip A and Clip B. It has its own selection state, distinct color (warm amber/orange), and diagonal cross-hash pattern.
  - **Interactive Duration Trimming:** Hovering the left or right edge of the transition icon reveals a red bracket trim cursor. Dragging changes the duration symmetrically (if centered) or unilaterally (if aligned to start/end).
  - **Media Handles Concept:** A transition across a cut requires frames beyond the in/out points of the trimmed clips. Premiere checks available head/tail frames.
  - **Inspector Integration:** Double-clicking or selecting the transition opens Effect Controls showing exact duration in frames, alignment dropdown, and start/end percentages.
- **What OmniFrame Should Adopt:**
  - Model transitions as first-class entity objects with `fromClipId`, `toClipId`, `startTime`, `duration`, `alignment`, and `type`.
  - Render an interactive transition block on the timeline over the shared clip boundary with selectable state and edge-resize handles.
  - Real-time parameter updates in both inspector and canvas preview.
- **What Should NOT Be Copied:**
  - Modal blocking alert dialogs for handle warnings; modern web workflows prefer inline non-blocking visual warnings (e.g. diagonal stripes or badge indicator).

---

## 3. CapCut PC Transitions & Cut-Point Indicators
- **URL:** `https://www.youtube.com/watch?v=gA9s20CSv1E`
- **Timestamps / Ranges Studied:**
  - `00:45 - 02:15`: Transition library browsing, hover-to-preview animations.
  - `02:30 - 04:50`: Applying transitions to adjacent clips and visual badge icon display.
  - `05:10 - 07:00`: Modifying duration slider and "Apply to All" batch action.
- **Observed Interactions:**
  - **Cut-Point Icon:** Adjacent clips that touch have a small rectangular transition button directly on the cut line.
  - **Applied State Indicator:** When a transition is applied, the icon changes to a colored glyph representing the transition type (e.g. dissolve hourglass, wipe arrow, camera push) and expands to show a highlighted duration region on both clips.
  - **Right-Click Context Menu:** Context menu on the transition badge provides: "Edit Duration", "Replace Transition", "Delete", and "Apply to All Cuts".
- **What OmniFrame Should Adopt:**
  - A clean, compact transition badge directly at the cut point that indicates applied transitions with a recognized icon glyph.
  - Right-click contextual menu tailored specifically for transitions.
  - Visual duration span highlighted across the cut point.
- **What Should NOT Be Copied:**
  - Opaque black-box transitions that cannot be keyframed or customized with custom easing or shader parameters.

---

## 4. Kdenlive Same-Track Mixes vs Multi-Track Compositions
- **URL:** `https://www.youtube.com/watch?v=YnSE9qgGui4`
- **Timestamps / Ranges Studied:**
  - `03:00 - 05:30`: Creating same-track "Mix" transitions between abutting clips using `Shift + drag` or right-click.
  - `07:10 - 09:40`: Multi-track compositing transitions (Wipe, Composite, Cairo Blend) between overlapping tracks V1 and V2.
  - `12:15 - 14:00`: Track insertion above/below and drag-and-drop track reordering.
- **Observed Interactions:**
  - **Same-Track Mix:** When two clips touch on the same video track, dragging the top corner handle creates a green triangular/trapezoidal Mix block. Internally, Kdenlive dissolves between the hidden tail handle of clip 1 and the head handle of clip 2.
  - **Cross-Track Composition:** For clips on separate tracks (V2 above V1), an explicit composition block spans the overlapping time interval.
  - **Track Insertion:** Right-clicking track headers or dragging a clip into the empty space above/below tracks creates a new track with deterministic naming (V1, V2, V3, etc.) and stable internal ID.
  - **Edit Modes:** Clear toggle between Overwrite Mode (default), Insert Mode (ripples downstream clips), and Spacer Tool.
- **What OmniFrame Should Adopt:**
  - Clear architectural distinction between Same-Track Transitions (cuts/dissolves) and Cross-Track Compositions.
  - Atomic track insertion when dropping clips outside existing track bounds or between track rows.
  - Stable track identifiers that do not change when track visual order is updated.
- **What Should NOT Be Copied:**
  - Cluttered Linux desktop dialog windows; OmniFrame must maintain a sleek, dark obsidian-themed responsive interface.
