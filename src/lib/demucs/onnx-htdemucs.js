import * as ort from 'onnxruntime-web';

/**
 * ONNX wrapper for Meta's Demucs v4 "Hybrid Transformer" (htdemucs) model.
 *
 * Vendored from the MIT-licensed `demucs` npm package (bakkot's JS/ONNX port
 * of facebookresearch/demucs), lightly adapted for OmniFrame:
 *  - always requests the webgpu execution provider with automatic wasm
 *    fallback (we only run in the browser)
 *  - no `wasmPaths` override — onnxruntime-web resolves its own wasm assets
 *    through the bundler.
 */
export class ONNXHTDemucs {
    sources = ['drums', 'bass', 'other', 'vocals'];
    audioChannels = 2;
    samplerate = 44100;
    segment = 7.8;
    // @ts-expect-error these are initialized in the async initializer
    session;
    // @ts-expect-error
    inputNames;
    // @ts-expect-error
    outputNames;
    constructor() { }
    static async init(modelWeights) {
        let instance = new ONNXHTDemucs();
        let session = await ort.InferenceSession.create(modelWeights, { executionProviders: ['webgpu', 'wasm'] });
        instance.session = session;
        instance.inputNames = session.inputNames;
        instance.outputNames = session.outputNames;
        return instance;
    }
    validLength(length) {
        const trainingLength = Math.floor(this.segment * this.samplerate);
        if (trainingLength < length) {
            throw new Error(`Given length ${length} is longer than training length ${trainingLength}`);
        }
        return trainingLength;
    }
    async forward(mix, magspec) {
        const mixTensor = new ort.Tensor('float32', mix.data, mix.shape);
        const magspecTensor = new ort.Tensor('float32', magspec.data, magspec.shape);
        const feeds = {};
        feeds[this.inputNames[0]] = mixTensor;
        feeds[this.inputNames[1]] = magspecTensor;
        const results = await this.session.run(feeds);
        const outX = results[this.outputNames[0]];
        const outXt = results[this.outputNames[1]];
        return {
            outX: { data: outX.data, shape: outX.dims },
            outXt: { data: outXt.data, shape: outXt.dims },
        };
    }
}
