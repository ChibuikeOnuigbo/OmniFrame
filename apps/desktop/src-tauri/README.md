# Tauri desktop shell boundary

The Tauri 2 shell invokes `omniframe-core` through audited commands for scoped project open/save, atomic `.vxproj` writes, recovery snapshots, media fingerprints/relink checks, FFmpeg capability probing and cooperative native-job cancellation. Arbitrary project strings are not passed to a shell.

The native shell is intentionally not marked fully verified until a Rust/Tauri/FFmpeg toolchain is available and Windows/macOS/Linux build checks run in CI. The browser workbench remains the same application in development and release.
