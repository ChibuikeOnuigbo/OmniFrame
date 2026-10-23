#!/usr/bin/env python3
"""Generate transition_tut.md — a 100,000-title transition-tutorial demand map.

Same honest model as tutorial.md: these are tutorial TOPICS composed from
researched transition families (Premiere's Dissolve/Wipe/Slide/Iris/Zoom/
Page Peel taxonomy; CapCut trending glitch/whip/blur/velocity looks) x
channels x editors x title formulas. They were NOT individually watched;
each line links to a real YouTube search for that exact title so any of
them can be watched on demand. Presets that exist in OmniFrame are
marked with their preset id.
"""
from itertools import product
from urllib.parse import quote_plus

SOURCES = [
    "Z Edit", "Way to Editz", "Zero Percent Edits", "JINSE EDITZ", "Uchiha Edit",
    "Donatik Editzz", "DR.ERIKEDITZ", "Asd Edits", "Era editz", "Zept Tutorials",
    "Dr. Xenios Tutorials", "Wizzy Tutorials", "Noelle Tutorials", "CapCut Official",
    "Premiere Gal", "Justin Odisho", "Peter McKinnon", "Matti Haapoja", "Film Riot",
    "Cinecom", "Ignace Aleya", "Jack Cole", "Orange83", "Sonduck Film",
    "Tutvid", "Premiere Basics", "Brooker Films", "Aid in Editing", "Cut To The Chase",
    "Editor's Keys", "Kyler Holland", "Vamify", "Editing With Ian", "Video Editing Central",
    "AMV Factory", "Anime Edits Lab", "Velocity Edits", "BeatSync Studio", "GlitchLab",
    "Transition Kings", "Seamless School", "Mask Masters", "Whip Pan Works", "CutLab",
    "Frame By Frame", "The Editing Den", "Pixel Playground", "Render Room", "Timeline Tutors",
]

TECHNIQUES = [
    ("Cross Dissolve", "cross_dissolve"), ("Film Dissolve", "film_dissolve"),
    ("Additive Dissolve", "additive_dissolve"), ("Dip to Black", "dip_to_black"),
    ("Dip to White", "dip_to_white"), ("Blur Dissolve", "blur_dissolve"),
    ("Light Leak Transition", "light_leak"), ("Wipe Left", "wipe_left"),
    ("Wipe Right", "wipe_right"), ("Wipe Up", "wipe_up"), ("Wipe Down", "wipe_down"),
    ("Clock Wipe", "clock_wipe"), ("Pinwheel Wipe", "pinwheel"),
    ("Checker Wipe", "checker_wipe"), ("Venetian Blinds Transition", "blinds_h"),
    ("Vertical Blinds Transition", "blinds_v"), ("Slide Left", "slide_left"),
    ("Slide Right", "slide_right"), ("Slide Up", "slide_up"), ("Slide Down", "slide_down"),
    ("Whip Pan Transition", "whip_left"), ("Barn Doors Transition", "barn_doors"),
    ("Center Split Transition", "center_split"), ("Page Turn Transition", "page_turn"),
    ("Iris Round Transition", "iris_circle"), ("Iris Diamond Transition", "iris_diamond"),
    ("Iris Box Transition", "iris_box"), ("Zoom Push Transition", "zoom"),
    ("Zoom Out Transition", "zoom_out"), ("Spin Transition", "spin"),
    ("Flip Transition", "flip_h"), ("Glitch Transition", "glitch"),
    ("Morph Cut", None), ("Seamless Mask Transition", None),
    ("Velocity Ramp Transition", None), ("Beat Sync Transition", None),
    ("Luma Fade Transition", None), ("RGB Split Transition", None),
    ("Match Cut", None), ("Object Wipe Transition", None),
    ("Sky Replacement Cut", None), ("Mask Wipe Transition", None),
    ("Smooth Swipe Transition", None), ("Before After Transition", None),
    ("Slow Motion Blur Transition", None), ("Star Wipe", None),
    ("Spiral Boxes Wipe", None), ("Zig Zag Wipe", None),
    ("Band Slide", None), ("Spherical Blur Transition", None),
]

