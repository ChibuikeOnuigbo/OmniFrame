# Scene recreations — output notes

Every recreation below is LIVE in OmniFrame as a Scene-pillar transition preset
(catalogue: `src/lib/pillarPresets.ts`, renderer: `src/lib/pillarRenderers.ts`
`scene` family, shared constant look `SCENE_LOOK` = one easeInOutCubic fade curve +
one grain pass + one vignette for the whole family). Headless QA:
`node qa/scene-recreation-unit.mjs` (14 styles × 7 progress samples).
Apply from the Transitions panel → **Scene** pillar, or the agent surface
`window.__omniframe_transitions.apply('<preset id>')`.

Durations honour the 0.1–5 s law; base seconds listed per preset.

---

## 1. scene_comp_light — "Scene: Comp-Light Relight" (1.6 s) — source M2_vjAseOns
Grammar: dimmed roto-matte proof (feathered silhouette ring, dashed) → travelling
white light orb with falloff ring on an eased arc (accelerate then settle) →
warm-key / cool-ambient relit reveal of the incoming clip.
Params: `{style:"relight"}`. Beats: p<0.5 matte+orb, p≥0.5 relit grade split.

## 2. scene_crt_blotch — "Scene: CRT Emulator Blotch" (1.2 s) — source RktZGRjji5g
Grammar: RGB fringe on the attack only → grey blotch amplitude-map (the mask,
visualised) peaking mid-cut → constant scanline rows.
Params: `{style:"crt"}`.

## 3. scene_magna_split — "Scene: Magna Split Proof" (1.4 s) — source jlDIX3Ky-hs
Grammar: before/after halves on a sweeping GOLD divider (eased), sparkle accent
riding the divider, small "After" label entering at p>0.55.
Params: `{style:"magna"}`.

## 4. scene_line_draw — "Scene: Line Draw-On Split" (1.3 s) — source kZskcvTkAjs
Grammar: green stroke trims on with a travelling sine bend (ease-in-out) → at
p>0.68 the line splits open vertically to reveal the incoming clip.
Params: `{style:"line"}`.

## 5. scene_rim_glow — "Scene: Manga Rim-Glow Pulse" (1.5 s) — source khjRWWTYZcc
Grammar: magenta rim-glow (blurred silhouette, screen-blend) pulses around the
outgoing subject → warm/cool grade crossfade into incoming.
Params: `{style:"rim"}`.

## 6. scene_mosaic_pix — "Scene: Mosaic Pixel Shift" (1.1 s) — source jlDIX3Ky-hs
Grammar: mosaic cells shrink and row-shift (seeded per-row offsets) out of the
outgoing frame into the incoming clip; imageSmoothing off for hard pixels.
Params: `{style:"mosaic"}`.

## 7. scene_roto_poly — "Scene: Roto Polygon Hero" (1.6 s) — source pztANrbFI3w
Grammar: polygon outline draws ON ALONE over black (dash-trim) as the hero proof
frame → sits over the footage → fades into a cool-graded result hold.
Params: `{style:"roto"}`. Field-only beat at p<0.4 (QA-verified).

## 8. scene_tv_mask — "Scene: Rounded TV Mask" (1.4 s) — source AsHnacGDo6E
Grammar: static burst opens (field-only beat p<0.12, QA-verified) → content lives
inside a rounded TV with scanlines + bottom reflection (the constant frame).
Params: `{style:"tv"}`.

## 9. scene_slit_halftone — "Scene: Slit-Scan Halftone" (1.5 s) — source Z8EAr0p6X14
Grammar: red-tinted frame (sepia+hue-rotate+saturate) → red slit arch with arched
top expands from centre → halftone dot field ramps in as the outro bed.
Params: `{style:"slit"}`.

## 10. scene_fisheye_sting — "Scene: Fisheye Circle Sting" (1.0 s) — source WC1tT1B5o_w
Grammar: glitch-warp bands (self-drawImage row jumps) on the attack → fisheye
circle lens bulge (1.45× magnified incoming inside a clipped circle) + white ring
+ centre typo sting.
Params: `{style:"fisheye"}`.

## 11. scene_spotlight_typo — "Scene: Spotlight Typo Stage" (1.6 s) — source BP4xGE9iUtU
Grammar: grey field + spotlight ellipse stage → scattered inverted 3D typo
fragments with drop shadows settle on staggered eases → incoming multiplies in late.
Params: `{style:"spotlight"}`.

## 12. scene_neon_arc — "Scene: Neon Arc CTA Sting" (1.5 s) — source jZiwWHV7M54
Grammar: two red neon crescent arcs breathe on the shared fade (shadowBlur glow)
while stacked CTA typos enter in the arc mouth on staggered eases.
Params: `{style:"arc"}`.

