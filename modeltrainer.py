#!/usr/bin/env python3
"""Train and package a small, inspectable OmniFrame editor-assist model.

This is a bounded local tool, not an autonomous agent and not a claim that a
foundation model has been trained. It learns a preference/action classifier
from explicit JSONL examples and can apply opt-in reward feedback. The default
training budget is exactly 1009 finite passes; it stops earlier if the user
supplies a time budget. No network access, form submission, credential use or
remote model download is performed by this file.

Example JSONL records:
  {"text":"make this clip portrait", "label":"set_aspect_9_16"}
  {"input":{"text":"remove the background"}, "output":{"action":"mask"}, "reward":1}
  {"text":"the previous suggestion was wrong", "action":"split", "reward":-1}

The model is deliberately simple enough to audit and reproduce. Its optional
ONNX export is a linear softmax graph that can be loaded by onnxruntime-web or
onnxruntime in a desktop adapter. It is not a transformer; a larger model must
be trained and evaluated separately rather than being implied by a filename.
"""
from __future__ import annotations

import argparse
import html
import http.server
import json
import math
import random
import re
import shutil
import signal
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

MODEL_FORMAT = "omniframe-editor-assist-linear-v1"
TOKENIZER_FORMAT = "fnv1a-token-ngram-char-v2"
DEFAULT_FEATURE_COUNT = 2048
DEFAULT_ITERATIONS = 1009
MAX_ITERATIONS = 1009
TOKEN_RE = re.compile(r"[\w'-]+", re.UNICODE)


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def fnv1a(text: str) -> int:
    value = 2166136261
    for byte in text.encode("utf-8", errors="replace"):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value


def tokens_for(text: str) -> list[str]:
    return [item.lower() for item in TOKEN_RE.findall(text) if item.strip("_-")]


def feature_vector(text: str, feature_count: int) -> list[float]:
    """Match the web runtime's deterministic sparse hashing contract."""
    vector = [0.0] * feature_count
    tokens = tokens_for(text)
    terms: list[tuple[str, float]] = [(f"w:{token}", 1.0) for token in tokens]
    terms.extend((f"b:{a}::{b}", 1.0) for a, b in zip(tokens, tokens[1:]))
    normalized = " ".join(tokens)
    for width in (3, 4, 5):
        padded = f"^{normalized}$"
        terms.extend((f"c{width}:{padded[index:index + width]}", 0.35) for index in range(max(0, len(padded) - width + 1)))
    if not terms:
        terms = [("<empty>", 1.0)]
    for term, weight in terms:
        vector[fnv1a(term) % feature_count] += weight
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def text_from_record(record: dict[str, Any]) -> str:
    value = record.get("text")
    if isinstance(value, str):
        return value
    for key in ("input", "prompt", "context"):
        value = record.get(key)
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            nested = value.get("text") or value.get("prompt") or value.get("query")
            if isinstance(nested, str):
                return nested
            return json.dumps(value, sort_keys=True, ensure_ascii=False)
    return ""


