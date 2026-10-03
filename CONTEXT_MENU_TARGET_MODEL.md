# OmniFrame Context Menu Target-Aware Resolution Model

## 1. Design Rationale & Eliminating Menu Clutter
A critical defect in amateur web editors is rendering global, un-targeted context menus (e.g. displaying "Cross Dissolve" when right-clicking an empty canvas, or opening the Inspector panel whenever a user right-clicks to inspect a clip).

OmniFrame adheres to the **Target-Aware Resolution Invariant**:
> Context menus are strictly generated from the tuple `(contextTarget, targetCapabilities, activeSelection, editorMode)`. A command is displayed if and only if it is mathematically and semantically actionable on the right-clicked object. Right-clicking MUST NEVER auto-open the Inspector or trigger unexpected panel layout shifts.

---

## 2. Concrete Target Hierarchy & Command Mapping

```
                               Target Resolver
                                     |
    +----------------+---------------+---------------+----------------+
    |                |               |               |                |
    v                v               v               v                v
CANVAS / PREVIEW  TRACK LANE    CLIP INSTANCE   TRANSITION PILL   MEDIA PANEL
  - Add Media      - Close Gaps   - Cut / Copy    - Change Type     - Import Media
  - Paste Media    - Add Track    - Duplicate     - Set Duration    - Delete Asset
                   - Delete Track - Isolate Voice - Delete Trans    - Filter View
                                  - Hide / Unhide
                                  - Delete Clip
```

### 2.1 Concrete Target Specifications

| Target Type | DOM Selector / Data Attribute | Available Contextual Actions | Prohibited / Blocked Actions |
|---|---|---|---|
| `CANVAS` | `[data-testid="preview-stage"]` | Add Media, Paste at Playhead | Cut, Copy, Delete Clip, Transitions |
| `TRACK_LANE` | `[data-testid^="track-lane-"]` | Close Gaps on Track, Add Track Above, Add Track Below, Delete Track | Clip-specific commands, Transitions |
| `VIDEO_CLIP` | `[data-testid="timeline-clip"][data-kind="video"]` | Cut, Copy, Duplicate, Add Transition, Separate Audio, Isolate Voice…, Isolate Voice (Keep Vocal), Isolate Voice (Remove Vocal), Hide/Unhide, Delete | Track deletion, Gap closure |
| `AUDIO_CLIP` | `[data-testid="timeline-clip"][data-kind="audio"]` | Cut, Copy, Duplicate, Isolate Voice…, Isolate Voice (Keep Vocal), Isolate Voice (Remove Vocal), Hide/Unhide, Delete | Video Transitions, Separate Audio |
| `IMAGE_CLIP` | `[data-testid="timeline-clip"][data-kind="image"]` | Cut, Copy, Duplicate, Add Transition, Hide/Unhide, Delete | Audio tools, Separate Audio |
| `TRANSITION` | `[data-testid="timeline-transition"]` | Cross Dissolve, Dip to Black, Dip to White, Wipe Left, Slide Left, Zoom Push, Duration: 1.5s, Delete Transition | Clip operations, Track operations |
| `MEDIA_PANEL` | `[data-testid="media-panel"]` | Import Media, Paste Asset | Timeline mutations, Clip trims |

---

## 3. Viewport Boundary & Safe Layout Geometry
Context menus must never spawn offscreen or overflow the browser viewport. OmniFrame calculates position with bi-directional clamping:

```typescript
const width = 224;
const height = target.type === 'TRANSITION' ? 280 : 'clip' in target ? (target.type === 'VIDEO_CLIP' ? 280 : 220) : target.type === 'TRACK_LANE' ? 180 : 144;
const margin = 8;
const offset = 4;

// Horizontal flip if approaching right viewport edge
const x = event.clientX + width + offset <= window.innerWidth - margin 
  ? event.clientX + offset 
  : event.clientX - width - offset;

// Vertical flip if approaching bottom viewport edge
const y = event.clientY + height + offset <= window.innerHeight - margin 
  ? event.clientY + offset 
  : event.clientY - height - offset;

setContextMenu({
  ...target,
  x: Math.max(margin, x),
  y: Math.max(margin, y),
  anchorX: event.clientX,
  anchorY: event.clientY,
});
```

---

## 4. Accessibility & Keyboard Navigation
- **`role="menu"` & `role="menuitem"`**: Fully standard WAI-ARIA menu navigation semantics.
- **Auto-Focus**: The first menu item receives immediate focus on open for instant keyboard arrow navigation.
- **Escape Dismissal**: Pressing `Escape` immediately closes the menu without executing any action.
- **Destructive Action Styling**: Critical operations (`Delete Clip`, `Delete Track`, `Delete Transition`) render with red warning text (`text-red-400 hover:bg-red-500/10`) to prevent accidental destruction.
