# OmniFrame review outputs

These files come from actual Blender/browser/shared-engine renders and universal-tool recipe calls. See [implementation and QA report](../reports/IMPLEMENTATION_20261031.md) and [recovered user-task questions](../docs/CODEX_TASK_RECOVERY.md) for scope and remaining work.

- [Twelve device transitions: combined video](device-transitions/combined-device-demo.mp4), [video manifest](device-transitions/manifest.json), [model previews](screenshots/device-model-contact-sheet.png), [motion contact sheet](screenshots/device-contact-sheet.png).
- New motions: [spin reveal](device-transitions/phone-spin-reveal.mp4), [barrel roll](device-transitions/phone-barrel-roll.mp4), [drop bounce](device-transitions/monitor-drop-bounce.mp4).
- [Five animated Glitch V2 demos](glitch-v2/combined-glitch-demo.mp4), [demo manifest](glitch-v2/demo-manifest.json), [contact sheet](screenshots/glitch-contact-sheet.png).
- [All-5,000 compositor diagnostic](glitch-v2/all-5000-compositor-diagnostic.mp4): one active frame per recipe, **not** 5,000 full-motion accepted videos.
- [A–J regenerated board contact sheet](recovered-boards/contact-sheet.png), [43-run machine report](recovered-boards/report.json), individual MP4s and timeline proofs in the board directories. [Before project-reset repair](recovered-boards/before-project-reset.png) shows how prior paint obscured subsequent renders.
- [Actual editor export 1](device-transitions/editor-export-1.mp4), [export 2](device-transitions/editor-export-2.mp4), [measured duration/audio](device-transitions/native-export-manifest.json).
- [Device inspector](screenshots/device-inspector.png), [glitch builder](screenshots/glitch-builder.png), [filled-heart drawing](screenshots/filled-heart-ui.png), [mobile context menu](popups/menu-390.png).
- [Live app MCP report](mcp/live-bridge-report.json), [timeline proof](mcp/live-timeline.png), [audio-strength measurements](audio/strength-report.json), [real meter measurements](audio/meter-report.json), [popup bounds](popups/report.json), [landing checks](landing/landing-results.json).

Board B now processes its target pixels, but donor seams/reflections remain: natural invisible object removal is not accepted. Board C's original instruction asks for 150 video edits and 15 speed curves; ten still-based archived variants are insufficient. Machine replay success and diagnostic hashes do not establish source fidelity, perceptual uniqueness or human approval.
