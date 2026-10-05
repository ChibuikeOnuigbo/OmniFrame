# OmniFrame Third-Party Notices (`THIRD_PARTY_NOTICES.md`)

This file contains the licenses and notices for open source software used in OmniFrame.

---

### React & React DOM
- **Copyright**: (c) Meta Platforms, Inc. and affiliates.
- **License**: MIT
- **Permission**: Free of charge, to any person obtaining a copy of this software...

---

### Zustand
- **Copyright**: (c) 2019 Paul Henschel
- **License**: MIT
- **Permission**: Free of charge, to any person obtaining a copy of this software...

---

### Lucide React
- **Copyright**: (c) 2022 Lucide Contributors, (c) 2013-2022 Cole Bemis
- **License**: ISC
- **Permission**: Permission to use, copy, modify, and/or distribute this software for any purpose...

---

### Tailwind CSS
- **Copyright**: (c) Tailwind Labs, Inc.
- **License**: MIT
- **Permission**: Free of charge, to any person obtaining a copy of this software...

---

### Vite
- **Copyright**: (c) 2019-present Evan You & Vite Contributors
- **License**: MIT
- **Permission**: Free of charge, to any person obtaining a copy of this software...

---

### OpenCV Python Headless
- **Copyright**: (c) 2026 OpenCV team and contributors.
- **License**: Apache-2.0
- **Licensed under the Apache License, Version 2.0**: You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

---

### NumPy
- **Copyright**: (c) 2005-2026 NumPy Developers.
- **License**: BSD 3-Clause "New" or "Revised" License.

---

### JAX / jaxlib (OmniRoto training toolchain)
- **Copyright**: (c) 2021 Google LLC.
- **License**: Apache-2.0
- **Use**: offline training of the OmniRoto ONNX models in scripts/python/train_roto_models.py. Not shipped in the app.

---

### ONNX / onnxruntime (training export + desktop sidecar)
- **Copyright**: (c) ONNX Contributors.
- **License**: MIT (onnx), MIT (onnxruntime)
- **Use**: ONNX graph export during training and native inference in the desktop roto sidecar (scripts/python/roto_onnx.py). onnxruntime-web ships in the browser bundle as before.

---

### OmniRoto training corpus (omni-roto-*-v1.onnx)
- **Origin**: reference photographs collected via image search (people, anime characters, hair portraits) plus in-repo sample assets; pseudo-labelled with OpenCV GrabCut. The corpus lives in training_data/ which is git-ignored and NOT redistributed.
- **Models**: trained in-repo, MIT, ~560 KB each; metadata in public/models/omni-roto-*-v1.json.
- **Catalog models** (U2-Net, IS-Net, Silueta, etc.) are NOT bundled — RotoMask links them by URL at the user's request; their licences remain those of the upstream projects (Apache-2.0 / non-commercial research depending on the model).
