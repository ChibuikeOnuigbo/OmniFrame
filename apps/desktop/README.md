# OmniFrame Desktop

Tauri 2 entry point for Windows, macOS and Linux. The web workbench loads unchanged in the shell, while `apps/desktop/src-tauri/src/main.rs` exposes the native boundary for:

- validated `.vxproj` open and atomic save;
- recovery snapshot writes;
- media fingerprint/relink checks;
- runtime FFmpeg capability detection;
- cooperative native-job registration and cancellation.

The source is intentionally explicit about the native gate: Cargo/rustc and FFmpeg are not installed in this sandbox, so `cargo check`, Tauri development and platform bundles have not been claimed as verified. Install the toolchain before running:

```bash
npm run desktop:dev
npm run desktop:build
cargo check -p omniframe-core
```
