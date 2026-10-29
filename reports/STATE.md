# OmniFrame STATE — Board T cont.3 (2026-10-29)

Baseline audited: f6d0128 (pack baseline match). Packs unpacked earlier at
new_doc_toll_research/packs/ (glitch-audit + repair-pack); that dir is
gitignored and was wiped by a sandbox rollback — re-download ids are logged in
session memory; all pack-derived CODE is committed in-repo (glitchNG,
CurveEngine, curves.py port). Videos kept OUT of git.

## Completed
- Curve engine (repair-pack canonical math) — unchanged, still PASS 35 families
  (qa/curve-sim.mjs re-run green this increment).
- Glitch NG engine + catalog + 12 logo-layer renders + sampler — unchanged,
  battery re-run green on the new render pipeline (new_glitch/renders/).
- WONDERFUL acceptance proof (master prompt P0, correctly spelled): ONE text
  clip, 10 s, 720×1280@24 + 360×640@30 exports; 9 per-char color ranges with
  SUCCESSIVE color changes on mixed curve families (bounce-param, rebound-out,
  physical, ease-in-out, bounce, rebound-in, elastic, bounce-uniform, back-out)
  + per-char fontSize pulses + opacity shimmer + whole-word tracking widen
  (rebound-in) + clip drift/scale/rotation springs; REAL moving Drive footage
  (roses pelats.mp4) masked inside the glyphs (insideVideo + insideBaseAlpha
  0.6, tinted base on top for legibility) over the anime scene plate with slow
  zoom. Evidence: test_ans_result/board_T_WONDERFUL_720p24.mp4 /
  _360p30.mp4, evidence/T-WONDERFUL-sheet.png (1 s steps), T-WONDERFUL-f132/
  f192.png full-res frames, T-timeline-WONDERFUL.png timeline screenshot,
  wonderful.project.json schema dump. Frame-aligned, not a static image.
- Headless per-char text stack re-landed (was lost in rollback #4, now
  committed incl. tools/): paintTextRuns in CreateText draw, charStyle
  keyframe channels, charMetrics response, ImportVideo tool + insideVideo.
- Memory-stable headless render pipeline (measured, then fixed): getImageData/
  createImageData leak ~4 MB/frame of NATIVE memory in @napi-rs/canvas 1.0.13
  (unreclaimable even with --expose-gc global.gc); over-sized layer scratch
  downscale blit rebuilt ~8 MB Skia mipmap/frame. Fixes: VideoEncoder pipes PNG
  frames into ffmpeg stdin; direct-draw fast path for fx-free clips; exact-size
  fx layers (timecode burn-in visibility regression caught + fixed by QA);
  pooled compound pad; grow-only textRuns scratch. 720p×240-frame exports now
  flat ~200-400 MB (was OOM-kill at ~24 frames).
- New Glitch batch queue slice 1: qa/newglitch-batch.mjs (resumable via
  new_glitch/batch/checkpoint.json) rendered recipes 13-100 through the real
  Glitch NG effect graph at recipe duration (envelope fractions × duration —
  measured: kernel takes seconds); perceptual dedupe 96×30 centre-crop 3-frame
  grayscale MAD < 0.6/255 (calibrated: same-video 0.0, cross-family 1.5-3.1):
  53 kept mp4 + batch-manifest.md (links + sha256:16) + combined review reel
  new_glitch/batch_reel.mp4; 35 honest dup-skips, 0 failed.
- Roto/mask accuracy MEASURED (master prompt P0: benchmark before rewrite):
  reports/roto-benchmark.{md,json} — roto polygon 64 pts mean edge err 0.63 px
  (max 1.5), IoU 0.9924 vs analytic circle; mask_draw ellipse 0.59 px / 0.9923;
  shape_detect class=circle centre/radius err 0 px, fill−π/4 = −0.001.
  Verdict: no rewrite warranted. Flagged for calibration: feather control
  coarse/non-linear (any small feather ⇒ ~60-70 px 10→90% band).
- QA: UNIVERSAL TOOLS QA PASS (63 universal steps, 59 tools, omniframe law ok,
  data:img dumps ok); tsc --noEmit clean.

## Partial
- Batch queue: 100/5000 recipes queued next (checkpoint ready); user
  keep/delete/improve rating pending on batch_reel.mp4.
- insideVideo in BROWSER playback: guarded/partial (headless complete).
- Headless has no project_save tool: .omni package export = honest
  wonderful.project.json schema dump, not a store-produced file.
- Glitch Effect Graph node UI (material inspector) still pending.

## Failed / blocked
- Desktop Tauri installer evidence: BLOCKED (no Rust toolchain in sandbox).
- ≥80% visual similarity to HGH reference: NOT MEASURED (no declared metric;
  original copyright-safe logo used).
- UI workspace rebuild (BrandBird/CapCut refs): not started this increment.

## Preservation
- No source/user media deleted; .cache/, google_drive/ downloads and packs
  stay OUT of git (gitignored); batch sidecar traces kept beside kept mp4s only.
