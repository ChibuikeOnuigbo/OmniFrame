# Optional editor-assist models

OmniFrame editing, masking, tracking, compositing, 3D and export do not require a model. This directory contains the reproducible input for an optional, inspectable editor-assist baseline:

```bash
python modeltrainer.py train \
  --input models/editor-assist/train.jsonl \
  --output models/editor-assist/model.json \
  --event-log /tmp/omniframe-model-training.jsonl \
  --checkpoint-dir /tmp/omniframe-checkpoints \
  --report-dir qa/model-training
python modeltrainer.py report \
  --model models/editor-assist/model.json \
  --input models/editor-assist/train.jsonl \
  --output-dir qa/model-training
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

## Long-running, checkpointed training

To intentionally keep improving the model for a bounded ten-hour window, use an explicit deadline and real repeated cycles:

```bash
python modeltrainer.py train \
  --input models/editor-assist/train.jsonl \
  --output models/editor-assist/model.json \
  --hours 10 \
  --epochs 1009 \
  --repeat-until-deadline \
  --sleep-seconds 0.25 \
  --event-log qa/model-training/events.jsonl \
  --checkpoint-dir qa/model-training/checkpoints \
  --checkpoint-every 100 \
  --report-dir qa/model-training
```

This is a real finite training loop with validation, checkpoints and measurable reports; it is not a fake progress bar. Stop it with `Ctrl-C` or the process supervisor. A checkpoint remains usable if the run is stopped. The default training budget is 1009 passes, and `--repeat-until-deadline` is required before it will repeat cycles until the ten-hour deadline. Do not start an unbounded run without a deadline.

The baseline is a hashed-feature linear softmax classifier, not a transformer and not a substitute for a SAM2, diffusion or language model. It is a safe adapter for editor intents and can be evaluated before a larger model is introduced. The report produces `report.json`, `report.html` and `report.svg` from measured predictions so a visual result can be inspected without pretending the model generated video or artwork. ONNX export requires optional `numpy` and `onnx` packages; no fake `.onnx` file is emitted when they are absent.

## Runtime targets

- **Web:** load an ONNX bundle through `onnxruntime-web` only after explicit user/model selection. The tokenizer, feature count and label manifest must match.
- **Desktop Linux/macOS:** ship the same `manifest.json` and `model.onnx` as a resource, then use `onnxruntime` or a native adapter with the same input contract. The Tauri shell remains optional and must not make editing dependent on the model.
- **Local service:** `python modeltrainer.py serve --model models/editor-assist/model.json` exposes `/health` and `/predict` on `127.0.0.1` only.

No training command scrapes websites, submits forms, uploads footage or collects credentials. Feedback must be supplied explicitly as JSONL with a reward in `[-1, 1]`.
