# animation_study.md — Animation Graphs, Spacing Maths & Glow Model

A serious study of how animation is timed and spaced across CapCut, After
Effects, Alight Motion, Blender and Maya, the maths under every graph
type, and how OmniFrame implements each one in the Text Preset Library
(`src/lib/textPresets.ts`, engine `src/lib/animation/CurveEngine.ts`).

Sources consulted for terminology and editor behaviour:
CapCut graph presets and PC curve tools
([Programiz guide](https://programiz-pro-staging.programiz.com/how-to-add-keyframe-graphs-on-capcut-pc-1631552),
[EditLogic keyframe mechanics](https://editlogic.io/capcut-keyframe-mechanics-the-beginners-smooth-motion-guide/),
[CapCut graphs tutorial — Quad/Cubic In families](https://videohighlight.com/v/BxHHyGRdmvk),
[Flow 1 / Flow 2 on CapCut PC](https://www.vidau.ai/capcut-pc-guide-made-easy-on-how-to-make-the-flow-2-graph)),
After Effects value vs speed graphs and Easy Ease
([DJordanMedia guide](https://djordanmedia.com/blogs/news/after-effects-graph-editor-beginners-guide)),
Blender interpolation/easing taxonomy
([Varsity Tutors](https://www.varsitytutors.com/practice/subjects/blender/lessons/use-the-graph-editor-to-adjust-interpolation-and-easing-intro)),
Cavalry's Linear/Bézier/Step definitions
([Cavalry docs](https://cavalry.studio/docs/user-interface/menus/window-menu/scene-window/graph-editor/)),
and tangent-handle practice
([MocapOnline](https://mocaponline.com/blogs/mocap-news/animation-curves-graph-editor-guide)).

---

## 1. What a "graph" is

A graph plots a property value (position, scale, rotation, opacity) on the
Y axis against time on the X axis. Keyframes are points (t₀,V₀) → (t₁,V₁);
the segment between them is evaluated through an interpolation function
f(u), u ∈ [0,1] being normalized segment time:

    value(t) = V₀ + f(u) · (V₁ − V₀),   u = (t − t₀)/(t₁ − t₀)

Velocity is f′(u)·(V₁−V₀)/(t₁−t₀); acceleration is its derivative. Every
graph below is a different f. After Effects shows this twice: the *value
graph* (the curve itself) and the *speed graph* (f′, px/s) — same
information, differentiated. CapCut shows one curve with preset chips;
Blender/Maya expose raw Bézier handles; Alight Motion shows easing presets
per keyframe pair. The maths is identical in all of them.

## 2. Every graph type, with maths

### 2.1 Constant / Stepped (Hold)
f(u) = 0 for u < 1, jumps at u = 1 (Heaviside step). Velocity 0 everywhere,
undefined at the jump. AE: *Hold keyframe*; Blender: *Constant*; Cavalry:
*Step*. Used for visibility switches, stop-motion, typewriter cursors.
**OmniFrame:** `constant` interpolation (evaluateCurve returns V₀).

### 2.2 Linear
f(u) = u. Constant velocity, infinite acceleration at both ends (visible
as mechanical motion). CapCut "Linear/None"; everywhere the fallback.
**OmniFrame:** `linear`.

### 2.3 Bézier (spline)
Cubic Bézier through P₀=(t₀,V₀), P₃=(t₁,V₁) with handle points P₁, P₂:

    B(s) = (1−s)³P₀ + 3(1−s)²s·P₁ + 3(1−s)s²P₂ + s³P₃

Time and value share the parameter s, so the evaluator first solves
Bx(s) = t (root finding / Newton iteration), then returns By(s). Handle
*horizontal* length changes speed, *vertical* changes overshoot — this is
AE's Easy Ease (F9 sets handles to ≈33.33% influence), Blender's default
*Bézier*, Maya's *Spline*. **OmniFrame:** `bezier` with dt/dv tangent
handles (default ⅓-segment auto handles), plus graph-editor handle editing.

### 2.4 Power / polynomial eases (Quad, Cubic, Quart, Quintic)
    EaseIn:  f(u) = uⁿ            EaseOut: f(u) = 1 − (1−u)ⁿ
    EaseInOut: f(u) = ½(2u)ⁿ for u<½, else 1 − ½(2−2u)ⁿ
n=2 quad, 3 cubic, 4 quart, 5 quintic — higher n = lazier start, harder
finish. This is exactly CapCut's **Ease In 1/2/3** (and Out 1/2/3)
numbering: the number is the intensity/exponent step, confirmed by
CapCut tutorial taxonomies (Quad In gentler than Cubic In).
**OmniFrame:** `ease-in/ease-out` = quad (n=2), `cubic-in/cubic-out` =
n=3, and **easingIntensity** (0–1.5) blends f toward linear
(`progress = u + (f−u)·intensity`), giving the 1/2/3 strengths on one curve.

### 2.5 Sinusoidal
    EaseInOut: f(u) = (1 − cos(πu))/2
Gentlest S-curve; derivative is a half-sine (pendulum velocity profile).
**OmniFrame:** approximated by `ease-in-out` (2u² form) — equal endpoints
slopes; the study note matters because AE's Easy Ease is closer to sine.

### 2.6 Circular
    EaseOut: f(u) = √(1 − (u−1)²)     EaseIn: 1 − √(1 − u²)
Quarter-circle arcs; velocity blows up at one end (rolling-ball feel).

### 2.7 Exponential ("Flash" in CapCut speed graphs)
    EaseIn: f(u) = 2^(10(u−1))        EaseOut: 1 − 2^(−10u)
Near-zero motion for most of the segment, then an explosive rush — CapCut's
*Flash In/Out* speed curves. **OmniFrame:** reachable via `cubic-in` at
high intensity; a true `expo` preset is a listed engine TODO.

### 2.8 Back (overshoot)
    f(u) = (c₁+1)u³ − c₁u²,  c₁ = 1.70158
Dips below 0 then overshoots past 1 before settling (anticipation). AE
overshoot expression, Blender *Back*. **OmniFrame:** `back` (exact c₁).

### 2.9 Bounce
Piecewise parabolas with restitution: standard 7.5625u² segments with
breakpoints 1/2.75, 2/2.75, 2.5/2.75 and plateaus 0.75/0.9375/0.984375 —
each arc is a gravity fall y = −½g·t² mirrored, peaks shrinking by the
restitution coefficient. CapCut *Bounce 1/2/3* varies bounce count/energy.
**OmniFrame:** `bounce` (canonical Robert Penner constants, as in engine).

### 2.10 Elastic
    f(u) = −2^(10u−10) · sin((10u − 10.75)·2π/3) + 1
Damped harmonic oscillator: sine oscillation × exponentially decaying
envelope 2^(−10u). **OmniFrame:** `elastic` (same closed form).

### 2.11 Noise / shake (procedural)
    value(t) = Σᵢ Aᵢ·sin(ωᵢt + φᵢ)
Harmonic synthesis (or Perlin noise): Wizzy's shake system (magnitude A,
frequency ω, angle) is this with decay A(t) = A₀(1 − t/T). AE wiggle()
is the same idea. **OmniFrame:** the shake presets bake seeded harmonic /
random-walk keys (`src/lib/customEffects.ts` does live perlin shakes).

### 2.12 Extrapolation (past the last key)
Constant (hold), Linear (continue slope), Cycle (wrap period), Ping-pong
(mirror period). Blender/Maya expose these per curve; **OmniFrame**
implements all four in evaluateCurve.

### Velocity comparison
| Graph | v(0) | v(0.5) | v(1) |
|---|---|---|---|
| Linear | k | k | k |
| Ease In (uⁿ) | 0 | moderate | peak |
| Ease Out | peak | moderate | 0 |
| Ease In-Out | 0 | peak | 0 |
| Back | 0 | peak | 0 (after overshoot) |
| Elastic | 0 | oscillates | 0 |

## 3. The same maths, per editor

| Concept | CapCut | After Effects | Alight Motion | Blender/Maya |
|---|---|---|---|---|
| Hold | — | Hold keyframe | — | Constant |
| Straight | Linear/None | Linear keyframe | Linear | Linear |
| Smooth S | Auto Curve / Ease 1-3 | Easy Ease F9 | Ease presets | Bézier/Spline |
| Strong ease | Ease In/Out 3, Flash | Graph handles pulled long | — | Quad→Quintic |
| Overshoot | Bounce graphs (UI) | Overshoot expression | Back/Bounce | Back |
| Physics bounce | Bounce 1/2/3 | Bounce expression | Bounce | Bounce |
| Spring | Elastic presets (mobile) | Elastic expression | Elastic | Elastic |
| Speed ramps | Flow 1 / Flow 2, speed graphs | Speed Graph | Velocity graphs | F-Curve |
| Custom handles | Free Curve (PC) / Custom | Full Bézier handles | per-key easing | Handles + Clamped (Maya) |

## 4. OmniFrame graph setting (per animation)

The preset panel's **Graph** dropdown re-interpolates every keyframe of
the built animation to the chosen family (`constant, linear, ease-in,
cubic-in, ease-out, cubic-out, ease-in-out, back, bounce, elastic,
bezier`) — because our evaluator selects the formula from the keyframe's
`interpolation`, the setting changes the real evaluated motion, not a
label. First opacity keys are spared so fades don't pop. This mirrors
CapCut's "select segment → choose graph chip" workflow.

## 5. Typewriter: 5 cursor formes

The old typewriter drew a floating white band. It is now five presets,
all driven by stepped (`constant`) cursor keys over measured glyph
positions (each char reveals at tᵢ = i·per):

1. **Vertical Bar** `|` — classic terminal caret after the last letter.
2. **Block** `▮` — solid block caret (VT100 style).
3. **Underscore** `_` — horizontal caret under the next position.
4. **Caret** `▸` — sideways caret (prompt style).
5. **Highlight** `█` — accent block *behind* the current glyph
   (reverse-video), drawn first so glyphs sit on top.

Blink: after typing completes, opacity toggles 1 ↔ 0.05 every 0.4 s
(stepped keys), like real terminals (~1.2 Hz).

## 6. Spacing settings with auto caps (the maths)

Glyph widths are **measured** (canvas measureText at the real font), never
guessed — Arial Black's `W` is ≈0.94 em, `i` ≈0.36 em, so fixed advances
caused collisions. A centered line fits the 1920 preview with 4% margins
(usable W = 1766 px) when

    Σᵢ glyphWᵢ + (n−1)·charSpacing + (w−1)·wordSpacing ≤ 1766

The caps solve this directly (other variable at 0):

    charMax = ⌊(1766 − ΣglyphW) / (n−1)⌋      (n = non-space chars)
    wordMax = ⌊(1766 − ΣglyphW) / (w−1)⌋      (w = words)

Both hard-clamped (≤400 / ≤600) so sliders stay sane for tiny words, and a
joint pass shrinks wordSpacing first if both settings together overflow.
The panel shows the live caps for the current text. **Word Pop** lays
words out cumulatively with measured widths + `16 + wordSpacing` gaps —
QA asserts the minimum measured inter-word gap ≥ 8 px at spacing 0 (no
collisions) and that +60 word spacing widens gaps by >30 px.

## 7. Per-animation settings map

| Setting | Applies to | Mechanics |
|---|---|---|
| Character spacing | all | extra px in measured letter layout / whole-word tracking |
| Word spacing | word/letter layouts | space width + Word Pop gaps |
| Duration | all | clip length; scrambles stretch (below) |
| Animation delay | all | shifts every built clip's start |
| Graph | all keyframed | re-interpolates keyframes (§4) |
| Seed | randomized looks | deterministic re-roll |

## 8. Glow / shadow layer model

For any preset with glow or under-layers, the panel exposes:

- **Angle** (0–360°): direction vector (cos θ, sin θ) along which spread
  copies are placed — 90° = glow/shadow falls downward.
- **Glow intensity** (0–2): multiplier on glowBlur of existing layers.
- **Glow spread** (px): total offset distance of the copied glow layer
  along the angle (0 = concentric glow).
- **Glow blur intensity** (0–2): multiplier combined with intensity
  (effective blur = base · blur · intensity, clamped 0–90 px).
- **Smoothness** (0–1): number of blended halo copies,
  layers = 1 + round(2·smoothness), each at k/layers of the spread —
  more layers = smoother gradient falloff.
- **Sharpness** (toggle: *text* | *effect*): `text` adds a clean white
  core with glowBlur 0 so glyphs stay crisp while the halo blooms;
  `effect` multiplies copy blur ×0.45 so the glow edge itself stays hard.
- **Clarity** (0–1): opacity of that white core copy (0.3 + 0.7·clarity).

Copies are real editable clips (`<name> glow`, `<name> clarity core`).

## 9. Scramble / gibberish filler growth law

Randomized looks scale chaos with duration instead of a fixed burst:
- Effects retro / watermark randomizers: `untilSec = clamp(0.55·duration, 0.8, 4)` s.
- **Gibberish Padding Reveal**: filler length `fill = clamp(round(3·duration), 2, 20)`
  gibberish chars on **both** sides of the real word, randomized for
  0.72·duration, then the clean word cross-fades in. Longer duration =
  more padding and a longer decode, exactly the "calculated animation"
  behaviour of decoder-text tutorials.

## 10. What was fixed / added in this wave

Typewriter rebuilt as 5 formes (§5); Word Pop collisions fixed by
measured layout + word spacing (§6); per-animation settings (spacing,
duration, delay, graph) and the full glow stack (§7–8) apply to every one
of the 42 presets; scramble filler grows with duration (§9). QA:
`qa/preset-settings-e2e.mjs` (30 assertions: 5 glyphs, caps maths,
measured gaps, delay/duration, graph remap, glow geometry at 90°,
filler growth) + `qa/text-presets-e2e.mjs` (all 42 build, char mapping,
determinism).
