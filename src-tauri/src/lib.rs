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

/// Native AI denoise: pipes a WAV through the Python sidecar
/// (scripts/python/denoise_onnx.py) running the omni-denoise-v1 ONNX model
/// with onnxruntime, so the desktop build uses the model directly instead of
/// the browser WASM path. stdin/stdout pipe — no temp files, no new crates.
#[tauri::command]
fn ai_denoise_wav(wav: Vec<u8>, strength: f64, app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    // Model ships as a bundled resource next to the app; fall back to the
    // repo checkout in dev mode.
    let model_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("models/omni-denoise-v1.onnx"))
        .filter(|p| p.exists())
        .or_else(|| {
            // dev: src-tauri/../public/models/...
            std::env::current_dir()
                .ok()
                .map(|d| d.join("../public/models/omni-denoise-v1.onnx"))
                .filter(|p| p.exists())
        })
        .ok_or_else(|| "omni-denoise-v1.onnx not found (resource or public/models)".to_string())?;

    let script = std::env::current_dir()
        .ok()
        .map(|d| d.join("scripts/python/denoise_onnx.py"))
        .filter(|p| p.exists())
        .or_else(|| {
            app.path()
                .resource_dir()
                .ok()
                .map(|d| d.join("scripts/denoise_onnx.py"))
                .filter(|p| p.exists())
        })
        .ok_or_else(|| "denoise_onnx.py sidecar not found".to_string())?;

    let mut child = Command::new("python3")
        .arg(script)
        .arg("--model")
        .arg(&model_path)
        .arg("--strength")
        .arg(strength.clamp(0.25, 2.0).to_string())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn python3 sidecar: {e}"))?;

    child
        .stdin
        .as_mut()
        .ok_or("sidecar stdin unavailable")?
        .write_all(&wav)
        .map_err(|e| format!("sidecar write failed: {e}"))?;

    let out = child
        .wait_with_output()
        .map_err(|e| format!("sidecar wait failed: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "denoise sidecar failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(out.stdout)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            omniframe_ping,
            omniframe_desktop_info,
            omniframe_toggle_fullscreen,
            ai_denoise_wav
        ])
        .run(tauri::generate_context!())
        .expect("error while running OmniFrame");
}
