import type { Tensor } from './dsp.js';
export declare class ONNXHTDemucs {
    readonly sources: readonly ["drums", "bass", "other", "vocals"];
    readonly audioChannels = 2;
    readonly samplerate = 44100;
    readonly segment = 7.8;
    session: import('onnxruntime-web').InferenceSession;
    inputNames: readonly string[];
    outputNames: readonly string[];
    private constructor();
    static init(modelWeights: ArrayBuffer): Promise<ONNXHTDemucs>;
    validLength(length: number): number;
    forward(mix: Tensor, magspec: Tensor): Promise<{
        outX: Tensor;
        outXt: Tensor;
    }>;
}
