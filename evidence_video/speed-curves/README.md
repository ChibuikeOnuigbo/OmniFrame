# Moving speed-curve proofs

`manifest.json` links 15 MP4s and records 120 exact pixel comparisons against decoded linear source footage at the expected shared source times. Each export has 54 frames at 24 fps, including a 0.25-second empty lead-in and two seconds of retimed footage. Timeline screenshots and universal-tool traces accompany each video.

Source: original FFmpeg test footage; output: 320×180 silent diagnostics. Back/elastic/bounce curves intentionally include overshoot or non-monotonic sampling. These are not 150 finished character edits. Nonlinear audio time stretching remains unsupported and is not implied by silent visual exports.

Reproduce: `node qa/speed-curves-render-e2e.mjs`. Test nested grouping/hold/moved-ungroup clocks with `node qa/compound-source-clock-unit.mjs`.
