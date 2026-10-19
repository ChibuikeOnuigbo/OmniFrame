# Watermark + Retro Text studies

Two tutorials, transcripts read in full; **no frames viewed or claimed
watched**, no preset files downloaded (the linked Glow preset Drive file
was not fetched — IDs must be verbatim and the look is reproducible from
first principles).

## 1. "How to Make a Watermark From Beginner to Advanced On CapCut"
NDK Edit, `r6GsP90vBLk` (10:50). Six levels: (1) text + glow + fade;
(2) BG-removed character + text on green, exported, chroma-keyed,
keyframed drift with graph easing, fade; (3) custom fonts, pixel
stretch ×4, chromatic + pixel artifacts; (4) body-part-separated
character, hair distortion + cloth effects, keyframes/graphs, sound FX
+ voice tag, key, fades; (5) AI-generated character logo, part
animation, text animation, signature sound; (6) freeform combo with
splice/lighten blend modes.

**Built as Watermark Studio** (Text panel): levels 1–6 as one-click
builders producing ordinary editable clips — never baked renders:
glow text with opacity fade keys; character + drift with bezier graph
keys; pixel-stretch/chromatic intro slices (new effects, below);
wave-warp character sway + voice-tag audio slot; logo pop with a
`back` ease + Text Randomizer reveal; lighten-blended combo. Watermarks
save as presets (localStorage) and **stamp** across any project at a
chosen corner. The tutorials' export→chroma-key round-trip is
unnecessary in OmniFrame (compounds are transparent natively), but a
real **Chroma Key** effect was added anyway for actual green-screen
footage. Body-part separation and image generation stay user/BYOK
steps — not automated, not claimed.

New render support: `pixelStretch`, `chromatic`, `waveWarp`,
`chromaKey` (+`chromaColor`) in `src/lib/pixelGrade.ts`, wired through
adjustment/clip/compound paths; `Clip.blendMode` honoured in the frame
compositor; text glow/stroke/tracking in `drawTextClip`.

## 2. "Master Retro Text Animation in Alight Motion" — Noelle, `UxfwndLF8cY` (16:20)
Base structure (white bar-wipe rectangles with 1-frame offsets, split
text, slight tracking) grouped, then two methods. **Effects method:**
Text Transform + Text Randomizer (seed/evolution). **Traditional:**
duplicate text (red under white), split the top into per-letter
layers, then frame-by-frame 1-frame mutations — move, recolour,
swap glyph, rotate, resize, vanish, stroke-only — settling into the
word; satellite small text around it; glow finish.

**Built as Retro Text Studio** (Text panel, `src/lib/builders.ts`):
Effects method = a text clip with the new seeded **Text Randomizer**
(`textStyle.randomizer`, per-frame RNG, left-to-right settle —
deterministic: same seed + frame = same glyphs, verified) + glow +
tracking + bar wipes. Traditional = per-letter tracks where settled
letter segments are interrupted by exactly-1-frame mutation clips
chosen by the seed (rotate/colour/swap/stroke/vanish all occur and are
asserted in QA). Letters stay separate editable clips so users can
re-time or re-roll individual frames, exactly like the tutorial.

Verified by `qa/retro-watermark-e2e.mjs` (ALL PASS): letter/mutation
construction, 1-frame durations, mutation variety, on-screen settled
vs glitch frames, randomizer determinism, watermark level contents
(fade keys, wave-warp, sway keys), save/stamp placement, and chroma
key pixel math (green→gone, red survives). Evidence:
`evidence/improvements/22-retro-watermark.png`.
