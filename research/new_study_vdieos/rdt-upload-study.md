# Uploaded RDT reference study

The user supplied `RDT_20261027_092910.mp4` directly. The earlier Drive redirect denial remains true, but no longer blocks studying the finished edit. Source: `evidence_video/reala/source/RDT_20261027_092910.mp4`; SHA-256, file size and numeric scene-score candidates are in its sibling `analysis.json`. Probe: H.264, 360×640, 30 fps, 752 frames / 25.067 seconds, AAC stereo at 48 kHz.

## What was observed

Native frame 8.0 seconds measures a sharp center band at approximately x=0–360, y=219–421. The portrait background is an enlarged blurred moving duplicate. Cyan highlights and violet/navy shadows dominate. Lyric words appear centered over the sharp band, changing scale and color. Some frames contain inset imagery, tilted or repeated compositions, white flashes and RGB/scanline tears.

The contact sheets `rdt-contact-sheet.png` (0–11.5 s), `rdt-middle.png` (8–16.5 s) and `rdt-ending.png` (17–25 s) were visually inspected. They sample at 2 fps, so brief transitions and single-frame details are not fully reviewed. The ranges below are approximate visual groupings, not certified exact edit points.

| Approximate range | Observed composition / timing requirements |
|---|---|
| 0–7 s | Pink-haired masked character and blond camera character; rapid scene/lyric changes, occasional inset framing, tears and flashes. Words visible in samples include GIVE, ME, HALLMARK, DREAM, ONE and LOVER. |
| 7–9.5 s | Cyan outdoor city shot, pink-haired character; PAINT / HAPPY words and central lyric placement. |
| 9.5–11 s | Angled/repeated overhead imagery with BLUE, followed by a tighter character view. |
| 11–12.5 s | Face/hand detail within a smaller central inset; purple outer blur. |
| 12.5–15.5 s | Blond camera character facing the masked character; NORMAN / ROCKWELL word changes. |
| 15.5–18.5 s | Diagonal/glitch disruption, camera action and low-angle shot; UNDER / COVERS appears in later samples. |
| 18.5–21 s | Camera close-up and wider group composition; center band remains the main readable area. |
| 21–25.067 s | Camera LCD close-up with smaller lyric text; gradual fade to black at the end. |

FFmpeg scene score >0.22 generates candidate timestamps in `analysis.json`. A score can indicate a cut, flash or glitch; candidates are not promoted to verified boundaries. No separate anime source scenes were identified in the local footage search. The soundtrack was decoded and numerically compared, not listened to or transcribed.

## Concrete editor output and remaining gap

`qa/render-rdt-reference.mjs` uses the established universal tools to build two video layers: a slightly enlarged, blurred and dimmed background plus a sharp central rectangle matte. The background supplies original audio; the foreground is muted. Source cuts, typography and transitions remain in both imported layers as baked pixels. The saved tool trace permits replay; it is not a native `.omni` project archive.

Output: `evidence_video/reala/normal edit/RDT_recopy.mp4`, 752 frames, 750 distinct decoded frame hashes, original audio correlation 0.99736. This is reference-derived recomposition, not an independently recreated edit. Separate original clips and clean effect-free plates are needed to rebuild the source timing, text and glitches as independently editable layers. The old Board S still-portrait scripts do not satisfy that requirement.

The generic export fix is independently tested with synthesized moving footage and chirped audio: source offset/delay correlation 0.99873, measured quarter gain 0.24995, relative overlap error 0.00235, exact leading/trailing silence, mute produces no audio stream, and source-offset pixels agree in fast and masked compositor paths.
