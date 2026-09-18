# Export

Export is a cancelable job with preparation, render, encode, audio and mux stages. Presets are data and codec support is probed at runtime.

The browser path now has a real local MP4 adapter: WebCodecs H.264 video encoding plus WebCodecs AAC audio encoding are passed to the MIT `mp4-muxer` package. The export action refuses to produce a file when either encoder configuration is rejected or the source audio cannot be decoded; it does not fall back to a fake download or a silent track. The current browser adapter renders the selected local video clip, including source trim, transform and mask-aware CPU effects, through the same definitions as the canvas preview.

The native target is designed for Rust/FFmpeg/hardware-aware encoding and must be enabled only after the toolchain, FFmpeg build/licence composition and fixture outputs are audited. HEVC/AV1 and social presets remain capability-gated rather than promised on every machine.

Preview and export consume the same effect definitions. Full timeline composition, audio mixing/ducking, transitions and native final-quality scheduling remain release gates and are recorded in `feature-matrix.json` rather than hidden behind the export button.
