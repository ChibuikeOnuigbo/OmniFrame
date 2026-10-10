Code in this reposity/package is licensed under the MIT license, as below. However, this repository/package also include a weights file ("htdemucs.onnx"), which is not covered by this license. It is derived from a weights file provided by Meta, which is made available for personal and research use only.

---

MIT License

Copyright (c) 2014 Kevin Gibbons and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
---

Vendored into OmniFrame (src/lib/demucs) from npm package `demucs@1.0.0`
(https://www.npmjs.com/package/demucs). Adaptations:
 - onnx-htdemucs.js: always use onnxruntime-web with webgpu→wasm fallback;
   removed the `wasmPaths` override so bundler-resolved wasm assets are used.
 - apply.d.ts / onnx-htdemucs.d.ts: import specifiers normalized to .js.
The htdemucs.onnx weights themselves are downloaded separately by
scripts/fetch-demucs-model.mjs into public/models/htdemucs.onnx and are NOT
committed to this repository (174 MB; derived from Meta's weights, which are
provided for personal and research use only — see notice above).