def label_from_record(record: dict[str, Any]) -> str | None:
    for key in ("label", "action", "target"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    output = record.get("output")
    if isinstance(output, str) and output.strip():
        return output.strip()
    if isinstance(output, dict):
        for key in ("label", "action", "target"):
            value = output.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


@dataclass
class Example:
    text: str
    label: str
    reward: float = 1.0
    metadata: dict[str, Any] | None = None


def load_examples(path: Path) -> list[Example]:
    examples: list[Example] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid JSON: {error}") from error
            if not isinstance(record, dict):
                continue
            text = text_from_record(record).strip()
            label = label_from_record(record)
            if not text or not label:
                continue
            try:
                reward = float(record.get("reward", 1.0))
            except (TypeError, ValueError):
                reward = 1.0
            examples.append(Example(text, label, clamp(reward, -1.0, 1.0), record.get("metadata")))
    if not examples:
        raise ValueError(f"{path} contains no usable text/label examples")
    return examples


@dataclass
class LinearModel:
    format: str
    tokenizer: str
    feature_count: int
    labels: list[str]
    weights: list[list[float]]
    bias: list[float]
    trained_iterations: int
    seed: int
    created_at: str
    training_summary: dict[str, Any]

    def scores(self, text: str) -> list[float]:
        vector = feature_vector(text, self.feature_count)
        return [sum(weight * value for weight, value in zip(row, vector)) + self.bias[index] for index, row in enumerate(self.weights)]

    def probabilities(self, text: str) -> list[float]:
        scores = self.scores(text)
        if not scores:
            return []
        pivot = max(scores)
        exponentials = [math.exp(clamp(score - pivot, -60.0, 60.0)) for score in scores]
        total = sum(exponentials) or 1.0
        return [value / total for value in exponentials]

    def predict(self, text: str, limit: int = 5) -> list[dict[str, Any]]:
        probabilities = self.probabilities(text)
        ranked = sorted(range(len(probabilities)), key=lambda index: probabilities[index], reverse=True)
        return [{"action": self.labels[index], "probability": round(probabilities[index], 6)} for index in ranked[:max(1, limit)]]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "LinearModel":
        value = json.loads(path.read_text(encoding="utf-8"))
        if value.get("format") != MODEL_FORMAT:
            raise ValueError(f"unsupported model format: {value.get('format')!r}")
        return cls(**value)


def softmax(scores: list[float]) -> list[float]:
    if not scores:
        return []
    pivot = max(scores)
    values = [math.exp(clamp(score - pivot, -60.0, 60.0)) for score in scores]
    total = sum(values) or 1.0
    return [value / total for value in values]


def split_examples(examples: list[Example], validation_ratio: float, seed: int) -> tuple[list[Example], list[Example]]:
    """Make a deterministic, label-aware holdout so accuracy is not self-congratulation."""
    ratio = clamp(validation_ratio, 0.0, 0.5)
    grouped: dict[str, list[Example]] = {}
    for example in examples:
        grouped.setdefault(example.label, []).append(example)
    rng = random.Random(seed)
    training: list[Example] = []
    validation: list[Example] = []
    for label in sorted(grouped):
        items = grouped[label][:]
        rng.shuffle(items)
        holdout = max(1, round(len(items) * ratio)) if ratio > 0 and len(items) >= 3 else 0
        holdout = min(holdout, max(0, len(items) - 1))
        validation.extend(items[:holdout])
        training.extend(items[holdout:])
    rng.shuffle(training)
    rng.shuffle(validation)
    return training, validation


def evaluate_model(model: LinearModel, examples: list[Example]) -> dict[str, Any]:
    if not examples:
        return {"examples": 0, "accuracy": None, "loss": None, "top3_accuracy": None, "per_label": {}}
    correct = 0
    top3 = 0
    loss = 0.0
    per_label: dict[str, dict[str, int]] = {}
    for example in examples:
        predictions = model.predict(example.text, limit=3)
        probabilities = model.probabilities(example.text)
        try:
            target_index = model.labels.index(example.label)
        except ValueError:
            continue
        predicted = predictions[0]["action"] if predictions else None
        correct += int(predicted == example.label)
        top3 += int(example.label in {item["action"] for item in predictions})
        loss -= math.log(max(1e-9, probabilities[target_index]))
        label_stats = per_label.setdefault(example.label, {"correct": 0, "total": 0})
        label_stats["total"] += 1
        label_stats["correct"] += int(predicted == example.label)
    count = len(examples)
    return {
        "examples": count,
        "accuracy": round(correct / count, 6),
        "loss": round(loss / count, 6),
        "top3_accuracy": round(top3 / count, 6),
        "per_label": per_label,
    }


def model_from_state(labels: list[str], weights: list[list[float]], bias: list[float], feature_count: int, seed: int, completed: int, loss: float, accuracy: float, validation: dict[str, Any], examples: int, validation_examples: int) -> LinearModel:
    return LinearModel(
        format=MODEL_FORMAT,
        tokenizer=TOKENIZER_FORMAT,
        feature_count=feature_count,
        labels=labels,
        weights=weights,
        bias=bias,
        trained_iterations=completed,
        seed=seed,
        created_at=now(),
        training_summary={
            "examples": examples,
            "validation_examples": validation_examples,
            "labels": labels,
            "loss": round(loss, 6),
            "accuracy": round(accuracy, 6),
            "validation": validation,
            "time_limited": False,
        },
    )


def train(
    examples: list[Example],
    iterations: int,
    feature_count: int,
    learning_rate: float,
    seed: int,
    event_log: Path | None,
    time_limit_hours: float,
    validation_ratio: float = 0.2,
    checkpoint_dir: Path | None = None,
    checkpoint_every: int = 100,
    sleep_seconds: float = 0.0,
    repeat_until_deadline: bool = False,
    report_dir: Path | None = None,
    stop_file: Path | None = None,
) -> LinearModel:
    iterations = max(1, min(MAX_ITERATIONS, iterations))
    train_examples, validation_examples = split_examples(examples, validation_ratio, seed)
    labels = sorted({example.label for example in examples})
    label_index = {label: index for index, label in enumerate(labels)}
    vectors = [(feature_vector(example.text, feature_count), label_index[example.label], example.reward) for example in train_examples]
    if not vectors:
        raise ValueError("the training split is empty; add at least one example per label")
    rng = random.Random(seed)
    weights = [[0.0] * feature_count for _ in labels]
    bias = [0.0] * len(labels)
    started = time.monotonic()
    deadline = started + time_limit_hours * 3600 if time_limit_hours > 0 else None
    last_loss = 0.0
    last_accuracy = 0.0
    last_validation: dict[str, Any] = evaluate_model(model_from_state(labels, weights, bias, feature_count, seed, 0, 0, 0, {}, len(train_examples), len(validation_examples)), validation_examples)
    completed = 0
    log_handle = event_log.open("a", encoding="utf-8") if event_log else None
    checkpoint_every = max(1, checkpoint_every)
    stop_requested = False
    stop_reason: str | None = None
    previous_handlers: dict[int, Any] = {}

    def request_stop(signum: int, _frame: Any) -> None:
        nonlocal stop_requested, stop_reason
        stop_requested = True
        stop_reason = signal.Signals(signum).name

    def stop_seen() -> bool:
        nonlocal stop_requested, stop_reason
        if stop_requested:
            return True
        if stop_file and stop_file.exists():
            stop_requested = True
            stop_reason = f"stop-file:{stop_file}"
            return True
        return False

    def emit(event: dict[str, Any]) -> None:
        if log_handle:
            log_handle.write(json.dumps({"time": now(), **event}, sort_keys=True) + "\n")
            log_handle.flush()

    def current_model() -> LinearModel:
        model = model_from_state(labels, weights, bias, feature_count, seed, completed, last_loss, last_accuracy, last_validation, len(train_examples), len(validation_examples))
        model.training_summary["time_limited"] = deadline is not None
        model.training_summary["repeat_until_deadline"] = repeat_until_deadline
        if stop_requested:
            model.training_summary["stopped"] = True
            model.training_summary["stop_reason"] = stop_reason
        return model

    try:
        for stop_signal in (signal.SIGINT, signal.SIGTERM):
            previous_handlers[stop_signal] = signal.getsignal(stop_signal)
            signal.signal(stop_signal, request_stop)
        while True:
            for cycle_iteration in range(1, iterations + 1):
                if stop_seen():
                    emit({"event": "training_stop_requested", "iteration": completed, "reason": stop_reason})
                    break
                if deadline is not None and time.monotonic() >= deadline:
                    emit({"event": "training_deadline", "iteration": completed, "limit_hours": time_limit_hours})
                    break
                order = list(range(len(vectors)))
                rng.shuffle(order)
                loss = 0.0
                correct = 0
                for index in order:
                    vector, target, reward = vectors[index]
                    logits = [sum(weight * value for weight, value in zip(row, vector)) + bias[class_index] for class_index, row in enumerate(weights)]
                    probabilities = softmax(logits)
                    prediction = max(range(len(probabilities)), key=probabilities.__getitem__)
                    correct += int(prediction == target)
                    loss -= math.log(max(1e-9, probabilities[target]))
                    sample_weight = 0.25 + 0.75 * max(0.0, reward)
                    for class_index in range(len(weights)):
                        gradient = (probabilities[class_index] - (1.0 if class_index == target else 0.0)) * sample_weight
                        bias[class_index] -= learning_rate * gradient
                        row = weights[class_index]
                        for feature_index, value in enumerate(vector):
                            row[feature_index] -= learning_rate * gradient * value
                completed += 1
                last_loss = loss / len(vectors)
                last_accuracy = correct / len(vectors)
                measure_validation = completed == 1 or completed % checkpoint_every == 0 or (not repeat_until_deadline and cycle_iteration == iterations)
                if measure_validation:
                    last_validation = evaluate_model(current_model(), validation_examples)
                event = {
                    "event": "training_pass",
                    "iteration": completed,
                    "cycle_iteration": cycle_iteration,
                    "iterations_per_cycle": iterations,
                    "loss": last_loss,
                    "accuracy": last_accuracy,
                    "validation": last_validation,
                    "validation_measured": measure_validation,
                    "examples": len(train_examples),
                    "validation_examples": len(validation_examples),
                }
                emit(event)
                if checkpoint_dir and (completed % checkpoint_every == 0 or (not repeat_until_deadline and cycle_iteration == iterations)):
                    checkpoint = current_model()
                    checkpoint.save(checkpoint_dir / f"checkpoint-{completed:06d}.json")
                if stop_seen():
                    emit({"event": "training_stop_requested", "iteration": completed, "reason": stop_reason})
                    break
                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)
            if stop_requested or not repeat_until_deadline or (deadline is not None and time.monotonic() >= deadline):
                break
    finally:
        for stop_signal, previous_handler in previous_handlers.items():
            signal.signal(stop_signal, previous_handler)
        if log_handle:
            log_handle.close()

    model = current_model()
    if checkpoint_dir:
        model.training_summary["checkpoint_dir"] = str(checkpoint_dir)
        model.training_summary["final_checkpoint"] = str(checkpoint_dir / f"checkpoint-final-{completed:06d}.json")
        model.save(checkpoint_dir / f"checkpoint-final-{completed:06d}.json")
    if report_dir:
        write_model_report(model, examples, report_dir, seed)
    return model


