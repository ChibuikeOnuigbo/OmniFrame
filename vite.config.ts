import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// OmniFrame web editor — Vite config.
// Bound to 0.0.0.0 so the Arena preview proxy can reach it.
export default defineConfig({
  plugins: [react()],
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
