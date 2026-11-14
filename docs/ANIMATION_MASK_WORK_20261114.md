# Animation and effect view masks — 14 November 2026

A new Animation entry in the 2D rail opens the existing drawing engine in frame scope,
with onion skins on. Cels and Curves switch the existing graph editor. The panel also
adds Duplicate next and Clear cel for the active paint layer. Exposure replacement
preserves neighboring held frames, other paint layers and project undo history.

Effect masks allow the first shape to be chosen before adding it. The new Split shape
covers one side of a rotatable line and can be inverted with Outside. Rotation is now
exposed for all mask regions. Browser preview and headless rendering both support
Split; existing rectangle, circle, ellipse, text and polygon regions remain. A mask
limits the effect region while keeping the original clip visible.

Krita reference: https://docs.krita.org/en/user_manual/animation.html . Its frame,
onion skin and transform-mask sections guided the separation between cel work and
nondestructive animation. These controls reuse OmniFrame's existing drawing tools.

Remaining requests include interactive mask handles and Bezier editing, colored
feather, recorded handwriting reveal, advanced card and hologram effects, physical
bounce/roll, dust, water, aura and tracked glowing-eye effects. No neural model was
trained, and no huge catalog count is being presented as distinct working effects.

Validation: TypeScript typecheck, production build, live animation entry/duplicate/clear/undo,
effect-mask UI, and headless split-mask pixel checks passed. The full onion-skin browser/export test now passes with project-local OpenCV: 124
decoded frames, average luminance 205.42. Install with
`python -m pip install --target .cache/python-deps -r qa/requirements-opencv.txt`,
then run with `PYTHONPATH=$PWD/.cache/python-deps node qa/onion-skin-cel-animation-e2e.mjs`.

Animation now includes Draw on. It turns visible freehand strokes on the active
paint layer into a timed path reveal with an adjustable 0.2–10 second duration; frame cels become a matching span. The same
`renderAllPaintLayers` function serves browser playback/export and headless rendering.
Draw-on remains path based and does not yet support typed handwriting, automatic
shape templates or interactive timing curves.
