# Burst, aura, turbulence and effect-region increment — 2026-11-07

## Evidence used

This increment used retained, reviewable project evidence. It did not count a URL list or search result as newly watched footage.

- `youtube-audit/evidence/xeXhlkoOyrw.md` is marked `VISUAL_ANALYSIS_COMPLETE` from the earlier 18-frame review. It records cyan and magenta character auras, dual-colour aura motifs and sparkle overlays.
- `youtube-audit/inventory.json` records a grey Voronoi/shatter composition, fire/explosion footage with a purple mask outline, a green glow aura and a white shard burst. These are inventory observations, not a new continuous watch in this turn.
- `research/editor-upgrade-20261031/apk-effect-catalogue.json` records Perfect Slice (radial slice explosion), Shatter Break, Voronoi shatter, S_GlowAura (radial coloured lines around bright pixels) and Turbulent Pro (FBM/curl displacement). This is retained static resource analysis. It does not establish source-code licensing.

Interactive shared-Chrome computer control was unavailable in this draft, so no new claim is made about watching additional YouTube videos end to end.

## Read-only GitHub candidate scan

The GitHub API was queried on 2026-11-07 so repository identity and the API-reported code licence were checked instead of inferred from names. Model weights and training data can have different terms and must be reviewed separately before bundling.

| Candidate | Possible editor use | API licence result | Decision in this increment |
|---|---|---|---|
| `xinntao/Real-ESRGAN` | image/video upscaling | BSD-3-Clause | Candidate for a later tiled ONNX/native worker; no weights bundled here |
| `upscayl/upscayl` | desktop upscaling workflow reference | AGPL-3.0 | Workflow reference only; code was not copied |
| `TencentARC/GFPGAN` | face restoration | NOASSERTION | Not bundled without a clear code/weights review |
| `KlingAIResearch/LivePortrait` | portrait motion | NOASSERTION | Not bundled without a clear code/weights review |
| `DepthAnything/Depth-Anything-V2` | 2.5D depth maps | Apache-2.0 | Candidate for the existing model-download architecture |
| `facebookresearch/sam2` | video roto tracking | Apache-2.0 | Already represented in OmniFrame's external roto-model design; weights remain optional |
| `huggingface/transformers.js` | browser model runtime patterns | Apache-2.0 | Compatible reference for browser loading; OmniFrame already uses ONNX Runtime Web |
| `TencentARC/InstantMesh` | image-to-3D | Apache-2.0 | Candidate for an external desktop service, not suitable as an embedded lightweight model here |
| `Tencent-Hunyuan/Hunyuan3D-2` | text/image-to-3D | NOASSERTION | Not bundled without licence and hardware review |
| `isl-org/Open3D` | geometry processing | NOASSERTION | Candidate for native tooling after licence/platform review |

This scan did not clone or vendor third-party code. It narrows safe follow-up work without turning uncertain licences or very large model stacks into installer dependencies.

## Implemented behavior

- `src/lib/actionFx.ts` is a shared Canvas renderer used by browser playback/export and the universal headless renderer through `particleFx.ts`.
- The Burst category contains exactly 50 real presets: Glass, Crack, Shatter, Tile Break, Slice, Shockwave, Fireball, Smoke, Energy and Implosion, each with Soft, Clean, Classic, Heavy and Chaos tiers.
- Every burst exposes intensity, speed, cycle, loop gap, loop on/off, origin, spread, piece count, gravity, spin, colour and deterministic seed. Long effect ranges repeat after the configured gap. `Fit 1×` trims an instance to one active cycle.
- Split effect instances retain their source clock, so a split does not restart the action phase.
- Eight aura presets use a bright-pixel mask, coloured bloom, spiral arcs and radial rays. Threshold, radius, line count, speed, rotation, centre and both colours remain editable and numeric fields remain keyframeable.
- Turbulent displacement now exposes FBM, curl and glass modes plus scale, evolution, direction and seed. Six presets exercise those paths.
- Eight Liquify effect presets use the same non-destructive push/bulge/pinch/twirl deformation vocabulary as the existing preview brush. The existing drawing/transform liquify remains a persisted dab field.
- Each FX stack row has a `Region` action that opens the existing multi-region effect mask. Ellipse, rectangle, circle, text and custom regions work in browser and headless rendering. The mask currently scopes the combined effect stack on that clip; it is not an independent mask stored inside each individual overlapping FX instance.
- Adjustment-layer region isolation now includes pixel, glitch, particle, aura and burst engines even when the layer has no LUT or CSS filter.
- Effect category tabs and cards use compact icons. Poly Haven licence data remains in asset metadata/source records, while browsing cards no longer show acronym badges or explanatory licence prose.

## Verification

- `npm run typecheck`
- `npm run build`
- `node qa/action-fx-unit.mjs`: 50 presets, ten distinct family signatures, aura/liquify/turbulence coverage and loop timing.
- `node qa/deformation-unit.mjs`
- `node qa/particle-fx-unit.mjs`
- `node qa/fx-split-continuity-unit.mjs`
- `node qa/action-fx-ui-e2e.mjs`: live catalog apply, 0.5-second `Fit 1×`, effect region navigation and cleaned asset browsing.
- `node qa/context-menu-viewport-e2e.mjs`
- `node qa/mcp-live-bridge-e2e.mjs`

Visual evidence:

- `qa/artifacts/burst-fx-contact-sheet.png`
- `qa-output/action-fx/burst-catalog-stack-mask.png`
- `qa-output/action-fx/asset-library-clean.png`

The production web build passed. Native Tauri compilation was not run because this runner has no Rust/Cargo executable; cross-platform native certification remains open.
