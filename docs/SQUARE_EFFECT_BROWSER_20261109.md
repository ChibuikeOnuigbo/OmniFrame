# Square preview browser and 300K recipes

Effects and transitions use a shared square card: single click starts a temporary audition; the active canvas copies the actual program monitor; its bottom scrubber seeks within the audition window. Dragging holds transport and releasing preserves playback intent. The hover/focus plus button commits; double-click also commits. Effects insert a two-second adjustment clip at the current playhead, while transitions use the nearest valid cut. Dragging an effect onto a clip remains supported.

The active square uses the shared preview renderer. Idle cards render a small subject image through the raster grading engine once. Idle thumbnails cannot demonstrate every temporal/3D effect; active auditions require suitable timeline footage (and transitions require a usable cut). Only the active tile copies frames. Leaving that tile's collection cancels its owned audition.

Catalog: **300,000 base recipes**, consisting of 10,623 materialized plus 289,377 indexed recipes. The authored 5,000 pack brings the loaded count to **305,000**. Existing indexed IDs retain their meanings. These are parameter recipes over shared engines, not 300K independent effect algorithms. Lens Bokeh, Motion Pulse, Directional Light and Turbulence shortcuts expose themed catalog selections; they are not additional downloaded third-party packs.

Three locally stored subject photos from Unsplash cover portrait, landscape and night. Sources and SHA256 values are in `public/assets/effect-subjects/credits.json`. Drive listing and sampled inspection are recorded in `research/square-browser-20261109/drive-inventory.json`. The user's attached CapCut screenshots supplied the principal card layout reference. The official CapCut page was blocked; the Unsplash license page presented a browser challenge. No complete Drive/video viewing is claimed.

Validation: exact catalog count, unique indexed IDs, bounded search, typecheck/build, square browser interactions, context-menu and live MCP regressions. Evidence: `qa-output/square-preview/`. Timeline fixes and test-count limits: `ultimate tests/Ultimate_timeline_est.md`.
