# OmniFrame Dependency & Code License Audit (`LICENSE_AUDIT.md`)

## Audit Status: CLEAN & COMPLIANT
Date of Audit: 2026-09-24

### 1. OmniFrame Native Codebase License
- **Target License**: MIT License
- **Origin**: Clean-room implementation authored from specification.
- **Copyright**: (c) 2026 Chibuike Onuigbo & OmniFrame Contributors.

### 2. Runtime Dependencies License Audit

| Package | Version | Declared License | Compatibility with MIT | Usage Purpose |
|---|---|---|---|---|
| `react` | ^19.0.0 | MIT | Compatible | UI Component rendering |
| `react-dom` | ^19.0.0 | MIT | Compatible | DOM tree management |
| `zustand` | ^5.0.3 | MIT | Compatible | Global state management |
| `lucide-react` | ^0.475.0 | ISC | Compatible | UI Vector icons |
| `tailwindcss` | ^4.0.9 | MIT | Compatible | Utility CSS framework |
| `vite` | ^6.2.0 | MIT | Compatible | Build tool and bundler |
| `typescript` | ^5.7.3 | Apache-2.0 | Compatible | Static typing engine |
| `@sparticuz/chromium` | ^133.0.0 | MIT | Compatible | Headless testing environment |
| `playwright-core` | ^1.50.1 | Apache-2.0 | Compatible | End-to-end automation test runner |
| `opencv-python-headless` | 5.0.0.93 | Apache-2.0 | Compatible | Forensic video export verification |
| `numpy` | 2.4.6 | BSD-3-Clause | Compatible | Mathematical matrix verification |

### 3. GPL Research Compliance Certification
OmniFrame developers study open-source GPL architectures (Kdenlive, Shotcut, OpenShot, Olive) strictly for knowledge discovery, interface standards, and mathematical models (e.g. Bézier math, projection transformations, timeline intervals).
- **No GPL Source Code Ingestion**: No source files, C++ functions, or copyrighted MLT/Kdenlive source code snippets are copied or pasted into OmniFrame.
- **Clean-Room TypeScript Implementation**: All data structures, React hooks, Zustand stores, Web Audio DSP algorithms, and WebGL shaders are written de novo in modern web-standard TypeScript.
- **Dependency Isolation**: No GPL libraries are statically or dynamically linked in OmniFrame Web. The Voice Isolation DSP engine (`src/lib/voiceIsolation.ts`) executes pure Float32Array Web Audio math and canonical WAV RIFF byte-array encoding without any external C/C++ or GPL binary dependencies.

