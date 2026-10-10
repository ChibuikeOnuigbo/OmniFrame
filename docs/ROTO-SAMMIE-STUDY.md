# RotoMask — Sammie-Roto 2 Study & OmniFrame Implementation

**Sources studied:**
- [Zarxrax/Sammie-Roto-2](https://github.com/Zarxrax/Sammie-Roto-2) — "**S**egment **A**nything **M**odel with **M**atting **I**ntegrated **E**legantly". A free, open-source desktop GUI (Python/Django) for AI-assisted masking of video. 395★, actively maintained.
- [Jordy's walkthrough video](https://www.youtube.com/watch?v=HWpdLjILhj0) — *"I Built My Own Roto Brush... Then Someone Built a Better One"* (7:08, 2026-10-04): full workflow demo incl. the anime model, VideoMaMa hair matting, object removal, luma-matte export into After Effects parallax setups.

## What Sammie-Roto 2 is

Three primary functions, each behind one GUI:

| Function | Models used |
|---|---|
| Video **segmentation** (click + track) | **SAM2** + a **fine-tuned anime model** (added 2.5.0, 2026-10-04) |
| Video **matting** (hair/strand detail) | **MatAnyone**, **MatAnyone 2**, **VideoMaMa** (SVD-based) |
| Video **object removal** | **MiniMax-Remover**, **ProPainterX** |

Installers for Windows/macOS/Linux (uv-managed Python), AMD/ROCm support since 2.4.1,
live preview while holding shift during segmentation (2.3.1), correct colorspace
conversions (2.3.3), additional segmentation tracking options (2.4.0).

## The reference workflow (from the video transcript)

1. **Pick a model** in the model picker (e.g. *Anime* for AMV editing) → click
   **Load model** → status line at the bottom.
2. **Click your subject** — "It is as simple as that."
3. **Track objects** → the mask propagates; review all frames or play the clip.
4. **Fix-ups:** right-click where you want to *remove* (background that leaked
   in), left-click back on the subject to re-add; multiple dots allowed; click
   *Track objects* again to re-track.
5. **Matting** (VideoMaMa): takes the existing segmentation mask and refines
   hair strands. Slower, but "just look at the hair."
6. **Object removal**: uses the segmentation mask, removes the subject and
   patches the background — slow, proportional to clip size.
7. **Export**: File → Export video → output type: segmentation map / matting /
   **luma mattes**. In After Effects the matte is used as a luma matte
   (white-on-black under the clip) — and the object-removal result enables
   2.5D **parallax** scene builds.

## OmniFrame's RotoMask (this implementation)

Same workflow shape, sized for a browser-resident editor:

### UX (Sammie parity)
- **RotoMask sub-tool** — its own section next to Selection & Masking in both
  the OmniFrame and Drawing panels (a *combo* tool: it shares the improved
  auto-brush engine with the Masking sub-tool for add/remove brush refine).
- **Engine & Models picker**: `Smart` (instant, no model) + the trained
  OmniRoto family + **import any .onnx** + a **catalog** of known community
  models (U²-Net, U²-Net-lite, IS-Net general/anime, Silueta) linked by URL —
  "import all models possible" without bundling their varied licences.
- **Click to segment**: arm the click tool → **left-click = Add**,
  **right-click (or Alt+click) = Remove**; the mask re-runs after every click;
  markers render on the preview (green +/red −); **Undo click** pops the last
  dot. This is exactly Sammie's click semantics.
- **Frame scope**: current frame / **a chosen start–end range** / all frames,
  with a step control — "a set of frames chosen around".
- **Track Objects**: propagates the mask across the scope — block-match warp
  (reusing `trackingEngine.matchPatch` on an interior grid) + colour
  re-anchor + largest-component cleanup (a mini MatAnyone in TypeScript).
  Walks outward from the base frame so large ranges stay coherent.
- **Apply**:
  - *Extract to Layer* — the subject becomes a movable OmniFrame character
    (transform + scope + keyframes = "move the selection from all frames or a
    chosen set around").
  - *Cut Out + Patch BG* — the copy-paste workflow from the request: remove
    the subject, patch the background (pyramid push-pull inpaint still placed
    above the video), paste the character back as its own layer on top.
  - *Remove from Video* — patch + hidden layer (ProPainter-style removal,
    spatial-only v1).
  - *To Drawing Mask* — hands the matte to the Drawing layer system (per the
    standing rule: only Drawing masks affect final export).
  - *Export Luma Matte* — white-on-black PNG data URL (After Effects style).

### Engines
- **Smart** (`src/lib/rotoMaskEngine.ts`): colour model fitted from the
  positive click disks, positive-vs-negative scoring with gradient demotion,
  component picking/vetoing by clicks. No download, works everywhere.
- **OmniRoto family** (`public/models/omni-roto-*-v1.onnx`): four small
  (≈142k-param, ~560 KB) residual U-Nets trained in-repo
  (`scripts/python/train_roto_models.py`, JAX on CPU) on collected reference
  photos — human (full body + portraits), anime (incl. the in-repo Death Note
  chibi set), hair portraits, and a general mix — supervised by OpenCV
  GrabCut pseudo-labels + heavy augmentation, exported to ONNX with a
  hand-built graph, parity-checked against the JAX forward (max err < 2e-3),
  val-IoU recorded in each `.json` sidecar. Clicks then pick/veto blobs from
  the model's probability map (adaptive quartile threshold).
- **Imported models**: any saliency-contract ONNX (input `1x3xHxW` 0..1, one
  map output) is auto-profiled and run through the same path in
  onnxruntime-web; on the desktop the same models run natively via the
  `roto_segment` Tauri command → `scripts/python/roto_onnx.py` sidecar
  (mirrors the ai-denoise native path). Model load failures fall back to the
  Smart engine so the tool never dead-ends.

### Masking sub-tool upgrades (the "auto brush")
- The selection **brush** now computes a real mask: the painted band is grown
  to the subject's edges by a stroke colour model + gradient stop + edge-snap
  (`src/lib/rotoBrush.ts`), instead of a hard circle that ignored the pixels.
  Toggle + tolerances live in the new *Auto Brush & Wand* section.
- The **magic wand** now floods the actual colour region under the click
  (weighted-RGB distance BFS with island cleanup) — the old implementation
  produced a fixed 0.2×0.2 rectangle regardless of pixels.
- The RotoMask brush refine reuses the same engine (add/subtract strokes on
  the live mask).

## SAM Mobile — the promptable Segment Anything engine (2026-10-05)

The reference tool's headline model is now built in: **SAM Mobile
(MobileSAM)** — TinyViT image encoder + SAM mask decoder, ONNX export via
SAMExporter (files from Kazuhito00/MobileSAM-ONNX-Sample; MobileSAM and
Segment Anything are Apache-2.0). Unlike the saliency family (whole-image
subject map), SAM is **promptable**: the user's accumulated clicks are the
prompt — positives are label-1 points, right-click negatives are label-0
points — with one iterative refinement pass feeding the decoder logits back
in for cleaner boundaries.

- Browser: both sessions load in onnxruntime-web (44.5 MB fp32; the int8
  quantisation was tested and rejected — it collapses on busy photos,
  0.910 → 0.094 IoU on the chair case). First click on a frame runs the
  encoder (~6 s in headless WASM here), and the embedding is cached per
  asset+frame, so every further click only runs the decoder (~1 s). The
  desktop sidecar (`roto_onnx.py --sam`) runs the same contract natively
  (~1.5 s encode, IoU 0.910 on the chair) with its own embedding cache; the
  Tauri command still needs click passthrough, so desktop in-app falls back
  to the WASM path until then.
- Isolation quality vs the OmniRoto family (exact-GT composites, same click
  protocol): SAM exact-tier mean IoU **0.485** vs 0.231 for the best
  OmniRoto model — and it wins precisely where saliency struggles: busy
  photo obj_chair **0.463 single-click / 0.910 with the natural 2-click
  workflow** (OmniRoto general: 0.178), mello+ryuk two subjects 0.842,
  ryuk 0.842, towel 0.748, mello 0.835.
- In-app E2E (`roto-isolation-browser-e2e.mjs` cases 12-14): chair 10.0%
  coverage vs GT 9.4% with strict bounds and localisation; pale-on-white
  char_light localised and bounded where colour engines cannot separate;
  two prompts accumulate both subjects 2.5% → 6.1% (GT union 5.4%).
- The model registry entry `sam-mobile-v1` is the first builtin in the
  picker; descriptor sidecar `public/models/sam-mobile-v1.json` documents
  the promptable contract.

## Isolation-model test results (2026-10-05)

Two new suites test the isolation engines against real ground truth
(`qa/roto-isolation-models-test.py` offline matrix against the exact sidecar
contract; `qa/roto-isolation-browser-e2e.mjs` driving the real in-app
pipeline). GT tiers: **EXACT** (in-repo RGBA cutouts composited — pasted alpha
is pixel-exact GT), **APPROX** (held-out studio portrait, border-calibrated
background suppression), **QUALITATIVE** (hair close-up, coverage only).

**Offline raw-map matrix** (IoU@0.5 / best-IoU over thresholds, native
onnxruntime): anime model 70.6/73.9% on char_mello, 58.2/58.8% on char_ryuk;
human model 60.5/77.0% on the held-out studio person; hair + human models
light up the held-out hair close-up (96.5% / 98.6% coverage) while the anime
model correctly stays at 2.5% — domain specialisation is real. Win counts
across the exact tier: anime 6, hair 5, general 2, human 0 (the human cutouts
in-repo are anime-styled; the human model's win is the held-out photo).

**In-app pipeline** (`qa/reports/roto-isolation-browser.json`, 14/14 PASS):
mello 5.4% vs GT 2.8% and ryuk 3.9% vs GT 3.1% with tight localisation;
held-out person 24.0% vs approx-GT 16.4%; hair close-up 87.6%; anime/hair
specialisation ratio 0.07; Extract→`obj_roto_` layer works from a model mask;
click accumulation 2.5%→6.5% (GT union 5.4%); negative-click trim 52.4%→24.3%
with the chair still covered.

**Engine fix found by the test**: a negative right-click inside a picked blob
used to veto the *whole connected component* — on model over-coverage that
erased the subject along with the background (52.4%→0.1%). It now subtracts
the colour-seeded region around the negative click (Sammie "this pixel is
background" semantics) and only vetoes whole blobs the negative owns outright.

**Honest limitations** (documented, not hidden):
- *Pale/small subjects*: char_light at ~1% of frame on white isolates poorly
  (anime recall 0.13 in-app) — at 128px input the subject is ~20px and nearly
  white-on-white. Mitigation: more positive clicks (accumulation verified),
  brush refine, or framing the subject larger.
- *Busy real photos*: the general model over-covers (raw map 53% vs chair GT
  9.4%; in-app precision 0.18, recall 1.0). Mitigation: negative clicks
  (verified −54% with subject survival) or a stronger imported model.
- *White-on-white*: the colour-based smart engine cannot separate white
  clothing from a white background (15.3% from a 1.2% subject) — inherent to
  colour tolerance; models or brush refine are the answer there.

The held-out stock previews are not redistributable and are git-ignored; the
browser suite skips cases 05–07 with a recorded SKIPPED status when they are
absent, everything else is reproducible from in-repo assets.

## Verification status (2026-10-05)

- `qa/roto-isolation-models-test.py` (offline matrix, native onnxruntime,
  5 engines incl. SAM) and `qa/roto-isolation-browser-e2e.mjs` (in-app,
  16 checks: 13 PASS + 3 SKIPPED without the local-only held-out previews —
  incl. SAM cases 12-14 and the two correction loops).
- `qa/rotomask-e2e.mjs`: **19/19 PASS** (sub-tool section, smart click,
  right-click remove, clicks summary + undo, model family served, anime model
  loads in onnxruntime-web, model-driven segmentation, brush refine, track
  across chosen frames, Extract→`obj_roto_` layer, Cut Out + Patch BG, Remove
  from Video, To Drawing Mask, luma-matte export, auto-brush mask, auto-brush
  toggle, real magic wand, model picker).
- Desktop sidecar smoke test: all 4 OmniRoto models produce full-size masks
  through `scripts/python/roto_onnx.py` (native onnxruntime).
- Regressions: collapse-popout-layouts 49/49, masking-tracking-mobile-drawing
  12/12, omniframe-selection-masking-recolor SUCCESS, omniframe-clean-infill
  (after a pre-existing harness fix — the verification disclosure was already
  expanded), omniframe-mode-drawing-mask, ai-denoise-model 11/11,
  krita-transparency-mask-paint, layout-selection-mask — all green.
- `tsc --noEmit` clean, `npm run build` green, `dist/models/` ships all four
  ONNX engines + JSON sidecars.

## Honest scope notes
- v1 object removal is **spatial** inpainting (pyramid push-pull), not a
  diffusion model like MiniMax-Remover/ProPainterX; temporal patching and the
  VideoMaMa-style hair matting pass are future work (guidedMatting.ts already
  provides border matting to build on).
- The OmniRoto models are small by design (browser-first); for maximal
  quality, import a U²-Net/IS-Net class model through the same UI.
- `cargo check` for the new `roto_segment` command could not run in this
  sandbox (no Rust toolchain; rustup download blocked) — the command mirrors
  `ai_denoise_wav` 1:1, but compile verification is pending a toolchain.
