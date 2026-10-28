# New Glitch — render manifest (Board T)

Recipes: `new_glitch/index.json` + `presets.ndjson` = 5,000 metadata definitions (pack-integrated).
Only the renders below exist on disk and are claimed; the remaining recipes are batch-queue candidates.

| file | family | palette | seed | frames | sha256:16 |
|---|---|---|---|---|---|
| [renders/ng01_digital-slice_a568ff.mp4](renders/ng01_digital-slice_a568ff.mp4) | digital-slice | #a568ff/#15e4f3 | 8156 | 24 | fe3dbd9c37b908ee |
| [renders/ng02_rgb-shock_a568ff.mp4](renders/ng02_rgb-shock_a568ff.mp4) | rgb-shock | #a568ff/#15e4f3 | 8157 | 24 | f21b0062639b7931 |
| [renders/ng03_vhs-tear_a568ff.mp4](renders/ng03_vhs-tear_a568ff.mp4) | vhs-tear | #a568ff/#15e4f3 | 8158 | 24 | e866981944931530 |
| [renders/ng04_datamosh-inspired_a568ff.mp4](renders/ng04_datamosh-inspired_a568ff.mp4) | datamosh-inspired | #a568ff/#15e4f3 | 8159 | 24 | 7a7fcc84a06128d3 |
| [renders/ng05_scan-burst_a568ff.mp4](renders/ng05_scan-burst_a568ff.mp4) | scan-burst | #a568ff/#15e4f3 | 8160 | 24 | c442c4452058a6cb |
| [renders/ng06_phantom-echo_a568ff.mp4](renders/ng06_phantom-echo_a568ff.mp4) | phantom-echo | #a568ff/#15e4f3 | 8161 | 24 | c25d3fe8b45a1df6 |
| [renders/ng07_neon-corrupt_a568ff.mp4](renders/ng07_neon-corrupt_a568ff.mp4) | neon-corrupt | #a568ff/#15e4f3 | 8162 | 24 | 2f25b0a821b94d2b |
| [renders/ng08_pixel-collapse_a568ff.mp4](renders/ng08_pixel-collapse_a568ff.mp4) | pixel-collapse | #a568ff/#15e4f3 | 8163 | 24 | 2e0942423a2ca1dd |
| [renders/ng09_vector-edge_a568ff.mp4](renders/ng09_vector-edge_a568ff.mp4) | vector-edge | #a568ff/#15e4f3 | 8164 | 24 | 860a5773e34e8d08 |
| [renders/ng10_spectral-logo_a568ff.mp4](renders/ng10_spectral-logo_a568ff.mp4) | spectral-logo | #a568ff/#15e4f3 | 8165 | 24 | 4e512c428d3edf5f |
| [renders/ng11_digital-slice_ff4d5e.mp4](renders/ng11_digital-slice_ff4d5e.mp4) | digital-slice | #ff4d5e/#ffffff | 8166 | 24 | 46296a766056351d |
| [renders/ng12_spectral-logo_7fd4ff.mp4](renders/ng12_spectral-logo_7fd4ff.mp4) | spectral-logo | #7fd4ff/#3a6cff | 8167 | 24 | cf96f748a787231d |

Combined sampler: [glitch_sampler_OMNIFRAME.mp4](glitch_sampler_OMNIFRAME.mp4)

Kernel: src/lib/glitchNG.ts (deterministic RGBA, ported from OmniFrame_Glitch_Audit code/glitchEngine.mjs);
wired into browser playback.ts + headless appRender.mjs; catalog family "Glitch NG" (ng-* ids), all ng* params keyframeable via fx keys.
