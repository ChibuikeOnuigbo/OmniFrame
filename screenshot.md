# OmniFrame Master Screenshot Inventory (`screenshot.md`)

This register tracks all full-frame screenshots and visual captures validating OmniFrame's architectural subsystems, viewport responsivity, rendering engine, timeline interactions, and transitions.

| ID | File Path | Resolution | Subsystem / Feature | Description |
|---|---|---|---|---|
| SS-001 | `evidence/timeline/omniframe-timeline-full-stack.png` | 1440x900 | Timeline & Tracks | Full timeline stack with multiple video tracks (V1, V2), clips, adaptive ruler, and active playhead. |
| SS-002 | `evidence/timeline/omniframe-transition-context-menu.png` | 1440x900 | Transition System | Active context menu over a first-class transition block, displaying presets (Dissolve, Dip Black, Dip White, Wipe, Slide, Zoom). |
| SS-003 | `qa/screenshots/landing-1440x900.png` | 1440x900 | Landing Page | Desktop landing page with hero CTA, project initialization, and template selectors. |
| SS-004 | `qa/screenshots/landing-360x800.png` | 360x800 | Landing Page | Mobile landing page viewport test. |
| SS-005 | `qa/screenshots/landing-transition.png` | 1440x900 | Landing Transition | Transition animation from landing screen into studio workspace. |
| SS-006 | `qa/screenshots/media-library-all-types.png` | 1440x900 | Media Ingestion | Media library panel displaying ingested video, audio, and image assets. |
| SS-007 | `qa/screenshots/media-library-audio-filter.png` | 1440x900 | Media Ingestion | Media library filtered exclusively by audio MIME types. |
| SS-008 | `qa/screenshots/media-library-compact-768x720.png` | 768x720 | Media Ingestion | Compact tablet viewport test for media asset cards. |
| SS-009 | `qa/screenshots/media-library-empty-search.png` | 1440x900 | Media Ingestion | Empty search state handling in media dock. |
| SS-010 | `qa/screenshots/media-library-narrow-900x700.png` | 900x700 | Media Ingestion | Narrow window media panel layout. |
| SS-011 | `qa/screenshots/media-library-search-filter.png` | 1440x900 | Media Ingestion | Active search query filtering media items. |
| SS-012 | `qa/screenshots/media-library-search.png` | 1440x900 | Media Ingestion | Media dock search bar interaction. |
| SS-013 | `qa/screenshots/media-library-wide-1920x1080.png` | 1920x1080 | Media Ingestion | Ultra-wide / 1080p full workspace media dock layout. |
| SS-014 | `qa/screenshots/settings-popup-accessibility.png` | 1440x900 | Settings & Preferences | Settings modal with keyboard navigation and accessible tabs. |
| SS-015 | `qa/screenshots/stress-01-empty.png` | 1440x900 | Studio Stress Suite | Fresh empty studio session prior to media ingestion. |
| SS-016 | `qa/screenshots/stress-02-video-image-audio.png` | 1440x900 | Studio Stress Suite | Timeline populated with mixed media types (video, image, audio). |
| SS-017 | `qa/screenshots/stress-03-playback-paused.png` | 1440x900 | Studio Stress Suite | Playhead paused at frame position with preview frame synchronization. |
| SS-018 | `qa/screenshots/stress-04-image-moved.png` | 1440x900 | Studio Stress Suite | Image clip repositioned along the temporal timeline track. |
| SS-019 | `qa/screenshots/stress-05-video-trimmed.png` | 1440x900 | Studio Stress Suite | Video clip trimmed using edge trim handles. |
| SS-020 | `qa/screenshots/stress-06-split.png` | 1440x900 | Studio Stress Suite | Razor split tool dividing clip into contiguous segments. |
| SS-021 | `qa/screenshots/stress-07-frame-mode.png` | 1440x900 | Studio Stress Suite | Continuous zoom ruler switched into high-density frame mode. |
| SS-022 | `qa/screenshots/stress-08-preview-200-panned.png` | 1440x900 | Canvas Preview | 200% canvas zoom with 2D pan offset. |
| SS-023 | `qa/screenshots/stress-08-preview-zoom.png` | 1440x900 | Canvas Preview | Canvas zoom fit and magnification controls. |
| SS-024 | `qa/screenshots/stress-09-panels.png` | 1440x900 | Workspace Layout | Dockable panels toggle and collapse states. |
| SS-025 | `qa/screenshots/stress-10-exported.png` | 1440x900 | Video Pipeline | Export confirmation dialog and status toast. |
| SS-026 | `qa/screenshots/studio-context-menu-desktop.png` | 1440x900 | Context System | Centralized context menu invocation on desktop viewport. |
| SS-027 | `qa/screenshots/studio-context-menu-mobile-390x844.png` | 390x844 | Context System | Long-press / right-click context menu on mobile viewport. |
| SS-028 | `qa/screenshots/timeline-clip-context-menu.png` | 1440x900 | Timeline Context | Clip contextual actions (Cut, Copy, Duplicate, Split, Extract Audio). |
| SS-029 | `qa/screenshots/timeline-hidden-clip-context-menu.png` | 1440x900 | Timeline Context | Clip contextual actions showing 'Unhide Clip' toggle. |
| SS-030 | `qa/screenshots/audio-waveform-volume-25.png` | 1440x900 | Audio Subsystem | Audio clip rendered with real audio waveform peaks at 25% gain. |
| SS-031 | `evidence/drawing/omniframe-drawing-active-mode.png` | 1440x900 | Drawing Subsystem | Active drawing mode with floating tool palette, left dock paint panel, multiple paint layers, and canvas vector strokes (brush, boxes, arrows). |
| SS-032 | `evidence/drawing/omniframe-hair-recolor-active.png` | 1440x900 | Drawing Subsystem | Feature-Slice 03: Contiguous flood fill & hair recolor workflow with blue `#3b82f6` fill, luminance/shading preservation, active floating toolbar, left dock blend mode controls, and timeline clip. |
| SS-033 | `evidence/drawing/omniframe-onion-skin-active.png` | 1440x900 | Drawing Subsystem | Feature-Slice 02: Multi-frame cel animation & onion skinning workflow with active cel frame indicator (F#0), step prev/next buttons, hold exposure selector (2f on twos), onion skin ghost rendering, and timeline. |
| SS-034 | `evidence/drawing/omniframe-layout-manager-active.png` | 1440x900 | Layout & Workspace | Layout Manager Modal active, showing Built-in Presets with `WorkspaceSchematic` mini geometric cards, Custom Workspaces tab, Focus Modes tab, and Reset Layout to Default. |
| SS-035 | `evidence/drawing/omniframe-selection-marching-ants.png` | 1440x900 | Drawing Subsystem | Feature-Slice 04: Selection Family & Mask Conversion showing Rectangular Marquee tool active, animated dual-phase black/white marching ants boundary overlay, and floating toolbar selection pill with "To Mask", "Invert", and "Deselect". |
| SS-036 | `evidence/rebuild/omniframe-source-monitor-active.png` | 1440x900 | Media & Preview Subsystem | Dedicated Source Monitor active previewing ingested media asset in isolation with dedicated playback controls, frame stepping, scrubbing bar, and zero unintended timeline insertion (Invariant I-10). |
| SS-037 | `evidence/rebuild/omniframe-master-rebuild-full.png` | 1440x900 | Master Rebuild Architecture | Full OmniFrame Master Rebuild studio stack showing authoritative 9:16 portrait sequence settings, compact bottom-right aspect ratio selector, non-overlapping clips with ripple push resolution, and rendered text title clip. |
| SS-038 | `qa/screenshots/voice-isolation-sidebar-panel.png` | 1440x900 | Voice Isolation Subsystem | LeftDock Voice Isolation drawer panel active with Keep Vocal / Remove Vocal toggles, strength slider, bass preservation switch, and speech formant focus. |
| SS-039 | `qa/screenshots/voice-isolation-context-menu.png` | 1440x900 | Voice Isolation Subsystem | Clip context menu showing lightweight Isolate Voice… dialog launcher and quick-action commands (Keep Vocal, Remove Vocal) for audio clips. |
| SS-040 | `qa/screenshots/voice-isolation-modal.png` | 1440x900 | Voice Isolation Subsystem | Dedicated Voice Isolation popup modal with clip selector, mode cards, fine-grained DSP controls, progress bar, and execution action. |
| SS-041 | `qa/screenshots/voice-isolation-timeline-tracks.png` | 1440x900 | Voice Isolation Subsystem | Timeline displaying newly extracted, synchronized audio tracks with calculated 256-bin RMS waveforms and media library asset registration. |
| SS-042 | `qa/screenshots/marker-dialog-active.png` | 1440x900 | Sequence Markers Subsystem | Edit Timeline Marker popup dialog with marker name input, timecode readout, span duration input, color badge selector (blue, green, red, yellow, purple, orange), comments/notes textarea, delete, and save actions. |
| SS-043 | `qa/screenshots/timeline-markers-and-vu-meter.png` | 1440x900 | Timeline & Audio Subsystem | Timeline ruler showing sequence marker flag pins and label pill ("Outro Fade"), transport bar displaying Add Marker button, real-time stereo audio VU meter with Left/Right LED channels, numerical dB readout, and master volume slider set to 125%. |
| SS-044 | `qa/screenshots/unified-desktop-suite.png` | 1440x900 | Unified Preview & Text Subsystem | Unified preview viewport rendering bold text title ("OMNIFRAME 2026 HERO"), cross dissolve cut transition, transitions dock panel, and clip inspector. |
| SS-045 | `qa/screenshots/mobile-full-studio.png` | 390x844 | Mobile Responsiveness | Full mobile studio view on iPhone viewport (390x844) with zero horizontal overflow, responsive preview scaling, compact top bar, and timeline transport. |
| SS-046 | `qa/screenshots/mobile-drawer-responsive.png` | 390x844 | Mobile Responsiveness | Slide-out overlay drawer on mobile viewport showing clean slide-in transition over preview without layout shifting. |
| SS-047 | `qa/screenshots/ratio-dropdown-actual-icons.png` | 1440x900 | Aspect Ratio Subsystem | Aspect Ratio popover and trigger button featuring actual platform icons, YouTube + TikTok stacked paper slide for 9:16, Instagram icons, and custom dimension controls without hyphens. |
| SS-048 | `evidence/screenshots/supreme-master-verification.png` | 1440x900 | Supreme Master Verification | Full studio desktop verification demonstrating Motion Tracking, Universal LinkSets & Arrange Linked Elements, 3D Camera Paint, Sequence Templates modal, and Drawing "Apply to All Frames" toggle. |
| SS-049 | `evidence/test_edit_composite.png` | 1280x720 | YouTube Reference Test Edit | Synthetic test edit composite visualizing kinetic typography with cyan glow, "3D in 2D" perspective plane with drop shadow, and neon cel drawing accents. |
| SS-050 | `evidence/screenshots/mobile-drawing-toolbar-responsive.png` | 390x844 | Mobile Drawing Toolbar | Mobile iPhone viewport (390x844) demonstrating responsive floating drawing toolbar with 374px bounded width, horizontal tool scrolling, compact titles, and zero page overflow. |
| SS-051 | `evidence/screenshots/blender-rotation-full.png` | 1440x900 | Blender Rotation Gizmo Verification | Full studio desktop viewport demonstrating Blender 3-axis rotation gizmo icons integrated in RightPanel Clip Inspector and ThreePanel Camera Controls Guide. |
| SS-052 | `evidence/screenshots/source-preview-fullscreen-bar.png` | 1440x900 | Source Preview & Transport | Dedicated Source Preview mode showing clean bottom-left details pill without '+ Add to Timeline' button and expanded full-width transport bar with enlarged touch targets. |
| SS-053 | `evidence/screenshots/media-specs-modal-verified.png` | 1440x900 | Media Library Technical Specs | Technical file metadata dialog launched from 3-dot button showing filename, format, duration, resolution, size, and decoder pipeline. |
| SS-054 | `evidence/screenshots/source-preview-oop-tracks-verified.png` | 1440x900 | OOP Timeline Architecture | Full studio desktop demonstrating CapCut-style 40% reduced text track (38px), text insertion at playhead, and sticky track headers with z-index above playhead. |
| SS-055 | `evidence/screenshots/three-d-video-plane-composite.png` | 1440x900 | 3D in 2D Compositing Viewport | 3D mode demonstrating 2.5D video plane with live sequence playback continuation, studio bezel, cyan rim light, floating 3D diamond, Blender rotation status readout, and HUD aim controls. |
| SS-056 | `evidence/screenshots/audio-inspector-checkbox-context.png` | 1440x900 | Audio Section & Context Dismissal | Clip Inspector Audio section with CapCut-style Voice Isolation checkbox, custom dropdown with Remove/Keep Vocal modes and omni-voicetarget model, and context menu outside click dismiss. |
| SS-057 | `evidence/screenshots/graph-editor-curves-verified.png` | 803x231 | Interactive Graph Editor Curves | Graph Editor showing Value Graph vs Speed Graph, animatable property channel tree, Bezier curve paths, draggable keyframe nodes and tangent handles, and easing presets bar (cubic-in, ease-in-out, back, bounce). |
| SS-058 | `evidence/screenshots/three-d-camera-keyframe-curves-verified.png` | 1440x900 | 3D Viewport & Keyframing Engine | Full studio desktop viewport demonstrating 3D camera navigation (WASD, orbit, pan, dolly), sequence aspect ratio safe frame synchronization (9:16 portrait), Blender modes toolbar (Object, Camera View, Texturing, Curves), 3D Wheel primitive with cubic-in rotation easing, and RightPanel keyframing diamonds. |
| SS-059 | `evidence/screenshots/omniframe-mode-drawing-mask-verified.png` | 1440x900 | OmniFrame Mode, Drawing Mode & Masking Architecture | Full studio desktop viewport demonstrating OmniFrame AI character segmentation on Death Note 5-character video, 3 propagation scopes (All Frames, Section of Frames, Only 1 Frame), Drawing "Add Directly to Video" toggle, Frame Attach Stepper & Presets, and LumaCut/Krita Mask & Selection Conversions. |





