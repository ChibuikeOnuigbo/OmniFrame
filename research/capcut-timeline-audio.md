# Timeline media and audio extraction research

Retrieved 2026-09-21. This is behavioral research only; no CapCut or OpenShot source/UI code was copied.

## Verified references

- CapCut, “Extract Audio from Video on Web, PC, and App”: https://www.capcut.com/resource/extract-audio-from-video-online
  - A timeline video can expose “Separate audio” / “Extract audio”.
  - Extraction creates an independent audio layer beneath the video.
  - Extracted audio is independently movable and trimmable.
  - CapCut documents volume, noise reduction, fades, voice changes, and speed as follow-on audio operations.
- CapCut, “Sync Audio and Video”: https://www.capcut.com/resource/sync-audio-and-video
  - Desktop workflow uses right-click → Extract audio and then permits independent timing adjustment.
  - Loudness normalization is presented as an audio follow-on operation.
- CapCut, “Extract Audio from Video”: https://www.capcut.com/resource/extract-audio-from-video
  - Mobile documentation describes the detached audio as a blue waveform below the source video.
  - Desktop documentation places the extracted audio on a new independent track.
- OpenShot 4.0 timeline article: https://www.openshot.org/blog/2026/08/30/openshot-40-record-edit-color-like-never-before/
  - Professional timeline conventions include video thumbnails, audio waveforms, persistent track controls, and adaptive commands according to whether a clip contains video, audio, or both.
- OpenShot feature page: https://www.openshot.org/
  - Timeline presentation combines clip thumbnails, waveforms, snapping, and frame-accurate controls.

## Independent OmniFrame decisions

1. An empty document has no placeholder tracks. Tracks are created automatically from imported/placed media.
2. A video/image-only sequence identifies itself as `Video`; an audio-only sequence as `Audio`; mixed content as `Video + Audio`.
3. Video clips use source-derived filmstrip imagery captured from the imported file.
4. Image clips use the imported image itself as their visual strip.
5. Audio clips use peaks decoded from the real source samples, not decorative random bars.
6. Extract Audio creates an independent aligned audio clip, mutes the source video's linked audio to prevent doubling, and changes sequence classification to `Video + Audio`.
7. Extraction is idempotent per source clip; the UI no longer offers extraction after it has already occurred.
8. Follow-on capabilities such as fades, noise reduction, normalization, beat markers, and audio-only export remain separate future implementations and must not be shown as functioning controls until real processing exists.