def write_model_report(model: LinearModel, examples: list[Example], output_dir: Path, seed: int) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    training_examples, validation_examples = split_examples(examples, 0.2, seed)
    validation = evaluate_model(model, validation_examples)
    full = evaluate_model(model, examples)
    probe_source = validation_examples if validation_examples else examples
    probes = []
    for example in probe_source[: min(36, len(probe_source))]:
        probes.append({"text": example.text, "expected": example.label, "predictions": model.predict(example.text, 3)})
    checkpoint_dir = output_dir / "checkpoints"
    checkpoint_paths = sorted(checkpoint_dir.glob("checkpoint-*.json")) if checkpoint_dir.exists() else []
    report = {"model": MODEL_FORMAT, "generated_at": now(), "training_summary": model.training_summary, "validation": validation, "full_dataset": full, "probes": probes, "probe_source": "validation-holdout" if validation_examples else "full-dataset", "checkpoints": {"directory": str(checkpoint_dir), "count": len(checkpoint_paths), "latest": str(checkpoint_paths[-1]) if checkpoint_paths else None}, "note": "Metrics are measured on the supplied examples; they are not a generalization guarantee."}
    (output_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    rows = []
    for probe in probes:
        top = probe["predictions"][0] if probe["predictions"] else {"action": "none", "probability": 0}
        rows.append((probe["expected"], top["action"], float(top["probability"])))
    width = 1120
    height = 180 + max(1, len(rows)) * 34
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">', '<rect width="100%" height="100%" fill="#0b0f14"/>', '<style>text{font-family:monospace}.title{font-size:24px;font-weight:700;fill:#d8ff63}.muted{fill:#9aa6a5;font-size:13px}.label{fill:#d5ddda;font-size:13px}.bar{fill:#84f0ba}.wrong{fill:#ff8f9f}</style>', '<text x="28" y="38" class="title">OmniFrame editor-assist · validation result</text>']
    svg.append(f'<text x="28" y="66" class="muted">validation accuracy: {validation.get("accuracy")} · top-3: {validation.get("top3_accuracy")} · holdout examples: {validation.get("examples")} · passes: {model.trained_iterations}</text>')
    svg.append('<text x="28" y="103" class="muted">expected action</text><text x="480" y="103" class="muted">top prediction</text><text x="930" y="103" class="muted">probability</text>')
    for index, (expected, predicted, probability) in enumerate(rows):
        y = 130 + index * 34
        colour = "bar" if expected == predicted else "wrong"
        svg.append(f'<text x="28" y="{y}" class="label">{html.escape(expected[:48])}</text><text x="480" y="{y}" class="label">{html.escape(predicted[:42])}</text><rect x="930" y="{y - 13}" width="150" height="14" rx="3" fill="#1c252c"/><rect x="930" y="{y - 13}" width="{150 * clamp(probability, 0, 1):.2f}" height="14" rx="3" class="{colour}"/><text x="1090" y="{y}" class="muted">{probability:.1%}</text>')
    svg.append('</svg>')
    (output_dir / "report.svg").write_text("\n".join(svg) + "\n", encoding="utf-8")
    (output_dir / "report.html").write_text("<!doctype html><meta charset='utf-8'><title>OmniFrame model report</title><body style='background:#0b0f14;color:#d5ddda'><h1>Measured editor-assist result</h1><img src='report.svg' alt='Measured model predictions'><pre>" + html.escape(json.dumps(report, indent=2)) + "</pre></body>\n", encoding="utf-8")
    return report

def apply_feedback(model: LinearModel, feedback: list[Example], learning_rate: float) -> dict[str, Any]:
    """Apply an explicit bandit-style preference update, not pretend RL."""
    label_index = {label: index for index, label in enumerate(model.labels)}
    applied = 0
    for example in feedback:
        if example.label not in label_index:
            continue
        vector = feature_vector(example.text, model.feature_count)
        direction = 1.0 if example.reward > 0 else -1.0
        class_index = label_index[example.label]
        for feature_index, value in enumerate(vector):
            model.weights[class_index][feature_index] += learning_rate * direction * value
        model.bias[class_index] += learning_rate * direction
        applied += 1
    model.training_summary = {**model.training_summary, "feedback_updates": model.training_summary.get("feedback_updates", 0) + applied}
    return {"applied": applied, "total": len(feedback), "method": "explicit-preference-update"}


def export_onnx(model: LinearModel, output: Path) -> None:
    try:
        import numpy as np  # type: ignore
        import onnx  # type: ignore
        from onnx import TensorProto, helper, numpy_helper  # type: ignore
    except ImportError as error:
        raise RuntimeError("ONNX export requires optional packages: python -m pip install numpy onnx") from error
    weights = np.asarray(model.weights, dtype=np.float32)
    bias = np.asarray(model.bias, dtype=np.float32)
    features = helper.make_tensor_value_info("features", TensorProto.FLOAT, [1, model.feature_count])
    probabilities = helper.make_tensor_value_info("probabilities", TensorProto.FLOAT, [1, len(model.labels)])
    graph = helper.make_graph(
        [
            helper.make_node("Gemm", ["features", "weights", "bias"], ["logits"], transB=1),
            helper.make_node("Softmax", ["logits"], ["probabilities"], axis=1),
        ],
        "omniframe_editor_assist",
        [features],
        [probabilities],
        initializer=[numpy_helper.from_array(weights, "weights"), numpy_helper.from_array(bias, "bias")],
    )
    exported = helper.make_model(graph, producer_name="omniframe-modeltrainer", opset_imports=[helper.make_opsetid("", 13)])
    exported.metadata_props.extend([
        onnx.StringStringEntryProto(key="format", value=MODEL_FORMAT),
        onnx.StringStringEntryProto(key="tokenizer", value=TOKENIZER_FORMAT),
        onnx.StringStringEntryProto(key="labels", value=json.dumps(model.labels)),
    ])
    onnx.checker.check_model(exported)
    output.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(exported, output)


def package_model(model_path: Path, output_dir: Path, onnx_path: Path | None = None) -> None:
    model = LinearModel.load(model_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model_path, output_dir / "model.json")
    manifest = {
        "name": "OmniFrame Editor Assist",
        "format": model.format,
        "tokenizer": model.tokenizer,
        "feature_count": model.feature_count,
        "labels": model.labels,
        "onnx": None,
        "web_runtime": "onnxruntime-web",
        "desktop_runtime": "onnxruntime or native adapter",
        "training": model.training_summary,
        "warning": "This is an inspectable linear assistant, not a general-purpose transformer.",
    }
    if onnx_path:
        destination = output_dir / "model.onnx"
        shutil.copy2(onnx_path, destination)
        manifest["onnx"] = destination.name
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (output_dir / "README.md").write_text(
        "# OmniFrame Editor Assist\n\n"
        "This bundle contains an explicitly trained hashed-feature action model. "
        "Load `manifest.json` before using `model.onnx`; the tokenizer and feature count must match.\n\n"
        "The model is optional and never required for editing, masking, tracking or export.\n",
        encoding="utf-8",
    )


def command_train(args: argparse.Namespace) -> int:
    examples = load_examples(Path(args.input))
    if args.repeat_until_deadline and args.time_limit_hours <= 0:
        raise ValueError("--repeat-until-deadline requires a positive --time-limit-hours")
    model = train(
        examples,
        args.iterations,
        args.feature_count,
        args.learning_rate,
        args.seed,
        Path(args.event_log) if args.event_log else None,
        args.time_limit_hours,
        validation_ratio=args.validation_ratio,
        checkpoint_dir=Path(args.checkpoint_dir) if args.checkpoint_dir else None,
        checkpoint_every=args.checkpoint_every,
        sleep_seconds=args.sleep_seconds,
        repeat_until_deadline=args.repeat_until_deadline,
        report_dir=Path(args.report_dir) if args.report_dir else None,
        stop_file=Path(args.stop_file) if args.stop_file else None,
    )
    model.save(Path(args.output))
    print(json.dumps({"model": str(args.output), "summary": model.training_summary, "iterations": model.trained_iterations}, indent=2))
    if args.feedback:
        feedback = load_examples(Path(args.feedback))
        result = apply_feedback(model, feedback, args.feedback_rate)
        model.save(Path(args.output))
        print(json.dumps({"feedback": result}, indent=2))
    return 0


def command_predict(args: argparse.Namespace) -> int:
    model = LinearModel.load(Path(args.model))
    print(json.dumps({"input": args.text, "predictions": model.predict(args.text, args.limit)}, indent=2))
    return 0


def command_report(args: argparse.Namespace) -> int:
    model = LinearModel.load(Path(args.model))
    examples = load_examples(Path(args.input))
    report = write_model_report(model, examples, Path(args.output_dir), args.seed)
    print(json.dumps({"output_dir": args.output_dir, "validation": report["validation"], "full_dataset": report["full_dataset"]}, indent=2))
    return 0


def command_feedback(args: argparse.Namespace) -> int:
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {"text": args.text, "action": args.action, "reward": clamp(args.reward, -1, 1), "metadata": {"source": "explicit-user-feedback", "time": now()}}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(json.dumps(record, indent=2))
    return 0


class PredictionHandler(http.server.BaseHTTPRequestHandler):
    model: LinearModel

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.send_json(200, {"ok": True, "format": self.model.format, "labels": self.model.labels})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/predict":
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length > 1_000_000:
                raise ValueError("request is too large")
            payload = json.loads(self.rfile.read(length))
            text = payload.get("text") if isinstance(payload, dict) else None
            if not isinstance(text, str) or not text.strip():
                raise ValueError("JSON body must contain a non-empty text string")
            self.send_json(200, {"predictions": self.model.predict(text)})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})

    def send_json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"model service · {format % args}", flush=True)


