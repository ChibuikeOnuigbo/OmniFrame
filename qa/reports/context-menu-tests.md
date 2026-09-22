# Context menu regression matrix

| Target | Resolved type | Allowed | Forbidden verified | Result |
|---|---|---|---|---|
| Video clip | VIDEO_CLIP | Cut, Copy, Duplicate, Separate audio, Delete | Group, Transcribe, Compound, web preset | PASS |
| Canvas | CANVAS | Add media, available history commands | Clip commands | PASS |
| Generic narrow surface | EMPTY_EDITOR | Add media, available history commands | Clip commands | PASS |
| Text input | native | Browser text editing context | OmniFrame overlay | PASS |
| Type select | native/popup owner | Existing select interaction | OmniFrame overlay | PASS |

Additional verified behavior: hidden Paste before clipboard content, visible Paste after Copy, real multi-file chooser, Escape close, collision-safe 390×844 placement, keyboard Cut/Paste/Duplicate, real Separate audio, and zero runtime errors.

## Honest remaining scope

Track headers, lanes, ruler, gaps, and playhead need explicit DOM semantics and command implementations before they can receive specialized menus. Unsupported clip/object types are intentionally not represented as if functional.
