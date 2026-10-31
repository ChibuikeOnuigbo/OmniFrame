# Textured 3D asset transition demos

[Watch the six-asset reel](six-asset-reel.mp4).

Order and individual MP4s:

1. [Knob CRT TV](device_tv_crt_knobs.mp4)
2. [Silver CRT TV](device_tv_crt_silver.mp4)
3. [Arrow Sweep](object_arrow_sweep.mp4)
4. [Bullet Shell Whip](object_shell_whip.mp4)
5. [Payphone Orbit](object_payphone_orbit.mp4)
6. [Concrete Shatter](object_concrete_shatter.mp4)

Each clip is an actual PreviewEngine/GLB render: 49 distinct frames, 640×360, 30 fps. The loaded input footage advances during every sequence. The outgoing card is original; incoming footage is the supplied finished RDT edit, whose existing effects are baked in.

[Native product MP4 export with sound](editor-export.mp4) — realtime software-GPU output; 19 VFR frames over 1.63075 seconds, measured audio RMS 0.06314. This is distinct from the fixed-rate offline sequence proofs.

[Manifest](manifest.json) · [Phone catalog](ui/library-320.png) · [Phone controls](ui/inspector-320.png) · [Desktop catalog](ui/library-1440.png) · [UI measurements](ui/measurements.json)

Latest UI screenshots in `ui/` supersede the initial demo-run catalog screenshot. Source models and materials have [credits](../../public/models/transition_assets/CREDITS.md); [implementation and limits](../../docs/EXTERNAL_TRANSITION_ASSETS_20261031.md) describe the exact source/conversion/render path. The fracture geometry is an original kinematic rig with a CC0 material; it is not a downloaded simulation. Sketchfab requires authentication and no model from it was downloaded.
