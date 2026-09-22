# Settings registry audit

Date: 2026-09-22

## Implemented

- Source-indexed typed registry for 8 existing settings/shortcut disclosures.
- First-class search across labels, descriptions, IDs, categories, and aliases.
- Project scope: frame rate and drop-frame display; intentionally not stored as user preferences.
- User scope: preview quality and reduced motion; both persist in local storage and have direct runtime effects.
- Session/read-only scope: four implemented keyboard shortcuts.
- Categories are derived from registry contents rather than a second category array.
- Search results navigate to the real control; unsupported candidate settings are not shown.

## Verification

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- `node qa/context-menu-e2e.mjs`: 47 PASS, including settings ownership, project FPS, preview backing resolution, reduced motion, escape dismissal, and zero runtime errors.

## Skipped / blocked

- Tauri/native capability settings: SKIPPED — no implemented native settings bridge and Cargo is absent in this environment.
- Device enumeration, native file locations, hardware acceleration, and OS integrations: SKIPPED — no corresponding runtime binding exists.
- Cross-browser/platform persistence matrix: SKIPPED — only the bundled Chromium browser is available in this sandbox.
