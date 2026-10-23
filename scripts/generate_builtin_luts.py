#!/usr/bin/env python3
"""Generate OmniFrame's clean-room, downloadable 3D .cube look library.

The looks are authored from small deterministic color-transform parameters,
not copied from third-party LUT packs or extracted frames. Run from the repo
root with: python3 scripts/generate_builtin_luts.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "luts"
SIZE = 17  # 17^3 gives smooth trilinear grading without shipping 25 x 33^3 tables.

# The small RGB offsets are deliberately restrained: each LUT should be a
# flexible starting look that can be dialled back with the stack's intensity.
LOOKS = [
    # Clean / correction
    {"id": "clean-neutral", "name": "Clean Neutral", "category": "Clean", "description": "Balanced Rec.709-style color with a gentle contrast lift.", "swatch": "rgb(125, 150, 156)", "tags": ["neutral", "natural", "clean"], "contrast": 1.04, "exposure": 0.02, "saturation": 1.02},
    {"id": "soft-portrait", "name": "Soft Portrait", "category": "Clean", "description": "Soft contrast, warm midtones and restrained saturation for faces.", "swatch": "rgb(192, 143, 121)", "tags": ["skin", "portrait", "soft"], "contrast": 0.94, "saturation": 0.96, "temperature": 0.12, "mid": [0.018, 0.006, -0.012], "lift": 0.012},
    {"id": "bright-air", "name": "Bright Air", "category": "Clean", "description": "An airy exposure lift with open shadows and quiet color.", "swatch": "rgb(178, 197, 196)", "tags": ["bright", "airy", "lift"], "exposure": 0.24, "contrast": 0.93, "saturation": 0.96, "lift": 0.018, "highlights": [0.008, 0.008, 0.004]},
    {"id": "crisp-daylight", "name": "Crisp Daylight", "category": "Clean", "description": "Clear daylight with crisp definition and a subtle cool balance.", "swatch": "rgb(105, 151, 174)", "tags": ["daylight", "crisp", "cool"], "contrast": 1.11, "saturation": 1.04, "temperature": -0.06, "shadows": [-0.008, 0.006, 0.022]},
    {"id": "shadow-detail", "name": "Shadow Detail", "category": "Clean", "description": "Lifts the toe gently so darker footage keeps more readable detail.", "swatch": "rgb(129, 143, 151)", "tags": ["shadows", "lifted", "low light"], "contrast": 0.98, "exposure": 0.04, "saturation": 0.98, "lift": 0.045},
    # Cinematic
    {"id": "teal-amber", "name": "Teal / Amber", "category": "Cinematic", "description": "Cooler shadows and a restrained amber highlight split.", "swatch": "rgb(72, 151, 161)", "tags": ["teal", "orange", "film"], "contrast": 1.12, "saturation": 1.06, "shadows": [-0.022, 0.012, 0.034], "highlights": [0.038, 0.016, -0.022]},
    {"id": "steel-blue", "name": "Steel Blue", "category": "Cinematic", "description": "A cool steel bias with controlled highlights and firm contrast.", "swatch": "rgb(89, 123, 167)", "tags": ["blue", "cool", "dramatic"], "contrast": 1.12, "saturation": 0.96, "temperature": -0.10, "shadows": [-0.006, 0.004, 0.032], "highlights": [-0.008, 0.006, 0.018]},
    {"id": "golden-hour", "name": "Golden Hour", "category": "Cinematic", "description": "Warm light and golden highlights without turning whites orange.", "swatch": "rgb(205, 153, 89)", "tags": ["warm", "sunset", "gold"], "exposure": 0.08, "contrast": 1.04, "saturation": 1.08, "temperature": 0.17, "highlights": [0.035, 0.012, -0.028]},
    {"id": "silver-bypass", "name": "Silver Bypass", "category": "Cinematic", "description": "A desaturated, higher-contrast silver finish with preserved highlights.", "swatch": "rgb(157, 164, 166)", "tags": ["silver", "bleach", "mono"], "contrast": 1.24, "saturation": 0.62, "temperature": -0.02, "lift": 0.012},
    {"id": "midnight-noir", "name": "Midnight Noir", "category": "Cinematic", "description": "Deep blue shadows and low-key contrast for night scenes.", "swatch": "rgb(50, 75, 120)", "tags": ["night", "dark", "noir"], "exposure": -0.24, "contrast": 1.18, "saturation": 0.91, "shadows": [-0.016, 0.004, 0.044], "highlights": [0.004, 0.006, 0.018]},
    # Graphic / anime-edit palette
    {"id": "crimson-pulse", "name": "Crimson Pulse", "category": "Graphic", "description": "Bold crimson highs and cool shadows for high-energy edits.", "swatch": "rgb(191, 64, 93)", "tags": ["red", "crimson", "energy"], "contrast": 1.16, "saturation": 1.15, "shadows": [-0.014, 0.004, 0.022], "highlights": [0.045, -0.008, 0.004]},
    {"id": "cyan-surge", "name": "Cyan Surge", "category": "Graphic", "description": "Electric cyan highlights over a dense, cool blue base.", "swatch": "rgb(40, 176, 198)", "tags": ["cyan", "blue", "electric"], "contrast": 1.15, "saturation": 1.16, "temperature": -0.08, "shadows": [-0.01, 0.008, 0.034], "highlights": [-0.012, 0.026, 0.032]},
    {"id": "violet-dream", "name": "Violet Dream", "category": "Graphic", "description": "Lavender-magenta color separation with a soft violet haze.", "swatch": "rgb(143, 95, 186)", "tags": ["violet", "purple", "magenta"], "contrast": 1.07, "saturation": 1.12, "shadows": [0.014, -0.006, 0.036], "highlights": [0.024, 0.006, 0.026], "lift": 0.012},
    {"id": "golden-impact", "name": "Golden Impact", "category": "Graphic", "description": "Punchy golden mids with clean whites and strong subject separation.", "swatch": "rgb(209, 160, 56)", "tags": ["gold", "yellow", "impact"], "contrast": 1.17, "saturation": 1.14, "temperature": 0.09, "highlights": [0.042, 0.022, -0.024], "mid": [0.014, 0.008, -0.012]},
    {"id": "ink-cut", "name": "Ink Cut", "category": "Graphic", "description": "High-contrast monochrome with a small black lift to retain texture.", "swatch": "rgb(144, 148, 151)", "tags": ["black and white", "mono", "contrast"], "contrast": 1.26, "saturation": 0.0, "lift": 0.018},
    # Film / vintage
    {"id": "35mm-fade", "name": "35mm Fade", "category": "Vintage", "description": "Muted film color, lifted blacks and a gentle warm bias.", "swatch": "rgb(165, 133, 111)", "contrast": 0.92, "saturation": 0.89, "temperature": 0.08, "lift": 0.038, "highlights": [0.018, 0.008, -0.004]},
    {"id": "super8-sun", "name": "Super 8 Sun", "category": "Vintage", "description": "Soft sun-warmed mids with a nostalgic, slightly faded roll-off.", "swatch": "rgb(198, 151, 83)", "exposure": 0.08, "contrast": 0.94, "saturation": 1.04, "temperature": 0.15, "lift": 0.024, "highlights": [0.025, 0.008, -0.02]},
    {"id": "digicam-flash", "name": "Digicam Flash", "category": "Vintage", "description": "Cool, direct-flash character with crisp edges and a restrained palette.", "swatch": "rgb(149, 163, 191)", "contrast": 1.14, "saturation": 0.94, "temperature": -0.09, "highlights": [-0.008, 0.008, 0.026]},
    {"id": "vhs-soft-green", "name": "VHS Soft Green", "category": "Vintage", "description": "Softened contrast, raised blacks and a faint analog green cast.", "swatch": "rgb(115, 145, 116)", "contrast": 0.9, "saturation": 0.84, "tint": -0.06, "lift": 0.052, "shadows": [-0.006, 0.018, -0.006]},
    {"id": "warm-negative", "name": "Warm Negative", "category": "Vintage", "description": "Warm, low-contrast film response with quiet reds and open shadows.", "swatch": "rgb(174, 133, 101)", "contrast": 0.95, "saturation": 0.92, "temperature": 0.11, "lift": 0.03, "mid": [0.018, 0.005, -0.01]},
    # Atmosphere
    {"id": "winter-glass", "name": "Winter Glass", "category": "Atmosphere", "description": "Icy blue shadows, neutral skin highlights and a clean winter finish.", "swatch": "rgb(123, 162, 196)", "contrast": 1.05, "saturation": 0.94, "temperature": -0.13, "shadows": [-0.006, 0.008, 0.03]},
    {"id": "forest-cinema", "name": "Forest Cinema", "category": "Atmosphere", "description": "Earthy green shadows and natural, slightly warm highlights.", "swatch": "rgb(91, 144, 96)", "contrast": 1.08, "saturation": 1.02, "shadows": [-0.012, 0.016, -0.008], "highlights": [0.018, 0.012, -0.012]},
    {"id": "desert-dust", "name": "Desert Dust", "category": "Atmosphere", "description": "Dry sand warmth, softened contrast and gently muted color.", "swatch": "rgb(174, 145, 109)", "contrast": 0.95, "saturation": 0.86, "temperature": 0.13, "tint": 0.02, "lift": 0.026},
    {"id": "lavender-haze", "name": "Lavender Haze", "category": "Atmosphere", "description": "Pastel lavender highlights with an airy, low-contrast bloom-like base.", "swatch": "rgb(164, 140, 188)", "contrast": 0.92, "saturation": 0.92, "shadows": [0.012, 0.004, 0.022], "highlights": [0.02, 0.008, 0.024], "lift": 0.025},
    {"id": "neon-afterdark", "name": "Neon Afterdark", "category": "Atmosphere", "description": "Dense night contrast with separate cyan shadows and magenta lights.", "swatch": "rgb(135, 70, 170)", "exposure": -0.08, "contrast": 1.2, "saturation": 1.17, "shadows": [-0.012, 0.012, 0.036], "highlights": [0.032, -0.006, 0.026]},
]


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    x = clamp01((value - edge0) / (edge1 - edge0))
    return x * x * (3.0 - 2.0 * x)


def grade(rgb: tuple[float, float, float], look: dict) -> tuple[float, float, float]:
    r, g, b = rgb
    exposure = 2.0 ** float(look.get("exposure", 0.0))
    contrast = float(look.get("contrast", 1.0))
    values = [((channel * exposure - 0.42) * contrast) + 0.42 for channel in (r, g, b)]
    luminance = max(0.0, min(1.0, 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]))
    shadows = (1.0 - smoothstep(0.06, 0.62, luminance)) ** 1.25
    highlights = smoothstep(0.34, 0.96, luminance) ** 1.15
    mids = max(0.0, 1.0 - abs(luminance - 0.48) / 0.48)

    for i, cast in enumerate(look.get("shadows", (0.0, 0.0, 0.0))):
        values[i] += cast * shadows
    for i, cast in enumerate(look.get("highlights", (0.0, 0.0, 0.0))):
        values[i] += cast * highlights
    for i, cast in enumerate(look.get("mid", (0.0, 0.0, 0.0))):
        values[i] += cast * mids

    temperature = float(look.get("temperature", 0.0))
    tint = float(look.get("tint", 0.0))
    values[0] += temperature * 0.10 + tint * 0.025
    values[1] += tint * -0.05
    values[2] -= temperature * 0.10 - tint * 0.025

    luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
    saturation = float(look.get("saturation", 1.0))
    vibrance = float(look.get("vibrance", 0.0))
    chroma = max(values) - min(values)
    saturation *= 1.0 + vibrance * (1.0 - clamp01(chroma * 1.6))
    values = [luminance + (channel - luminance) * saturation for channel in values]

    lift = float(look.get("lift", 0.0))
    gamma = float(look.get("gamma", 1.0))
    values = [((channel * (1.0 - lift)) + lift) for channel in values]
    if gamma != 1.0:
        values = [max(0.0, channel) ** (1.0 / gamma) for channel in values]
    return tuple(clamp01(channel) for channel in values)


def cube_text(look: dict) -> str:
    lines = [
        f"# OmniFrame clean-room look — {look['name']}",
        f"# {look['description']}",
        f"TITLE \"{look['name']}\"",
        f"LUT_3D_SIZE {SIZE}",
        "DOMAIN_MIN 0.0 0.0 0.0",
        "DOMAIN_MAX 1.0 1.0 1.0",
        "",
    ]
    for red_index in range(SIZE):
        r = red_index / (SIZE - 1)
        for green_index in range(SIZE):
            g = green_index / (SIZE - 1)
            for blue_index in range(SIZE):
                b = blue_index / (SIZE - 1)
                values = grade((r, g, b), look)
                lines.append("{:.6f} {:.6f} {:.6f}".format(*values))
    return "\n".join(lines) + "\n"


def main() -> None:
    if len(LOOKS) != 25 or len({look["id"] for look in LOOKS}) != 25:
        raise SystemExit("Built-in LUT catalog must contain exactly 25 unique looks")
    OUT.mkdir(parents=True, exist_ok=True)
    # Start clean: remove old bundled cubes so stale presets cannot leak into
    # the shipped library. User-uploaded LUTs live in browser storage instead.
    for old_cube in OUT.glob("*.cube"):
        old_cube.unlink()

    for look in LOOKS:
        (OUT / f"{look['id']}.cube").write_text(cube_text(look), encoding="utf-8")

    manifest = {
        "version": 1,
        "count": len(LOOKS),
        "luts": [
            {
                "id": look["id"],
                "name": look["name"],
                "file": f"luts/{look['id']}.cube",
                "description": look["description"],
                "category": look["category"],
                "swatch": look["swatch"],
                "tags": look.get("tags", []),
            }
            for look in LOOKS
        ],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(LOOKS)} clean-room {SIZE}³ .cube LUTs in {OUT}")


if __name__ == "__main__":
    main()
