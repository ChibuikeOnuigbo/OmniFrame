# Adjustments, LUTs and reference study

**Research date:** 2026-10-10  
**Implementation note:** OmniFrame's bundled looks are clean-room transforms authored in `scripts/generate_builtin_luts.py`. No upstream source, paid project, overlay pack, or third-party `.cube` file was copied into this repository.

## Product behavior to carry forward

- A **clip grade** is stored on the selected visual clip. A regular video/image/text clip is affected by its own grade; a compound clip's grade is scoped to that compound's rendered output.
- An **adjustment layer** is an ordinary, trim-able timeline clip. The compositor applies it to content already drawn below its track. It is inserted immediately above selected footage (or the lowest active footage at the playhead), so higher title/overlay tracks remain untouched.
- Opening a compound clip and adding an adjustment layer there scopes the adjustment to that nested sequence. Selecting the compound in its parent sequence and adding a LUT scopes the grade to the compound as a whole.
- The left-side **LUTs & Adjustments** panel separates the LUT gallery, timeline layers and selected-clip controls. Its persistent rail badge reads **LUT**, and its panel header uses the full workflow name. The right inspector exposes placed effects; timeline selection restores the colored selection border and the layer's effect badge.
- Each 3D LUT uses a standard `.cube` file; uploaded LUTs are validated and can be stacked, toggled and intensity-adjusted. The bundled catalog contains **exactly 25** looks in five groups.
- Adjustment layers support optional ellipse/rectangle mattes with position, size, feather and inversion controls. A `.cube` itself remains a full-frame color transform; the separate adjustment matte limits where the layer is composited.

## Priority references

### FilmCraft — color grading and NLE workflow

