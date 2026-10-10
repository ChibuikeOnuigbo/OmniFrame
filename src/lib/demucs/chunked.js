/**
 * Chunked separation accumulation — the host-side half of the WASM-fallback
 * pass runner (src/lib/demucs/index.ts#runChunkedPassInWorker).
 *
 * The math is a verbatim port of the vendored overlap-add in apply.js
 * #applySplits (triangle window, weighted accumulation, weight-sum
 * normalization) so that executing each chunk in its own throwaway worker
 * produces the same stems as one full-track pass. Kept in a dependency-free
 * module of its own so qa/demucs-chunked-parity.mjs can prove the
 * equivalence in Node with a mock model (the real model needs a browser).
 */

/**
 * The triangle-shaped crossfade window applySplits applies per chunk.
 * Verbatim from apply.js: weight[i] = min(i + 1, segment - i), normalized
 * by its max.
 */
export function triangleWeights(segment) {
  const weight = new Float32Array(segment)
  for (let i = 0; i < Math.floor(segment / 2) + 1; i++) weight[i] = i + 1
  for (let i = Math.floor(segment / 2) + 1; i < segment; i++) weight[i] = segment - i
  let maxWeight = -Infinity
  for (let i = 0; i < segment; i++) if (weight[i] > maxWeight) maxWeight = weight[i]
  for (let i = 0; i < segment; i++) weight[i] /= maxWeight
  return weight
}

/**
 * Accumulate one chunk's stems into the pass buffers.
 * `acc` is [stem][channel] Float32Array(length); `chunkStems` is the
 * worker's stems object ({ name: { channelData } }) for the slice
 * [offset, offset + chunkLength).
 */
export function accumulateChunk(acc, sumWeight, offset, chunkStems, weight) {
  const first = Object.values(chunkStems)[0]
  const chunkLength = first.channelData[0].length
  for (const [name, stem] of Object.entries(chunkStems)) {
    const channels = acc[name]
    if (!channels) continue
    for (let c = 0; c < channels.length; c++) {
      const src = stem.channelData[c]
      if (!src || src.length < chunkLength) continue
      const dst = channels[c]
      for (let t = 0; t < chunkLength; t++) dst[offset + t] += weight[t] * src[t]
    }
  }
  for (let t = 0; t < chunkLength; t++) sumWeight[offset + t] += weight[t]
  return chunkLength
}

/**
 * Divide the accumulated stems by the accumulated weights — the final step
 * of applySplits. Mutates and returns `acc`.
 */
export function normalizeChunked(acc, sumWeight) {
  const length = sumWeight.length
  for (const name of Object.keys(acc)) {
    for (const ch of acc[name]) {
      for (let i = 0; i < length; i++) ch[i] /= sumWeight[i]
    }
  }
  return acc
}
