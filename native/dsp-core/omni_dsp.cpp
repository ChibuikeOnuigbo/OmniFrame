/**
 * OmniFrame native DSP core — freestanding C++ compiled to wasm32.
 *
 * Build:  ./scripts/build-dsp-wasm.sh  →  public/wasm/omni-dsp.wasm
 * Parity: qa/native-dsp-parity.mjs asserts this core computes the SAME
 *         results as the pure-JS fallbacks (resample bar 1e-5; the
 *         double-precision ops bar 1e-6). Run it after any change here.
 *
 * This module implements the hot DSP loops of the pipeline — the ones that
 * run over millions of samples per clip — with the exact same arithmetic as
 * the JS implementations (src/lib/demucs/resample.js, the removeLsLeakage /
 * pass-averaging loops in src/lib/demucs/index.ts, and the peak-safety
 * policy of encodeAudioBufferToWav in src/lib/voiceIsolation.ts):
 *
 *   omni_resample        polyphase windowed-sinc resampler, asetrate
 *                        semantics (32-tap Blackman-windowed sinc, 2048
 *                        phases, per-phase DC normalization, anti-aliasing
 *                        cutoff at Nyquist/rate when decimating)
 *   omni_ls_leakage      in-place least-squares stem de-leak (±0.5 clamp)
 *   omni_average_passes  finite-aware averaging of shift-averaged passes
 *   omni_peak_scale      encode-time peak safety scaling
 *
 * Freestanding: no libc, no libm, no exceptions, no RTTI, no allocator.
 * The only math used is double-precision multiply/add — sin/cos come from
 * a local fdlibm-style kernel (range reduction + minimax polynomials),
 * accurate to ~1 ulp, which is why the resampled output matches the JS
 * (Math.sin) path to the last float32 bit or the one next to it
 * (measured max|diff| 3e-8 — one f32 ulp at these magnitudes).
 *
 * FLAT ABI (no malloc): every function takes pointers into the module's
 * exported linear memory. The JS side (src/lib/native/dspNative.ts) reads
 * the exported `__heap_base` global, grows memory to fit, and places its
 * scratch buffers from there; nothing below __heap_base is touched except
 * the static polyphase table, which this module builds lazily on first
 * use (and rebuilds when the resample cutoff changes).
 */

// ─── math kernel (fdlibm-style, ~1 ulp) ─────────────────────────────────────

/** |x| without libm. */
static double omni_abs(double x) { return x < 0.0 ? -x : x; }

/** sin on |r| <= π/4 — Taylor through x¹⁷ (truncation < 6e-20 there). */
static double omni_k_sin(double r) {
  static const double S1 = -0.16666666666666666;      // -1/3!
  static const double S2 = 0.008333333333333333;      // +1/5!
  static const double S3 = -0.0001984126984126984;    // -1/7!
  static const double S4 = 2.7557319223985893e-06;    // +1/9!
  static const double S5 = -2.505210838544172e-08;    // -1/11!
  static const double S6 = 1.6059043836821613e-10;    // +1/13!
  static const double S7 = -7.647163731819816e-13;    // -1/15!
  static const double S8 = 2.8114572543455206e-15;    // +1/17!
  const double z = r * r;
  const double p = S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * (S6 + z * (S7 + z * S8))))));
  return r + r * z * p;
}

/** cos on |r| <= π/4 — Taylor through x¹⁶ (truncation < 1.5e-18 there). */
static double omni_k_cos(double r) {
  static const double C1 = 0.041666666666666664;      // +1/4!
  static const double C2 = -0.001388888888888889;     // -1/6!
  static const double C3 = 2.48015873015873e-05;      // +1/8!
  static const double C4 = -2.755731922398589e-07;    // -1/10!
  static const double C5 = 2.08767569878681e-09;      // +1/12!
  static const double C6 = -1.1470745597729725e-11;   // -1/14!
  static const double C7 = 4.779477332387385e-14;     // +1/16!
  const double z = r * r;
  const double p = z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * (C6 + z * C7))))));
  return 1.0 - 0.5 * z + p;
}

/**
 * sin(x) for |x| up to a few hundred, without libm. Range reduction by
 * Cody-Waite two-word split of π/2 (the residual π/2 − pio2_1 − pio2_1t is
 * 3.7e-21, so worst-case reduction error is 1.3e-19 at |k| = 36 — the
 * largest this module ever produces), then the Taylor kernel above. ~1 ulp,
 * matching V8's Math.sin closely enough that float32 outputs agree to the
 * last bit or the one next to it.
 */
