# Reference repository inventory

Generated from actual shallow, blob-filtered clones in `/tmp/omniframe-reference-lab` on 2026-09-22. No source was copied into OmniFrame. Clone trees are temporary and deliberately excluded from Git.

| Repository | Clone | Commit | License file | Relevant paths found |
|---|---|---|---|---|
| opencut | CLONED (1s) | `400f097becba` | `LICENSE` | .vscode/settings.json, apps/desktop/src/panels/timeline.rs, apps/web/.vscode/settings.json |
| opencut-classic | CLONED (0s) | `cf5e79e91914` | `LICENSE` | .vscode/settings.json, apps/web/src/actions/components/shortcuts-dialog.tsx, apps/web/src/actions/use-keyboard-shortcuts-help.ts, apps/web/src/commands/project/update-project-settings.ts |
| openreel-video | CLONED (1s) | `3be4be4a0ead` | `LICENSE` | .superpowers/brainstorm/46511-1779972049/content/timeline-visualization.html, apps/image/src/components/editor/KeyboardShortcutsPanel.tsx, apps/image/src/components/editor/SettingsDialog.tsx, apps/image/src/components/editor/canvas/Rulers.tsx |
| clypra | CLONED (1s) | `87c8d3d8af4a` | `LICENSE` | android/capacitor.settings.gradle, android/settings.gradle, docs/antigravity-timeline-toolbar-investigation.md, src/components/editor/properties/StickerSettingsSection.tsx |
| kdenlive | CLONED (0s) | `8d0333eb00ce` | `COPYING` | data/clipjobsettings.rc, data/effects/avfilter/avfilter_zoompan.xml, data/effects/pan_zoom.xml, data/shortcuts/CMakeLists.txt |
| shotcut | CLONED (1s) | `ce58962c93a2` | `COPYING` | elements/emojis/object/143-ruler.tgs, elements/emojis/object/144-triangular_ruler.tgs, icons/dark/32x32/zoom-fit-best.png, icons/dark/32x32/zoom-in.png |
| olive | CLONED (1s) | `7e0e94abf661` | `LICENSE` | app/dialog/preferences/CMakeLists.txt, app/dialog/preferences/keysequenceeditor.cpp, app/dialog/preferences/keysequenceeditor.h, app/dialog/preferences/preferences.cpp |
| losslesscut | CLONED (0s) | `20f2e34687a6` | `LICENSE` | .vscode/settings.json, src/renderer/src/Timeline.module.css, src/renderer/src/Timeline.tsx, src/renderer/src/TimelineSeg.tsx |
| openshot | CLONED (1s) | `9004af74b02c` | `COPYING` | doc/images/file-add-to-timeline.jpg, doc/images/preferences-1-general.jpg, doc/images/preferences-2-preview.jpg, doc/images/preferences-3-autosave.jpg |
| pitivi | CLONED (1s) | `fd4a0b3f899e` | `COPYING` | data/ui/elementsettingsdialog.ui, data/ui/pluginpreferencesrow.ui, data/ui/preferences.ui, data/ui/projectsettings.ui |
| flowblade | CLONED (1s) | `d7b911585809` | `LICENSE` | flowblade-trunk/Flowblade/res/darktheme/playback_settings.png, flowblade-trunk/Flowblade/res/darktheme/timeline_button.png, flowblade-trunk/Flowblade/res/darktheme/timeline_button_active.png, flowblade-trunk/Flowblade/res/darktheme/zoom_in.png |
| natron | CLONED (0s) | `3763d805d7d2` | `LICENSE.txt` | Documentation/source/devel/PythonReference/NatronEngine/AppSettings.rst, Documentation/source/devel/preferencesCallback.png, Documentation/source/devel/settingsPanelExpression.png, Documentation/source/devel/settingsPanelParamChangedCB.png |
| cinelerra-gg | CLONED (1s) | `2f5f5847bfee` | `cinelerra-5.1/COPYING` | CineRmt/settings.gradle, cinelerra-5.1/cinelerra/preferences.C, cinelerra-5.1/cinelerra/preferences.h, cinelerra-5.1/cinelerra/preferences.inc |
| vidcutter | CLONED (1s) | `db6818f11bbb` | `LICENSE` | vidcutter/images/dark/settings-active.png, vidcutter/images/dark/settings-disabled.png, vidcutter/images/dark/settings-hover.png, vidcutter/images/dark/settings.png |
| ai-video-editor | CLONED (1s) | `93f79bb05f9d` | `LICENSE.md` | client/src/components/MCPSettings.tsx, client/src/components/ProjectSettingsModal.tsx, client/src/components/SettingsModal.tsx, client/src/components/editor/__tests__/recordModalZoom.test.ts |
| synthcut | CLONED (0s) | `96b1ca0e8b99` | `LICENSE` | apps/desktop/src/timeline.tsx |
| clipforge | CLONED (1s) | `3332b6298be6` | `NOT_FOUND` | src/renderer/components/AISettings.tsx, src/renderer/components/Timeline.tsx, src/renderer/hooks/useKeyboardShortcuts.ts |
| react-browser-video-editor | CLONED (1s) | `123e0969a461` | `LICENSE` | src/components/Timeline.tsx |
| free-react-video-editor | CLONED (1s) | `458f24db0a3b` | `LICENSE.md` | none from filename scan |
| quik-clip | CLONED (0s) | `4e0ec6adb3aa` | `NOT_FOUND` | src/components/TimelineErrorBoundary.tsx, src/components/VideoTimeline.tsx, src/utils/__tests__/timelineValidation.test.ts, src/utils/timelineValidation.ts |
| remotion | CLONED (1s) | `fd087cbb9c63` | `LICENSE.md` | .vscode/settings.json, packages/brand/public/studio-timeline-avatar-strip.png, packages/brand/public/studio-timeline-filmstrip.png, packages/canvas/src/calculate-timeline.ts |

## Method and limitations
- `git clone --depth 1 --filter=blob:none --no-checkout` was executed for every repository. All 21 succeeded.
- Trees, manifests, license filenames, and timeline-related path names were inspected from each exact commit.
- Targeted source blobs were inspected in nine contrasting implementations; see `source-observations.txt`.
- Applications were not claimed runnable merely because cloning succeeded. Dependency installation and native launches were not performed across the corpus, so application execution is **SKIPPED**.
- The temporary clone lab is outside the production source tree as requested and can be removed without affecting OmniFrame.
