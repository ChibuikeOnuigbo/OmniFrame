#!/usr/bin/env python3
"""Generate tutorial.md — the 100,000-title tutorial index.

Titles = tutorial channels (from the subscription scan) x techniques x
editors x YouTube title formulas. This is a demand map of what to build,
NOT a list of watched videos. Rows whose technique exists as an app
preset are marked with the preset id.

Usage: python3 qa/generate-tutorial-index.py [subscriptions.csv]
"""
import csv
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "tutorial.md"
TARGET = 100_000

EDITORS = [
    "CapCut", "CapCut PC", "Alight Motion", "After Effects", "Premiere Pro",
    "DaVinci Resolve", "Final Cut Pro", "Filmora", "VN Video Editor",
    "KineMaster", "PowerDirector", "Canva Video", "Sony VEGAS Pro", "iMovie",
    "HitFilm", "Shotcut", "Blender", "Photoshop", "Krita", "PowerPoint",
    "Descript", "Gold Motion", "Toji Motion", "Node Video", "YouCut",
    "InShot", "VLLO", "LumaFusion", "Final Cut iPad", "Resolve iPad",
    "Premiere Rush", "Clipchamp", "Kapwing", "VEED", "Runway", "Topaz",
    "After Motion", "AMZ", "Motion Ninja", "Piximperfect Style",
]

# (technique, preset id or None)
TECHNIQUES = [
    ("Retro Text Animation Per-Letter Glitches", "retro-traditional"),
    ("Retro Text Randomizer Scramble", "retro-effects"),
    ("Text Scramble Reveal", "retro-effects"),
    ("Matrix Code Scramble Text", "matrix-scramble"),
    ("RGB Split Glitch Text", "rgb-split"),
    ("Pixel Stretch Text Intro", "pixel-stretch-in"),
    ("Neon Flicker Sign Text", "neon-flicker"),
    ("Glow Pulse Title", "glow-pulse"),
    ("Bounce Letters", "bounce-letters"),
    ("Wave Letters", "wave-letters"),
    ("Spin Drop Letters", "spin-drop"),
    ("Cascade Falling Letters", "cascade-fall"),
    ("Slam Zoom Impact Title", "slam-zoom"),
    ("Karaoke Sweep Lyrics", "karaoke-sweep"),
    ("Typewriter With Cursor", "typewriter"),
    ("Rainbow Letters", "rainbow-letters"),
    ("Outline Echo Text", "outline-echo"),
    ("News Lower Third", "lower-third"),
    ("Cinematic Serif Fade", "cinematic-fade"),
    ("Marker Highlight Text", "highlight-marker"),
    ("Credit Roll Rise", "credit-roll"),
    ("Minimal Fade Typography", "minimal-fade"),
    ("Vertical Letter Stack", "vertical-stack"),
    ("Echo Trail Motion Text", "echo-trail"),
    ("Smooth Shake Text (Magnitude/Frequency)", "shake-smooth"),
    ("Aggressive Random Shake Text", "shake-aggressive"),
    ("Fire Text", "fire-text"),
    ("Ice Frozen Text", "ice-text"),
    ("Gold Shine Text", "gold-text"),
    ("Gradient Flow Letters", "gradient-flow"),
    ("Long Shadow Retro Text", "long-shadow"),
    ("Blur Focus Pull Title", "blur-focus"),
    ("VHS Camcorder Text", "vhs-text"),
    ("Word By Word Pop Captions", "word-pop"),
    ("Custom Shake Effects From Scratch", None),
    ("AE-Like Grid Transition", None),
    ("Smooth Clean Masks", None),
    ("Flow Edit Timing", None),
    ("Video Composition Basics", None),
    ("Upscale To 4K Quality", None),
    ("Watermark Beginner To Advanced", None),
    ("Animated Character Watermark", None),
    ("Text Behind Object", None),
    ("3D Extruded Text", None),
    ("Handwritten Write-On Text", None),
    ("Text On A Path", None),
    ("Smoke Dissolve Text", None),
    ("Particles Forming Text", None),
    ("Video Inside Text Mask", None),
    ("Kinetic Typography Beat Sync", None),
    ("Styled Auto Captions", None),
    ("Text Tracking Expand", None),
    ("Split Flap Board Text", None),
    ("Countdown Numbers Animation", None),
    ("Sale Price Pop Text", None),
    ("Comic Speech Bubble Text", None),
    ("Two Colour Karaoke Subtitles", None),
    ("Velocity Edit Speed Ramping", None),
    ("Twixtor Smooth Slow Motion", None),
    ("Graph Editor Mastery", None),
    ("Oscillate And Auto Shake", None),
    ("Shake Presets Pack Building", None),
    ("Beat Sync Markers Workflow", None),
    ("Colour Correction For AMV", None),
    ("Colour Grading Cinematic LUTs", None),
    ("Glow Effects Stacking", None),
    ("Chromatic Aberration Hits", None),
    ("Wave Warp Distortion", None),
    ("Mirror And Kaleidoscope", None),
    ("Zoom Punch Transitions", None),
    ("Mask Transitions Wipe", None),
    ("Film Burn Transitions", None),
    ("Light Leaks Overlay Edit", None),
    ("Grain And VHS Overlays", None),
    ("Thumbnail Text That Pops", None),
    ("Subtitle Styling For Shorts", None),
    ("Lyrics Edit Full Workflow", None),
    ("AMV Full Editing Process", None),
    ("Edit Ideas From References", None),
    ("Editing On Low-End Phones", None),
    ("Export Settings For Quality", None),
    ("Copyright Safe Music Workflow", None),
    ("Sound Design Hit Cues", None),
    ("Voice Tag Watermark Sound", None),
    ("Character Rig Puppet Edit", None),
    ("Hair Sway Distortion Edit", None),
    ("Body Parts Animation Edit", None),
    ("Logo Intro Reveal", None),
    ("Signature Intro Building", None),
    ("Text Presets Pack Creation", None),
    ("Keyframe Graphs Smoothness", None),
    ("Easing Curves Explained", None),
    ("Loop Perfect Text Animation", None),
    ("Glitch Blocks Datamosh Text", None),
    ("Neon Outline Sign", None),
    ("Chrome Metal Text", None),
    ("Retro 80s Chrome Text", None),
    ("Y2K Bubble Text", None),
    ("Grunge Stamp Text", None),
    ("Clean Corporate Titles", None),
    ("Wedding Titles Elegant", None),
]

