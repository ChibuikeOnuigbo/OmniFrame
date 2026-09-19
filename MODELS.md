# Model registry

Models are lazy, cancellable and licence-recorded. The normal UI says Fast/Balanced/Quality. Advanced can show model, runtime, dtype, device and resolution.

Current registry entries include:

- SAM2.1 Hiera-Tiny/Small: Apache-2.0 candidates, explicit ONNX/ORT loading;
- BiRefNet Lite 512: MIT-listed candidate;
- Xenova MODNet: Apache-2.0-listed candidate;
- ISNet-ONNX: research-only AGPL-3.0 listing;
- CoTracker: research-only CC-BY-NC restriction;
- built-in pyramidal Lucas–Kanade: MIT OmniFrame implementation, no download.

The optional local editor-assist adapter in `models/editor-assist/` is a measured hashed-feature linear softmax classifier, not a general-purpose foundation model. Its explicit JSONL data, 18 intent labels, 2,048 hashed features, validation holdout and generated `qa/model-training/report.{json,html,svg}` are inspectable. It runs only after explicit opt-in and does not make editing dependent on a model. Exact model revision, weight licence, checksum, commercial-use status and redistribution rights must be filled before a release bundles a third-party weight.
