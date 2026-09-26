# OmniFrame Layout & Workspace Source Code Map (`research/layout/source-map.md`)

## Reference Open-Source Workspace Implementations

### 1. Blender (Source Code & Architecture)
- **Repository**: `projects.blender.org/blender/blender`
- **Key Modules Analyzed**:
  - `source/blender/windowmanager/intern/wm_workspace.c`: Workspace instantiation, area tree duplication, and layout preset loading.
  - `source/blender/editors/screen/screen_ops.c`: `screen_area_split`, `screen_area_join`, `screen_area_swap`, and area maximization logic.
  - `source/blender/windowmanager/intern/wm_event_system.c`: Global event routing for area focus toggle (`Shift+Space` / `Ctrl+Space`).
- **OmniFrame Clean-Room Adaptation**:
  - Model layout as a responsive state tree containing panel visibility, split dimensions, and focus states.

### 2. Shotcut (MLT / Qt Docking)
- **Repository**: `github.com/mltframework/shotcut`
- **Key Modules Analyzed**:
  - `src/mainwindow.cpp`: Setup of `QDockWidget` hierarchy, menu actions (`View -> Layout`), and layout preset restoration.
  - `src/docks/*`: Individual dock implementations (timeline dock, playlist dock, filters dock, scopes dock).
- **OmniFrame Clean-Room Adaptation**:
  - Centralized `TopBar` and `Window -> Layout` preset selector with instantaneous state switching.

### 3. Krita (KDE Frameworks Docking)
- **Repository**: `invent.kde.org/graphics/krita`
- **Key Modules Analyzed**:
  - `libs/ui/KisMainWindow.cpp`: Window layout management, multi-monitor configuration saving, and canvas-only mode toggle (`Tab`).
  - `libs/ui/dialogs/KisWorkspaceChooser.cpp`: Workspace preset card grid UI with thumbnail previews.
- **OmniFrame Clean-Room Adaptation**:
  - Compact popup layout selector displaying active layout indicator and quick presets.

### 4. OpenCut & OpenReel (Web NLEs)
- **Repository**: `github.com/OpenCut-app/OpenCut` & `github.com/Augani/openreel-video`
- **Key Modules Analyzed**:
  - Resizable flexbox splitters with pointer capture listeners.
  - CSS transform-based canvas viewport centering and responsive layout clamping.
- **OmniFrame Clean-Room Adaptation**:
  - Smooth interactive splitter (`[data-testid="timeline-splitter"]`) with client coordinate tracking and bounded min/max clamps.
