# Professional Open-Source Video Editor Timeline Source Map

This document catalogs architectural patterns, data models, drag/drop handling, track management, transition representations, and rendering pipelines across leading open-source NLEs.

---

## 1. Kdenlive (`kde/kdenlive`)
- **Repository:** `https://github.com/kde/kdenlive`
- **Key Source Paths:**
  - `src/timeline2/model/timelineitemmodel.cpp`: Master timeline model coordinating tracks, clips, compositions, and mixes.
  - `src/timeline2/model/trackmodel.cpp`: Track data structure maintaining ordered clip intervals and collision avoidance.
  - `src/timeline2/model/mixmodel.cpp`: Same-track mix/transition model connecting two abutting clips with media handles.
  - `src/timeline2/view/qml/Clip.qml` & `Transition.qml`: QML frontend rendering clip blocks, resize handles, and mix trapezoids.
- **Data Model Insights:**
  - Uses rational time (`GenTime`) to avoid floating-point rounding errors.
  - Clips are interval records `[in, out]` mapped to track IDs.
  - Mixes are separate objects linked to `clipA` and `clipB` with a defined duration, evaluated during MLT producer rendering.

---

## 2. OpenCut (`OpenCut-app/OpenCut`) & OpenReel (`Augani/openreel-video`)
- **Key Source Paths:**
  - `src/core/timeline/`: TypeScript / React timeline state engine using Zustand/Redux.
  - `src/components/timeline/TrackList.tsx`: Vertical track stacking and drag-over insertion zones.
  - `src/components/timeline/ClipBlock.tsx`: Screen-coordinate mapping (`startTime * pxPerSec`, `duration * pxPerSec`).
  - `src/components/timeline/TransitionOverlay.tsx`: Interactive boundary block rendered over cut points.
- **Data Model Insights:**
  - Pure separation of authoritative temporal state (`startTime: number`, `duration: number`, `trackId: string`) from visual geometry (`left: number`, `width: number`).
  - Ghost clip rendering during active drag; commits track reassignments and time shifts only on `pointerup`.

---

## 3. Shotcut (`mltframework/shotcut`)
- **Repository:** `https://github.com/mltframework/shotcut`
- **Key Source Paths:**
  - `src/qml/views/timeline/Timeline.qml`: Master timeline canvas view with track rows, header controls, and playhead.
  - `src/qml/views/timeline/Track.qml`: Track row layout supporting multi-format clips.
  - `src/timeline/timeline.cpp`: C++ bridge communicating with the MLT melt framework.
- **Data Model Insights:**
  - Automatic transition creation when one clip is dragged over another on the same track (overlapping region becomes a purple transition block).
  - Track order is strictly index-based ($V_n$ to $V_1$), where higher indices composite on top of lower indices.

---

## 4. Olive Video Editor (`olive-editor/olive`)
- **Repository:** `https://github.com/olive-editor/olive`
- **Key Source Paths:**
  - `app/node/timeline/timeline.cpp`: Node-based timeline representation.
  - `app/widget/timelinewidget/timelinewidget.cpp`: Interactive Qt timeline widget with custom painters for clips and transitions.
  - `app/codec/transcode/`: GPU-accelerated video decoding pipeline.
- **Data Model Insights:**
  - Highly modular transition objects with input/output node connections and parameter keyframing.
  - Separation of display zoom from frame coordinates using integer frame numbers.

---

## 5. OpenShot (`OpenShot/openshot-qt`)
- **Repository:** `https://github.com/OpenShot/openshot-qt`
- **Key Source Paths:**
  - `src/windows/views/timeline_webview.py`: Web-based timeline UI using AngularJS and HTML5 Canvas / SVG.
  - `src/classes/timeline.py`: Python wrapper around `libopenshot` C++ rendering engine.
- **Data Model Insights:**
  - Transitions are first-class JSON objects placed on tracks with `start`, `end`, and grayscale mask image paths for wipe effects.
  - Dragging between clips snaps to cut points with configurable magnetic sensitivity.

---

## 6. Flowblade (`jliljebl/flowblade`)
- **Repository:** `https://github.com/jliljebl/flowblade`
- **Key Source Paths:**
  - `flowblade-trunk/Flowblade/timeline/`: Python/GTK timeline implementation emphasizing fast keyboard workflow.
  - `flowblade-trunk/Flowblade/transitions.py`: Transitions database and compositing rules.
- **Data Model Insights:**
  - Explicit distinction between Insert (splice) and Overwrite modes.
  - Two-clip transitions compute bounding ranges and clamp duration to minimum available handle on either side.

---

## 7. Blender Video Sequence Editor (`Blender/blender`)
- **Repository:** `https://github.com/Blender/blender`
- **Key Source Paths:**
  - `source/blender/editors/space_sequencer/`: Sequencer UI, timeline drawing, and strip manipulation.
  - `source/blender/sequencer/intern/`: Strip data structure (Movie, Image, Sound, Wipe, Cross, Transform).
- **Data Model Insights:**
  - Strips live on 1-based channels.
  - Transitions (Wipe, Cross) are effect strips that take input from two adjacent or overlapping strips.
