# OmniFrame desktop architecture decision

## Decision

OmniFrame desktop uses **Tauri 2 with a Rust native shell and the shared TypeScript/React editor frontend**. It does not use Python for latency-sensitive editing, playback, rendering, timeline interaction, or UI. C++ is not currently required.

This is the smallest coherent cross-platform path for this repository:

- React/TypeScript owns the editor workspace, timeline interaction, command routing, preview controls, and shared web/desktop UI.
- Rust owns desktop-native integration: application lifecycle, filesystem/project containers, native dialogs, global/native shortcuts where justified, process management, and future native media-engine bridges.
- Browser APIs continue to provide the current web preview/export implementation.
- A future heavy native media engine may be implemented in Rust, or Rust may call mature C/C++ libraries such as FFmpeg through audited bindings. Adding a second C++ application core now would duplicate state and command systems.
- Python is acceptable only for offline developer tooling, fixture generation, or analysis scripts. It must not become the production playback/render/UI engine.

## Shared semantic commands

Web and desktop should invoke the same project command IDs and canonical state transitions. Native shortcut registration must dispatch semantic commands into the shared frontend rather than duplicate clip mutations in Rust.

`clip.hideToggle` remains a clip-level command. Desktop packaging does not turn it into track visibility.

## Persistence direction

The shared editor now has a versioned `.omni` browser project bundle (schema v1): a ZIP manifest stores serializable editor state and embeds session media/object-URL bytes as SHA-256-checked resources. Opening it rehydrates those resources into fresh object URLs before applying state. The save/load contract is shared by the web and Tauri-hosted frontend; the native shell does not yet provide a separate transactional filesystem/project-directory adapter.

Undo/redo history and transient runtime jobs are intentionally excluded. Installed app-relative resources are not recopied into each project. `.omni` is OmniFrame's editable project format, not a Photoshop/Krita native writer or an external-format round trip. See [the detailed schema, limits, capability matrix, and checklist](OMNI-PROJECT-AND-EXPORTS.md).

## Current build blocker

The desktop source exists under `src-tauri/`, but this sandbox has no `rustc` or `cargo`. The exact `npm run tauri -- build` failure is preserved in `qa/reports/desktop-build-attempt.log`. Windows, macOS, and Linux package execution therefore remains SKIPPED until a Rust/Tauri toolchain and platform-specific WebView dependencies are available.