## 13. scene_logo_cloud — "Scene: Logo Cloud Over Art" (1.8 s) — source YOCiH8zHGic
Grammar: sepia classical-art field → app-name typos float in placed around the
frame (staggered, shadowed) → hero app name enters late with a blue glow.
Params: `{style:"cloud"}`.

## 14. scene_grade_compare — "Scene: Grade Compare Rhythm" (1.6 s) — source GP-dx6ruQQA / -SZcpYq49v8
Grammar: one comp cut through four graded states (plain / desat / crush / warm)
on quarter beats with a state chip label; curve-graph proof inset (purple-framed
bezier) on the desat state.
Params: `{style:"compare"}`.

## 15. scene_xslash_graph — "Scene: X-Slash Speed Graph" (1.2 s) — source chIJCGNoGls
Grammar: red X-slash strokes draw on (eased) with their DIAGONAL SPEED-GRAPH
INSET bottom-right (the curve that drives the slash) + radial ray burst at the
impact beat (p 0.5–0.8).
Params: `{style:"xslash"}`.

## 16. scene_thumb_wall — "Scene: 3D Thumbnail Wall" (1.6 s) — source LqfUhkr2vcc
Grammar: perspective grid of thumbnail cards flies in (scale/offset on the shared
fade); incoming clip lands as the HERO thumb (gold frame), others carry a dimmed
outgoing; green grid strokes + yellow typo constant.
Params: `{style:"wall"}`.

## 17. scene_cutout_checker — "Scene: Cut-Out Checker Proof" (1.4 s) — source YHJUoaPcyqg
Grammar: transparency-CHECKER proof field with the cut-out subject + red
spiral-eye accent (p≤0.55), then the neutral-grey result hold.
Params: `{style:"cutout"}`.

## 18. scene_material_spheres — "Scene: Material Sphere Row" (1.7 s) — source eB10bFHlz7Y / 2AuOLEmEAkU
Grammar: warm bokeh bed (shared replaceBg renderer) + wireframe camera arc with a
travelling camera box + material sphere proof row (8 shaded spheres) along the
bottom; incoming fades up over the bed.
Params: `{style:"spheres"}`.

---

## Companion layers (clip effects, not transitions)
Particles / overlays / background beds live in `src/lib/particleFx.ts` and are
placed per-clip from Effects-panel tiles or the right-panel AE Tool Rack:
- particleFx: feathers · embers · dust · bokeh · sparkles · snow · rain · petals
  (+ particleDensity, particleTint)
- overlayFx: scanlines · halftone · spotlight · vignette · lightleak · frameglow
  (+ overlayStrength)
- replaceBg (drawn UNDER keyed/cut-out footage): synthwave · aurora · grid ·
  bokeh · sunset · studio
QA: `node qa/particle-fx-unit.mjs`.
## 19 — scene_quote_band (`quote`)
Source: chat-history links MX3yw9gT0DI / VA_p4aqYaIc / v2g0zap6LQc / Uew3Znl3Fl8 (techniques 49/51/54).
Grammar: black bed → mono from-clip fades under → white serif quote band slides from top
(reveal-clip wipes the quote line left→right) with ONE red accent word → p>0.8 flash-frame
sting hands off to the to-clip + micro typo bottom-centre. Params: none (constant look).
Beats: band slide 0–0.3 · quote reveal 0.18–0.48 · sting 0.8–1.0.
QA: `node qa/scene-recreation-unit.mjs` (style `quote`, 7 samples).

## 20 — scene_mono_typo (`mono`)
Source: chat-history links uFnoKD-4cpM / 6Stj_5zLyiM + whip of ixEoA7z5jmQ / 0rNqPArnpB0 (techniques 50/52).
Grammar: grayscale+contrast-crushed from-clip bed, black crush overlay easing out →
letter-spaced micro-caps typo fades in centred → p 0.45–0.62 directional 4-ghost smear
(the cut itself) → mono to-clip hold. Params: none (constant look).
Beats: typo 0.2–0.45 · whip 0.45–0.62 · hold 0.62–1.
QA: style `mono`, 7 samples.

## 21 — scene_drift_trail (`drift`)
Source: user short K2mSI59wPvg (technique 85).
Grammar: gradient sky bed (blue → pale horizon) + single paper-plane hero drifting
left→right on the shared fade curve with a thin white motion trail; incoming clip
crossfades up from p 0.7. Params: none (constant look). Beats: drift 0–1 · handoff 0.7–1.
QA: `node qa/scene-recreation-unit.mjs` (style `drift`, 7 samples) — 21 styles PASS.

## 22 — scene_flare_sting (`flare`)
Source: Hancybox short V9ApHueQbN0 (technique 99).
Grammar: black bed, outgoing clip dimmed under a chromatic anamorphic streak
(orange/blue fringes + white core dot + radial glow) swelling on the shared fade
curve; incoming clip rises from p 0.6. Params: none (constant look).
Beats: flare swell 0–0.6 · handoff 0.6–1. QA: style `flare`, 7 samples — 22 styles PASS.
