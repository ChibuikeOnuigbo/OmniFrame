# Krita docs scan — Board M (2026-10-26)
Official manual 5.3.0, toolbox index (37 tools) + deep scans of freehand_brush / multibrush / gradient_draw.
Full crosswalk + notes: krita-tools.html. Sub-tools created from this scan:
- Drawing toolbar regrouped Krita-style: 7 primary group tiles (Brushes/Shapes/Paths/Fills/Repair/Erase/Select) + scrollable icon sub-mode row per group (shapes/paths/fills/selects now live INSIDE their group; old flat wrapped 18-button row gone).
- Multibrush mirror modes: stroke mirrorX/mirrorY (X, Y, both) — engine renders reflected copies about centre axes (draw_stroke params, MCP-controllable like radialCopies).
- Gradient tool radial shape: gradientShape 'linear'|'radial' (Krita shape family; bilinear/conical/spiral/shaped + repeat modes = backlog).
- Select group exposes the 7 selection sub-modes already in the engine (rect/ellipse/lasso/polygon/brush/magic-wand/character) — Krita selection-tool family parity.
Drive pack provenance: google_drive pack_data folder (id 1EJchvF8g7_aiBgDO5Z0SBpnm0adSGPwQ) holds 85 screenshots; the Krita one is Screenshot (107).png (id 1asCtL2P3Upru5mIaXc6M8Sb5J_WswZnz, 553,583 bytes, fullText match 'krita'). Not inlined: the Drive connector returns binary only as inline base64 (~740 KB chars) which would exhaust the session context; catalogued here with ids instead. Web-harvested Krita UI imagery used for vision: images/boardM-krita-toolbox-docker.png, images/boardM-krita-configure-toolbars.png.
Backlog from scan (honest): stroke stabilizer/smoothing params, Multibrush translate/snowflake/copy-translate, gradient bilinear/conical/spiral/shaped + repeat/antialias/dither, assistants, measure, comic panel, shape edit, magnetic select, colorize mask, dyna, freehand path, reference images.
