import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// OmniFrame web editor — Vite config.
// Bound to 0.0.0.0 so the Arena preview proxy can reach it.

/**
 * onnxruntime-web loads its WASM loader (.mjs) and binary (.wasm) at runtime
 * via import('<url>'). Vite's dev server appends `?import` to that dynamic
 * import and serves it through the transform middleware, which only resolves
 * files that exist on disk inside the project — public/ assets fail there.
 * So the runtime files are copied to a root-level `ort-runtime/` dir for dev,
 * and emitted into `dist/ort/` at build time. node_modules is not persisted
 * between environments, so the copy runs at every dev/build start.
 */
function copyOrtWasm(): Plugin {
  const root = process.cwd()
  const copy = (dstDir: string) => {
    const src = resolve(root, 'node_modules/onnxruntime-web/dist')
    if (!existsSync(src)) return
    mkdirSync(dstDir, { recursive: true })
    for (const f of readdirSync(src)) {
      if (f.endsWith('.wasm') || f.endsWith('.mjs')) {
        cpSync(resolve(src, f), resolve(dstDir, f), { force: true })
      }
    }
  }
  return {
    name: 'omniframe-copy-ort-wasm',
    buildStart() {
      copy(resolve(root, 'ort-runtime')) // dev import path
      copy(resolve(root, 'public/ort')) // build output (public -> dist)
    },
  }
}

export default defineConfig({
  plugins: [react(), copyOrtWasm()],
  // The runtime WASM import must not be rewritten by the optimizer.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Allow the Arena live-preview proxy host (and any *.e2b.app subdomain).
    allowedHosts: ['*.e2b.app', 'localhost', '127.0.0.1', '.e2b.app'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['*.e2b.app', 'localhost', '127.0.0.1', '.e2b.app'],
  },
})
