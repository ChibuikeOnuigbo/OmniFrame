# Transition video results

Every transition preset rendered for real inside the OmniFrame editor at 24 fps, between the two test clips (**CLIP 1** `#dc2645` -> **CLIP 2** `#2456e6`, 6 s each, cut at 6 s). Each video was produced through the agent surface (`window.__omniframe_transitions.apply`) with the preset's **base duration**; frames were captured from the live editor canvas (`qa/render-transition-videos.mjs`) and encoded by `qa/encode-transition-videos.py`.

A transition always sits **between two clips**: the clip on each side of the cut must hold at least `duration / 2` seconds of material. Every preset ships a **base** number of seconds; you can raise or lower it in the Transitions panel (slider + chips), but the applied value is capped to **0.1 s floor / 5 s ceiling**.

- **Combined reel (all 33 transitions, title cards included):** [all-transitions-reel.mp4](./all-transitions-reel.mp4)
- Total video payload: 4.1 MB

| # | Transition | Category | Base (s) | Applied (s) | Video |
|---|------------|----------|----------|-------------|-------|
| 1 | Cross Dissolve | Dissolve | 1.2 | 1.2 | [cross_dissolve.mp4](./cross_dissolve.mp4) |
| 2 | Film Dissolve | Dissolve | 1.4 | 1.4 | [film_dissolve.mp4](./film_dissolve.mp4) |
| 3 | Additive Dissolve | Dissolve | 1.2 | 1.2 | [additive_dissolve.mp4](./additive_dissolve.mp4) |
| 4 | Dip to Black | Dissolve | 1 | 1 | [dip_to_black.mp4](./dip_to_black.mp4) |
| 5 | Dip to White | Dissolve | 1 | 1 | [dip_to_white.mp4](./dip_to_white.mp4) |
| 6 | Blur Dissolve | Dissolve | 1.5 | 1.5 | [blur_dissolve.mp4](./blur_dissolve.mp4) |
| 7 | Light Leak | Dissolve | 1.6 | 1.6 | [light_leak.mp4](./light_leak.mp4) |
| 8 | Wipe Left | Wipe | 0.8 | 0.8 | [wipe_left.mp4](./wipe_left.mp4) |
| 9 | Wipe Right | Wipe | 0.8 | 0.8 | [wipe_right.mp4](./wipe_right.mp4) |
| 10 | Wipe Up | Wipe | 0.8 | 0.8 | [wipe_up.mp4](./wipe_up.mp4) |
| 11 | Wipe Down | Wipe | 0.8 | 0.8 | [wipe_down.mp4](./wipe_down.mp4) |
| 12 | Clock Wipe | Wipe | 1 | 1 | [clock_wipe.mp4](./clock_wipe.mp4) |
| 13 | Pinwheel | Wipe | 1 | 1 | [pinwheel.mp4](./pinwheel.mp4) |
| 14 | Checker Wipe | Wipe | 0.9 | 0.9 | [checker_wipe.mp4](./checker_wipe.mp4) |
| 15 | Venetian Blinds H | Wipe | 0.9 | 0.9 | [blinds_h.mp4](./blinds_h.mp4) |
| 16 | Venetian Blinds V | Wipe | 0.9 | 0.9 | [blinds_v.mp4](./blinds_v.mp4) |
| 17 | Slide Left | Slide | 0.9 | 0.9 | [slide_left.mp4](./slide_left.mp4) |
| 18 | Slide Right | Slide | 0.9 | 0.9 | [slide_right.mp4](./slide_right.mp4) |
| 19 | Slide Up | Slide | 0.9 | 0.9 | [slide_up.mp4](./slide_up.mp4) |
| 20 | Slide Down | Slide | 0.9 | 0.9 | [slide_down.mp4](./slide_down.mp4) |
| 21 | Whip Left | Slide | 0.5 | 0.5 | [whip_left.mp4](./whip_left.mp4) |
| 22 | Whip Right | Slide | 0.5 | 0.5 | [whip_right.mp4](./whip_right.mp4) |
| 23 | Barn Doors | Slide | 1 | 1 | [barn_doors.mp4](./barn_doors.mp4) |
| 24 | Center Split | Slide | 0.9 | 0.9 | [center_split.mp4](./center_split.mp4) |
| 25 | Page Turn | Slide | 1.1 | 1.1 | [page_turn.mp4](./page_turn.mp4) |
| 26 | Iris Round | Shapes | 1 | 1 | [iris_circle.mp4](./iris_circle.mp4) |
| 27 | Iris Diamond | Shapes | 1 | 1 | [iris_diamond.mp4](./iris_diamond.mp4) |
| 28 | Iris Box | Shapes | 1 | 1 | [iris_box.mp4](./iris_box.mp4) |
| 29 | Zoom Push | Zoom & Motion | 1 | 1 | [zoom.mp4](./zoom.mp4) |
| 30 | Zoom Out | Zoom & Motion | 1 | 1 | [zoom_out.mp4](./zoom_out.mp4) |
| 31 | Spin | Zoom & Motion | 0.8 | 0.8 | [spin.mp4](./spin.mp4) |
| 32 | Flip | Zoom & Motion | 0.7 | 0.7 | [flip_h.mp4](./flip_h.mp4) |
| 33 | Glitch | Special | 0.6 | 0.6 | [glitch.mp4](./glitch.mp4) |

## Re-render

```bash
LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/render-transition-videos.mjs
python3 qa/encode-transition-videos.py
```
