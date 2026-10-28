# OmniFrame STATE — Board T cont.2 (2026-10-28)

Baseline audited: f6d0128 (pack baseline match). Packs unpacked at
new_doc_toll_research/packs/ (glitch-audit + repair-pack; videos kept OUT of git).

## Completed
- Curve engine rebuilt to repair-pack tools/curves.py canonical math: full Penner
  family (sine→circ × in/out/inout), back/elastic/bounce in-out, normalized-spring
  rebound-in/out (overshoot past 1 + damped up-down regression; rebound-in adds
  anticipation dip), equal-contact decaying bounce (params steps/bounciness/
  firstBounce from the uploaded Easing-Curve popup), springs, anticipate-settle.
  Simulation-verified: qa/curve-sim.mjs asserts endpoints pinned, rebound
  overshoot >1.01 with ≥2 regressions, bounce contacts at 0.52 + equal arcs,
  elastic peak ≈1.37, back-out ≈1.1, back-in dip ≈-0.1 → PASS 35 families;
  atlas test_ans_result/evidence/curve-atlas.png + curve_texts/curve-stats.json.
  curve_texts/ 50 videos RE-RENDERED on the fixed engine.
- Glitch NG engine integrated: src/lib/glitchNG.ts (deterministic RGBA kernel
  ported from pack code/glitchEngine.mjs), wired browser playback.ts (3 passes)
  + headless appRender.mjs (2 passes), catalog family 'Glitch NG' (10 ng-* ids),
  all ng* params keyframeable via fx keys. 5,000 recipe definitions integrated as
  metadata (new_glitch/index.json + presets.ndjson).
- new_glitch/: 12 real renders (10 families + 2 palette variants) over an ORIGINAL
  OmniFrame logotype plate, glitch confined to logo layers; combined sampler
  new_glitch/glitch_sampler_OMNIFRAME.mp4; MANIFEST.md with sha256 + links.

## Partial
- 5,000-recipe batch rendering: queue not yet run in-app (12/5000 rendered).
- Glitch Effect Graph node UI (material controls inspector) — params exist via
  MCP/fx keys; native inspector panel pending.
- WONDERFUL hero: 'wodnderful' per user spelling rendered; correctly-spelled
  WONDERFUL 10s re-render pending next increment.

## Failed / blocked
- Desktop Tauri installer evidence: BLOCKED (no Rust toolchain in sandbox; logged
  in docs/desktop-architecture.md previously).
- ≥80% visual similarity to the HGH reference: NOT MEASURED (copyright-safe
  original logo used instead; frame-aligned metric not declared yet).
- Roto/mask accuracy upgrade + UI workspace rebuild: not started this increment.

## Preservation
- No source dirs deleted; no generated folders removed; packs unpacked under
  new_doc_toll_research/packs/ and gitignored (71 MB videos stay local).
