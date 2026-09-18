//! Native boundary for the OmniFrame Tauri shell.
//!
//! The portable TypeScript engine owns the frame-accurate data model. This crate owns
//! operations that need native resources: atomic project writes, bounded job handles,
//! file identity and capability probes. It never executes project-provided code or
//! downloaded shaders.

use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::{Path, PathBuf}, sync::{Arc, atomic::{AtomicBool, Ordering}}};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("project JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("project path has no parent directory")]
    MissingParent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeProjectEnvelope {
    pub format: String,
    #[serde(rename = "projectVersion")]
    pub project_version: u32,
    #[serde(rename = "savedAt")]
    pub saved_at: u64,
}

/// Write bytes to a sibling temporary file, flush/sync it, then atomically replace the
/// destination. The caller can use this for `.vxproj` JSON and recovery snapshots.
pub fn atomic_write(path: impl AsRef<Path>, bytes: &[u8]) -> Result<(), CoreError> {
    let path = path.as_ref();
    let parent = path.parent().ok_or(CoreError::MissingParent)?;
    fs::create_dir_all(parent)?;
    let temp = temp_path(path);
    let mut file = fs::File::create(&temp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    // On Windows rename does not replace an existing file. Remove only the known target,
    // never an arbitrary path, then complete the replacement.
    if cfg!(windows) && path.exists() { fs::remove_file(path)?; }
    fs::rename(&temp, path)?;
    Ok(())
}

fn temp_path(path: &Path) -> PathBuf {
    let name = path.file_name().and_then(|x| x.to_str()).unwrap_or("project.vxproj");
    path.with_file_name(format!(".{name}.omniframe-tmp"))
}

/// A cooperative cancellation token shared by native jobs and their Tauri commands.
#[derive(Clone, Default)]
pub struct CancellationToken(Arc<AtomicBool>);

impl CancellationToken {
    pub fn cancel(&self) { self.0.store(true, Ordering::Release); }
    pub fn is_cancelled(&self) -> bool { self.0.load(Ordering::Acquire) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeJobProgress {
    pub id: String,
    pub stage: String,
    pub done: u64,
    pub total: u64,
    pub elapsed_ms: u64,
}

/// Validate the small envelope before native code trusts a project file. Full schema
/// validation remains shared with the TypeScript project-format module.
pub fn validate_envelope(bytes: &[u8], max_bytes: usize) -> Result<NativeProjectEnvelope, CoreError> {
    if bytes.len() > max_bytes { return Err(CoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, "project exceeds configured size limit"))); }
    let envelope: NativeProjectEnvelope = serde_json::from_slice(bytes)?;
    if envelope.format != "omniframe.vxproj" { return Err(CoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, "unexpected project format"))); }
    Ok(envelope)
}

/// A stable, dependency-free content fingerprint for relink suggestions. It is not a
/// cryptographic signature; callers must still compare file size and, when required,
/// perform a cryptographic hash in a dedicated native adapter.
pub fn content_fingerprint(bytes: &[u8]) -> String {
    let mut hash: u64 = 14695981039346656037;
    for byte in bytes { hash ^= u64::from(*byte); hash = hash.wrapping_mul(1099511628211); }
    format!("fnv1a64:{hash:016x}:{}", bytes.len())
}

pub fn fingerprint_file(path: impl AsRef<Path>) -> Result<String, CoreError> {
    let bytes = fs::read(path)?;
    Ok(content_fingerprint(&bytes))
}

pub fn read_project(path: impl AsRef<Path>, max_bytes: usize) -> Result<(String, NativeProjectEnvelope), CoreError> {
    let bytes = fs::read(path)?;
    let envelope = validate_envelope(&bytes, max_bytes)?;
    let text = String::from_utf8(bytes).map_err(|error| CoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, error)))?;
    Ok((text, envelope))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_is_shared() {
        let a = CancellationToken::default();
        let b = a.clone();
        assert!(!b.is_cancelled());
        a.cancel();
        assert!(b.is_cancelled());
    }

    #[test]
    fn fingerprint_is_stable_and_includes_size() {
        assert_eq!(content_fingerprint(b"abc"), content_fingerprint(b"abc"));
        assert_ne!(content_fingerprint(b"abc"), content_fingerprint(b"abcd"));
    }
}
