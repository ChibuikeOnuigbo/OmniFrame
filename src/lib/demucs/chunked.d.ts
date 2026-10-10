/** Triangle crossfade window of applySplits (weight[i] = min(i+1, segment-i) / max). */
export declare function triangleWeights(segment: number): Float32Array

/** Accumulate one chunk's stems into the pass buffers at `offset`. */
export declare function accumulateChunk(
  acc: Record<string, Float32Array[]>,
  sumWeight: Float32Array,
  offset: number,
  chunkStems: { [name: string]: { channelData: Float32Array[]; sampleRate?: number } },
  weight: Float32Array,
): number

/** Divide accumulated stems by the accumulated weights (in place). */
export declare function normalizeChunked(
  acc: Record<string, Float32Array[]>,
  sumWeight: Float32Array,
): Record<string, Float32Array[]>
