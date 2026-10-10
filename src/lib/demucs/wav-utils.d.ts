export type RawAudio = {
    channelData: Float32Array[];
    sampleRate: number;
};
export declare function wavToSamples(buffer: Uint8Array): RawAudio;
export declare function samplesToWav(channelData: Float32Array[], sampleRate?: number, asFloat?: boolean): Uint8Array<ArrayBuffer>;
export declare function planarize(channelData: Float32Array[]): Float32Array;
