/*
 * RNNoise parity reference driver — compiled with NATIVE gcc, fed the same
 * deterministic fixture as the wasm module, and its output is checked in as
 * qa/fixtures/rnnoise-parity-ref.f32.
 *
 * It mirrors src/lib/rnnoise.ts exactly:
 *   - reads f32le 48 kHz mono at ±1 scale
 *   - scales to 16-bit PCM range (x * 32768) before rnnoise_process_frame
 *   - divides the output by 32768
 *   - drops the first output frame (one-frame algorithmic delay, same as
 *     examples/rnnoise_demo.c skipping frame 0)
 *
 * Build (from the repo root):
 *   gcc -O2 -DNDEBUG -I native/rnnoise/src -I native/rnnoise/include \
 *       qa/rnnoise-ref-driver.c \
 *       native/rnnoise/src/{denoise,rnn,rnn_data,rnn_reader,pitch,celt_lpc,kiss_fft}.c \
 *       -lm -o /tmp/rnnoise-ref
 *
 * Usage: rnnoise-ref < input.f32 > output.f32
 */
#include <stdio.h>
#include <stdlib.h>
#include "rnnoise.h"

#define SCALE 32768.0f

int main(void) {
  DenoiseState *st = rnnoise_create(NULL);
  int n = rnnoise_get_frame_size();
  float *in = malloc(sizeof(float) * n);
  float *out = malloc(sizeof(float) * n);
  int first = 1;
  for (;;) {
    size_t r = fread(in, sizeof(float), n, stdin);
    if (r < (size_t)n) break;
    for (int i = 0; i < n; i++) in[i] *= SCALE;
    rnnoise_process_frame(st, out, in);
    if (!first) {
      for (int i = 0; i < n; i++) out[i] /= SCALE;
      fwrite(out, sizeof(float), n, stdout);
    }
    first = 0;
  }
  rnnoise_destroy(st);
  free(in);
  free(out);
  return 0;
}
