# Surgical patch acceptance status

| Gate | Status | Evidence |
|---|---|---|
| Adaptive ruler | PASS | 34-assertion real-browser ruler suite |
| No unit-mode dropdown | PASS | Continuous range, buttons, Fit, and modifier-wheel zoom |
| Zoom physically expands clips | PASS | Four measured clip widths |
| Collision-free generated ticks | PASS for sampled scales | Browser bounding-box checks |
| Multiple project FPS | PASS for ruler generation | Nine rates exercised |
| Synchronized pointer anchor | PASS | 0.0001 s measured delta |
| Exact clip-only hide | PASS | Physical-target browser test |
| Hidden visual state and hover | PASS | Computed opacity and shadow evidence |
| Unhide and shortcut | PASS | Context and keyboard checks |
| Undo/redo | PASS | Browser state checks |
| Preview path excludes hidden clips | PASS at playback routing level | Active clip filter reads `hidden` |
| Encoded export validation | SKIPPED | No export artifact decoded |
| Project reload persistence | SKIPPED/UNSUPPORTED | No project save/load subsystem exists |
| Web shortcut safety | PASS for Chromium/input/Settings | Negative and positive browser tests |
| Native desktop shortcut matrix | SKIPPED | Native shells not launched |
| Compact categorized Settings | PASS | Real dialog interactions |
| No unrelated redesign | PASS by scoped diff review | Changes restricted to requested components/utilities/tests |
| 21 reference clones | PASS | Exact commits in inventory |
| 21 application executions | SKIPPED | Clone is not execution |
| Full performance matrix | SKIPPED | Not benchmarked |

This report intentionally does not convert unavailable work into PASS.
