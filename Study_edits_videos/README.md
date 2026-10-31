# Study_edits_videos — footage study + scene recreations

Everything produced by the frame-by-frame study of the Drive-zip footage and the
recreations it fed.

- `deep-study-1.md` … `-4.md` — 48 videos deep-passed on 18-frame contact
  sheets (uniform u00–u11 + scene cuts s1–s6); per scene: composition, effects,
  inferred speed curve; cross-video technique inventory (36 entries).
- `deep-sheets/` — the 48 deep contact sheets (`deep-<videoId>.jpg`).
- `recreations/` — recreation output notes; the live recreations themselves are the
  **Scene pillar** in OmniFrame (`src/lib/pillarRenderers.ts` `scene` family,
  catalogue in `src/lib/pillarPresets.ts`, 14 presets) plus the AE-scanned settings
  rack, particle/overlay/background-bed layers (`src/lib/particleFx.ts`).

## Recreation → source video map
| OmniFrame preset / tool | watched source |
| --- | --- |
| Scene: Comp-Light Relight | M2_vjAseOns |
| Scene: CRT Emulator Blotch | RktZGRjji5g |
| Scene: Magna Split Proof | jlDIX3Ky-hs |
| Scene: Line Draw-On Split | kZskcvTkAjs |
| Scene: Manga Rim-Glow Pulse | khjRWWTYZcc |
| Scene: Mosaic Pixel Shift | jlDIX3Ky-hs |
| Scene: Roto Polygon Hero | pztANrbFI3w |
| Scene: Rounded TV Mask | AsHnacGDo6E |
| Scene: Slit-Scan Halftone | Z8EAr0p6X14 |
| Scene: Fisheye Circle Sting | WC1tT1B5o_w |
| Scene: Spotlight Typo Stage | BP4xGE9iUtU |
| Scene: Neon Arc CTA Sting | jZiwWHV7M54 |
| Scene: Logo Cloud Over Art | YOCiH8zHGic |
| Scene: Grade Compare Rhythm | GP-dx6ruQQA / -SZcpYq49v8 |
| Particles (feathers/embers/dust/bokeh/sparkles/snow/rain/petals) | overlay & particle beds across the corpus |
| Overlays (scanlines/halftone/spotlight/vignette/lightleak/frameglow) | AsHnacGDo6E, Z8EAr0p6X14, BP4xGE9iUtU |
| Background beds (synthwave/aurora/grid/bokeh/sunset/studio) | "replace bg with a cool one" composite beats |
| AE Tool Rack combos | settings popups scanned in all three passes |
| Scene: X-Slash Speed Graph | chIJCGNoGls |
| Scene: 3D Thumbnail Wall | LqfUhkr2vcc |
| Scene: Cut-Out Checker Proof | YHJUoaPcyqg |
| Scene: Material Sphere Row | eB10bFHlz7Y / 2AuOLEmEAkU |

## Products (MP4 exports)

- `exports/<id>.mp4` — one 2s 640×360@24fps recreation clip per watched tutorial
  (245 clips), rendered headlessly by `tools/render-study-mp4s.mjs` through the
  REAL renderer code (pillarRenderers + particleFx). Each clip is captioned with
  its video id + technique = "the steps".
- `exports/ALL_STEPS_COMBINED.mp4` — every clip concatenated (~8 min master reel).
- `exports/manifest.json` — id → style/particle/overlay/bg recipe map.
- MP4s stay OUT of git (`.gitignore`); regenerate with
  `node tools/render-study-mp4s.mjs` (needs @napi-rs/canvas + imageio-ffmpeg).

## Chat-history links (WhatsApp zip)

- `chat-history/links.json` — 105 YouTube ids + 38 reddit links harvested from
  "WhatsApp Chat with @GameOver1089.zip" (Drive folder 1q0uf6vGTdsMl08Eoc16QTFiGgO1iTc7t).
  The YouTube ids are merged into the audit inventory and fetched/watched via the
  runner lane; reddit post text is collected by the runner into
  `youtube-audit/runner/reddit/*.json`.