static double omni_sin(double x) {
  static const double PI_OVER_2 = 1.57079632679489661923;
  static const double INV_PIO2 = 0.6366197723675814; // 2/π, rounded once
  // π/2 = pio2_1 + pio2_1t + 3.7e-21 (fdlibm two-word Cody-Waite split;
  // pio2_1 keeps 33 significant bits so k·pio2_1 is exact for |k| < 2^20)
  static const double PIO2_1 = 1.57079632673412561417e+00;
  static const double PIO2_1T = 6.07710050650619224932e-11;
  const int negative = x < 0.0;
  const double y = omni_abs(x);
  if (y < PI_OVER_2 / 2.0) return negative ? -omni_k_sin(y) : omni_k_sin(y);
  // k = round(y / (π/2)) — |k| <= 36 for every caller in this module
  const int kk = (int)(y * INV_PIO2 + 0.5); // y >= 0 here
  const double r = y - kk * PIO2_1 - kk * PIO2_1T;
  double v;
  switch (kk & 3) {
    case 0: v = omni_k_sin(r); break;
    case 1: v = omni_k_cos(r); break;
    case 2: v = -omni_k_sin(r); break;
    default: v = -omni_k_cos(r); break;
  }
  return negative ? -v : v;
}

/** cos(π·t) via sin(π·(0.5 − t)) — keeps the argument small for the kernel. */
static double omni_cos_pi(double t) { return omni_sin(3.14159265358979323846 * (0.5 - t)); }

// ─── resampler (mirrors src/lib/demucs/resample.js exactly) ─────────────────

static const int OMNI_TAPS_PER_SIDE = 16; // 32 taps total
static const int OMNI_PHASES = 2048;

/** Lazily-built polyphase table: [phase][tap], stored float32 like the JS. */
static float g_table[OMNI_PHASES][2 * OMNI_TAPS_PER_SIDE]; // 256 KB BSS
static double g_table_fc = -1.0;                           // cutoff it was built for

/** sinc(x) = sin(πx)/(πx), x == 0 → 1 — same as resample.js. */
static double omni_sinc(double x) {
  if (x == 0.0) return 1.0;
  const double px = 3.14159265358979323846 * x;
  return omni_sin(px) / px;
}

/** Blackman window on |x| <= 1, 0 outside — same constants as resample.js. */
static double omni_blackman(double x) {
  if (x <= -1.0 || x >= 1.0) return 0.0;
  return 0.42 + 0.5 * omni_cos_pi(x) + 0.08 * omni_cos_pi(2.0 * x);
}

/**
 * Builds the table for cutoff `fc` cycles/input-sample. Mirrors buildTable()
 * in resample.js, including the float32 rounding points: each weight is
 * stored as float32, the running sum accumulates the unrounded double, and
 * the DC normalization divides the STORED value by the double sum.
 */
static void omni_build_table(double fc) {
  const int K = 2 * OMNI_TAPS_PER_SIDE;
  for (int q = 0; q < OMNI_PHASES; q++) {
    const double phi = (double)q / (double)OMNI_PHASES;
    float* row = g_table[q];
    double sum = 0.0;
    for (int t = 0; t < K; t++) {
      const double x = (double)(t - OMNI_TAPS_PER_SIDE + 1) - phi; // input-sample distance
      const double w = 2.0 * fc * omni_sinc(2.0 * fc * x) * omni_blackman(x / (double)OMNI_TAPS_PER_SIDE);
      row[t] = (float)w;
      sum += w;
    }
    if (omni_abs(sum) > 1e-9) {
      for (int t = 0; t < K; t++) row[t] = (float)((double)row[t] / sum);
    }
  }
  g_table_fc = fc;
}

/**
 * Mono planar resample, playing the input `rate`x faster (rate > 1) or
 * slower (rate < 1). `outLen` must be max(1, ceil(inLen / rate)) — the JS
 * wrapper computes it. Output sample j interpolates at input position
 * j·rate with the phase-quantized (1/2048) polyphase row; input samples
 * outside [0, inLen) contribute nothing (zero-padded edges, like the JS).
 */