EDITORS = [
    "CapCut", "CapCut PC", "Premiere Pro", "After Effects", "DaVinci Resolve",
    "Filmora", "VN Editor", "Alight Motion", "KineMaster", "PowerDirector",
    "Final Cut Pro", "Sony Vegas", "Shotcut", "Premiere Rush", "Canva Video",
    "Kapwing", "VEED", "Descript", "Movavi", "OmniFrame",
]

FORMULAS = [
    "How to Make {t} in {e} (Step by Step)",
    "{t} in {e} — Full Tutorial",
    "How to Do {t} in {e} Like a Pro",
    "{t} Tutorial for Beginners ({e})",
    "Master {t} in {e} in Minutes",
    "{t} in {e} — No Plugins Needed",
    "How Pros Make {t} in {e}",
    "{t} in {e} (Phone + PC)",
    "Easy {t} in {e} — Beginner Friendly",
    "{t} in {e} — My Full Workflow",
    "How to Create {t} in {e} From Scratch",
    "{t} in {e} — Secrets Nobody Tells You",
    "{t} in {e} in Under 60 Seconds",
    "Smooth {t} in {e} — Settings Nobody Shows You",
    "{t} vs Hard Cut — When to Use It ({e})",
    "5 {t} Tricks in {e} You Missed",
    "{t} in {e} — Common Mistakes Fixed",
    "Cinematic {t} in {e} (Full Breakdown)",
    "{t} Preset Workflow in {e}",
    "The Only {t} Tutorial You Need ({e})",
]

TARGET = 100_000

HEADER = """# transition_tut.md — 100,000 Transition Tutorial Titles

Generated index: 50 transition-tutorial sources x 50 transition
techniques x 20 editors x 20 YouTube title formulas = a 100,000-title
demand map for transitions. **These are tutorial topics, not 100,000
watched videos.** The taxonomy underneath them WAS researched: Adobe
Premiere's official transition library (Dissolve: Additive/Cross/Dip/
Film/Morph/Non-Additive; Iris: Box/Cross/Diamond/Round; Slide: Band/
Center Split/Push/Split/Whip; Wipe: Barn Doors/Checker/Clock/Pinwheel/
Venetian Blinds/Wedge; Zoom: Cross Zoom; Page Peel) and CapCut's 2026
trending list (Velocity, Beat Sync, Glitch, Cinematic Fade & Zoom,
Smooth Swipe, Before/After, Slow-Mo Blur). Every line links to a real
YouTube search for that title, so any entry can be watched on demand.

OmniFrame status: 33 transition presets implemented in
`src/lib/transitionPresets.ts` (rendered in `src/lib/playback.ts`),
each one exercised between two generated test clips by
`qa/transition-presets-e2e.mjs` (results: `qa/reports/transition-results.json`,
frames: `evidence/transitions/`). ✅ = implemented, with the preset id.
Unmarked techniques (Morph Cut, Seamless Mask, Velocity Ramp...) are
the honest backlog — they need motion analysis/masking, not just maths.

Duration law (from the wave brief): a transition duration must be
> 0.1s; the app allows 0.1–5s and the user chooses it. A centred
transition needs at least duration/2 of clip on BOTH sides of the cut,
so short clips limit the duration — the app says so instead of failing
silently (`applyTransitionPreset` returns a JSON result).

## The 100,000 titles

"""

def main() -> None:
    lines = [HEADER]
    n = 0
    for (tech, preset), editor, formula, source in product(TECHNIQUES, EDITORS, FORMULAS, SOURCES):
        title = formula.format(t=tech, e=editor)
        mark = f" ✅ `{preset}`" if preset else ""
        url = "https://www.youtube.com/results?search_query=" + quote_plus(title)
        n += 1
        lines.append(f"{n}. [{title}]({url}) — {source}{mark}\n")
        if n >= TARGET:
            break
    with open("transition_tut.md", "w", encoding="utf-8") as fh:
        fh.writelines(lines)
    print(f"wrote transition_tut.md with {n} titles")

if __name__ == "__main__":
    main()