[FilmCraft repository](https://github.com/storytold/filmcraft) · [ArtCraft app page](https://getartcraft.com/apps/filmcraft)

The README describes a clean-room Premiere-style NLE and a color workflow ordered as Basic Correction, Creative looks with strength, Curves, Color Wheels, HSL Secondary and Vignette. It also calls out per-clip Effect Controls/keyframes and a compositor designed to blend in linear light. The useful product lesson for OmniFrame is to keep clip-scoped controls, reusable looks, effect stacks and adjustment layers distinct, and to expose scope clearly in the inspector. We referenced the public descriptions only; we did not copy FilmCraft code or assets.

### EffectCraft — composition and effect-stack workflow

[EffectCraft repository](https://github.com/storytold/effectcraft) · [ArtCraft app page](https://getartcraft.com/apps/effectcraft)

EffectCraft describes a layer-based composition editor with keyframes, effect controls, reusable presets and a large categorized effect catalog. That layer-first mental model informed the timeline-clip representation and selection/inspector loop here. The repository metadata lists Apache-2.0 while its README advertises MIT OR Apache-2.0; check the source repository's current license files before any future reuse. OmniFrame uses no copied source or bundled EffectCraft assets.

### ArtCraft apps

[ArtCraft app lineup](https://getartcraft.com/apps) lists seven open-source creative tools, including FilmCraft and EffectCraft, and presents a shared emphasis on familiar professional workflows and local project files. It is a product reference, not a dependency.

## Additional editor and workflow references

| Reference | Public project description / lesson used |
|---|---|
| [WeftCut](https://github.com/WeftCut/WeftCut) | MIT video editor with local editing and an MCP/command surface; useful reminder that editor actions should be explicit and testable. |
| [Vibe Editing](https://github.com/davidcervinka/vibe-editing) | MIT workflow/method repository rather than a full NLE; its technique notes mention ASC-CDL-style grading and repeatable presets. |
| [KinoCut](https://github.com/KyaniteLabs/kinocut) | Apache-2.0 guardrailed video-editing tools for agents; useful for constraining edits to explicit targets. |
| [Timeline Studio](https://github.com/chatman-media/timeline-studio) | MIT Tauri/TypeScript editor with feature-oriented UI and a plugin model; useful as an architecture comparison. |
| [Open-source editor audit](../.audit/video-editors/reference-inventory.md) | Existing local audit of 21 additional projects, including Kdenlive, Shotcut, Olive, Natron and OpenReel. It records clone/license/source-path checks and explicitly marks broad application builds as not run. |

These are reference notes, not a claim that every repository was installed or executed. No upstream implementation was copied.

## User-supplied video links

The page metadata and any transcript surfaced by the available YouTube page reader were checked for all nine links. This environment did not provide playable video frames, so the LUT pack is **not** represented as a frame-by-frame extraction or an exact recreation of those edits. Several descriptions also link to paid project files or editing packs; those were not used.

| Video | Public page information observed |
|---|---|
| [HONORED ONE (4K) +PF](https://www.youtube.com/watch?v=qiemHpPOm9A) | Montori; Jujutsu Kaisen edit; After Effects/Blender; project-file link is paid. |
| [VFX BREAKDOWN 3 (After Effects)](https://www.youtube.com/watch?v=9ft_Q5oWNAw) | Montori; Death Note breakdown; 2:18; description links to a paid project. |
| [I Spent 400+ Hours to Make this Subaru Edit](https://www.youtube.com/watch?v=u7UuDpbB1zE) | Unique.; Re:Zero; 1:21; description links to a project file. |
| [TOJI FUSHIGURO - TESLA](https://www.youtube.com/watch?v=CJuhp9_Rh1M) | ZIKOVAZ; Jujutsu Kaisen; 0:38. |
| [This Edit took Me WAY too Long - Blitz](https://www.youtube.com/watch?v=oKV9S4fisR0) | cursedamv; Gojo/Jujutsu Kaisen; 1:17. |
| [This Was Supposed to Be a Simple Toji Edit](https://www.youtube.com/watch?v=8wfPiML9tsc) | Vizzae; Jujutsu Kaisen; After Effects; 0:38. |
| [Toji Edit But it Took Me WAY too Long to Make](https://www.youtube.com/watch?v=_iBFhb1RDDs) | Molob; Jujutsu Kaisen; 0:22. |
| [Sukuna Edit But it Took Me WAY too Long to Make](https://www.youtube.com/watch?v=9ma0TLEtGrE) | SAGE; Jujutsu Kaisen; 0:25. |
| [I Spent 16+ Hours On Mobile For This Gojo Edit](https://www.youtube.com/watch?v=M5FBB7wCCfI) | arcxheart; Jujutsu Kaisen; Alight Motion/Node Video; 1:07. |

The 25 bundled looks cover clean, cinematic, graphic, vintage and atmospheric grades. The requested "about five per video" would imply about 45 source-specific looks; those should only be created after the actual frames or authorized project/media assets are available for visual review.

## Google Drive pack

The supplied [Drive folder](https://drive.google.com/drive/folders/1klR5Po2L1W3PwyYqZS5dCF1uiI84GioA) is now readable through the connected Google Drive app. Its top level contains `Overlays`, `SFX`, `Textures` and `read.txt`. The `Overlays` folder has eight categories—`electricity, rain`, `energy`, `Fire`, `Glass`, `particles`, `Shockwaves`, `Smoke` and `some stuff`—with 164 video files listed across them (25, 14, 25, 3, 12, 45, 15 and 25 respectively). `Textures` contains 20 image files. `SFX` was not inspected because it is outside the overlay request.

This is a multi-gigabyte source collection: some individual source videos exceed 1 GB. The repository has no standalone `public/overlays` pack to delete or replace, so existing `public/assets/death_note` and `public/assets/room` assets (used for character/scene compositing and masking) were deliberately left intact. The Drive inventory was not bulk-copied into the repository; the app's existing local Media Library can already import video/image files, but the current browser build has no Drive-backed picker. Importing the full pack needs a curated or external-storage strategy rather than committing the originals into Git.
