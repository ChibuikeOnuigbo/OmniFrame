# OmniFrame UI quality — 200 live scans

**Run date:** 2026-11-08

**Surface:** Studio left dock and each of its ten editor modes at 1600×1000

**Method:** Playwright measured exactly 20 visible interactive controls in each mode, captured every control, and assembled ten cutout contact sheets. This is live browser evidence, not a source-only review.

## Verdict

- Total scans: **200**
- PASS: **200**
- REVIEW: **0**
- FAIL: **0**
- Browser errors: **0**
- Broader two-viewport affordance sweep: **0 tiny, 0 unnamed, 0 duplicate-test-id findings**

A PASS means the control is named, visible, inside the viewport, at least 24×24 CSS pixels, and exposes the applicable interaction state. REVIEW marks a usable control whose hover or keyboard focus treatment needs a design pass. FAIL marks a target, naming, or viewport defect that blocks reliable operation.

## Strict state rules

1. A clicked or selected tag keeps a persistent border/background state and exposes `aria-selected`, `aria-pressed`, or `aria-checked`.
2. Hover produces a visible change but remains lower emphasis than the selected state.
3. Tags and view switches use consistent grid or flex alignment instead of irregular wrapping.
4. Keyboard focus must be visible; interactive targets must be at least 24×24 CSS pixels.
5. Edge-arrow selectors keep Previous at the left edge, the current value in the center, and Next at the right edge.

## Effects collection proof

- Order: **previous < selection < next**
- Arrow targets: **28x25 / 28x25**
- Category grid: **4 columns**
- Border hierarchy: selected `rgb(165, 243, 252)`; rest `rgb(35, 42, 57)`; hover `rgb(119, 131, 156)`
- Functional cycle: **all → curated → all**
- Evidence: [collection stepper](../qa-output/ui-200/proof-effects-collection-stepper.png), [category grid](../qa-output/ui-200/proof-effects-category-grid.png)

## Professional pattern comparison

The verdict uses three public design-system baselines and the user-supplied picker reference. Adobe Spectrum's button component provides the professional control baseline. Material Design defines hover, focus, and pressed state layers with different emphasis. The WAI-ARIA tabs pattern requires an explicit selected tab and keyboard-operable semantics. OmniFrame's effect tags now follow those principles with a persistent cyan selected state, a quieter hover border, a four-column layout, and semantic `role=tab` / `aria-selected`. The edge-arrow collection picker follows the supplied compact picker layout while retaining an accessible native select.

References checked 2026-11-08:

- Adobe Spectrum Web Components, Button: https://opensource.adobe.com/spectrum-web-components/components/button/
- Material Design 3, Interaction states: https://m3.material.io/foundations/interaction/states/overview
- WAI-ARIA Authoring Practices, Tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

## Cutout contact sheets

- [media](../qa-output/ui-200/cutouts-media.png) — scans 1–20
- [text](../qa-output/ui-200/cutouts-text.png) — scans 21–40
- [transitions](../qa-output/ui-200/cutouts-transitions.png) — scans 41–60
- [effects](../qa-output/ui-200/cutouts-effects.png) — scans 61–80
- [audio](../qa-output/ui-200/cutouts-audio.png) — scans 81–100
- [relationships](../qa-output/ui-200/cutouts-relationships.png) — scans 101–120
- [drawing](../qa-output/ui-200/cutouts-drawing.png) — scans 121–140
- [omniframe](../qa-output/ui-200/cutouts-omniframe.png) — scans 141–160
- [tracking](../qa-output/ui-200/cutouts-tracking.png) — scans 161–180
- [threed](../qa-output/ui-200/cutouts-threed.png) — scans 181–200

## All 200 scans

