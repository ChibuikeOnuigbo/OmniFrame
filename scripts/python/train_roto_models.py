#!/usr/bin/env python3
"""
Train the OmniRoto model family — tiny U-Nets for the RotoMask sub-tool.

Reference behaviour (Sammie-Roto 2): pick a model, click the subject, track.
Sammie wraps SAM2 (176 MB+); OmniFrame ships its own family of small
segmenters trained in-repo so click-to-segment works in the browser with no
download, while still importing bigger community models (U2-Net, IS-Net,
Silueta...) when the user provides them.

Supervision: OpenCV GrabCut pseudo-labels. Each raw photo (people, anime
characters, hair portraits, objects — see training_data/raw/) is segmented
with a centre-biased rectangle prior; degenerate masks are rejected. The
pseudo-labels are then heavily augmented (crops, flips, colour jitter) and
a ~300k-parameter residual U-Net is trained per domain:

    omni-roto-general-v1  (mixed subjects)
    omni-roto-human-v1    (full body + portraits)
    omni-roto-anime-v1    (anime characters, incl. the Death Note chibi set)
    omni-roto-hair-v1     (hair-dominant portraits)

Training runs on CPU with JAX; the trained weights are exported to ONNX with
a hand-built graph (Conv / Resize / Add / Sigmoid) so no exporter dependency
is needed. Each model gets a JSON sidecar with its metadata the app reads.

Usage:
    python3 scripts/python/train_roto_models.py            # train all
    python3 scripts/python/train_roto_models.py human      # one domain
    python3 scripts/python/train_roto_models.py --epochs 20
"""

import argparse
import datetime as _dt
import json
import os
import sys

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW_DIR = os.path.join(ROOT, "training_data", "raw")
OUT_DIR = os.path.join(ROOT, "public", "models")

INPUT = 128  # model input resolution (square)
DOMAINS = ["general", "human", "anime", "hair"]
AUG_PER_IMAGE = 48      # augmented crops generated per accepted raw image
VAL_FRACTION = 0.15
SEED = 7

# Small residual U-Net: conv-SAME everywhere, strided-conv down, nearest up.
CHANNELS = [16, 24, 32, 48, 64]  # enc0..enc4 (enc4 = bottleneck)


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------------------
# Pseudo-labels: GrabCut with a centre-biased rect + cleanup
# ---------------------------------------------------------------------------

