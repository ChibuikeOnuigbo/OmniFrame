# Motion Lab template increment — 2026-11-07

## Public-site review and boundary

The public Motionvid template page, `robots.txt`, sitemap and Terms were read on 2026-11-07. The sitemap exposed 213 template URLs: 201 individual template pages plus 12 category pages. The landing page described “200+ free motion graphics templates.” This establishes breadth, not a right to copy project sources.

Motionvid Terms section 5 prohibits automated bots, scripts, scrapers, crawlers, data-mining tools and calls to internal application endpoints. Section 7 prohibits copying, modifying, distributing or creating derivatives of platform technology without express permission. The Terms license Generated Content to the user, including controlled elements incorporated into that output; they do not grant source-project redistribution rights.

No Motionvid project, preview video, thumbnail or internal response is committed. The bounded source record, counts, policy decision and public-page hashes are in `research/motionvid-public-catalog-scope-20261107.json`. A shared Chrome desktop was unavailable, so no claim is made that all 201 previews were continuously watched.

## Implemented original system

`src/lib/templatePresets.ts` now provides 201 original OmniFrame Motion Lab recipes. Seventeen composition families cross twelve visual variants and are trimmed to the requested 201 recipes. They cover 16 working categories: titles, brand, lower thirds, data, diagrams, maps, product, devices, social, news, countdowns, photos, UI demos, backgrounds, music and comparisons.

Each recipe defines:

- editable text, media, logo and audio slots;
- a 16:9, 9:16, 1:1 or 4:5 sequence aspect;
- a three-color palette;
- one of 12 keyframe motion families;
- one of eight original procedural backdrop families;
- a four-to-ten-second working duration.

The live builder in `TemplatePickerModal.tsx` creates a generated SVG backdrop, independent editable timeline layers, media replacements from the project library, text styling and actual Curve Engine keys. Missing required media stays an open slot and is reported after the build. No external media is silently fetched.

The picker is now reachable from the top bar and mobile workspace menu. It supports text/tag search, category filtering, a visual preview, palette swatches, aspect/duration metadata and direct asset assignment. Its modal stacks above the editor panels at desktop sizes.

## Verification

- `npm run typecheck`
- `npm run build`
- `node qa/motion-lab-templates-unit.mjs`
- `node qa/motion-lab-templates-ui-e2e.mjs`

The unit test checks exact catalog size, unique IDs/names, all categories, 12 motion families, slot integrity and search behavior. The browser test searches and filters the live catalog, builds Data Story · Neon, and verifies one original background plus three animated editable text layers and sequence settings.

Evidence:

- `qa-output/motion-lab/catalog-search-preview.png`
- `qa-output/motion-lab/data-story-editable-scene.png`
- `qa-output/motion-lab/mobile-template-browser.png`
- `qa-output/motion-lab/report.json`

The recipes share general construction engines. A count of 201 is a recipe count, not 201 unrelated rendering algorithms or faithful copies of another service.
