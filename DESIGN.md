# OmniFrame DESIGN.md — the committed direction

Per the anti-AI-slop research (new_doc_toll_research/DESIGN-STUDY-ai-slop-custom-ui.md):
a design system only survives if it is written down and obeyed. This is that file.
Direction: **dense, technical, flame-on-ink** — a pro video tool, not a landing page.

## Identity
- Brand = **flame orange** `#ff6b35` (ramp: 200 `#ffd0bd`, 300 `#ffb08e`, 400 `#ff8c61`, 600 `#e85520`).
  Chosen because the product is called OmniFrame (flame), and because vibecode violet
  `#6d5efc` is the single most-flagged AI-slop color. Identity color is never a gradient.
- Surfaces: ink ramp (`#08090d` … `#2e374a`). Dark, flat, high-contrast. No glassmorphism:
  `backdrop-blur-*` is disabled in the default (omniframe) UI style via index.css.

## Color semantics (Notion rule: a color must MEAN something)
| Color | Meaning |
|---|---|
| flame (`brand`) | identity, primary action, focus ring, active tool |
| cyan `#22d3ee` (`accent`) | selection fills, timeline interaction (user-mandated) |
| emerald | audio clips / OK |
| amber | text clips / warn |
| purple/indigo | image clips, compound clips, adjustment clips, mask-info banners (category colors — kept on purpose) |
| red | destructive / bad |

## Corners (user rule: ~19% of UI keeps radius, the rest is sharp)
- 0 radius: `rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl` → all forced to 0 in the
  default style (index.css Board R block). ~81% of radius tokens.
- Kept ~19%, **varied on purpose** (randomizer, not one uniform value):
  - `rounded-md` controls (buttons/inputs) → **3px** (removed entirely in TopBar / EffectsPanel / Timeline)
  - `rounded-sm` chips → **2px**
  - `rounded-full` pills/circles → **999px**
  - scrollbar thumb → **2px**
- Theme skins still work: capcut/krita/premiere/daylight `data-ui-style` overrides redefine
  these utilities per theme; the Board R rules only bind `omniframe` (and the pre-studio
  attribute-less html).

## Typography
- UI stack: `Avenir Next → Segoe UI Variable Display → Trebuchet MS → DejaVu Sans → sans-serif`.
  Inter/Roboto/system-default are banned tells; this stack keeps a humanist face with
  personality on every OS, with no webfont download (sandbox/egress-safe).
- Mono stack (timecodes, numbers, badges): `ui-monospace → SFMono-Regular → Menlo → monospace`.
- Content text presets (canvas artwork in videos, src/lib/textPresets.ts) may still name
  other fonts — those are video artwork choices, not app chrome.

## Spacing
- Tailwind 4px scale is the spacing system; deliberate bumps shipped with Board R:
  tooltip `px-2.5 py-1.5`, drawing toolbar `py-1.5`, landing cards `p-3.5`.
- Density stays technical: panels `p-2`–`p-3`, rows `h-7`–`h-9`, no marketing whitespace.

## Icons
- Icons only when they clarify an action (lucide, 13–16px). No decorative icon filler,
  no repeated identical icon across a menu (the 7× Sparkles transition menu was purged),
  no sparkle/wand/emoji decoration.

## Anti-slop bans (never re-introduce)
purple→blue gradients · Inter/Roboto as UI font · uniform radius on everything ·
backdrop-blur glass · neon glow shadows · gradient hero cards · decorative icons ·
native `title=` where a custom Tooltip wraps the same element.