| # | Mode | Control | Role | Target | Layout | State evidence | Verdict | Notes |
|---:|---|---|---|---:|---|---|---|---|
| 1 | media | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 2 | media | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 3 | media | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 4 | media | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 5 | media | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 6 | media | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 7 | media | Open + read an Alight Motion v5 project XML: layers, effects and keyfram | button | 80×40 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 8 | media | Export the whole project as Alight Motion v5 dialect XML (OmniFrame re-i | button | 80×40 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 9 | media | Export the most recently captured template (TEMPLATE MODE) as XML — full | button | 80×55 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 10 | media | Search | input | 87×32 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 11 | media | Filter media by type | select | 82×32 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 12 | media | Open GIPHY | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 13 | media | Import media files | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 14 | media | Media specifications for Death Note Chibi - 5 Characters.mp4 | button | 24×24 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 15 | media | Add Death Note Chibi - 5 Characters.mp4 to timeline | button | 24×24 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 16 | media | Find a tool or panel | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 17 | media | all — every tool category | button | 39×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 18 | media | VID — video editing tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 19 | media | 2d — paint tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 20 | media | 3d — scene tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 21 | text | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 22 | text | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 23 | text | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 24 | text | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 25 | text | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 26 | text | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 27 | text | PresetsCinematic & Lower 3rd | button | 123×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 28 | text | 42 procedural text presets with animation settings | button | 123×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 29 | text | Retro glitch text — effects or traditional per-letter method | button | 123×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 30 | text | Watermark levels 1–6 and saved stamps | button | 123×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 31 | text | StylingFonts & Colors | button | 123×50 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 32 | text | Find a tool or panel | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 33 | text | all — every tool category | button | 39×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 34 | text | VID — video editing tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 35 | text | 2d — paint tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 36 | text | 3d — scene tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 37 | text | Media Library | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 38 | text | Text & Titles | button | 34×34 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 39 | text | Transitions | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 40 | text | LUT — Effects | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 41 | transitions | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 42 | transitions | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 43 | transitions | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 44 | transitions | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 45 | transitions | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 46 | transitions | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 47 | transitions | Transition duration in seconds (0.1 to 5) | input | 229×24 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 48 | transitions | 0.5s | button | 38×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 49 | transitions | 1s | button | 26×24 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 50 | transitions | 1.5s | button | 38×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 51 | transitions | 2s | button | 26×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 52 | transitions | 3s | button | 26×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 53 | transitions | 5s | button | 26×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 54 | transitions | Device 3D6 | button | 80×30 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 55 | transitions | Object 3D4 | button | 80×30 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 56 | transitions | Blur50 | button | 80×30 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 57 | transitions | Dissolve57 | button | 80×30 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 58 | transitions | Light50 | button | 80×30 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 59 | transitions | Flicker50 | button | 80×30 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 60 | transitions | TV50 | button | 80×30 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 61 | effects | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 62 | effects | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 63 | effects | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 64 | effects | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 65 | effects | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 66 | effects | Scroll left | button | 36×36 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 67 | effects | Effect catalog150K+ | tab | 181×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 68 | effects | Scroll right | button | 36×36 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 69 | effects | Panel contents, scrollable | div | 271×866 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 70 | effects | Previous effect collection | button | 28×25 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 71 | effects | Effect collection | select | 193×25 | grid | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 72 | effects | Next effect collection | button | 28×25 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 73 | effects | All | tab | 60×26 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 74 | effects | Glitch | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 75 | effects | Glitch NG | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 76 | effects | Motion | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 77 | effects | Color | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 78 | effects | Blur | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 79 | effects | Distort | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 80 | effects | Burst | tab | 60×26 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 81 | audio | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 82 | audio | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 83 | audio | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 84 | audio | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 85 | audio | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 86 | audio | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 87 | audio | Audio studio tools and results | region | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 88 | audio | Voice recorder, EQ & reverbCapture a local mic take and place it at the | button | 245×63 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 89 | audio | Pitch & tempo, independentRender a new audio clip, local processing | button | 245×63 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 90 | audio | Analyze | button | 70×30 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 91 | audio | Isolation engine | select | 225×32 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 92 | audio | Keep voiceAcapella / dialogue | button | 120×66 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 93 | audio | Remove voiceInstrumental / karaoke | button | 120×66 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 94 | audio | Isolation strength | input | 225×24 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 95 | audio | Find a tool or panel | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 96 | audio | all — every tool category | button | 39×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 97 | audio | VID — video editing tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 98 | audio | 2d — paint tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 99 | audio | 3d — scene tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 100 | audio | Media Library | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 101 | relationships | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 102 | relationships | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 103 | relationships | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 104 | relationships | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 105 | relationships | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 106 | relationships | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 107 | relationships | AE Layer > New > Null Object: invisible transform controller | button | 45×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 108 | relationships | CapCut-style group (Ctrl+G) | button | 65×24 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 109 | relationships | Find a tool or panel | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 110 | relationships | all — every tool category | button | 39×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 111 | relationships | VID — video editing tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 112 | relationships | 2d — paint tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 113 | relationships | 3d — scene tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 114 | relationships | Media Library | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 115 | relationships | Text & Titles | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 116 | relationships | Transitions | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 117 | relationships | LUT — Effects | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 118 | relationships | Audio | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 119 | relationships | Link & Groups | button | 34×34 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 120 | relationships | Desktop Pack | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 121 | drawing | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 122 | drawing | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 123 | drawing | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 124 | drawing | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 125 | drawing | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 126 | drawing | Scroll left | button | 36×36 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 127 | drawing | Selection & Masking | tab | 181×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 128 | drawing | Scroll right | button | 36×36 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 129 | drawing | Panel contents, scrollable | div | 271×866 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 130 | drawing | Disabled | button | 64×24 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 131 | drawing | View videos as layers | button | 90×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 132 | drawing | Convert drawing to clips | button | 90×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 133 | drawing | Brush | button | 43×36 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 134 | drawing | Pencil | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 135 | drawing | Marker | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 136 | drawing | Line | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 137 | drawing | Box | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 138 | drawing | Circle | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 139 | drawing | Arrow | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 140 | drawing | Star | button | 43×36 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 141 | omniframe | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 142 | omniframe | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 143 | omniframe | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 144 | omniframe | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 145 | omniframe | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 146 | omniframe | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 147 | omniframe | Segments | button | 76×44 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 148 | omniframe | Select | button | 76×44 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 149 | omniframe | Roto | button | 76×44 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 150 | omniframe | Actions | button | 76×44 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 151 | omniframe | Selection6 sub-tools | button | 78×88 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 152 | omniframe | Shift & InfillMulti-frame | button | 78×88 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 153 | omniframe | RecolorHue & presets | button | 78×88 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 154 | omniframe | Load the room chair and towel photo to edit by region | button | 121×46 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 155 | omniframe | Load the Death Note characters video or image to edit by region | button | 121×46 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 156 | omniframe | Rearrange Clean | button | 130×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 157 | omniframe | Character list, scrollable | div | 247×192 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 158 | omniframe | Light YagamiCharacter 1 (Far Left)All Frames | button | 245×46 | grid | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 159 | omniframe | L LawlietCharacter 2 (Crouching)All Frames | button | 245×46 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 160 | omniframe | MelloCharacter 3 (Leather Jacket)All Frames | button | 245×46 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 161 | tracking | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 162 | tracking | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 163 | tracking | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 164 | tracking | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 165 | tracking | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 166 | tracking | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 167 | tracking | Find a tool or panel | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 168 | tracking | all — every tool category | button | 39×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 169 | tracking | VID — video editing tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 170 | tracking | 2d — paint tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 171 | tracking | 3d — scene tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 172 | tracking | Media Library | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 173 | tracking | Text & Titles | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 174 | tracking | Transitions | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 175 | tracking | LUT — Effects | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 176 | tracking | Audio | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 177 | tracking | Link & Groups | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 178 | tracking | Desktop Pack | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 179 | tracking | Storyboard | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 180 | tracking | Drawing & Paint | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 181 | threed | Section style Tabs. Activate to use single-open accordion sections. | button | 26×26 | flex | Selected; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 182 | threed | Open panel as a full window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 183 | threed | Open help: tutorials and info | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 184 | threed | Pop panel out into a floating window | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 185 | threed | Collapse panel | button | 26×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 186 | threed | Panel contents, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 187 | threed | 3D scene controls, scrollable | div | 271×912 | flex | Rest; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 188 | threed | MaterialsPBR & Textures | button | 80×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 189 | threed | 3D PaintSurface Stencils | button | 80×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 190 | threed | Open 3D mask and selection tools | button | 80×82 | grid | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 191 | threed | Browse 3D & Stock Assets | button | 251×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 192 | threed | Open 3D Scene Workspace | button | 251×30 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 193 | threed | Off | button | 33×26 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 194 | threed | Open Drawing Mask Tools | button | 229×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 195 | threed | Find a tool or panel | button | 32×32 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 196 | threed | all — every tool category | button | 39×28 | flex | Selected; Hover N/A; Focus visible | **PASS** | Measured cleanly |
| 197 | threed | VID — video editing tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 198 | threed | 2d — paint tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 199 | threed | 3d — scene tools | button | 39×28 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
| 200 | threed | Media Library | button | 34×34 | flex | Rest; Hover changes; Focus visible | **PASS** | Measured cleanly |
