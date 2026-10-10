import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initNativeDsp } from './lib/native/dspNative.js'

// Warm the compiled DSP core (public/wasm/omni-dsp.wasm, ~11 KB) so the
// synchronous encode path and every renderAtRate / demucs call run natively
// from the first use. Fire-and-forget: every consumer falls back to the
// bit-identical pure-JS implementation if this fails.
void initNativeDsp()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
