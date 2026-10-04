// OmniFrame desktop shell — native layer for the Tauri 2 build.
//
// The web editor (src/) is the product. This crate is the thin native shell
// that packages it as a desktop application and exposes the small set of
// OS-level capabilities the editor needs. Keep this layer minimal on purpose:
// anything that can run as portable web code lives in src/lib instead.

use serde::Serialize;

#[derive(Serialize)]
pub struct DesktopInfo {
    /// Host operating system ("linux" | "macos" | "windows").
    pub os: &'static str,
    /// CPU architecture ("x86_64" | "aarch64" | ...).
    pub arch: &'static str,
    /// Desktop shell version (from Cargo.toml).
    pub app_version: &'static str,
    /// Whether the main window is currently fullscreen.
    pub fullscreen: bool,
}

/// Reports native environment info for the in-app "Desktop" badge.
#[tauri::command]
fn omniframe_desktop_info(window: tauri::Window) -> Result<DesktopInfo, String> {
    let fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    Ok(DesktopInfo {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        app_version: env!("CARGO_PKG_VERSION"),
        fullscreen,
    })
}

/// Toggles the main window between windowed and fullscreen.
/// Returns the resulting fullscreen state.
#[tauri::command]
fn omniframe_toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!fullscreen).map_err(|e| e.to_string())?;
    Ok(!fullscreen)
}

/// IPC round-trip health check for the desktop bridge (qa/desktop-e2e).
#[tauri::command]
fn omniframe_ping() -> &'static str {
    "pong"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            omniframe_ping,
            omniframe_desktop_info,
            omniframe_toggle_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running OmniFrame");
}
