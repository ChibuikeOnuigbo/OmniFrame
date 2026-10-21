# effect.md — SAVED, NOT IMPLEMENTED

> **Status: idea bank only.** Nothing in this file is built, promised, or
> scheduled. It exists so that when you walk through effects verbally
> ("this one is too strong, this knob is wrong"), every candidate already has
> a home, a parameter vocabulary and a research source. Transitions live in
> `src/lib/transitionPresets.ts` + `src/lib/pillarPresets.ts`; **effects are a
> separate system and stay untouched this wave.**

Research backing (fetched, titles/pages read — not watched):
glitchology.com (datamosh, Premiere/AE glitch recipes, starter guide),
mondniles datamosh modes, imageonline glitch ingredient sliders,
Storyblocks lens-flare types, ineedfx light-leak families, CapCut transition
category pages, Alight Motion camera-object guide, Demotion AE transition
cheat sheet.

---

## 0. Glitch fix notes (the transition-side fix that DID ship this wave)

The old glitch transition was "too small" — hairline slices, ±46 px shift.
Reworked (shipped, transition side only):

- slice height now `(0.035 + rnd*0.16) * H * (0.6 + I)` — bands, not hairlines
- horizontal displacement up to `0.38 * W * I` (was ~46 px flat)
- RGB split peak `I * 44 px` on rgb styles (was ~14 px)
- added macroblock corruption, pixel-sort streaks, signal tears with white
  gap lines, static patches, scanline veil, posterize-stutter
- intensity ladder per style: mild 0.35 / medium 0.55 / heavy 0.75 /
  extreme 0.92 / tv 0.65 (scan+static boosted)
- 50 named glitch variants: 10 styles (slice, rgb, block, sort, vhs, mosh,
  static, tear, shake, poster) x 5 intensities

If a variant still reads wrong when you vet them, the knobs to move are in
`renderGlitch()` in `src/lib/pillarRenderers.ts`: `slices`, slice `sh`,
`dx` amplitude, `rgb` peak, block count/size, static density, scan alpha.

---

## 1. Glitch pillar — effect candidates (persistent / on-beat, not transitions)

| # | Effect idea | Knobs (research vocabulary) | Source |
|---|-------------|-----------------------------|--------|
| 1 | RGB split ambient | amount 0-1 (5% width at 1), angle -180..180, speed 0-30, seed | FCP 1V2T Glitch plugin |
| 2 | Datamosh melt loop | I-frame drop chaos 0.2-0.7, freeze duration | glitchology/datamoshing |
| 3 | P-frame bloom burst | duplicated motion frames 5-10, decay | glitchology |
| 4 | Pixel sort sweep | threshold ~0.55, streak >0.5, H/V direction | mondniles |
| 5 | Block corruption loop | displacement, block size (small=VHS, big=Y2K) | mondniles |
| 6 | VHS tracking overlay | wobble, tracking band speed, colour bleed | abrush styles |
| 7 | Scanline veil | opacity ~30%, line pitch 3-4 px | Kyanite method 4 |
| 8 | Static burst one-shot | density, patch size, duration frames | imageonline static |
| 9 | Shake hit (beat) | amplitude, decay, direction bias | glitchest recipe |
| 10 | Posterize stutter | posterize levels 3-6, step fps 8-12 | glitchology AE |
| 11 | Hex-echo cascade | buffer-overflow repeats, offset decay | indiegtm prompt list |
| 12 | Dither pattern burn | ordered-dither matrix, threshold ramp | indiegtm |
| 13 | Chromatic pulse on beat | fringe px keyed to beat grid | CapCut glitch cat |
| 14 | Datamosh recipe preset | Strength 52, Glitch Rate 42, Width 48, Block 42, Chaos 42, Trail 28, H-Wave 14, V-Wave 10, V-Shift 30, V-Shake 18, RGB 54, Hue 26, Noise 10, Scan 15, Flicker 12 | glitchest exact settings |

## 2. Blur pillar — effect candidates

| # | Effect idea | Knobs | Source |
|---|-------------|-------|--------|
| 1 | Directional blur hit | angle, px 12-20 (whip), ease | Alight whip recipe |
| 2 | Zoom-blur punch | scale 100->112%, 12-16 frames, motion blur | Alight zoom push |
| 3 | Radial blur swirl | centre, degrees, quality | CapCut blur cat |
| 4 | Tilt-shift miniature | band height, position, strength | CapCut |
| 5 | Dreamy haze ambient | veiling glare alpha, saturation drop | Storyblocks veiling |
| 6 | Speed-ramp blur | velocity curve + blur keyed to speed | CapCut velocity |
| 7 | Focus rack | near/far swap, f-stop curve | filmmaking focus pull |
| 8 | Soft-glow bloom | threshold, radius, mix | light family overlap |

## 3. Dissolve pillar — effect candidates