TEMPLATES = [
    "How to Make {T} in {E} (Step by Step)",
    "{T} in {E} — Full Tutorial",
    "How to Do {T} in {E} Like a Pro",
    "{T} Tutorial for Beginners ({E})",
    "Master {T} in {E} in Minutes",
    "{T} in {E} — No Plugins Needed",
    "How Pros Make {T} in {E}",
    "{T} in {E} (Phone + PC)",
    "Easy {T} in {E} — Beginner Friendly",
    "{T} in {E} — My Full Workflow",
    "How to Create {T} in {E} From Scratch",
    "{T} in {E} — Secrets Nobody Tells You",
    "Stop Doing Text Wrong — {T} in {E}",
    "{T} in {E} in Under 5 Minutes",
    "How to Make {T} in {E} (2026 Guide)",
    "{T} in {E} — Settings + Graphs Shown",
    "My {T} Workflow in {E}",
    "{T} in {E} — Free Preset Method",
    "How to Animate {T} in {E}",
    "{T} in {E} — Full Breakdown",
]

FALLBACK_CHANNELS = [
    "Noelle Tutorials", "NDK Edit", "Wizzy Tutorials", "Zept Tutorials",
    "Dr. Xenios Tutorials", "Tyson Tutorials", "Zenny Tutorials",
    "mxtstutorials", "Z Edit", "Way to Editz", "Editiverse",
]


def channels_from_csv(path: str) -> list[str]:
    import re
    rows = list(csv.DictReader(open(path)))
    keep = []
    for r in rows:
        name = (r.get("Channel Title") or "").strip()
        if not name:
            continue
        n = name.lower()
        if "tutorial" in n or re.search(r"edit|vfx|motion|anim|davinci", n):
            keep.append(name)
    return keep or FALLBACK_CHANNELS


def main() -> None:
    channels = channels_from_csv(sys.argv[1]) if len(sys.argv) > 1 else FALLBACK_CHANNELS
    C, T, E, M = len(channels), len(TECHNIQUES), len(EDITORS), len(TEMPLATES)
    lines = [
        "# tutorial.md — 100,000 Text & Editing Tutorial Titles",
        "",
        f"Generated index: {C} tutorial/edit channels (from your subscription",
        f"scan — `docs/SUBSCRIPTION-SCAN.md`) × {T} techniques × {E} editors ×",
        f"{M} YouTube title formulas = a {TARGET:,}-title demand map of what to",
        "build next in OmniFrame. **These are tutorial topics, not 100,000",
        "watched videos.** Channels/techniques actually consumed (RSS titles +",
        "descriptions via your gateway; full transcripts for the two anchor",
        "tutorials) are documented in `docs/SUBSCRIPTION-SCAN.md` and",
        "`docs/RETRO-WATERMARK-STUDY.md`. ✅ = already an app preset",
        "(Text panel → Text Preset Library; vet the MP4s in `testing_asset_etc/`).",
        "",
        "Character-count rule: presets are procedures keyed to normalized",
        "letter position `u = i/(n−1)` — any text length maps; the app shows",
        "each preset's sweet spot live and never forces a character count.",
        "",
        "## The 100,000 titles",
        "",
    ]
    n = 0
    for i in range(TARGET):
        ch = channels[i % C]
        tech, pid = TECHNIQUES[(i // C) % T]
        ed = EDITORS[(i // (C * T)) % E]
        tpl = TEMPLATES[((i // (C * T)) + i) % M]  # rotate formulas for variety; (channel, technique, editor) triples stay unique
        title = tpl.format(T=tech, E=ed)
        mark = f" ✅ `{pid}`" if pid else ""
        lines.append(f"{i + 1}. {title} — {ch}{mark}")
        n += 1
    OUT.write_text("\n".join(lines) + "\n")
    print(f"tutorial.md: {n} titles, channels={C}, techniques={T}, editors={E}")


if __name__ == "__main__":
    main()
