# Audio-track visual study

Date: 2026-09-22

## Scope and rights boundary

The supplied Google Images query was used as a discovery prompt, not as an asset source. Search-result images and videos are commonly copyrighted and Google does not grant redistribution rights. OmniFrame therefore does not bulk-download, extract, or commit those third-party assets. This study inspected official CapCut material and public open-source-editor documentation, measured a temporary sample locally, recorded UI conventions, and removed the temporary files.

## Sources inspected

### Official CapCut

1. https://www.capcut.com/resource/audio-editor-app
2. https://www.capcut.com/resource/how-to-cut-mp3-files
3. https://www.capcut.com/resource/extract-audio-from-video
4. https://www.capcut.com/resource/extract-audio-from-video-online
5. https://www.capcut.com/resource/cut-recordings
6. https://www.capcut.com/resource/how-to-fade-music-in-imovie
7. https://www.capcut.com/resource/best-music-editing-software
8. https://www.capcut.com/resource/online-music-cutter
9. https://www.capcut.com/resource/best-sound-waves-generators
10. https://www.capcut.com/tools/online-audio-editor

### Open-source editor references

11. https://kdenlive.org/
12. https://docs.kdenlive.org/en/user_interface/timeline.html
13. https://userbase.kde.org/Kdenlive/Manual/Timeline/Editing
14. https://www.openshot.org/
15. https://cdn.openshot.org/static/files/user-guide/OpenShotVideoEditor.pdf

## OpenCV sample measurements

Ten temporary search-reference images were decoded with OpenCV rather than trusted by filename. The sample included five CapCut images and five Kdenlive images/animations.

- Decoded dimensions ranged from 288×720 to 2448×1269.
- CapCut full-editor references were predominantly dark: mean HSV value approximately 31–69 in the sampled stills.
- Edge density in full-editor references was approximately 0.021–0.094, consistent with restrained panel borders and information-dense timelines.
- The Kdenlive audio-envelope example clearly separated waveform fill, volume envelope, keyframe points, and selection border.
- Temporary samples were not retained in the repository.

## Repeated visual conventions

1. Time always runs left-to-right under a ruler shared by all tracks.
2. Audio is normally placed below its related video.
3. Dedicated audio clips use a continuous amplitude waveform, not filmstrip thumbnails.
4. The waveform is source-derived and scales horizontally with timeline zoom.
5. Clip name and a small audio/music identity mark sit above or over the waveform.
6. Clip background and waveform use related hues with enough luminance contrast to distinguish peaks and silence.
7. Selection is communicated with a thin bright outline; it does not replace the waveform.
8. Track controls live in a fixed header column, aligned with the clip lane.
9. The playhead crosses the ruler and every visible lane.
10. Trimming uses clip edges; splitting uses the shared playhead/tool model.
11. Extracted audio becomes a separate editable lane below the source video.
12. Professional editors keep the waveform visible while exposing volume, fade, mute, lock, and envelope controls separately.
13. Dense editors avoid oversized audio icons inside timeline clips; identity icons are small and secondary to waveform shape.
14. Different tracks remain visually distinct through lane labels, iconography, and color—not through large decorative cards.

## OmniFrame implications

OmniFrame already follows the principal conventions: decoded source waveforms, independent audio tracks below video, small music identity icon, filename label, timeline-wide playhead, trim/split/move behavior, mute/lock controls, and a violet selection outline. Future audio work should prioritize real fade handles and volume-envelope keyframes rather than decorative waveform variants. No CapCut artwork or implementation is copied.
