# Hide Clip and Settings focused verification

Date: 2026-09-22

## Browser assertions

- Visible clip exposes **Hide Clip** with right-aligned `H` shortcut: PASS
- Context command toggles canonical clip `hidden` state: PASS
- Hidden timeline clip remains visible at computed opacity `0.4`: PASS
- Hidden clip hover produces violet edge glow: PASS
- Hidden clip context changes to **Unhide Clip**: PASS
- `H` toggles the selected clip while the editor, not an input, owns focus: PASS
- Input and select ownership regressions remain passing: PASS
- Settings icon opens one compact popup: PASS
- Timeline, Shortcuts, and Accessibility categories present: PASS
- Shortcuts category documents Hide/Unhide: PASS
- Reduce Motion changes the root application class and persists in localStorage: PASS
- Escape closes Settings: PASS
- Full focused context/settings run: **39 PASS**, zero runtime errors.

## Render behavior

`activeClipOnTrack()` excludes hidden clips. Preview and export share `PreviewEngine`, so hidden visual/audio clips are omitted by the common rendering path. The timeline model retains the clip, waveform/filmstrip, trim data, and source association.

## Shortcut decision

Plain `H` was selected instead of a browser-modifier combination. It is captured only by the Studio shortcut handler when no input, textarea, or contenteditable surface owns focus. It avoids overriding browser history/reload/navigation shortcuts and uses the same semantic command in browser and desktop shells.
