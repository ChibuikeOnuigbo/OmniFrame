# OmniFrame Aspect Ratio & Video Export Specification
**Standard Document:** OF-SPEC-2026-AR-02  
**Author:** OmniFrame Core Architecture Team  
**Date:** 2026-09-25

---

## 1. Subsystem Architecture Overview

The Aspect Ratio Subsystem establishes sequence dimensions as the single source of truth across:
1. **Compositor Canvas (`Preview.tsx`):** Renders project canvas with exact pixel aspect ratio matching sequence dimensions.
2. **Transform Space (`playback.ts`):** Normalizes clip translation, scale, and rotation to sequence coordinates.
3. **Drawing & Mask Subsystems (`DrawingCanvasOverlay.tsx`):** Aligns brush strokes, selection marquees, marching ants, and layer masks to sequence resolution.
4. **Offline Export Engine (`export.ts`):** Guarantees exported WebM / MP4 video files match exact sequence pixel dimensions.

---

## 2. Platform Presets Catalogue

| Preset ID | Ratio | Width (px) | Height (px) | Primary Target Platforms | Orientation |
|---|---|---|---|---|---|
| `source` | Native | Dynamic | Dynamic | Matches primary ingested media | Adaptive |
| `16:9` | 1.7778 | 1920 | 1080 | YouTube, Broadcast, Desktop Displays, Vimeo | Landscape |
| `9:16` | 0.5625 | 1080 | 1920 | TikTok, Instagram Reels, YouTube Shorts, Stories | Portrait |
| `1:1` | 1.0000 | 1080 | 1080 | Instagram Feed, Square Video Ads, Carousel | Square |
| `4:5` | 0.8000 | 1080 | 1350 | Instagram Portrait Feed, Facebook Mobile | Portrait |
| `3:4` | 0.7500 | 1080 | 1440 | Tablet Portrait, Pinterest, Digital Signage | Portrait |
| `4:3` | 1.3333 | 1440 | 1080 | Classic Broadcast, SD Retro, iPad Video | Landscape |
| `3:2` | 1.5000 | 1620 | 1080 | DSLR Still Photography Video, Surface Display | Landscape |
| `2:3` | 0.6667 | 1080 | 1620 | Vertical Photography Displays, Pinterest Video | Portrait |
| `5:4` | 1.2500 | 1350 | 1080 | Large Format Photography, Medium Format | Landscape |
| `21:9` | 2.3333 | 2560 | 1080 | UltraWide Monitors, Anamorphic / Cinematic | Cinematic |
| `custom` | Custom | 64–7680 | 64–7680 | Custom LED Walls, Specialized Broadcast | User Defined |

---

## 3. UI Component State Machine

### 3.1 Closed State (Bottom-Right Anchor)
- Displayed in the bottom-right corner of the Preview area.
- Compact button showing platform/aspect icon and current label: `[icon] [16:9 ▾]`.
- Non-intrusive tooltip on hover displaying primary platform guidance.
- "Preview px × px live" text removed from top-left, eliminating visual clutter.

### 3.2 Popover Dropdown
- Organized into:
  1. Standard Presets Grid (with platform badge tooltips).
  2. Custom Dimension Editor (Width, Height, Aspect Lock toggle button).
  3. Reset to Standard Preset action.
- Numeric validation clamps inputs to $[64, 7680]$ pixels.
- Aspect lock calculates linked dimensions in real time:
  $$H = \operatorname{round}(W / R), \quad W = \operatorname{round}(H \times R)$$

---

## 4. Export Synchronization & OpenCV Headless Verification

During export:
1. `exportVideo` queries authoritative sequence dimensions:
   ```typescript
   const seq = useEditor.getState().sequenceSettings
   const targetW = seq?.width || 1920
   const targetH = seq?.height || 1080
   ```
2. Canvas size is synchronized:
   ```typescript
   canvas.width = targetW
   canvas.height = targetH
   ```
3. Monitor mode is automatically transitioned to `program`:
   ```typescript
   if (useEditor.getState().monitorMode !== 'program') {
     useEditor.getState().setMonitorMode('program')
   }
   ```
4. Output frames are encoded using `MediaRecorder` or WebCodecs.
5. In automated tests (`qa/master-rebuild-e2e.mjs`), headless OpenCV decodes the resulting video file:
   ```python
   cap = cv2.VideoCapture(export_path)
   w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
   h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
   assert w == 1080 and h == 1920, f"Expected 1080x1920, got {w}x{h}"
   ```