def command_serve(args: argparse.Namespace) -> int:
    model = LinearModel.load(Path(args.model))
    handler = type("BoundPredictionHandler", (PredictionHandler,), {"model": model})
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Local model service listening on http://{args.host}:{args.port} · /health and /predict", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bounded local OmniFrame editor-assist model trainer")
    sub = parser.add_subparsers(dest="command", required=True)
    train_parser = sub.add_parser("train", help="train from explicit JSONL examples")
    train_parser.add_argument("--input", required=True)
    train_parser.add_argument("--output", required=True)
    train_parser.add_argument("--iterations", "--epochs", dest="iterations", type=int, default=DEFAULT_ITERATIONS, help="finite passes per cycle; capped at 1009")
    train_parser.add_argument("--feature-count", type=int, default=DEFAULT_FEATURE_COUNT)
    train_parser.add_argument("--learning-rate", type=float, default=0.04)
    train_parser.add_argument("--seed", type=int, default=20260919)
    train_parser.add_argument("--event-log", help="optional JSONL pass log")
    train_parser.add_argument("--time-limit-hours", "--hours", dest="time_limit_hours", type=float, default=10.0, help="cooperative deadline; 0 disables it")
    train_parser.add_argument("--repeat-until-deadline", action="store_true", help="repeat real training cycles until the explicit deadline")
    train_parser.add_argument("--sleep-seconds", type=float, default=0.0, help="optional pause between passes to reduce CPU pressure")
    train_parser.add_argument("--validation-ratio", type=float, default=0.2)
    train_parser.add_argument("--checkpoint-dir", help="write measured model checkpoints here")
    train_parser.add_argument("--checkpoint-every", type=int, default=100)
    train_parser.add_argument("--report-dir", help="write JSON, HTML and SVG measured-result report")
    train_parser.add_argument("--stop-file", help="stop at the next safe pass boundary and save a final checkpoint")
    train_parser.add_argument("--feedback", help="optional explicit reward JSONL applied after supervised passes")
    train_parser.add_argument("--feedback-rate", type=float, default=0.02)
    train_parser.set_defaults(func=command_train)
    predict_parser = sub.add_parser("predict", help="score an input with a local model")
    predict_parser.add_argument("--model", required=True)
    predict_parser.add_argument("--text", required=True)
    predict_parser.add_argument("--limit", type=int, default=5)
    predict_parser.set_defaults(func=command_predict)
    report_parser = sub.add_parser("report", help="evaluate a model and render measured JSON/HTML/SVG output")
    report_parser.add_argument("--model", required=True)
    report_parser.add_argument("--input", required=True)
    report_parser.add_argument("--output-dir", required=True)
    report_parser.add_argument("--seed", type=int, default=20260919)
    report_parser.set_defaults(func=command_report)
    feedback_parser = sub.add_parser("feedback", help="append explicit user feedback; never scrapes or submits forms")
    feedback_parser.add_argument("--output", required=True)
    feedback_parser.add_argument("--text", required=True)
    feedback_parser.add_argument("--action", required=True)
    feedback_parser.add_argument("--reward", type=float, required=True)
    feedback_parser.set_defaults(func=command_feedback)
    export_parser = sub.add_parser("export-onnx", help="export the linear model to ONNX when optional deps exist")
    export_parser.add_argument("--model", required=True)
    export_parser.add_argument("--output", required=True)
    export_parser.set_defaults(func=lambda args: (export_onnx(LinearModel.load(Path(args.model)), Path(args.output)) or print(f"wrote {args.output}")) or 0)
    package_parser = sub.add_parser("package", help="create a portable model bundle for web/desktop adapters")
    package_parser.add_argument("--model", required=True)
    package_parser.add_argument("--output-dir", required=True)
    package_parser.add_argument("--onnx")
    package_parser.set_defaults(func=lambda args: (package_model(Path(args.model), Path(args.output_dir), Path(args.onnx) if args.onnx else None) or print(f"wrote {args.output_dir}")) or 0)
    serve_parser = sub.add_parser("serve", help="serve local predictions over HTTP")
    serve_parser.add_argument("--model", required=True)
    serve_parser.add_argument("--host", default="127.0.0.1", help="bind locally by default")
    serve_parser.add_argument("--port", type=int, default=8787)
    serve_parser.set_defaults(func=command_serve)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args) or 0)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"modeltrainer error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
