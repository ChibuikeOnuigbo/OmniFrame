# UI explained — section by section (AI analysis of the REAL screenshots in this folder)

Method: the saved screenshots were passed to the AI vision pass (read_file on each file) and every
visible section is described below from what is actually on screen. File names are cited per section.
These are web-sourced product screenshots (sources in README.md), NOT emulator captures — the sandbox
cannot run an emulator (see README.md + setup-attempt.log). AI-generated explanation art for chat
viewing lives in `ai_explain/` and is NEVER used as app evidence.

## Toji Motion (AM-mod lineage) — `toji-ui-1.png`
1. **Store-header band** (outside the phone frame): marketing title "Blending Modes" + tagline — not app UI.
2. **App bar "Blending & Opacity"** with back arrow — the property sheet for the selected layer; OmniFrame equivalent: RightPanel "Effects/Appearance" sections.
3. **Preview viewport** (16:9, letterboxed): live composite of the selected layer with its blend applied (projected-dancer plate shown multiplied over dark bed). OmniFrame: Preview canvas.
4. **Transport row**: undo ↺ / redo ↻ / step-back |← / play ▶ / step-forward →| / loop-repeat / bookmark-add. OmniFrame: TopBar transport + markers (bookmarks).
5. **Ruler + playhead** at 00:00:24 with tick marks; the vertical playhead line continues through the lane. OmniFrame: Timeline ruler.
6. **Single clip lane**: eye toggle (visibility) at left, trim chevron ‹ at the bar head, cyan clip bar spanning the view. OmniFrame: track lane + eye (toggleClipHidden) + trim handles.
7. **Opacity slider row**: back arrow, dot-icon, green slider at 98%. OmniFrame: transform opacity slider.
8. **Blend family picker**: "Normal" header, then a collapsed/expanded family group "Darken" with horizontal thumbnail chips — Multiply (selected, green tick), Darken, Darker Color, Color Burn, Linear Bu(rn)… — live thumbnails per mode. OmniFrame: blendMode per clip (same families); chips = our HScrollStrip pattern.
9. **Left icon rail**: back, keyframe diamond (◆ add key at playhead), mask/shape glyph. OmniFrame: right-panel rail + ◆ keyframe buttons.

## Toji Motion — `toji-ui-3.png` ("Edit Points" / vector screen)
1. **App bar "Edit Points"** + two right chips: ◆ keyframe toggle and ⊕ add-point.
2. **Viewport with bézier point handles**: white circle handles around a black shape over a puzzle-photo plate; the selected handle is a green square — point-level vector editing.
3. **Transport row + ruler/playhead** identical to ui-1 (same shell).
4. **Clip lane "Shape 1"** (blue bar) with eye + effect-badge chip at left, trim chevrons both ends.
5. **Gesture pad**: "Swipe to move point" framed area — the point mover is a touchpad, not direct drag.
6. **Left tool rail**: back, rotate-points glyph, scale-points glyph, minus (delete point).
7. **Right value column**: vertical slider with square/round/square-green handles = the keyframed value track for the selected point property.
   OmniFrame parity: bézier strokes exist in the drawing engine (bezier tool) and custom mask points exist (roto/mask 'custom' kind); a dedicated point-editor PAD with per-point key columns = backlog (honest).

## Toji Motion — `toji-ui-2.png` / `toji-ui-4.webp`
Same shell family (project list / effect grids in the AM-mod skin): card lists of projects & effect packs;
used here only as skin reference (the mod re-skins AM's list screens).

## Gold Motion v7.0.4 — `gold-settings-1.png` (home + EXTRA menu)
1. **Status bar** 12:53 / 85% — device chrome.
2. **App bar**: hamburger (left), gold wordmark "Gold Motion" (centre), gold-coin badge (right, mod status/membership chip).
3. **Segmented pills**: Projects | **Elements** (active, dark pill) | Cloud — library scopes; Elements = saved reusable pieces (our "custom effects / packs" idea), Cloud = sync.
4. **"Your elements" header + "Sort by Date" dropdown** + element cards (thumbnail + duration chip 00:0… + ⋯ menu).
5. **"GOLD MOTION EXTRA" overlay menu** (the mod's added toolset): Upscale Quality, Project Doctor, Reverse, Twixtor, DFR (dead-frame remover), Audio Converter.
   OmniFrame parity, honestly: Reverse ✔ (reverse engine); Audio Converter ≈ extractAudio ✔ (partial); Upscale Quality = AI upscaling → logged, NOT implemented (AI mandate); Project Doctor / Twixtor (optical flow) / DFR = researched backlog.
6. **Bottom navigation**: Home, Tutorials, big ＋ FAB (new project), Projects, Templates. OmniFrame: Landing + TemplatePickerModal + new-composition flow.
7. **Floating gold  chip** (right edge): quick-close for the EXTRA overlay.

## Gold Motion — `gold-settings-2.png`
Duplicate of the same settings/EXTRA screen from a second mirror (fmmods.xyz) — kept to prove the
screens are consistent across sources (no fakery).

## Gold Motion / AM shell — `gold-effects-ref.webp` (multi-track timeline)
1. **Transport row**: undo/redo, step-back, play, step-forward, loop, transform-gizmo toggle.
2. **Timecode chip 00:02:24** riding the playhead line.
3. **Six stacked track lanes**, each with: eye toggle + name chip at left, ⋮/≡ track menu at right, and stair-stepped thumbnail clips (the classic Hancybox stair-step duplicate pattern).
4. **＋ FAB** bottom-right = add layer/track.
5. **Right column**: preview viewport over a mini timeline (phone-in-phone layout of the same UI).
   OmniFrame parity: tracks + eye + per-track menus + stair-step duplicates + FAB track creation all exist; thumbnail filmstrips exist (ClipFilmstrip).

## Crosswalk summary (honest)
| section seen | OmniFrame status |
|---|---|
| blend family picker w/ live thumbs | ✔ blendMode (chips pattern exists) |
| opacity slider / transport / ruler / eye toggles | ✔ all shipped |
| trim chevrons / stair-step lanes / + track FAB | ✔ shipped |
| ◆ keyframe rail + value column | ✔ CurveEngine + Graph Editor |
| vector Edit-Points pad w/ per-point keys | partial (bezier strokes + custom mask points ✔; pad UI = backlog) |
| Elements/Cloud library pills | partial (custom effects + packs ✔; cloud sync = backlog) |
| Reverse | ✔ reverse engine |
| Audio Converter | partial (extractAudio ✔) |
| Upscale Quality (AI) | ✖ logged only — AI mandate |
| Twixtor optical flow / DFR / Project Doctor | backlog (researched, not built) |
