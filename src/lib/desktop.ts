/**
 * Desktop (Tauri) bridge.
 *
 * OmniFrame runs as a web app in the browser and as a native desktop app via
 * the Tauri 2 shell in src-tauri/. This module is the single seam between the
 * two: it detects the desktop runtime and exposes the handful of native
 * commands the Rust layer provides (see src-tauri/src/lib.rs).
 *
 * Every helper degrades gracefully in the browser — the web build never
 * imports native state.
 */

import { invoke } from '@tauri-apps/api/core'

export interface DesktopInfo {
  /** "linux" | "macos" | "windows" */
  os: string
  /** "x86_64" | "aarch64" | ... */
  arch: string
  /** Desktop shell version (src-tauri/Cargo.toml). */
  appVersion: string
  /** Whether the main window is currently fullscreen. */
  fullscreen: boolean
}

function tauriInternals(): unknown {
  return (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ?? null
}

/** True only when running inside the Tauri desktop shell (not a browser). */
export function isDesktopApp(): boolean {
  return tauriInternals() !== null
}

/** Native environment info for the in-app Desktop badge. Null in the browser. */
export async function getDesktopInfo(): Promise<DesktopInfo | null> {
  if (!isDesktopApp()) return null
  try {
    return (await invoke<DesktopInfo>('omniframe_desktop_info')) ?? null
  } catch {
    return null
  }
}

/**
 * Toggles the desktop window between windowed and fullscreen.
 * Returns the new fullscreen state, or null in the browser / on failure.
 */
export async function toggleDesktopFullscreen(): Promise<boolean | null> {
  if (!isDesktopApp()) return null
  try {
    return await invoke<boolean>('omniframe_toggle_fullscreen')
  } catch {
    return null
  }
}

/** IPC round-trip health check. Returns "pong" in a working desktop build. */
export async function pingDesktop(): Promise<string | null> {
  if (!isDesktopApp()) return null
  try {
    return await invoke<string>('omniframe_ping')
  } catch {
    return null
  }
}