| # | Effect idea | Knobs | Source |
|---|-------------|-------|--------|
| 1 | Film grain overlay | grain size, intensity, gamma weight | Premiere film dissolve |
| 2 | Dither dissolve mask | cell size, threshold noise seed | dither art |
| 3 | Luma-gradient reveal | gradient angle, softness | AE linear wipe family |
| 4 | Additive bloom mix | blend additive, exposure | Premiere additive |
| 5 | Morph-cut smoothing | flow vectors, smoothness (HONEST LIMIT: needs optical flow — not available) | Premiere Morph Cut |
| 6 | Dip-to-colour card | colour, hold frames | Premiere dip family |

## 4. Light pillar — effect candidates

| # | Effect idea | Knobs | Source |
|---|-------------|-------|--------|
| 1 | Light-leak loop | hue family, edge side, 6-16 frame envelope | ineedfx / domer |
| 2 | Lens-flare overlay | type: starburst / veiling / ghosting / anamorphic | Storyblocks 4 types |
| 3 | Flash-on-beat | blowout curve, peak frames 2-4 | melies light-flash |
| 4 | Film burn edge | corner origin, warmth, spread | ineedfx film burn |
| 5 | Bokeh ambience | disc count, radius range, drift | ineedfx bokeh |
| 6 | Exposure pop | EV curve, recovery ease | Demotion exposure pop |
| 7 | Sun-streak sweep | streak angle, speed, blue bias | anamorphic genre note |

## 5. Flicker pillar — effect candidates

| # | Effect idea | Knobs | Source |
|---|-------------|-------|--------|
| 1 | Film flicker loop | hz 4-18, depth 0.2-0.85, seed | ineedfx flicker |
| 2 | Strobe on beat | colour black/white, duty, hz | CapCut flash cat |
| 3 | Projector gate | dust specks, vignette pulse, weave | gate flicker |
| 4 | Frame-skip stutter | hold frames, drop pattern | videomaker flicker |
| 5 | Candle ambience | warm tint, low-freq noise | candle flicker |
| 6 | Burn-frame flash | overexpose frames, warmth 38deg hue | film burn family |

## 6. TV pillar — effect candidates

| # | Effect idea | Knobs | Source |
|---|-------------|-------|--------|
| 1 | CRT screen overlay (persistent) | curvature, scanlines, phosphor tint, bezel | CapCut retro tv interface |
| 2 | Static channel overlay | snow density, OSD channel text, hold | CapCut tv templates |
| 3 | VHS tracking loop | band speed, noise, colour bleed | CapCut vhs templates |
| 4 | Vertical-roll loop | roll px/s, sync line | CRT vertical hold |
| 5 | Power-on/off one-shot | collapse curve, line brightness | CRT physics |
| 6 | Screen-recording HUD | rec dot, timecode, battery | camera family overlap |

## 7. Overlay / scene pillar — effect candidates

| # | Effect idea | Knobs | Source |
|---|-------------|-------|--------|
| 1 | Phone-frame persistent overlay | device model bezel, notch, home bar | CapCut slowmo app switch |
| 2 | TV green-screen scene swap | screen quad corners, spill suppression | CapCut projector green screen |
| 3 | Viewfinder HUD | grid thirds, rec dot, exposure scale | Alight camera objects |
| 4 | Cinema bars + curtains | bar height, curtain colour | cinema scene |
| 5 | App-switch mock | app card stack, swipe curve | CapCut app switch |
| 6 | Earth-zoom pull | scale keyframes 1->0.001, easing | CapCut earth zoom |
| 7 | Hand/snap mask reveal | mask track, feather | CapCut hand transition |

## 8. Cross-pillar / other banked ideas (from the same research)

- Velocity ramp (speed curve presets: 0.5x->3x->0.5x) — CapCut velocity
- Beat-sync shake grid — CapCut beat sync
- Smoke / particle wipe overlays — CapCut overlay cat
- Mirror / kaleidoscope / ripple / bulge / twirl distortions — AE distortion family
- Paper-tear DIY wipe — uppbeat most-downloaded
- Match-cut helper (onion-skin alignment) — editorial
- Mask-reveal with feather + inverted complement (mask tool already ships)
- Slow-shutter ghosting overlay — CapCut 4 overlay transitions video

---

## 9. Honest limits recorded here

- **No APK dissection.** This sandbox cannot download editor APKs (network
  is limited to package registries + fetched docs), and decompiling
  proprietary apps would not be trustworthy research anyway. Overlay/scene
  behaviour above is modelled from documented template pages (CapCut
  explore/template listings, Alight Motion camera-object docs) — not from
  reverse-engineered code.
- **Morph Cut / optical-flow effects are out of reach** (no flow solver);
  banked with the limit flagged, not faked.
- Nothing in this file has been watched frame-by-frame; channel names and
  technique vocabularies come from the fetched pages listed at the top and
  from your `subscriptions.csv` channel list used in the pillar index.
