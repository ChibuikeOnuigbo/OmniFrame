# ProPainter study — what OmniFrame borrowed, and what it honestly doesn't do

Source studied: https://github.com/sczhou/ProPainter (ICCV 2023, "Improving
Propagation and Transformer for Video Inpainting"). ProPainter is a
server-side PyTorch model: RAFT optical flow completes a flow field across a
masked hole, pixels are **propagated** from neighbouring frames along that
flow into the hole, a mask is **dilated** before filling so foreground
remnants don't bleed in, and a transformer inpaints whatever propagation
could not cover. It needs model weights, a GPU-class runtime, and minutes per
clip. None of that can run inside OmniFrame's browser editor today, and
OmniFrame does not claim otherwise anywhere in the UI.

## What OmniFrame already had (temporal donor inpaint)

`analyzeRotoInpaint` / `applyRotoInpaint` in `src/store/rotoMask.ts` with
`inpaintMaskedHoleWithDonor` / `inpaintMaskedHole` in
`src/lib/rotoMaskEngine.ts`:

1. Track or segment a mask across the clip.
2. **Analyze**: rank every other frame as a donor by (a) low mask overlap with
   the target frame (the occluder has moved away) and (b) patch-match score
   around the hole. The user reviews the top donors before anything changes.
3. **Apply**: composite the chosen donor's pixels into each target frame's
   hole, feathered; fall back to spatial (single-frame) inpaint when no donor
   is clean enough (overlap ≥ 0.38).

## What this study added (propagation upgrade)

Mapped one-to-one onto ProPainter's pipeline stages, using only operations
that run in real time in a browser:

| ProPainter stage | OmniFrame equivalent |
| --- | --- |
| Mask dilation before fill | `dilateMaskBitmap` (separable max-filter) in `src/lib/rotoBrush.ts`; applied to every target mask before filling. UI: **Mask grow** slider, 0–24 px, default 4. |
| RAFT flow-guided pixel propagation | Donor pixels are shifted by the **mask-centroid delta** between donor and target frames (`maskCentroid`) — a cheap flow proxy that aligns the propagated region before compositing. Full RAFT flow is *not* claimed. |
| Propagation window / direction | Donor ranking can be restricted to earlier frames, later frames, or both, and to a ±N-frame window (0 = whole clip). UI: **Donor search** select + **Donor window** slider. |
| Transformer inpainting of leftovers | Spatial inpaint fallback (`inpaintMaskedHole`) — a classical fill, not a neural model. UI copy says exactly this. |

Controls live in RotoMask → Analyze & Inpaint → Propagation
(`data-testid="roto-inpaint-propagation"`), persist in
`RotoInpaintState { maskGrow, donorDirection, donorWindow }`, and are covered
by `qa/inpaint-propagation-e2e.mjs` and `qa/temporal-inpaint-e2e.mjs`.

## Honest limits

- Centroid shift aligns translation only; rotation, scale and non-rigid
  motion are not compensated. Bad alignment shows up as a soft patch — the
  per-frame spatial fallback and donor review exist for exactly that case.
- No neural inpainting runs in the browser build. If a future desktop build
  ships a real flow model, it should slot in behind the same
  analyze → review → apply contract.
