# OmniFrame Workspace Layout Architectural Decisions (`research/layout/decisions.md`)

## Architectural Decision Records (ADRs)

### ADR-001: Separation of Layout State from Project Media State
- **Context**: Video editors must distinguish between project contents (clips, tracks, transitions, assets, markers) and UI arrangement (panel widths, active tabs, visible sidebars, zoom).
- **Decision**: Layout state is stored in discrete Zustand store properties (`workspacePreset`, `focusMode`, `timelineHeight`, `leftDockWidth`, `rightPanelWidth`) and serialized to `localStorage` independently of project undo/redo history.
- **Consequences**:
  - `Ctrl+Z` undoes media edits (clip trims, stroke draws, splits) without reverting panel resize operations or moving dividers.
  - Project file exports (JSON, WebM, MP4) remain lightweight and layout-agnostic.

### ADR-002: Bounded Splitter Clamping with Zero Page Overflow
- **Context**: Arbitrary mouse dragging on horizontal/vertical splitters can crush editor regions to 0px or expand them beyond window boundaries, causing page-level scrollbars.
- **Decision**:
  - `timelineHeight` clamped to $[120\text{px}, 600\text{px}]$.
  - `leftDockWidth` clamped to $[220\text{px}, 600\text{px}]$.
  - `rightPanelWidth` clamped to $[220\text{px}, 500\text{px}]$.
  - Root container enforces `h-full w-full overflow-hidden`.
- **Consequences**:
  - Zero browser-window scrollbars under any resize or drag scenario.
  - Controls inside docks remain accessible.

### ADR-003: Reversible Focus Mode Snapshot Pattern
- **Context**: Users entering Focus Mode (Preview Zoom, Canvas Only, or Timeline Focus) require an effortless, single-key mechanism to return to their prior customized workspace.
- **Decision**:
  - When switching `focusMode` from `'none'` to an active focus mode, the current preset and divider dimensions are cached.
  - Pressing `Escape` or clicking `Exit Focus Mode` immediately restores the snapshot.
- **Consequences**:
  - Eliminates user anxiety when testing zen/preview-focused layouts.

### ADR-004: Responsive Drawer Auto-Collapse
- **Context**: Mobile or narrow tablet viewports (< 1080px) cannot simultaneously host two 300px side panels and a 16:9 preview monitor.
- **Decision**: A global `ResizeObserver` listener automatically collapses `leftOpen` and `rightOpen` to `false` when viewport width drops below 1080px, while keeping the 48px left icon rail visible.