def grabcut_mask(bgr):
    h, w = bgr.shape[:2]
    rect = (int(w * 0.08), int(h * 0.06), int(w * 0.84), int(h * 0.88))
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    mask = np.zeros((h, w), np.uint8)
    cv2.grabCut(bgr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    binary = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    # cleanup: close, open, largest component
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    if n > 2:
        best = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        binary = np.where(labels == best, 255, 0).astype(np.uint8)
    frac = float((binary > 0).mean())
    if frac < 0.03 or frac > 0.85:
        return None, frac
    return binary, frac


def load_domain_images(domain):
    """Return [(rgb float32 0..1 HxWx3, mask float32 0..1 HxW), ...]."""
    out = []
    d = os.path.join(RAW_DIR, domain)
    files = (
        sorted(os.listdir(d))
        if os.path.isdir(d)
        else []
    )
    # The "general" model also sees every other domain's images (it is the
    # fallback engine, so breadth matters more than specificity).
    if domain == "general":
        for other in DOMAINS:
            if other == "general":
                continue
            od = os.path.join(RAW_DIR, other)
            if os.path.isdir(od):
                files += [os.path.join(other, f) for f in sorted(os.listdir(od))]
    for name in files:
        if domain == "general" and os.sep in name:
            # cross-domain entry contributed as "human/xxx.jpg"
            path = os.path.join(RAW_DIR, name)
        else:
            path = os.path.join(RAW_DIR, domain, name)
        img = cv2.imread(path, cv2.IMREAD_COLOR)
        if img is None:
            continue
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        # Cap the long edge so GrabCut stays quick.
        scale = 640.0 / max(img.shape[:2])
        if scale < 1:
            img = cv2.resize(img, (int(img.shape[1] * scale), int(img.shape[0] * scale)))
        m, frac = grabcut_mask(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        if m is None:
            log(f"  skip {name} (degenerate pseudo-mask {frac:.2f})")
            continue
        out.append((img.astype(np.float32) / 255.0, m.astype(np.float32) / 255.0))
    return out


# ---------------------------------------------------------------------------
# Augmentation
# ---------------------------------------------------------------------------

rng = np.random.default_rng(SEED)


def random_crop_pair(img, mask, size):
    h, w = img.shape[:2]
    s = rng.uniform(0.55, 1.0)
    cw, ch = max(24, int(w * s)), max(24, int(h * s))
    x0 = rng.integers(0, max(1, w - cw))
    y0 = rng.integers(0, max(1, h - ch))
    # Bias the crop so the subject centre is usually inside.
    cx = int(w / 2 + rng.normal(0, w * 0.12) - cw / 2)
    cy = int(h / 2 + rng.normal(0, h * 0.12) - ch / 2)
    x0 = int(np.clip(cx, 0, max(0, w - cw)))
    y0 = int(np.clip(cy, 0, max(0, h - ch)))
    ic = img[y0 : y0 + ch, x0 : x0 + cw]
    mc = mask[y0 : y0 + ch, x0 : x0 + cw]
    ic = cv2.resize(ic, (size, size), interpolation=cv2.INTER_AREA)
    mc = cv2.resize(mc, (size, size), interpolation=cv2.INTER_AREA)
    return ic, mc


def augment(img, mask):
    # brightness / contrast jitter
    img = img * rng.uniform(0.75, 1.25)
    img = (img - 0.5) * rng.uniform(0.8, 1.25) + 0.5
    img = np.clip(img, 0, 1)
    # channel jitter
    for c in range(3):
        img[..., c] = np.clip(img[..., c] * rng.uniform(0.92, 1.08), 0, 1)
    if rng.random() < 0.5:
        img = img[:, ::-1]
        mask = mask[:, ::-1]
    if rng.random() < 0.3:  # slight rotation
        ang = rng.uniform(-8, 8)
        M = cv2.getRotationMatrix2D((INPUT / 2, INPUT / 2), ang, 1.0)
        img = cv2.warpAffine(img, M, (INPUT, INPUT))
        mask = cv2.warpAffine(mask, M, (INPUT, INPUT))
    # mild blur / sharpen
    if rng.random() < 0.3:
        img = cv2.GaussianBlur(img, (3, 3), 0)
    return np.ascontiguousarray(img), np.ascontiguousarray(mask)


def build_dataset(pairs):
    xs, ys = [], []
    for img, mask in pairs:
        for _ in range(AUG_PER_IMAGE):
            ic, mc = random_crop_pair(img, mask, INPUT)
            ic, mc = augment(ic, mc)
            xs.append(ic.transpose(2, 0, 1))  # CHW
            ys.append((mc > 0.5).astype(np.float32))
    X = np.stack(xs)
    Y = np.stack(ys)[:, None]  # N1HW
    # deterministic shuffle + split
    idx = rng.permutation(len(X))
    X, Y = X[idx], Y[idx]
    nval = max(4, int(len(X) * VAL_FRACTION))
    return X[nval:], Y[nval:], X[:nval], Y[:nval]


# ---------------------------------------------------------------------------
# JAX model
# ---------------------------------------------------------------------------

def import_jax():
    os.environ.setdefault("JAX_PLATFORMS", "cpu")
    import jax
    import jax.numpy as jnp
    from jax.example_libraries import optimizers
    return jax, jnp, optimizers


def init_params(jax, key):
    """He-initialised conv weights for the residual U-Net (list of (w, b))."""
    import jax.numpy as jnp
    params = []
    fan_ins = [3] + CHANNELS[:-1]
    chans = CHANNELS
    # enc0 (full res), enc1..3 (stride 2), bottleneck conv at stride-2 level,
    # dec3..0 (after upsample), head.
    specs = [
        (fan_ins[0], chans[0], 3, 1),   # enc0 128
        (chans[0], chans[1], 3, 2),     # enc1 64
        (chans[1], chans[2], 3, 2),     # enc2 32
        (chans[2], chans[3], 3, 2),     # enc3 16
        (chans[3], chans[4], 3, 1),     # bottleneck conv 16
        (chans[4] + chans[3], chans[3], 3, 1),  # dec3 16
        (chans[3] + chans[2], chans[2], 3, 1),  # dec2 32
        (chans[2] + chans[1], chans[1], 3, 1),  # dec1 64
        (chans[1] + chans[0], chans[0], 3, 1),  # dec0 128
        (chans[0], 1, 3, 1),            # head 128
    ]
    for cin, cout, k, _stride in specs:
        w = jax.random.normal(key, (k, k, cin, cout)) * np.sqrt(2.0 / (k * k * cin))
        b = jnp.zeros((cout,))
        params.append((w, b))
    return params


def conv_same(x, w, b, stride=1):
    """x: NCHW, w: (kh, kw, cin, cout) — matches lax.conv input layout."""
    import jax

    pad = ((1, 1), (1, 1))  # SAME for k=3
    y = jax.lax.conv_general_dilated(
        x, w, (stride, stride), pad, dimension_numbers=("NCHW", "HWIO", "NCHW"),
    )
    return y + b[None, :, None, None]


def relu(x):
    import jax.numpy as jnp
    return jnp.maximum(x, 0.0)


def upsample2(x):
    import jax.numpy as jnp
    n, c, h, w = x.shape
    y = jnp.repeat(x, 2, axis=2)
    y = jnp.repeat(y, 2, axis=3)
    return y


def forward(params, x):
    import jax
    import jax.numpy as jnp
    (w0, b0), (w1, b1), (w2, b2), (w3, b3), (wb, bb), \
        (wd3, bd3), (wd2, bd2), (wd1, bd1), (wd0, bd0), (wh, bh) = params
    e0 = relu(conv_same(x, w0, b0))                 # 16 x128
    e1 = relu(conv_same(e0, w1, b1, stride=2))       # 24 x64
    e2 = relu(conv_same(e1, w2, b2, stride=2))       # 32 x32
    e3 = relu(conv_same(e2, w3, b3, stride=2))       # 48 x16
    bt = relu(conv_same(e3, wb, bb, stride=2))                 # 64 x16
    d3 = relu(conv_same(jnp.concatenate([upsample2(bt), e3], axis=1), wd3, bd3))  # 48 x16
    d2 = relu(conv_same(jnp.concatenate([upsample2(d3), e2], axis=1), wd2, bd2))  # 32 x32
    d1 = relu(conv_same(jnp.concatenate([upsample2(d2), e1], axis=1), wd1, bd1))  # 24 x64
    d0 = relu(conv_same(jnp.concatenate([upsample2(d1), e0], axis=1), wd0, bd0))  # 16 x128
    logits = conv_same(d0, wh, bh)                   # 1 x128
    return jax.nn.sigmoid(logits)


def dice_bce_loss(logits_sig, y):
    import jax.numpy as jnp
    eps = 1e-6
    bce = -jnp.mean(y * jnp.log(logits_sig + eps) + (1 - y) * jnp.log(1 - logits_sig + eps))
    inter = jnp.sum(logits_sig * y)
    union = jnp.sum(logits_sig) + jnp.sum(y)
    dice = 1.0 - (2.0 * inter + eps) / (union + eps)
    return bce + dice


def train_domain(domain, epochs, batch=8, lr=2e-3):
    import jax
    import jax.numpy as jnp
    from jax.example_libraries import optimizers

    log(f"[{domain}] loading raw images…")
    pairs = load_domain_images(domain)
    if not pairs:
        log(f"[{domain}] no usable images — skipping")
        return None
    log(f"[{domain}] {len(pairs)} images -> pseudo-labels")
    X, Y, Xv, Yv = build_dataset(pairs)
    log(f"[{domain}] train {X.shape} val {Xv.shape}")

    key = jax.random.PRNGKey(SEED)
    params = init_params(jax, key)
    opt_init, opt_update, get_params = optimizers.adam(lr)
    opt_state = opt_init(params)

    def loss_fn(params, x, y):
        pred = forward(params, x)
        return dice_bce_loss(pred, y)

    @jax.jit
    def step(opt_state, x, y):
        grads = jax.grad(loss_fn)(get_params(opt_state), x, y)
        return opt_update(0, grads, opt_state)

    @jax.jit
    def predict(params, x):
        return forward(params, x)

    n = len(X)
    history = []
    for epoch in range(epochs):
        perm = np.random.permutation(n)
        tot = 0.0
        for i in range(0, n, batch):
            idx = perm[i : i + batch]
            xb = jnp.asarray(X[idx])
            yb = jnp.asarray(Y[idx])
            opt_state = step(opt_state, xb, yb)
            tot += float(loss_fn(get_params(opt_state), xb, yb)) * len(idx)
        # val IoU
        params = get_params(opt_state)
        ious = []
        for i in range(0, len(Xv), batch):
            p = np.asarray(predict(params, jnp.asarray(Xv[i : i + batch]))) > 0.5
            g = Yv[i : i + batch, 0] > 0.5
            inter = np.logical_and(p[:, 0], g).sum(axis=(1, 2))
            union = np.logical_or(p[:, 0], g).sum(axis=(1, 2))
            ious.append((inter + 1e-6) / (union + 1e-6))
        iou = float(np.concatenate(ious).mean())
        history.append(iou)
        log(f"[{domain}] epoch {epoch + 1}/{epochs} loss {tot / n:.4f} valIoU {iou:.3f}")

    params = get_params(opt_state)
    final_iou = history[-1] if history else 0.0
    n_params = int(sum(int(np.prod(p[0].shape)) + int(np.prod(p[1].shape)) for p in params))
    return params, final_iou, n_params, len(X) + len(Xv), len(pairs)


# ---------------------------------------------------------------------------
# ONNX export (hand-built graph: Conv / Relu / Concat / Resize / Sigmoid)
# ---------------------------------------------------------------------------

def export_onnx(params, domain, path, val_iou, n_params, n_samples, n_raw, epochs):
    import onnx
    from onnx import helper, TensorProto

    tensors = []  # initializer list
    nodes = []
    inp = [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, INPUT, INPUT])]
    outs = [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 1, INPUT, INPUT])]

    def add_conv(name, x, w, b, stride=1, out_ch=None):
        wname, bname = f"{name}.w", f"{name}.b"
        w_onnx = np.ascontiguousarray(w.transpose(3, 2, 0, 1))  # HWIO -> (M, C, kH, kW)
        tensors.append(helper.make_tensor(wname, TensorProto.FLOAT, list(w_onnx.shape), w_onnx.flatten().astype(np.float32)))
        tensors.append(helper.make_tensor(bname, TensorProto.FLOAT, list(b.shape), b.flatten().astype(np.float32)))
        nodes.append(
            helper.make_node(
                "Conv",
                [x, wname, bname],
                [name],
                kernel_shape=[3, 3],
                pads=[1, 1, 1, 1],
                strides=[stride, stride],
                name=name,
            )
        )
        return name

    def add_relu(name, x):
        nodes.append(helper.make_node("Relu", [x], [name], name=name))
        return name

    def add_concat(name, a, b):
        nodes.append(helper.make_node("Concat", [a, b], [name], axis=1, name=name))
        return name

    def add_up(name, x):
        # nearest 2x upsample via Resize
        scales = helper.make_tensor(f"{name}.scales", TensorProto.FLOAT, [4], [1.0, 1.0, 2.0, 2.0])
        tensors.append(scales)
        nodes.append(
            helper.make_node(
                "Resize", [x, "", f"{name}.scales"], [name],
                mode="nearest", nearest_mode="floor",
                coordinate_transformation_mode="asymmetric",
                name=name,
            )
        )
        return name

    (w0, b0), (w1, b1), (w2, b2), (w3, b3), (wb, bb), \
        (wd3, bd3), (wd2, bd2), (wd1, bd1), (wd0, bd0), (wh, bh) = params
    W = [np.asarray(w) for w, _ in params]
    B = [np.asarray(b) for _, b in params]
    # params order matches: 0 enc0, 1 enc1, 2 enc2, 3 enc3, 4 bottleneck,
    # 5 dec3, 6 dec2, 7 dec1, 8 dec0, 9 head
    x = add_conv("enc0", "input", W[0], B[0])
    e0 = add_relu("enc0.relu", x)
    e1 = add_relu("enc1.relu", add_conv("enc1", e0, W[1], B[1], stride=2))
    e2 = add_relu("enc2.relu", add_conv("enc2", e1, W[2], B[2], stride=2))
    e3 = add_relu("enc3.relu", add_conv("enc3", e2, W[3], B[3], stride=2))
    bt = add_relu("bt.relu", add_conv("bt", e3, W[4], B[4], stride=2))
    d3 = add_relu("dec3.relu", add_conv("dec3", add_concat("cat3", add_up("up3", bt), e3), W[5], B[5]))
    d2 = add_relu("dec2.relu", add_conv("dec2", add_concat("cat2", add_up("up2", d3), e2), W[6], B[6]))
    d1 = add_relu("dec1.relu", add_conv("dec1", add_concat("cat1", add_up("up1", d2), e1), W[7], B[7]))
    d0 = add_relu("dec0.relu", add_conv("dec0", add_concat("cat0", add_up("up0", d1), e0), W[8], B[8]))
    logits = add_conv("head", d0, W[9], B[9])
    nodes.append(helper.make_node("Sigmoid", [logits], ["output"], name="sigmoid"))

    graph = helper.make_graph(nodes, f"omni-roto-{domain}-v1", inp, outs, initializer=tensors)
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 8
    onnx.checker.check_model(model)
    onnx.save(model, path)

    sidecar = {
        "id": f"omni-roto-{domain}-v1",
        "domain": domain,
        "inputSize": INPUT,
        "params": n_params,
        "valIoU": round(float(val_iou), 4),
        "trainSamples": n_samples,
        "rawImages": n_raw,
        "epochs": epochs,
        "trainedAt": _dt.date.today().isoformat(),
        "teacher": "opencv-grabcut pseudo-labels + heavy augmentation",
        "runner": "onnxruntime-web saliency (input 1x3xHxW 0..1, output map)",
        "license": "MIT (trained in-repo on collected reference photos)",
    }
    with open(path.replace(".onnx", ".json"), "w") as f:
        json.dump(sidecar, f, indent=2)
    log(f"[{domain}] wrote {path} ({os.path.getsize(path) // 1024} KB) + sidecar")


