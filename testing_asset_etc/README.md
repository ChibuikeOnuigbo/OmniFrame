# Text preset test packs — for vetting

Every preset from the Text Preset Library, rendered with its demo text on a
dark stage. Three frames each: early (effect/scramble phase), mid (settling),
settled. Open the folder, look at the frames, and mark each row
**Perfect** or **Horrible** (or tell me in chat: "karaoke-sweep is perfect,
matrix is horrible"). Presets you approve become the app's vetted defaults;
horrible ones get rebuilt or cut.

## How the character-count problem is solved (your question)

Presets are **procedures, not recordings**: stagger/settle/wave all key off
each letter's normalized position `u = i/(n-1)`, so a 2-letter word and a
16-letter word run the same shape of animation. Nothing forces the same
character count as the tutorial — but every preset knows its sweet spot, the
UI says so live ("Best with 4–10 characters — yours has 2; it still maps"),
and the table below lists the ideal range per preset. Demo texts below sit
inside the sweet spot so you judge the look at its best.

## Packs

| Preset | Category | Ideal chars | Clips | Test output | Perfect? | Horrible? |
|---|---|---|---|---|---|---|
| Retro Glitch (Traditional) | Retro / Glitch | 4–10 | 60 | [retro-traditional/](retro-traditional/) · [spec](retro-traditional/spec.json) · [f1](retro-traditional/frame-1-early.png) [f2](retro-traditional/frame-2-mid.png) [f3](retro-traditional/frame-3-settled.png) | | |
| Retro Scramble (Effects) | Retro / Glitch | 3–12 | 5 | [retro-effects/](retro-effects/) · [spec](retro-effects/spec.json) · [f1](retro-effects/frame-1-early.png) [f2](retro-effects/frame-2-mid.png) [f3](retro-effects/frame-3-settled.png) | | |
| RGB Split Glitch | Retro / Glitch | 3–12 | 5 | [rgb-split/](rgb-split/) · [spec](rgb-split/spec.json) · [f1](rgb-split/frame-1-early.png) [f2](rgb-split/frame-2-mid.png) [f3](rgb-split/frame-3-settled.png) | | |
| Matrix Scramble | Retro / Glitch | 4–14 | 1 | [matrix-scramble/](matrix-scramble/) · [spec](matrix-scramble/spec.json) · [f1](matrix-scramble/frame-1-early.png) [f2](matrix-scramble/frame-2-mid.png) [f3](matrix-scramble/frame-3-settled.png) | | |
| Neon Sign Flicker | Glow / Neon | 3–10 | 1 | [neon-flicker/](neon-flicker/) · [spec](neon-flicker/spec.json) · [f1](neon-flicker/frame-1-early.png) [f2](neon-flicker/frame-2-mid.png) [f3](neon-flicker/frame-3-settled.png) | | |
| Glow Pulse Title | Glow / Neon | 3–14 | 2 | [glow-pulse/](glow-pulse/) · [spec](glow-pulse/spec.json) · [f1](glow-pulse/frame-1-early.png) [f2](glow-pulse/frame-2-mid.png) [f3](glow-pulse/frame-3-settled.png) | | |
| Bounce Letters | Motion | 3–12 | 6 | [bounce-letters/](bounce-letters/) · [spec](bounce-letters/spec.json) · [f1](bounce-letters/frame-1-early.png) [f2](bounce-letters/frame-2-mid.png) [f3](bounce-letters/frame-3-settled.png) | | |
| Wave Letters | Motion | 4–14 | 5 | [wave-letters/](wave-letters/) · [spec](wave-letters/spec.json) · [f1](wave-letters/frame-1-early.png) [f2](wave-letters/frame-2-mid.png) [f3](wave-letters/frame-3-settled.png) | | |
| Spin Drop Letters | Motion | 3–10 | 4 | [spin-drop/](spin-drop/) · [spec](spin-drop/spec.json) · [f1](spin-drop/frame-1-early.png) [f2](spin-drop/frame-2-mid.png) [f3](spin-drop/frame-3-settled.png) | | |
| Cascade Fall | Motion | 3–12 | 4 | [cascade-fall/](cascade-fall/) · [spec](cascade-fall/spec.json) · [f1](cascade-fall/frame-1-early.png) [f2](cascade-fall/frame-2-mid.png) [f3](cascade-fall/frame-3-settled.png) | | |
| Slam Zoom | Motion | 2–8 | 1 | [slam-zoom/](slam-zoom/) · [spec](slam-zoom/spec.json) · [f1](slam-zoom/frame-1-early.png) [f2](slam-zoom/frame-2-mid.png) [f3](slam-zoom/frame-3-settled.png) | | |
| Karaoke Sweep | Style | 4–16 | 10 | [karaoke-sweep/](karaoke-sweep/) · [spec](karaoke-sweep/spec.json) · [f1](karaoke-sweep/frame-1-early.png) [f2](karaoke-sweep/frame-2-mid.png) [f3](karaoke-sweep/frame-3-settled.png) | | |
| Typewriter + Cursor | Style | 4–20 | 11 | [typewriter/](typewriter/) · [spec](typewriter/spec.json) · [f1](typewriter/frame-1-early.png) [f2](typewriter/frame-2-mid.png) [f3](typewriter/frame-3-settled.png) | | |
| Rainbow Letters | Style | 3–14 | 7 | [rainbow-letters/](rainbow-letters/) · [spec](rainbow-letters/spec.json) · [f1](rainbow-letters/frame-1-early.png) [f2](rainbow-letters/frame-2-mid.png) [f3](rainbow-letters/frame-3-settled.png) | | |
| Outline Echo | Style | 3–10 | 4 | [outline-echo/](outline-echo/) · [spec](outline-echo/spec.json) · [f1](outline-echo/frame-1-early.png) [f2](outline-echo/frame-2-mid.png) [f3](outline-echo/frame-3-settled.png) | | |
| News Lower Third | Style | 4–24 | 2 | [lower-third/](lower-third/) · [spec](lower-third/spec.json) · [f1](lower-third/frame-1-early.png) [f2](lower-third/frame-2-mid.png) [f3](lower-third/frame-3-settled.png) | | |
| Cinematic Serif Fade | Style | 4–20 | 1 | [cinematic-fade/](cinematic-fade/) · [spec](cinematic-fade/spec.json) · [f1](cinematic-fade/frame-1-early.png) [f2](cinematic-fade/frame-2-mid.png) [f3](cinematic-fade/frame-3-settled.png) | | |
| Marker Highlight | Style | 3–16 | 2 | [highlight-marker/](highlight-marker/) · [spec](highlight-marker/spec.json) · [f1](highlight-marker/frame-1-early.png) [f2](highlight-marker/frame-2-mid.png) [f3](highlight-marker/frame-3-settled.png) | | |
| Pixel Stretch Intro | Retro / Glitch | 3–12 | 3 | [pixel-stretch-in/](pixel-stretch-in/) · [spec](pixel-stretch-in/spec.json) · [f1](pixel-stretch-in/frame-1-early.png) [f2](pixel-stretch-in/frame-2-mid.png) [f3](pixel-stretch-in/frame-3-settled.png) | | |
| Credit Roll Rise | Motion | 4–24 | 1 | [credit-roll/](credit-roll/) · [spec](credit-roll/spec.json) · [f1](credit-roll/frame-1-early.png) [f2](credit-roll/frame-2-mid.png) [f3](credit-roll/frame-3-settled.png) | | |
| Minimal Fade | Style | 2–20 | 1 | [minimal-fade/](minimal-fade/) · [spec](minimal-fade/spec.json) · [f1](minimal-fade/frame-1-early.png) [f2](minimal-fade/frame-2-mid.png) [f3](minimal-fade/frame-3-settled.png) | | |
| Vertical Letter Stack | Style | 3–8 | 5 | [vertical-stack/](vertical-stack/) · [spec](vertical-stack/spec.json) · [f1](vertical-stack/frame-1-early.png) [f2](vertical-stack/frame-2-mid.png) [f3](vertical-stack/frame-3-settled.png) | | |
| Echo Trail | Motion | 2–10 | 4 | [echo-trail/](echo-trail/) · [spec](echo-trail/spec.json) · [f1](echo-trail/frame-1-early.png) [f2](echo-trail/frame-2-mid.png) [f3](echo-trail/frame-3-settled.png) | | |

## Recreate any pack by hand

OmniFrame → Text panel → **Text Preset Library** → type the demo text →
click the preset. Change the text to anything and it remaps. Change the
seed to re-roll the randomized looks; change the accent colour to retheme.
