# Overlay and ownership report

- Context menu: fixed positioning, z-index 70, maximum viewport-relative height, vertical scrolling only when required.
- Collision strategy: open right/down when space permits; flip left/up near the corresponding edge; maintain an 8px safe margin.
- Capture-phase resolver prevents child timeline handlers from stealing the event.
- Editable inputs preserve native context behavior.
- Selects, options, listboxes, and existing menus retain popup ownership and do not mount an OmniFrame context menu over themselves.
- Pointer-down inside the context menu does not trigger outside-close; outside pointer-down and Escape close it.
- Context opening does not mutate selectedClipId, rightOpen, playback, playhead, or workspace layout.
