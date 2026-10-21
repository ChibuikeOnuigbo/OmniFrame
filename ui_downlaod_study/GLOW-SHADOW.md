# Glow & Shadow settings — interface research (2026-10-21)

Screenshots studied via image search (Adobe Help / CapCut resource pages):

1. **Photoshop Layer Style — Drop Shadow** (Adobe help screenshot). Left column lists
   every effect as its **own checkbox row**: Bevel & Emboss, Stroke, **Inner Shadow**,
   **Inner Glow**, Satin, Color Overlay, Gradient Overlay, Pattern Overlay,
   **Outer Glow**, **Drop Shadow**. Checking a box toggles that effect; selecting the
   row shows its parameters on the right. Drop Shadow parameters: Blend Mode + colour
   swatch, **Opacity %**, **Angle** (circular dial + degrees), **Distance px**,
   **Spread %**, **Size px** (= blur), then Quality: Contour, Noise.
2. **Photoshop Layer Style — Inner Shadow** (classic dialog). Same shell; Inner Shadow
   parameters: Blend Mode, Opacity, Angle, Distance, **Choke %** (spread turned
   inward), Size, Contour, Noise. → "Inner" effects reuse the same sliders; only the
   direction of the spread flips.
3. **CapCut glowing-text editor** (capcut.com resource screenshot). Glow is a text-style
   look; the editor keeps panels as checkbox rows on the right and templates on the
   left — glow strength is a property of the style, previewed live.

## Interface rules taken into OmniFrame

- **Glow and Shadow are separate effects**, each with its **own on/off toggle**
  (Photoshop checkbox model) — not one merged "glow/shadow" group.
- Direction is a **type choice**, not a slider: **Outward glow / Inward glow** and
  **Outer (drop) shadow / Inner shadow** — two single-line segmented controls.
- Shadow parameters follow Photoshop: **Angle · Distance · Size (Blur) · Opacity**,
  plus a colour swatch. Glow keeps OmniFrame's stack controls (Intensity, Spread,
  Smooth, Clarity, Sharpness) under the same pattern.
- Glow is **optional on every preset except Glow/Neon presets**, where it is locked
  on — the preset's identity is the glow (like a CapCut glow template).
