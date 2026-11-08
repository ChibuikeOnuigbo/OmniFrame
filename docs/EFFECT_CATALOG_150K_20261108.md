# 150K effect catalog and runtime shortcuts

## Delivered catalog

OmniFrame now exposes **150,048 base effect recipes**:

- 10,623 curated/materialized recipes already present in the shared catalog;
- 139,425 stable indexed recipes (`ofx-000001` through `ofx-139425`);
- the existing 5,000 authored Glitch NG pack loads on demand, producing
  **155,048 recipes in the live Effects browser**.

The indexed bank is not a 139,425-object JSON download. Twelve deterministic
generator families reconstruct only the requested search/page or ID. They
cover cinema grades, directional gradients, lens bokeh, directional streaks,
turbulent flow, aura/light, retro signal, action bursts, motion pulses,
prism/repeat graphics, graphic edges and studio lighting. Each result is a
concrete patch over shared preview/export controls and remains editable,
keyframeable and maskable after it is applied.

The browser keeps 60 cards initially and pages in more on request. Search is
deferred while typing. Users can switch among All, Curated + authored, Indexed
variations, Studio Looks and Favorites. Exact ID lookup works in the UI,
project store and MCP tools without retaining the whole bank in memory.

The collection control uses a compact previous / current / next layout. Effect
categories sit in a four-column semantic tab grid with a persistent selected
border, lower-emphasis hover border and visible keyboard focus. The complete
200-control live UI audit is in `docs/UI_QUALITY_200_SCAN_20261108.md`.

The subsequent movable tilt-shift increment adds 48 curated focus-plane
recipes and six shared-renderer controls. See
`docs/TILT_SHIFT_FOCUS_20261108.md`.

These are recipe counts over existing render kernels. They are not 150,048
independent algorithms, full-motion visual acceptances or a claim that every
possible creative look has been invented. Stable parameters and executable
renderer paths are tested separately from perceptual distinctness.

## Shortcut and settings work

Settings now contains 44 persistent configurable commands. The editor runtime
uses those bindings for undo/redo, clip clipboard operations, split,
duplicate, multi-delete, grouping, transport, frame/second/marker navigation,
tools, zoom, gaps, markers, export In/Out, snapping, panel navigation,
OmniFrame/3D modes, focus layouts and Help.

Bindings support alternatives, Command for Ctrl on macOS, exact modifiers,
clearing an action to leave it unassigned, conflict hints and Reset All.
Preferences are stored on the device in `omniframe.shortcuts`. Browser save
keys such as Ctrl+S remain unclaimed.

## Verification

- `node qa/effect-recipe-bank-unit.mjs`: exact totals, every generated ID,
  paging, direct lookup, category partition, family controls and bounded
  search sweep.
- `node qa/shortcut-registry-unit.mjs`: 44 unique persistent settings,
  alternative chords, modifier matching, macOS Command and disabled bindings.
- `node qa/effect-150k-shortcuts-e2e.mjs`: 155,048 live count, final indexed
  recipe search/apply, editable parameters, Settings UI, runtime rebind,
  persistence across reload and clearing a binding.
- `node qa/ui-200-scan-e2e.mjs`: exactly 200 visible controls across ten modes,
  with 200 PASS / 0 REVIEW / 0 FAIL and ten cutout contact sheets.

Artifacts are in `qa-output/effect-150k/` and `qa-output/ui-200/`.
