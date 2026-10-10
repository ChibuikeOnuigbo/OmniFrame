# OmniFrame Desktop (Rust / Tauri)

OmniFrame ships in two forms from one codebase:

| Form | Entry | Notes |
| --- | --- | --- |
| **Web app** | `npm run dev` / `npm run build` | The full editor in any browser. This is the product. |
| **Desktop app** | `npm run tauri dev` / `npm run tauri build` | The same editor inside a native window, driven by a small Rust shell. |

The desktop version is the `src-tauri/` directory: a [Tauri 2](https://v2.tauri.app)
crate that bundles the Vite build (`dist/`) into native installers —
`.msi`/`.exe` on Windows, `.deb`/`.rpm`/AppImage on Linux, `.app`/`.dmg` on macOS.

## What the Rust layer actually does

The shell is intentionally thin. `src-tauri/src/lib.rs` registers three IPC
commands, exposed to the web side through `src/lib/desktop.ts`:

| Command | Purpose | Used by |
| --- | --- | --- |
| `omniframe_ping` | IPC round-trip health check | QA / debugging |
| `omniframe_desktop_info` | Native OS, architecture, shell version, fullscreen state | The **Desktop badge** in the TopBar |
| `omniframe_toggle_fullscreen` | Toggle the native window fullscreen | Clicking the Desktop badge |

The TopBar's `desktop-badge` only renders when `window.__TAURI_INTERNALS__`
exists — i.e. only inside the desktop build — and shows `Desktop · <os>`.
In the browser the app never shows or calls any of this.

Window configuration (title, 1440×900 default size, minimum size, CSP) lives in
`src-tauri/tauri.conf.json`. App icons live in `src-tauri/icons/` (regenerate
everything from a single 1024×1024 PNG with `npx tauri icon <source.png>`).

## Building locally

Prerequisites: Node 20+, Rust via [rustup](https://rustup.rs), plus the
platform extras from the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)
(Windows: WebView2, included in Windows 10/11; Linux: `libwebkit2gtk-4.1-dev
libgtk-3-dev librsvg2-dev patchelf`; macOS: Xcode CLT).

```bash
npm ci                 # installs @tauri-apps/cli + @tauri-apps/api
npm run tauri dev      # desktop window with hot reload (runs vite under the hood)
npm run tauri build    # release installers in src-tauri/target/release/bundle/
```

## Building without a local toolchain (GitHub Actions)

`.github/workflows/desktop-build.yml` builds installers for all four targets on
GitHub runners (Rust + crates.io are available there):

- **Manual run:** Actions tab → *Desktop build (Tauri)* → *Run workflow* →
  download the artifacts from the run page.
- **Release:** push a tag (`v0.1.0`) → a draft GitHub Release is created with
  the Windows/Linux/macOS installers attached.

## Why you might not have seen it before

1. The Rust shell used to be pure boilerplate — it opened a window and did
   nothing native, so nothing in the app indicated a desktop build existed.
2. The bundle had no icon set, so `tauri build` failed at the bundling step.
3. Sandboxed/CI-less environments where `rustup`/crates.io are unreachable
   cannot compile it at all (`tauri build` errors with
   `failed to run 'cargo metadata'`).

All three are addressed: real commands + visible badge, generated icon set,
and an Actions workflow that produces the installers for you.
