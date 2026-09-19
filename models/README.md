# Optional editor-assist models

OmniFrame editing, masking, tracking, compositing, 3D and export do not require a model. This directory contains the reproducible input for an optional, inspectable editor-assist baseline:

```bash
python modeltrainer.py train \
  --input models/editor-assist/train.jsonl \
  --output models/editor-assist/model.json \
  --event-log /tmp/omniframe-model-training.jsonl
python modeltrainer.py predict \
  --model models/editor-assist/model.json \
  --text "make this sequence portrait"
python modeltrainer.py export-onnx \
  --model models/editor-assist/model.json \
  --output models/editor-assist/model.onnx
python modeltrainer.py package \
  --model models/editor-assist/model.json \
  --onnx models/editor-assist/model.onnx \
  --output-dir models/editor-assist/bundle
```

The baseline is a hashed-feature linear softmax classifier, not a transformer and not a substitute for a SAM2, diffusion or language model. It is a safe adapter for editor intents and can be evaluated before a larger model is introduced. ONNX export requires optional `numpy` and `onnx` packages; no fake `.onnx` file is emitted when they are absent.

## Runtime targets

- **Web:** load an ONNX bundle through `onnxruntime-web` only after explicit user/model selection. The tokenizer, feature count and label manifest must match.
- **Desktop Linux/macOS:** ship the same `manifest.json` and `model.onnx` as a resource, then use `onnxruntime` or a native adapter with the same input contract. The Tauri shell remains optional and must not make editing dependent on the model.
- **Local service:** `python modeltrainer.py serve --model models/editor-assist/model.json` exposes `/health` and `/predict` on `127.0.0.1` only.

No training command scrapes websites, submits forms, uploads footage or collects credentials. Feedback must be supplied explicitly as JSONL with a reward in `[-1, 1]`. The default training budget is 1009 finite passes and a 10-hour cooperative deadline; it does not create an autonomous agent or claim completion.
