import { type RawAudio } from './wav-utils.js';
import type { ONNXHTDemucs } from './onnx-htdemucs.js';
export type ProgressCallback = (step: number, total: number) => void;
export declare function separateTracks(model: ONNXHTDemucs, rawAudio: RawAudio, progressCallback?: ProgressCallback, overlap?: number): Promise<Record<string, RawAudio>>;
