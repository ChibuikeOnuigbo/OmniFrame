/**
 * Arbitrary-rate polyphase sinc resampling (see resample.js).
 * Pure JS + no browser APIs on purpose: imported by the app AND by the
 * offline node evidence runner so both run identical resampling code.
 */
export declare function resampleChannels(
  channelData: Float32Array[],
  rate: number,
): { channelData: Float32Array[]; length: number }