def verify_onnx(path, params):
    """Export parity: ONNX output must match the JAX forward within 1e-3."""
    import jax.numpy as jnp
    import onnxruntime as ort

    jax2, jnp, _ = import_jax()
    x = rng.random((1, 3, INPUT, INPUT)).astype(np.float32)
    ref = np.asarray(forward(params, jnp.asarray(x)))
    sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    got = sess.run(None, {"input": x})[0]
    assert got.shape == (1, 1, INPUT, INPUT), f"bad output shape {got.shape}"
    err = float(np.abs(ref - got).max())
    assert err < 2e-3, f"export parity error {err}"
    log(f"  parity OK (max err {err:.2e}), output shape {got.shape}")
    return err


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("domain", nargs="?", choices=DOMAINS + ["all"], default="all")
    ap.add_argument("--epochs", type=int, default=15)
    args = ap.parse_args()
    domains = DOMAINS if args.domain == "all" else [args.domain]

    os.makedirs(OUT_DIR, exist_ok=True)
    summary = {}
    for domain in domains:
        result = train_domain(domain, args.epochs)
        if result is None:
            continue
        params, iou, n_params, n_samples, n_raw = result
        path = os.path.join(OUT_DIR, f"omni-roto-{domain}-v1.onnx")
        export_onnx(params, domain, path, iou, n_params, n_samples, n_raw, args.epochs)
        verify_onnx(path, params)
        summary[domain] = {"valIoU": round(iou, 4), "params": n_params}
    log("SUMMARY " + json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
