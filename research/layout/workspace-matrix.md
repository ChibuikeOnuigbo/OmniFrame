# OmniFrame Workspace Layout & Docking Research Matrix (`research/layout/workspace-matrix.md`)

## Executive Summary
Professional creative software relies on adaptive, task-specific workspaces rather than rigid, one-size-fits-all single-window layouts. This document deconstructs the workspace architectures of six leading digital content creation suites (Blender, Krita, Adobe Premiere Pro, DaVinci Resolve, Shotcut, and Figma) to inform OmniFrame's layout, docking, focus mode, and multi-monitor management engine.

---

## 1. System Comparison Matrix

| System | Workspace Paradigm | Docking / Splitting Mechanics | Focus Mode / UI Minimization | Multi-Monitor Handling | State Persistence | Responsive Strategy |
|---|---|---|---|---|---|---|
| **Blender** | Screen Areas & Workspaces | Screen area corner dragging creates arbitrary horizontal/vertical splits; areas host any editor type | **Focus Mode (Ctrl+Space / Shift+Space)** expands active area to full window, hiding topbars and headers | Duplicate Area into New Window; native multi-window desktop support | Workspaces saved per-file (`.blend`) or as global User Startup Defaults | Collapses headers into menus; panels wrap into single columns |
| **Krita** | Saved Docker Configurations & Window Layouts | Qt-based docking engine; dockers can dock to edges, tab inside groups, or float independently | Canvas-Only Mode (`Tab`) hides all dockers, toolbars, and menus | **Window Layouts** remember multiple floating windows across multiple physical displays | Stored in `krita/workspaces/*.kws` (XML/INI) | Dockers collapse into icon buttons on compact viewports |
| **Adobe Premiere Pro** | Workspaces Bar (Assembly, Edit, Color, Effects, Audio) | Panel tab groups with 5-zone docking targets (Top, Bottom, Left, Right, Center Tab) | `tilde (~)` key toggles full-screen focus on hovered panel | Detached floating panels can drag to external monitors; saved across sessions | XML workspace presets in user preferences folder | Panel boundaries dynamically clamp to strict minimum widths |
| **DaVinci Resolve** | Page-Based Pipeline (Media, Cut, Edit, Fusion, Color, Fairlight, Deliver) | Fixed page layouts with contextual collapsible inspectors | **Enhanced Viewer (Shift+F)** / Cinema Viewer (Cmd+F) full-screen canvas preview | Dual Screen mode (`Workspace -> Dual Screen -> On`) routes timeline to primary and scopes/viewers to secondary | System library presets and project memory | Fixed minimum screen resolution (1920x1080 recommended) |
| **Shotcut** | Qt Dockable Multi-Panel UI | Flexible QDockWidget layout; drag dockers by titlebar to stack, tab, or float | Minimalist default layout; panels toggled individually via topbar | Floating dockers can span multiple OS monitors | Saved XML layout files via `View -> Layout` | Panels dynamically wrap and scroll |
| **Figma** | Canvas-First Minimalist Workspace | Fixed left layers sidebar, fixed right inspect sidebar, persistent top toolbar | **Hide UI (Cmd+\)** maximizes canvas, hiding all UI chrome; selection re-exposes property inspector | Browser tabs and native Electron windows | User account cloud profile preferences | Collapses panels on mobile and tablet viewport widths |

---

## 2. Key Architectural Takeaways for OmniFrame

### A. The Primacy of the Preview Canvas
In video editing and comic animation, the preview canvas represents the actual deliverable. Traditional video editors suffer when sidebars (Media, Effects, Inspector, Audio) consume 60%+ of horizontal viewport space, leaving the preview squished into a tiny postage stamp.
- **OmniFrame Rule**: In all default and focus modes, the preview canvas retains layout priority, clamping side docks to max 25% of viewport width and automatically collapsing drawers when viewport drops below 1080px.

### B. Discrete Focus Modes vs Generic Fullscreen
Browser fullscreen (`F11`) merely expands the browser window without changing UI layout. Professional focus mode alters the layout composition:
1. **Preview Zoom Focus**: Expands the preview viewport to available bounds, shrinking or collapsing timeline and side docks.
2. **Timeline Focus**: Expands timeline height (e.g. 460px+) for dense multi-track editing, keyframe animation, and audio track scrubbing.
3. **Canvas-Only (Zen Mode)**: Hides all toolbars, timeline, and side panels, exposing only a discreet floating exit control.

### C. Persistent Layout Snapshot & Safe Exit
Entering Focus Mode or applying a layout preset must NEVER destroy the user's prior fine-tuned divider positions. OmniFrame captures a layout snapshot immediately prior to mode changes, allowing an instant, single-action restore (`Escape` or `Exit Focus Mode`).