extern "C" void omni_resample(const float* in, int inLen, double rate, float* out, int outLen) {
  if (inLen <= 0 || outLen <= 0) return;
  // anti-aliasing: when decimating the output Nyquist maps to 0.5/rate
  // cycles per input sample (rate < 1 keeps the input Nyquist)
  const double fc = rate > 1.0 ? 0.5 / rate : 0.5;
  if (fc != g_table_fc) omni_build_table(fc);

  const int K = 2 * OMNI_TAPS_PER_SIDE;
  for (int j = 0; j < outLen; j++) {
    const double p = (double)j * rate;
    const int i = (int)p; // p >= 0 → truncation == Math.floor
    const double ph = (p - (double)i) * (double)OMNI_PHASES;
    int q = (int)(ph + 0.5); // p >= 0 → truncation of (ph+0.5) == Math.round
    if (q > OMNI_PHASES - 1) q = OMNI_PHASES - 1;
    if (q < 0) q = 0;
    const float* row = g_table[q];
    double acc = 0.0;
    for (int t = 0; t < K; t++) {
      const int m = i - OMNI_TAPS_PER_SIDE + 1 + t;
      if (m >= 0 && m < inLen) acc += (double)in[m] * (double)row[t];
    }
    out[j] = (float)acc;
  }
}

// ─── least-squares stem de-leak (mirrors removeLsLeakage in index.ts) ───────

/**
 * Subtracts a·ref from target in place, a = <target,ref>/<ref,ref> clamped
 * to ±0.5. Returns the coefficient, or 0 when the reference is silent
 * (rr < 1e-12) or the clamped coefficient is exactly 0. Double accumulate,
 * float32 store per sample — same rounding points as the JS loop.
 */
extern "C" double omni_ls_leakage(float* target, const float* ref, int len) {
  if (len <= 0) return 0.0;
  double dot = 0.0;
  double rr = 0.0;
  for (int i = 0; i < len; i++) {
    dot += (double)target[i] * (double)ref[i];
    rr += (double)ref[i] * (double)ref[i];
  }
  if (rr < 1e-12) return 0.0;
  double a = dot / rr;
  if (a > 0.5) a = 0.5;
  if (a < -0.5) a = -0.5;
  if (a == 0.0) return 0.0;
  for (int i = 0; i < len; i++) target[i] = (float)((double)target[i] - a * (double)ref[i]);
  return a;
}

// ─── pass averaging (mirrors the finite-aware loop in index.ts) ─────────────

/**
 * Averages `passCount` passes of `len` samples, pass-major layout
 * (passes[p*len + i]). Only finite values (no NaN, no ±Inf — some WASM
 * builds emit NaN around chunk tails) contribute; samples with zero finite
 * passes get 0 and missing[i] = 1. Returns the count of missing samples.
 */
extern "C" int omni_average_passes(const float* passes, int passCount, int len, float* out, unsigned char* missing) {
  if (len <= 0 || passCount <= 0) return 0;
  int missingCount = 0;
  for (int i = 0; i < len; i++) {
    double sum = 0.0;
    int n = 0;
    for (int p = 0; p < passCount; p++) {
      const double v = (double)passes[(unsigned)p * (unsigned)len + (unsigned)i];
      // Number.isFinite: excludes NaN (v != v) and ±Inf (v - v != 0)
      if (v == v && v - v == 0.0) { sum += v; n++; }
    }
    if (n > 0) {
      out[i] = (float)(sum / (double)n);
      missing[i] = 0;
    } else { out[i] = 0.0f; missing[i] = 1; missingCount++; }
  }
  return missingCount;
}

// ─── peak safety (mirrors the encode policy in voiceIsolation.ts) ───────────

/**
 * If the max |sample| over both channels exceeds `threshold`, scales both
 * in place by `target / peak` (one shared gain — no per-channel image
 * shift) and returns the gain; otherwise returns 1 and touches nothing.
 * Defaults in the JS wrapper: threshold 0.999, target 0.98.
 */
extern "C" double omni_peak_scale(float* a, float* b, int len, double threshold, double target) {
  if (len <= 0) return 1.0;
  double peak = 0.0;
  for (int i = 0; i < len; i++) {
    const double va = omni_abs((double)a[i]);
    if (va > peak) peak = va;
    const double vb = omni_abs((double)b[i]);
    if (vb > peak) peak = vb;
  }
  if (peak <= threshold) return 1.0;
  const double g = target / peak;
  for (int i = 0; i < len; i++) {
    a[i] = (float)((double)a[i] * g);
    b[i] = (float)((double)b[i] * g);
  }
  return g;
}
