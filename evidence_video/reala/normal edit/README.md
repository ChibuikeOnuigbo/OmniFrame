# RDT reference-derived recomposition

Open [RDT_recopy.mp4](RDT_recopy.mp4), [timeline](RDT-timeline.png), [tool trace](RDT_recopy.json), [manifest](manifest.json) and [source study](../../../research/new_study_vdieos/rdt-upload-study.md).

The user directly uploaded the exact finished edit after the ordinary Drive download redirected to a blocked host. Source bytes are preserved in `../source/`. The export uses universal editor tools, a blurred/dimmed/slightly enlarged reference background, and a sharp center-band matte on a second video layer. Only the first layer supplies audio, avoiding doubled sound.

This is **a reference-derived recomposition**, not a recreation from separate original anime scene clips. Its existing typography, cuts, glitches, grading and fades remain baked in. Those components are not independently editable. The two new video layers, background treatment and center matte are reproducible using `node qa/render-rdt-reference.mjs` and the saved universal-tool trace. Older Board S portrait/title demonstrations are not source-faithful RDT recreations.

Validation: 360×640, 30 fps, 25.067 seconds, 752 decoded frames, 750 distinct frame hashes; AAC stereo source audio retained with decoded waveform correlation 0.99736. These numerical checks verify motion/audio preservation, not aesthetic perfection or independent effect reconstruction. Contact sheets and previews were inspected as sampled frames; a listening review was not performed.

For an independent editable recreation, recover separate scene clips, clean effect-free plates and the original font/music/project or author replacement choices. The previous normal Drive redirect remains documented in `research/new_study_vdieos/rdt-download-retry.json`; it no longer means the finished reference is unavailable locally.
