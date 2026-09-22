# Hide Clip evidence

Actual Chromium checks passed for exact physical video-clip resolution, visible-command availability, right-aligned `H` shortcut text, canonical single-clip mutation, opacity 0.4, dashed/icon non-opacity indicator, hover edge glow, command replacement with Unhide Clip, keyboard toggle, undo, redo, and input/Settings shortcut ownership.

The canonical `Clip.hidden` value is read by timeline rendering and playback active-clip selection. Export records the same live preview/playback pipeline, so hidden visual clips are excluded from recorded frames; inactive hidden media elements are paused by playback routing. An encoded export was not generated and decoded in this audit, so end-to-end export validation is **SKIPPED**.

No standalone project save/load system currently exists in OmniFrame. The state is serializable, but reload persistence is **SKIPPED/UNSUPPORTED**, not claimed as passed.

Native Windows/macOS/Linux shortcut execution is **SKIPPED** because native shells were not built or launched.
