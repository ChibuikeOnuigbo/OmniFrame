# OmniFrame development

Read `continue.md`, `docs/CODEX_TASK_RECOVERY.md` and `reports/STATE.md` before working. Treat the user's latest branch instructions as authoritative. The device/glitch implementation started from merged `main` (`ba7103b89600ef4afa2d4ac5a55e1be1a24ac1ea`); preserve user branches and local changes. Never use the old continuation file's historical hard-reset recovery pattern.

Use the existing checkout. Do not create worktrees unless requested. Do not merge to main, reset protected branches, or force-push.

Keep preview and export on the shared `src/lib` engines. Browser video export uses `PreviewEngine`; universal headless tools use `tools/mcp/appRender.mjs`. A helper passing alone is not end-to-end proof. Preserve masks, animation, project persistence and undo history.

Useful checks:

- `npm run typecheck` and `npm run build`.
- `node qa/glitch-ng-layers-unit.mjs`, `node qa/device-rig-unit.mjs`, `node qa/drawing-shapes-unit.mjs`, `node qa/audio-output-math-unit.mjs`.
- With Vite running: `node qa/device-glitch-production-e2e.mjs` and `node qa/audio-strength-e2e.mjs`.
- `node qa/universal-tools-unit.mjs`, `node qa/tymm-lut-parity.mjs`, `node qa/alight-roundtrip.mjs`, `node qa/replace-template-demo.mjs` protect the universal tools and existing workflows.

Use the lockfile-pinned FFmpeg and Chromium. The cloud command sandbox may require supported escalation for sockets, subprocesses and browser runs. Keep inherited proxy/CA settings and verification. Do not substitute credentials or disable checks.

Recipe data lives in `new_glitch/presets.ndjson`. Rebuild the lazy UI pack with `node scripts/build-glitch-recipe-pack.mjs`. One canonical full-motion queue owns `new_glitch/batch/checkpoint.json`: `node qa/newglitch-batch.mjs --count=88`; the legacy batch entry point delegates to it. Its cursor is the next **1-based** recipe number, recovered from completed IDs. A failed render stays pending. Do not run two queue writers simultaneously.

Distinguish 5,000 available recipes, exhaustive kernel checks, single-frame compositor diagnostics, full-motion MP4 acceptance, visual distinctness, and human approval. Do not equate those counts. Preserve user media. Only remove outputs you generated and can identify.

For models: Blender 4.3.2 was validated. Run `blender --background --python scripts/blender/generate_device_pack.py -- --out public/models/device_transitions`, then `blender --background --python scripts/blender/render_device_previews.py`. Inspect the contact sheets, screen UVs, orientation, clipping and handoff before reporting visual quality. Keep the separate `ScreenSurface` and editable source. Do not claim unsupported motion blur, depth of field, desktop builds or hardware performance were verified.

Record concrete verified changes in `reports/FEATURES.md` and remaining work in `continue.md`. Keep claims scoped to actual executed checks and artifacts.

For interaction changes, run `qa/context-menu-viewport-e2e.mjs` and `qa/mcp-live-bridge-e2e.mjs` against fresh Vite. Audit old requests with `scripts/audit-project-history.py`; do not equate repeated ledger headings or search URLs with delivered features or watched tutorials.
