# DESIGN STUDY — AI-slop tells, custom UI & div design (Board R, 2026-10-26)

## 1. The requested scan — attempt log (HONEST)
User link: https://www.reddit.com/r/foss/s/UvqWU4c73m ("labels all design that is AI-like
and horrible, turn off/remove any of it in the app").
- fetch_page direct → **HTTP 403**; via r.jina.ai → **403 "You've been blocked by network
  security"** (Reddit bot-wall; short-link cannot be resolved in this sandbox).
- Substitute: live web_search surfaced the SAME Reddit-mined corpus the post belongs to:
  - r/webdesign "Preventing the AI slop look" (purple gradients, rounded corners, fade-in-on-scroll, eyebrows, lozenges, beige/purple palettes, outlines on all boxes)
  - r/UI_Design "How can you tell a design is AI?" (purple-to-blue gradient, even spacing with no emphasis, glassmorphism cards, "first draft = final")
  - r/ClaudeAI "Dead giveaways for AI slop websites" (bento grids, rounded corners on everything, gradient text)
  - JCarterJohnson/vibecoded-design-tells (GitHub) — 3.2M Reddit posts across 47 subreddits mined & ranked
  - dev.to "The Purple Gradient Problem" (fetched in full — checklist + fixes below)
  - uxskill.laithjunaidy.com "What is AI slop" (#7c3aed→#6366f1 hero gradient; uniform radius = hierarchy failure)
  - abhijayvuyyuru.substack.com anti-slop prompt guide ("icons only when they clarify an action"; no sparkle icons/emoji; no Inter/Geist/Space Grotesk)

## 2. The consolidated tell checklist (from sources above)
1 purple→blue/violet gradients · 2 Inter/Roboto/system-default font · 3 same corner radius
on everything · 4 glassmorphism/backdrop-blur · 5 neon glow shadows · 6 sparkle/decorative
icons & emoji · 7 centered hero + 3 identical cards · 8 gradient text · 9 bounce easing on
every hover · 10 untouched Tailwind/shadcn defaults (indigo-500) · 11 even spacing with no
intentional emphasis.

## 3. OmniFrame audit → classification (removed / kept-because-semantic)
REMOVED (slop found in app):
- Brand itself was `#6d5efc` vibecode violet → **flame `#ff6b35`** identity (tailwind.config.js + index.css + desktopPack.ts canvas fills). Tell #1/#10.
- App.tsx transition wave: 3-layer violet gradient + neon glow shadow → flat ink→brand wipe, no glow. Tell #1/#5.
- Landing.tsx hero card: rounded-xl + violet gradient + backdrop-blur-xl + big soft shadow → sharp solid ink card. Tell #1/#3/#4.
- VoiceIsolationPanel header card: violet gradient → flat ink; chip → brand. Tell #1.
- Timeline clip-selection neon glows (5 × shadow-[0_0_Npx_rgba]) → border+ring only. Tell #5.
- Inter font → Avenir Next/Segoe UI Variable/Trebuchet/DejaVu stack (no webfont = egress-safe). Tell #2.
- Uniform radius: CSS override block (index.css Board R) forces rounded/lg/xl/2xl → 0 in default style (~81% of 1047 radius tokens); kept ~19% VARIES: md→3px (removed in TopBar/EffectsPanel/Timeline), sm→2px, full→999px, scrollbar→2px. Tell #3.
- backdrop-blur disabled app-wide in default style via CSS override. Tell #4.
- 7× identical Sparkles in transition context menu → icons removed (labels suffice); 'Add Transition' → Blend; 'AI Background Removal' → ImageOff; ClipFilmstrip decorative Layers filler + colored placeholder bars → removed/neutral ink. Tell #6.
- Tooltips fixed: DrawingToolbar 6 native title= → custom draggable Tooltip; 3 double-tooltips deduped (Preview, SelectionSubToolBar); 4 redundant title={command.label} removed from context-menu buttons/spans; bubble: solid bg (no /95 glass, no blur), sharp 3px, roomier px-2.5 py-1.5.
- Spacing: tooltip + drawing toolbar + landing card padding bumped; density kept technical. Tell #11.
KEPT (semantic, per Notion rule "color must mean something"):
- Timeline track-kind category colors: IMG purple, CMP indigo, adjustment violet ring, text amber, audio emerald (rings/borders, glows stripped).
- DrawingPanel/RightPanel indigo mask-info & compound-info banners (Layers icon there MEANS compound).
- 'Cyber Violet' cursor theme (named user-selectable feature, not chrome).
- textPresets.ts 'Inter' canvas text preset (video artwork font choice, not UI chrome).

## 4. Custom UI / div design study (user: "study abt design abt sketching and custom ui and div etc design")
- div-level rules adopted from the fetched dev.to guide: DESIGN.md token file at repo root
  (fix #1 — "own your tokens so the direction propagates"); ONE committed aesthetic
  direction "dense/technical/flame-on-ink" (fix #2); semantic color table (fix #3).
- Sketching/wireframe study: hand-drawn plan references saved —
  imgs/wireframe-sketch-miro.webp (miro.com/templates/app-wireframe, hand-drawn sketching
  system wireframes) + imgs/wireframe-sketch-balsamiq.jpg (balsamiq.com pen-and-paper
  first-wireframe guide). Both on-topic for "design more custom ui like the plan I drew".
- "The plan I drew" = user's Krita window screenshots in Drive: `name contains 'krita-win'`
  → **still 0 files** this turn (re-checked; compressed-copy plan from Board P stands).
- Custom-cursor + UI-style switcher (capcut/krita/premiere/daylight skins) already ship as
  per-theme CSS overrides — Board R rules were added in the same pattern so all themes keep
  working (verified: tsc green, vite build green, QA PASS 63 steps/54 tools).

## 5. Verification (no fake captures — DOM screenshot impossible in sandbox)
- `tsc --noEmit` clean; `npm run build` clean; `node qa/universal-tools-unit.mjs` PASS.
- Radius census after: rounded 515/lg 205/xl 48/2xl 3 → CSS-forced 0; md 97 (was 170)
  + sm 18 + full 81 + l/r 2 = 198/1047 ≈ **18.9% kept** ≈ user's 19%.
- Remaining violet/purple/indigo grep = only the semantic list above (+ day-light theme
  overrides for text-brand-200/300 added so flame text stays readable on light skin).

## 6. Continue pass (same request re-sent 2026-10-27)
- reddit short-link retried via old.reddit through proxy → still 403 "network policy"
  (block code 01a17a8b-aa83-7fea-a819-447bdb7e3b53 logged). Substitute corpus stands.
- NEW tells purged this pass:
  - LeftDock temporary sub-mode rail rendered a hardcoded decorative Sparkles + animate-pulse
    INSTEAD of each sub-mode's real icon (names were already stored!) → name→component
    resolver (BoxSelect/History/Layers/Move/PaintBucket/Paintbrush/Shapes/Stamp/Type/
    LibraryBig); TextPanel callers 'Sparkles'/'Wand2' renamed to 'Type'/'LibraryBig'
    (sparkle-family names purged at the source); smart-patch menu icon Sparkles → Replace.
  - Heavy diffuse shadows (26× shadow-2xl, 4× shadow-xl) tempered in the default style to
    tight functional elevation (0 6px 18px / 0 4px 12px) via the same omniframe CSS pattern.
  - Functional pulses kept on purpose: ModelLoadOverlay phase pulse + CustomCursor status
    dot (they MEAN loading/live — semantic, per Notion rule).
- Design study refs added: imgs/lumina-studio-flat-ui-ref.jpg (Vecteezy "Lumina Studio"
  editor mockup) — NEGATIVE ref for uniform rounded cards + light-theme glass look, POSITIVE
  ref for clear preview / color-grading / timeline-strip sectioning. Off-topic sibling hit
  (vecteezy character-illustration, https://www.vecteezy.com/free-vector/video-editing)
  discarded, URL kept as text ref.
- Jake In Motion scan yields design-theory material: "Animation Principles Work Everywhere
  (Even Your Website)" — easing/spacing principles now inform the motion language of the
  flame UI (fast, purposeful transitions; no bounce easing anywhere: census = 0 decorative).
