import type { Tensor } from './dsp.js';
export declare class ONNXHTDemucs {
    readonly sources: readonly ["drums", "bass", "other", "vocals"];
    readonly audioChannels = 2;
    readonly samplerate = 44100;
    /** Segment length in seconds (7.8 = the training length; the ONNX export
     *  takes a FIXED 343,980-sample input — not shrinkable). */
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
