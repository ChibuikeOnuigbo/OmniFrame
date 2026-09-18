#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use omniframe_core::{atomic_write, fingerprint_file, read_project, validate_envelope, CancellationToken, NativeProjectEnvelope};
use serde::Serialize;
use std::{collections::HashMap, fs, path::PathBuf, process::Command, sync::Mutex};
use tauri::State;

const MAX_PROJECT_BYTES: usize = 256 * 1024 * 1024;

#[derive(Default)]
struct NativeJobs {
    tokens: Mutex<HashMap<String, CancellationToken>>,
}

#[derive(Debug, Serialize)]
struct NativeCapabilities {
    ffmpeg_available: bool,
    ffmpeg_version: Option<String>,
    native_core: bool,
    atomic_project_writes: bool,
    cancellable_jobs: bool,
}

#[tauri::command]
fn open_project(path: String) -> Result<serde_json::Value, String> {
    let (text, envelope) = read_project(PathBuf::from(&path), MAX_PROJECT_BYTES).map_err(|error| error.to_string())?;
    let project: serde_json::Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;
    Ok(serde_json::json!({ "path": path, "project": project, "envelope": envelope }))
}

#[tauri::command]
fn save_project(path: String, contents: String) -> Result<NativeProjectEnvelope, String> {
    let bytes = contents.as_bytes();
    let envelope = validate_envelope(bytes, MAX_PROJECT_BYTES).map_err(|error| error.to_string())?;
    atomic_write(PathBuf::from(path), bytes).map_err(|error| error.to_string())?;
    Ok(envelope)
}

#[tauri::command]
fn write_recovery(path: String, contents: String) -> Result<(), String> {
    if contents.len() > MAX_PROJECT_BYTES { return Err("recovery snapshot exceeds the configured project size limit".into()); }
    atomic_write(PathBuf::from(path), contents.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn fingerprint_media(path: String) -> Result<String, String> {
    fingerprint_file(PathBuf::from(path)).map_err(|error| error.to_string())
}

#[tauri::command]
fn relink_media(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(path).is_file())
}

#[tauri::command]
fn native_capabilities() -> NativeCapabilities {
    let version = Command::new("ffmpeg").arg("-version").output().ok().and_then(|output| {
        if !output.status.success() { return None; }
        String::from_utf8(output.stdout).ok()?.lines().next().map(str::to_owned)
    });
    NativeCapabilities {
        ffmpeg_available: version.is_some(),
        ffmpeg_version: version,
        native_core: true,
        atomic_project_writes: true,
        cancellable_jobs: true,
    }
}

/// Register a cooperative native job. The actual FFmpeg/CV worker adapters call this
/// boundary with a fixed, audited operation; arbitrary project strings are never passed
/// to a shell.
#[tauri::command]
fn register_job(id: String, state: State<'_, NativeJobs>) -> Result<(), String> {
    let mut jobs = state.tokens.lock().map_err(|_| "native job registry is unavailable")?;
    jobs.insert(id, CancellationToken::default());
    Ok(())
}

#[tauri::command]
fn cancel_job(id: String, state: State<'_, NativeJobs>) -> Result<bool, String> {
    let mut jobs = state.tokens.lock().map_err(|_| "native job registry is unavailable")?;
    if let Some(token) = jobs.remove(&id) { token.cancel(); return Ok(true); }
    Ok(false)
}

fn main() {
    tauri::Builder::default()
        .manage(NativeJobs::default())
        .invoke_handler(tauri::generate_handler![
            open_project,
            save_project,
            write_recovery,
            fingerprint_media,
            relink_media,
            native_capabilities,
            register_job,
            cancel_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OmniFrame desktop application");
}

#[allow(dead_code)]
fn _native_fs_smoke(path: &str) -> Result<usize, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(bytes.len())
}
