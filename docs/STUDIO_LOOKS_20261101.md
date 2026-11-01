# Studio Looks — 2026-11-01

Added 1,152 original editable effect recipes: 12 families × 12 palettes × 8 tonal mixes. Families cover Cinema, Soft Bloom, Print Grain, Crisp Detail, Neon Edge, Prism Glass, Poster Ink, Solar Print, Dream Diffusion, Tape Memory, Ripple Lens and Emboss Study. These combine existing shared rendering operations; they are not 1,152 new algorithms or copied APK effects.

Open Effects → Collection → Studio Looks. Search can narrow family, palette and mix names. Each tile offers Favorite, Preview, Layer, click-to-apply and drag-to-clip. Favorites persist in browser storage and have their own collection filter. Preview uses the existing reversible audition system. Applied layers keep editable/keyframeable parameters and participate in undo/redo and `.omni` persistence.

The base catalog now contains 10,481 entries after adding six direct blur-search aliases. Loading the existing 5,000-recipe glitch pack brings it to 15,481. Counts refer to catalog entries, not perceptually independent algorithms.

## Validation

`qa/studio-looks-e2e.mjs` exercises the real browser:

- All 1,152 entries have unique IDs and distinct parameter patches.
- All new patches passed numeric parameter bounds and rendered changed pixels through the shared pixel-grade implementation.
- All 1,152 produced different pixel signatures on a deterministic 96×64 color/texture fixture. This does not establish perceptual uniqueness on arbitrary footage.
- Collection filtering, search, favoriting, reload persistence, non-destructive audition, apply, undo/redo and project save/reopen passed.
- An applied Studio Look was exported on real moving video using the editor's video-export path. FFmpeg decoded the result; the existing realtime/VFR timestamp warning remains.
- Typecheck, production build, context-menu viewport and live MCP regressions passed. Existing build chunk-size/dynamic-import warnings remain.

Evidence is in `qa-output/studio-looks-20261101/`: JSON report, 12-family diagnostic contact sheet, actual library screenshot, video export and interaction-regression artifacts. The contact sheet is a static diagnostic, not a full-motion acceptance reel for every recipe.

The existing earlier editor improvements and user files were retained. No environment configuration or publication, PR, remote push, or model training was performed. Comparative superiority to other editors is not established by this increment.
