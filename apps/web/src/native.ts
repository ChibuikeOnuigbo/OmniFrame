export interface NativeCapabilities {
  ffmpeg_available: boolean;
  ffmpeg_version: string | null;
  native_core: boolean;
  atomic_project_writes: boolean;
  cancellable_jobs: boolean;
}

type TauriInternals = { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> };

declare global {
  interface Window { __TAURI_INTERNALS__?: TauriInternals; }
}

export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const internals = typeof window !== 'undefined' ? window.__TAURI_INTERNALS__ : undefined;
  if (!internals) throw new Error('Native desktop commands are not available in the browser shell.');
  return internals.invoke(command, args) as Promise<T>;
}

export async function readNativeCapabilities(): Promise<NativeCapabilities | null> {
  if (!isDesktopShell()) return null;
  try { return await invokeNative<NativeCapabilities>('native_capabilities'); } catch { return null; }
}
