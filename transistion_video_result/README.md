# Transition video results

Every transition preset rendered for real inside the OmniFrame editor at 24 fps, between the two test clips (**CLIP 1** `#dc2645` -> **CLIP 2** `#2456e6`, 6 s each, cut at 6 s). Each video was produced through the agent surface (`window.__omniframe_transitions.apply`) with the preset's **base duration**; frames were captured from the live editor canvas (`qa/render-transition-videos.mjs`) and encoded by `qa/encode-transition-videos.py`.

A transition always sits **between two clips**: the clip on each side of the cut must hold at least `duration / 2` seconds of material. Every preset ships a **base** number of seconds; you can raise or lower it in the Transitions panel (slider + chips), but the applied value is capped to **0.1 s floor / 5 s ceiling**.

- **Combined reel (all 383 transitions, title cards included):** [all-transitions-reel.mp4](./all-transitions-reel.mp4)
- Total video payload: 45.5 MB

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
| 34 | Glitch Slice Mild | Glitch | 0.7 | 0.7 | [glitch_slice_mild.mp4](./glitch_slice_mild.mp4) |
| 35 | Glitch Slice Medium | Glitch | 0.6 | 0.6 | [glitch_slice_medium.mp4](./glitch_slice_medium.mp4) |
| 36 | Glitch Slice Heavy | Glitch | 0.5 | 0.5 | [glitch_slice_heavy.mp4](./glitch_slice_heavy.mp4) |
| 37 | Glitch Slice Extreme | Glitch | 0.45 | 0.45 | [glitch_slice_extreme.mp4](./glitch_slice_extreme.mp4) |
| 38 | Glitch Slice Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_slice_tv.mp4](./glitch_slice_tv.mp4) |
| 39 | Glitch Rgb Mild | Glitch | 0.7 | 0.7 | [glitch_rgb_mild.mp4](./glitch_rgb_mild.mp4) |
| 40 | Glitch Rgb Medium | Glitch | 0.6 | 0.6 | [glitch_rgb_medium.mp4](./glitch_rgb_medium.mp4) |
| 41 | Glitch Rgb Heavy | Glitch | 0.5 | 0.5 | [glitch_rgb_heavy.mp4](./glitch_rgb_heavy.mp4) |
| 42 | Glitch Rgb Extreme | Glitch | 0.45 | 0.45 | [glitch_rgb_extreme.mp4](./glitch_rgb_extreme.mp4) |
| 43 | Glitch Rgb Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_rgb_tv.mp4](./glitch_rgb_tv.mp4) |
| 44 | Glitch Block Mild | Glitch | 0.7 | 0.7 | [glitch_block_mild.mp4](./glitch_block_mild.mp4) |
| 45 | Glitch Block Medium | Glitch | 0.6 | 0.6 | [glitch_block_medium.mp4](./glitch_block_medium.mp4) |
| 46 | Glitch Block Heavy | Glitch | 0.5 | 0.5 | [glitch_block_heavy.mp4](./glitch_block_heavy.mp4) |
| 47 | Glitch Block Extreme | Glitch | 0.45 | 0.45 | [glitch_block_extreme.mp4](./glitch_block_extreme.mp4) |
| 48 | Glitch Block Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_block_tv.mp4](./glitch_block_tv.mp4) |
| 49 | Glitch Sort Mild | Glitch | 0.7 | 0.7 | [glitch_sort_mild.mp4](./glitch_sort_mild.mp4) |
| 50 | Glitch Sort Medium | Glitch | 0.6 | 0.6 | [glitch_sort_medium.mp4](./glitch_sort_medium.mp4) |
| 51 | Glitch Sort Heavy | Glitch | 0.5 | 0.5 | [glitch_sort_heavy.mp4](./glitch_sort_heavy.mp4) |
| 52 | Glitch Sort Extreme | Glitch | 0.45 | 0.45 | [glitch_sort_extreme.mp4](./glitch_sort_extreme.mp4) |
| 53 | Glitch Sort Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_sort_tv.mp4](./glitch_sort_tv.mp4) |
| 54 | Glitch Vhs Mild | Glitch | 0.7 | 0.7 | [glitch_vhs_mild.mp4](./glitch_vhs_mild.mp4) |
| 55 | Glitch Vhs Medium | Glitch | 0.6 | 0.6 | [glitch_vhs_medium.mp4](./glitch_vhs_medium.mp4) |
| 56 | Glitch Vhs Heavy | Glitch | 0.5 | 0.5 | [glitch_vhs_heavy.mp4](./glitch_vhs_heavy.mp4) |
| 57 | Glitch Vhs Extreme | Glitch | 0.45 | 0.45 | [glitch_vhs_extreme.mp4](./glitch_vhs_extreme.mp4) |
| 58 | Glitch Vhs Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_vhs_tv.mp4](./glitch_vhs_tv.mp4) |
| 59 | Glitch Mosh Mild | Glitch | 0.7 | 0.7 | [glitch_mosh_mild.mp4](./glitch_mosh_mild.mp4) |
| 60 | Glitch Mosh Medium | Glitch | 0.6 | 0.6 | [glitch_mosh_medium.mp4](./glitch_mosh_medium.mp4) |
| 61 | Glitch Mosh Heavy | Glitch | 0.5 | 0.5 | [glitch_mosh_heavy.mp4](./glitch_mosh_heavy.mp4) |
| 62 | Glitch Mosh Extreme | Glitch | 0.45 | 0.45 | [glitch_mosh_extreme.mp4](./glitch_mosh_extreme.mp4) |
| 63 | Glitch Mosh Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_mosh_tv.mp4](./glitch_mosh_tv.mp4) |
| 64 | Glitch Static Mild | Glitch | 0.7 | 0.7 | [glitch_static_mild.mp4](./glitch_static_mild.mp4) |
| 65 | Glitch Static Medium | Glitch | 0.6 | 0.6 | [glitch_static_medium.mp4](./glitch_static_medium.mp4) |
| 66 | Glitch Static Heavy | Glitch | 0.5 | 0.5 | [glitch_static_heavy.mp4](./glitch_static_heavy.mp4) |
| 67 | Glitch Static Extreme | Glitch | 0.45 | 0.45 | [glitch_static_extreme.mp4](./glitch_static_extreme.mp4) |
| 68 | Glitch Static Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_static_tv.mp4](./glitch_static_tv.mp4) |
| 69 | Glitch Tear Mild | Glitch | 0.7 | 0.7 | [glitch_tear_mild.mp4](./glitch_tear_mild.mp4) |
| 70 | Glitch Tear Medium | Glitch | 0.6 | 0.6 | [glitch_tear_medium.mp4](./glitch_tear_medium.mp4) |
| 71 | Glitch Tear Heavy | Glitch | 0.5 | 0.5 | [glitch_tear_heavy.mp4](./glitch_tear_heavy.mp4) |
| 72 | Glitch Tear Extreme | Glitch | 0.45 | 0.45 | [glitch_tear_extreme.mp4](./glitch_tear_extreme.mp4) |
| 73 | Glitch Tear Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_tear_tv.mp4](./glitch_tear_tv.mp4) |
| 74 | Glitch Shake Mild | Glitch | 0.7 | 0.7 | [glitch_shake_mild.mp4](./glitch_shake_mild.mp4) |
| 75 | Glitch Shake Medium | Glitch | 0.6 | 0.6 | [glitch_shake_medium.mp4](./glitch_shake_medium.mp4) |
| 76 | Glitch Shake Heavy | Glitch | 0.5 | 0.5 | [glitch_shake_heavy.mp4](./glitch_shake_heavy.mp4) |
| 77 | Glitch Shake Extreme | Glitch | 0.45 | 0.45 | [glitch_shake_extreme.mp4](./glitch_shake_extreme.mp4) |
| 78 | Glitch Shake Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_shake_tv.mp4](./glitch_shake_tv.mp4) |
| 79 | Glitch Poster Mild | Glitch | 0.7 | 0.7 | [glitch_poster_mild.mp4](./glitch_poster_mild.mp4) |
| 80 | Glitch Poster Medium | Glitch | 0.6 | 0.6 | [glitch_poster_medium.mp4](./glitch_poster_medium.mp4) |
| 81 | Glitch Poster Heavy | Glitch | 0.5 | 0.5 | [glitch_poster_heavy.mp4](./glitch_poster_heavy.mp4) |
| 82 | Glitch Poster Extreme | Glitch | 0.45 | 0.45 | [glitch_poster_extreme.mp4](./glitch_poster_extreme.mp4) |
| 83 | Glitch Poster Tv-flavoured | Glitch | 0.6 | 0.6 | [glitch_poster_tv.mp4](./glitch_poster_tv.mp4) |
| 84 | Blur Cross Soft | Blur | 1.1 | 1.1 | [blur_cross_soft.mp4](./blur_cross_soft.mp4) |
| 85 | Blur Cross Medium | Blur | 0.9 | 0.9 | [blur_cross_medium.mp4](./blur_cross_medium.mp4) |
| 86 | Blur Cross Strong | Blur | 0.7 | 0.7 | [blur_cross_strong.mp4](./blur_cross_strong.mp4) |
| 87 | Blur Cross Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_cross_dreamy.mp4](./blur_cross_dreamy.mp4) |
| 88 | Blur Cross Snap fast-ease | Blur | 0.4 | 0.4 | [blur_cross_snap.mp4](./blur_cross_snap.mp4) |
| 89 | Blur Push Left Soft | Blur | 1.1 | 1.1 | [blur_push_l_soft.mp4](./blur_push_l_soft.mp4) |
| 90 | Blur Push Left Medium | Blur | 0.9 | 0.9 | [blur_push_l_medium.mp4](./blur_push_l_medium.mp4) |
| 91 | Blur Push Left Strong | Blur | 0.7 | 0.7 | [blur_push_l_strong.mp4](./blur_push_l_strong.mp4) |
| 92 | Blur Push Left Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_push_l_dreamy.mp4](./blur_push_l_dreamy.mp4) |
| 93 | Blur Push Left Snap fast-ease | Blur | 0.4 | 0.4 | [blur_push_l_snap.mp4](./blur_push_l_snap.mp4) |
| 94 | Blur Push Right Soft | Blur | 1.1 | 1.1 | [blur_push_r_soft.mp4](./blur_push_r_soft.mp4) |
| 95 | Blur Push Right Medium | Blur | 0.9 | 0.9 | [blur_push_r_medium.mp4](./blur_push_r_medium.mp4) |
| 96 | Blur Push Right Strong | Blur | 0.7 | 0.7 | [blur_push_r_strong.mp4](./blur_push_r_strong.mp4) |
| 97 | Blur Push Right Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_push_r_dreamy.mp4](./blur_push_r_dreamy.mp4) |
| 98 | Blur Push Right Snap fast-ease | Blur | 0.4 | 0.4 | [blur_push_r_snap.mp4](./blur_push_r_snap.mp4) |
| 99 | Blur Push Up Soft | Blur | 1.1 | 1.1 | [blur_push_u_soft.mp4](./blur_push_u_soft.mp4) |
| 100 | Blur Push Up Medium | Blur | 0.9 | 0.9 | [blur_push_u_medium.mp4](./blur_push_u_medium.mp4) |
| 101 | Blur Push Up Strong | Blur | 0.7 | 0.7 | [blur_push_u_strong.mp4](./blur_push_u_strong.mp4) |
| 102 | Blur Push Up Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_push_u_dreamy.mp4](./blur_push_u_dreamy.mp4) |
| 103 | Blur Push Up Snap fast-ease | Blur | 0.4 | 0.4 | [blur_push_u_snap.mp4](./blur_push_u_snap.mp4) |
| 104 | Blur Push Down Soft | Blur | 1.1 | 1.1 | [blur_push_d_soft.mp4](./blur_push_d_soft.mp4) |
| 105 | Blur Push Down Medium | Blur | 0.9 | 0.9 | [blur_push_d_medium.mp4](./blur_push_d_medium.mp4) |
| 106 | Blur Push Down Strong | Blur | 0.7 | 0.7 | [blur_push_d_strong.mp4](./blur_push_d_strong.mp4) |
| 107 | Blur Push Down Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_push_d_dreamy.mp4](./blur_push_d_dreamy.mp4) |
| 108 | Blur Push Down Snap fast-ease | Blur | 0.4 | 0.4 | [blur_push_d_snap.mp4](./blur_push_d_snap.mp4) |
| 109 | Blur Zoom In Soft | Blur | 1.1 | 1.1 | [blur_zoom_in_soft.mp4](./blur_zoom_in_soft.mp4) |
| 110 | Blur Zoom In Medium | Blur | 0.9 | 0.9 | [blur_zoom_in_medium.mp4](./blur_zoom_in_medium.mp4) |
| 111 | Blur Zoom In Strong | Blur | 0.7 | 0.7 | [blur_zoom_in_strong.mp4](./blur_zoom_in_strong.mp4) |
| 112 | Blur Zoom In Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_zoom_in_dreamy.mp4](./blur_zoom_in_dreamy.mp4) |
| 113 | Blur Zoom In Snap fast-ease | Blur | 0.4 | 0.4 | [blur_zoom_in_snap.mp4](./blur_zoom_in_snap.mp4) |
| 114 | Blur Zoom Out Soft | Blur | 1.1 | 1.1 | [blur_zoom_out_soft.mp4](./blur_zoom_out_soft.mp4) |
| 115 | Blur Zoom Out Medium | Blur | 0.9 | 0.9 | [blur_zoom_out_medium.mp4](./blur_zoom_out_medium.mp4) |
| 116 | Blur Zoom Out Strong | Blur | 0.7 | 0.7 | [blur_zoom_out_strong.mp4](./blur_zoom_out_strong.mp4) |
| 117 | Blur Zoom Out Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_zoom_out_dreamy.mp4](./blur_zoom_out_dreamy.mp4) |
| 118 | Blur Zoom Out Snap fast-ease | Blur | 0.4 | 0.4 | [blur_zoom_out_snap.mp4](./blur_zoom_out_snap.mp4) |
| 119 | Blur Radial Spin Soft | Blur | 1.1 | 1.1 | [blur_spin_soft.mp4](./blur_spin_soft.mp4) |
| 120 | Blur Radial Spin Medium | Blur | 0.9 | 0.9 | [blur_spin_medium.mp4](./blur_spin_medium.mp4) |
| 121 | Blur Radial Spin Strong | Blur | 0.7 | 0.7 | [blur_spin_strong.mp4](./blur_spin_strong.mp4) |
| 122 | Blur Radial Spin Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_spin_dreamy.mp4](./blur_spin_dreamy.mp4) |
| 123 | Blur Radial Spin Snap fast-ease | Blur | 0.4 | 0.4 | [blur_spin_snap.mp4](./blur_spin_snap.mp4) |
| 124 | Blur Whip Soft | Blur | 1.1 | 1.1 | [blur_whip_soft.mp4](./blur_whip_soft.mp4) |
| 125 | Blur Whip Medium | Blur | 0.9 | 0.9 | [blur_whip_medium.mp4](./blur_whip_medium.mp4) |
| 126 | Blur Whip Strong | Blur | 0.7 | 0.7 | [blur_whip_strong.mp4](./blur_whip_strong.mp4) |
| 127 | Blur Whip Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_whip_dreamy.mp4](./blur_whip_dreamy.mp4) |
| 128 | Blur Whip Snap fast-ease | Blur | 0.4 | 0.4 | [blur_whip_snap.mp4](./blur_whip_snap.mp4) |
| 129 | Blur Tilt Shift Soft | Blur | 1.1 | 1.1 | [blur_tilt_soft.mp4](./blur_tilt_soft.mp4) |
| 130 | Blur Tilt Shift Medium | Blur | 0.9 | 0.9 | [blur_tilt_medium.mp4](./blur_tilt_medium.mp4) |
| 131 | Blur Tilt Shift Strong | Blur | 0.7 | 0.7 | [blur_tilt_strong.mp4](./blur_tilt_strong.mp4) |
| 132 | Blur Tilt Shift Dreamy long-ease | Blur | 1.4 | 1.4 | [blur_tilt_dreamy.mp4](./blur_tilt_dreamy.mp4) |
| 133 | Blur Tilt Shift Snap fast-ease | Blur | 0.4 | 0.4 | [blur_tilt_snap.mp4](./blur_tilt_snap.mp4) |
| 134 | Dissolve Cross Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_cross_linear.mp4](./dissolve_cross_linear.mp4) |
| 135 | Dissolve Cross Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_cross_smooth.mp4](./dissolve_cross_smooth.mp4) |
| 136 | Dissolve Cross Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_cross_fast.mp4](./dissolve_cross_fast.mp4) |
| 137 | Dissolve Cross Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_cross_slow.mp4](./dissolve_cross_slow.mp4) |
| 138 | Dissolve Cross Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_cross_radial.mp4](./dissolve_cross_radial.mp4) |
| 139 | Dissolve Film Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_film_linear.mp4](./dissolve_film_linear.mp4) |
| 140 | Dissolve Film Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_film_smooth.mp4](./dissolve_film_smooth.mp4) |
| 141 | Dissolve Film Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_film_fast.mp4](./dissolve_film_fast.mp4) |
| 142 | Dissolve Film Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_film_slow.mp4](./dissolve_film_slow.mp4) |
| 143 | Dissolve Film Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_film_radial.mp4](./dissolve_film_radial.mp4) |
| 144 | Dissolve Additive Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_additive_linear.mp4](./dissolve_additive_linear.mp4) |
| 145 | Dissolve Additive Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_additive_smooth.mp4](./dissolve_additive_smooth.mp4) |
| 146 | Dissolve Additive Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_additive_fast.mp4](./dissolve_additive_fast.mp4) |
| 147 | Dissolve Additive Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_additive_slow.mp4](./dissolve_additive_slow.mp4) |
| 148 | Dissolve Additive Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_additive_radial.mp4](./dissolve_additive_radial.mp4) |
| 149 | Dissolve Subtractive Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_subtract_linear.mp4](./dissolve_subtract_linear.mp4) |
| 150 | Dissolve Subtractive Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_subtract_smooth.mp4](./dissolve_subtract_smooth.mp4) |
| 151 | Dissolve Subtractive Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_subtract_fast.mp4](./dissolve_subtract_fast.mp4) |
| 152 | Dissolve Subtractive Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_subtract_slow.mp4](./dissolve_subtract_slow.mp4) |
| 153 | Dissolve Subtractive Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_subtract_radial.mp4](./dissolve_subtract_radial.mp4) |
| 154 | Dissolve Dip Black Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_dip_black_linear.mp4](./dissolve_dip_black_linear.mp4) |
| 155 | Dissolve Dip Black Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_dip_black_smooth.mp4](./dissolve_dip_black_smooth.mp4) |
| 156 | Dissolve Dip Black Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_dip_black_fast.mp4](./dissolve_dip_black_fast.mp4) |
| 157 | Dissolve Dip Black Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_dip_black_slow.mp4](./dissolve_dip_black_slow.mp4) |
| 158 | Dissolve Dip Black Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_dip_black_radial.mp4](./dissolve_dip_black_radial.mp4) |
| 159 | Dissolve Dip White Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_dip_white_linear.mp4](./dissolve_dip_white_linear.mp4) |
| 160 | Dissolve Dip White Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_dip_white_smooth.mp4](./dissolve_dip_white_smooth.mp4) |
| 161 | Dissolve Dip White Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_dip_white_fast.mp4](./dissolve_dip_white_fast.mp4) |
| 162 | Dissolve Dip White Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_dip_white_slow.mp4](./dissolve_dip_white_slow.mp4) |
| 163 | Dissolve Dip White Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_dip_white_radial.mp4](./dissolve_dip_white_radial.mp4) |
| 164 | Dissolve Dip Color Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_dip_color_linear.mp4](./dissolve_dip_color_linear.mp4) |
| 165 | Dissolve Dip Color Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_dip_color_smooth.mp4](./dissolve_dip_color_smooth.mp4) |
| 166 | Dissolve Dip Color Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_dip_color_fast.mp4](./dissolve_dip_color_fast.mp4) |
| 167 | Dissolve Dip Color Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_dip_color_slow.mp4](./dissolve_dip_color_slow.mp4) |
| 168 | Dissolve Dip Color Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_dip_color_radial.mp4](./dissolve_dip_color_radial.mp4) |
| 169 | Dissolve Gamma Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_gamma_linear.mp4](./dissolve_gamma_linear.mp4) |
| 170 | Dissolve Gamma Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_gamma_smooth.mp4](./dissolve_gamma_smooth.mp4) |
| 171 | Dissolve Gamma Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_gamma_fast.mp4](./dissolve_gamma_fast.mp4) |
| 172 | Dissolve Gamma Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_gamma_slow.mp4](./dissolve_gamma_slow.mp4) |
| 173 | Dissolve Gamma Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_gamma_radial.mp4](./dissolve_gamma_radial.mp4) |
| 174 | Dissolve Luma Gradient Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_luma_linear.mp4](./dissolve_luma_linear.mp4) |
| 175 | Dissolve Luma Gradient Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_luma_smooth.mp4](./dissolve_luma_smooth.mp4) |
| 176 | Dissolve Luma Gradient Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_luma_fast.mp4](./dissolve_luma_fast.mp4) |
| 177 | Dissolve Luma Gradient Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_luma_slow.mp4](./dissolve_luma_slow.mp4) |
| 178 | Dissolve Luma Gradient Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_luma_radial.mp4](./dissolve_luma_radial.mp4) |
| 179 | Dissolve Noise Dither Linear ease | Dissolve | 0.9 | 0.9 | [dissolve_dither_linear.mp4](./dissolve_dither_linear.mp4) |
| 180 | Dissolve Noise Dither Smooth ease | Dissolve | 1.2 | 1.2 | [dissolve_dither_smooth.mp4](./dissolve_dither_smooth.mp4) |
| 181 | Dissolve Noise Dither Fast ease | Dissolve | 0.6 | 0.6 | [dissolve_dither_fast.mp4](./dissolve_dither_fast.mp4) |
| 182 | Dissolve Noise Dither Slow ease | Dissolve | 1.8 | 1.8 | [dissolve_dither_slow.mp4](./dissolve_dither_slow.mp4) |
| 183 | Dissolve Noise Dither Radial shape | Dissolve | 1.2 | 1.2 | [dissolve_dither_radial.mp4](./dissolve_dither_radial.mp4) |
| 184 | Light Leak Left Warm | Light | 0.9 | 0.9 | [light_leak_l_warm.mp4](./light_leak_l_warm.mp4) |
| 185 | Light Leak Left Gold | Light | 0.8 | 0.8 | [light_leak_l_gold.mp4](./light_leak_l_gold.mp4) |
| 186 | Light Leak Left Magenta | Light | 0.8 | 0.8 | [light_leak_l_magenta.mp4](./light_leak_l_magenta.mp4) |
| 187 | Light Leak Left Cyan | Light | 0.7 | 0.7 | [light_leak_l_cyan.mp4](./light_leak_l_cyan.mp4) |
| 188 | Light Leak Left Cool | Light | 0.9 | 0.9 | [light_leak_l_cool.mp4](./light_leak_l_cool.mp4) |
| 189 | Light Leak Right Warm | Light | 0.9 | 0.9 | [light_leak_r_warm.mp4](./light_leak_r_warm.mp4) |
| 190 | Light Leak Right Gold | Light | 0.8 | 0.8 | [light_leak_r_gold.mp4](./light_leak_r_gold.mp4) |
| 191 | Light Leak Right Magenta | Light | 0.8 | 0.8 | [light_leak_r_magenta.mp4](./light_leak_r_magenta.mp4) |
| 192 | Light Leak Right Cyan | Light | 0.7 | 0.7 | [light_leak_r_cyan.mp4](./light_leak_r_cyan.mp4) |
| 193 | Light Leak Right Cool | Light | 0.9 | 0.9 | [light_leak_r_cool.mp4](./light_leak_r_cool.mp4) |
| 194 | Light Leak Top Warm | Light | 0.9 | 0.9 | [light_leak_top_warm.mp4](./light_leak_top_warm.mp4) |
| 195 | Light Leak Top Gold | Light | 0.8 | 0.8 | [light_leak_top_gold.mp4](./light_leak_top_gold.mp4) |
| 196 | Light Leak Top Magenta | Light | 0.8 | 0.8 | [light_leak_top_magenta.mp4](./light_leak_top_magenta.mp4) |
| 197 | Light Leak Top Cyan | Light | 0.7 | 0.7 | [light_leak_top_cyan.mp4](./light_leak_top_cyan.mp4) |
| 198 | Light Leak Top Cool | Light | 0.9 | 0.9 | [light_leak_top_cool.mp4](./light_leak_top_cool.mp4) |
| 199 | Light Flash White Warm | Light | 0.9 | 0.9 | [light_flash_white_warm.mp4](./light_flash_white_warm.mp4) |
| 200 | Light Flash White Gold | Light | 0.8 | 0.8 | [light_flash_white_gold.mp4](./light_flash_white_gold.mp4) |
| 201 | Light Flash White Magenta | Light | 0.8 | 0.8 | [light_flash_white_magenta.mp4](./light_flash_white_magenta.mp4) |
| 202 | Light Flash White Cyan | Light | 0.7 | 0.7 | [light_flash_white_cyan.mp4](./light_flash_white_cyan.mp4) |
| 203 | Light Flash White Cool | Light | 0.9 | 0.9 | [light_flash_white_cool.mp4](./light_flash_white_cool.mp4) |
| 204 | Light Flash Color Warm | Light | 0.9 | 0.9 | [light_flash_color_warm.mp4](./light_flash_color_warm.mp4) |
| 205 | Light Flash Color Gold | Light | 0.8 | 0.8 | [light_flash_color_gold.mp4](./light_flash_color_gold.mp4) |
| 206 | Light Flash Color Magenta | Light | 0.8 | 0.8 | [light_flash_color_magenta.mp4](./light_flash_color_magenta.mp4) |
| 207 | Light Flash Color Cyan | Light | 0.7 | 0.7 | [light_flash_color_cyan.mp4](./light_flash_color_cyan.mp4) |
| 208 | Light Flash Color Cool | Light | 0.9 | 0.9 | [light_flash_color_cool.mp4](./light_flash_color_cool.mp4) |
| 209 | Light Anamorphic Warm | Light | 0.9 | 0.9 | [light_flare_ana_warm.mp4](./light_flare_ana_warm.mp4) |
| 210 | Light Anamorphic Gold | Light | 0.8 | 0.8 | [light_flare_ana_gold.mp4](./light_flare_ana_gold.mp4) |
| 211 | Light Anamorphic Magenta | Light | 0.8 | 0.8 | [light_flare_ana_magenta.mp4](./light_flare_ana_magenta.mp4) |
| 212 | Light Anamorphic Cyan | Light | 0.7 | 0.7 | [light_flare_ana_cyan.mp4](./light_flare_ana_cyan.mp4) |
| 213 | Light Anamorphic Cool | Light | 0.9 | 0.9 | [light_flare_ana_cool.mp4](./light_flare_ana_cool.mp4) |
| 214 | Light Starburst Warm | Light | 0.9 | 0.9 | [light_flare_star_warm.mp4](./light_flare_star_warm.mp4) |
| 215 | Light Starburst Gold | Light | 0.8 | 0.8 | [light_flare_star_gold.mp4](./light_flare_star_gold.mp4) |
| 216 | Light Starburst Magenta | Light | 0.8 | 0.8 | [light_flare_star_magenta.mp4](./light_flare_star_magenta.mp4) |
| 217 | Light Starburst Cyan | Light | 0.7 | 0.7 | [light_flare_star_cyan.mp4](./light_flare_star_cyan.mp4) |
| 218 | Light Starburst Cool | Light | 0.9 | 0.9 | [light_flare_star_cool.mp4](./light_flare_star_cool.mp4) |
| 219 | Light Ghosting Warm | Light | 0.9 | 0.9 | [light_flare_ghost_warm.mp4](./light_flare_ghost_warm.mp4) |
| 220 | Light Ghosting Gold | Light | 0.8 | 0.8 | [light_flare_ghost_gold.mp4](./light_flare_ghost_gold.mp4) |
| 221 | Light Ghosting Magenta | Light | 0.8 | 0.8 | [light_flare_ghost_magenta.mp4](./light_flare_ghost_magenta.mp4) |
| 222 | Light Ghosting Cyan | Light | 0.7 | 0.7 | [light_flare_ghost_cyan.mp4](./light_flare_ghost_cyan.mp4) |
| 223 | Light Ghosting Cool | Light | 0.9 | 0.9 | [light_flare_ghost_cool.mp4](./light_flare_ghost_cool.mp4) |
| 224 | Light Bokeh Burst Warm | Light | 0.9 | 0.9 | [light_bokeh_warm.mp4](./light_bokeh_warm.mp4) |
| 225 | Light Bokeh Burst Gold | Light | 0.8 | 0.8 | [light_bokeh_gold.mp4](./light_bokeh_gold.mp4) |
| 226 | Light Bokeh Burst Magenta | Light | 0.8 | 0.8 | [light_bokeh_magenta.mp4](./light_bokeh_magenta.mp4) |
| 227 | Light Bokeh Burst Cyan | Light | 0.7 | 0.7 | [light_bokeh_cyan.mp4](./light_bokeh_cyan.mp4) |
| 228 | Light Bokeh Burst Cool | Light | 0.9 | 0.9 | [light_bokeh_cool.mp4](./light_bokeh_cool.mp4) |
| 229 | Light Film Burn Warm | Light | 0.9 | 0.9 | [light_filmburn_warm.mp4](./light_filmburn_warm.mp4) |
| 230 | Light Film Burn Gold | Light | 0.8 | 0.8 | [light_filmburn_gold.mp4](./light_filmburn_gold.mp4) |
| 231 | Light Film Burn Magenta | Light | 0.8 | 0.8 | [light_filmburn_magenta.mp4](./light_filmburn_magenta.mp4) |
| 232 | Light Film Burn Cyan | Light | 0.7 | 0.7 | [light_filmburn_cyan.mp4](./light_filmburn_cyan.mp4) |
| 233 | Light Film Burn Cool | Light | 0.9 | 0.9 | [light_filmburn_cool.mp4](./light_filmburn_cool.mp4) |
| 234 | Flicker Film Subtle | Flicker | 0.9 | 0.9 | [flicker_film_subtle.mp4](./flicker_film_subtle.mp4) |
| 235 | Flicker Film Classic | Flicker | 0.7 | 0.7 | [flicker_film_classic.mp4](./flicker_film_classic.mp4) |
| 236 | Flicker Film Hard | Flicker | 0.5 | 0.5 | [flicker_film_hard.mp4](./flicker_film_hard.mp4) |
| 237 | Flicker Film Chaotic | Flicker | 0.45 | 0.45 | [flicker_film_chaos.mp4](./flicker_film_chaos.mp4) |
| 238 | Flicker Film Pulsing | Flicker | 1 | 1 | [flicker_film_pulse.mp4](./flicker_film_pulse.mp4) |
| 239 | Flicker Strobe Black Subtle | Flicker | 0.9 | 0.9 | [flicker_strobe_b_subtle.mp4](./flicker_strobe_b_subtle.mp4) |
| 240 | Flicker Strobe Black Classic | Flicker | 0.7 | 0.7 | [flicker_strobe_b_classic.mp4](./flicker_strobe_b_classic.mp4) |
| 241 | Flicker Strobe Black Hard | Flicker | 0.5 | 0.5 | [flicker_strobe_b_hard.mp4](./flicker_strobe_b_hard.mp4) |
| 242 | Flicker Strobe Black Chaotic | Flicker | 0.45 | 0.45 | [flicker_strobe_b_chaos.mp4](./flicker_strobe_b_chaos.mp4) |
| 243 | Flicker Strobe Black Pulsing | Flicker | 1 | 1 | [flicker_strobe_b_pulse.mp4](./flicker_strobe_b_pulse.mp4) |
| 244 | Flicker Strobe White Subtle | Flicker | 0.9 | 0.9 | [flicker_strobe_w_subtle.mp4](./flicker_strobe_w_subtle.mp4) |
| 245 | Flicker Strobe White Classic | Flicker | 0.7 | 0.7 | [flicker_strobe_w_classic.mp4](./flicker_strobe_w_classic.mp4) |
| 246 | Flicker Strobe White Hard | Flicker | 0.5 | 0.5 | [flicker_strobe_w_hard.mp4](./flicker_strobe_w_hard.mp4) |
| 247 | Flicker Strobe White Chaotic | Flicker | 0.45 | 0.45 | [flicker_strobe_w_chaos.mp4](./flicker_strobe_w_chaos.mp4) |
| 248 | Flicker Strobe White Pulsing | Flicker | 1 | 1 | [flicker_strobe_w_pulse.mp4](./flicker_strobe_w_pulse.mp4) |
| 249 | Flicker Frame Skip Subtle | Flicker | 0.9 | 0.9 | [flicker_frameskip_subtle.mp4](./flicker_frameskip_subtle.mp4) |
| 250 | Flicker Frame Skip Classic | Flicker | 0.7 | 0.7 | [flicker_frameskip_classic.mp4](./flicker_frameskip_classic.mp4) |
| 251 | Flicker Frame Skip Hard | Flicker | 0.5 | 0.5 | [flicker_frameskip_hard.mp4](./flicker_frameskip_hard.mp4) |
| 252 | Flicker Frame Skip Chaotic | Flicker | 0.45 | 0.45 | [flicker_frameskip_chaos.mp4](./flicker_frameskip_chaos.mp4) |
| 253 | Flicker Frame Skip Pulsing | Flicker | 1 | 1 | [flicker_frameskip_pulse.mp4](./flicker_frameskip_pulse.mp4) |
| 254 | Flicker Gate Flicker Subtle | Flicker | 0.9 | 0.9 | [flicker_gate_subtle.mp4](./flicker_gate_subtle.mp4) |
| 255 | Flicker Gate Flicker Classic | Flicker | 0.7 | 0.7 | [flicker_gate_classic.mp4](./flicker_gate_classic.mp4) |
| 256 | Flicker Gate Flicker Hard | Flicker | 0.5 | 0.5 | [flicker_gate_hard.mp4](./flicker_gate_hard.mp4) |
| 257 | Flicker Gate Flicker Chaotic | Flicker | 0.45 | 0.45 | [flicker_gate_chaos.mp4](./flicker_gate_chaos.mp4) |
| 258 | Flicker Gate Flicker Pulsing | Flicker | 1 | 1 | [flicker_gate_pulse.mp4](./flicker_gate_pulse.mp4) |
| 259 | Flicker Burn Flash Subtle | Flicker | 0.9 | 0.9 | [flicker_burn_subtle.mp4](./flicker_burn_subtle.mp4) |
| 260 | Flicker Burn Flash Classic | Flicker | 0.7 | 0.7 | [flicker_burn_classic.mp4](./flicker_burn_classic.mp4) |
| 261 | Flicker Burn Flash Hard | Flicker | 0.5 | 0.5 | [flicker_burn_hard.mp4](./flicker_burn_hard.mp4) |
| 262 | Flicker Burn Flash Chaotic | Flicker | 0.45 | 0.45 | [flicker_burn_chaos.mp4](./flicker_burn_chaos.mp4) |
| 263 | Flicker Burn Flash Pulsing | Flicker | 1 | 1 | [flicker_burn_pulse.mp4](./flicker_burn_pulse.mp4) |
| 264 | Flicker Blink Dip Subtle | Flicker | 0.9 | 0.9 | [flicker_blink_subtle.mp4](./flicker_blink_subtle.mp4) |
| 265 | Flicker Blink Dip Classic | Flicker | 0.7 | 0.7 | [flicker_blink_classic.mp4](./flicker_blink_classic.mp4) |
| 266 | Flicker Blink Dip Hard | Flicker | 0.5 | 0.5 | [flicker_blink_hard.mp4](./flicker_blink_hard.mp4) |
| 267 | Flicker Blink Dip Chaotic | Flicker | 0.45 | 0.45 | [flicker_blink_chaos.mp4](./flicker_blink_chaos.mp4) |
| 268 | Flicker Blink Dip Pulsing | Flicker | 1 | 1 | [flicker_blink_pulse.mp4](./flicker_blink_pulse.mp4) |
| 269 | Flicker Vintage Subtle | Flicker | 0.9 | 0.9 | [flicker_vintage_subtle.mp4](./flicker_vintage_subtle.mp4) |
| 270 | Flicker Vintage Classic | Flicker | 0.7 | 0.7 | [flicker_vintage_classic.mp4](./flicker_vintage_classic.mp4) |
| 271 | Flicker Vintage Hard | Flicker | 0.5 | 0.5 | [flicker_vintage_hard.mp4](./flicker_vintage_hard.mp4) |
| 272 | Flicker Vintage Chaotic | Flicker | 0.45 | 0.45 | [flicker_vintage_chaos.mp4](./flicker_vintage_chaos.mp4) |
| 273 | Flicker Vintage Pulsing | Flicker | 1 | 1 | [flicker_vintage_pulse.mp4](./flicker_vintage_pulse.mp4) |
| 274 | Flicker Projector Subtle | Flicker | 0.9 | 0.9 | [flicker_projector_subtle.mp4](./flicker_projector_subtle.mp4) |
| 275 | Flicker Projector Classic | Flicker | 0.7 | 0.7 | [flicker_projector_classic.mp4](./flicker_projector_classic.mp4) |
| 276 | Flicker Projector Hard | Flicker | 0.5 | 0.5 | [flicker_projector_hard.mp4](./flicker_projector_hard.mp4) |
| 277 | Flicker Projector Chaotic | Flicker | 0.45 | 0.45 | [flicker_projector_chaos.mp4](./flicker_projector_chaos.mp4) |
| 278 | Flicker Projector Pulsing | Flicker | 1 | 1 | [flicker_projector_pulse.mp4](./flicker_projector_pulse.mp4) |
| 279 | Flicker Candle Subtle | Flicker | 0.9 | 0.9 | [flicker_candle_subtle.mp4](./flicker_candle_subtle.mp4) |
| 280 | Flicker Candle Classic | Flicker | 0.7 | 0.7 | [flicker_candle_classic.mp4](./flicker_candle_classic.mp4) |
| 281 | Flicker Candle Hard | Flicker | 0.5 | 0.5 | [flicker_candle_hard.mp4](./flicker_candle_hard.mp4) |
| 282 | Flicker Candle Chaotic | Flicker | 0.45 | 0.45 | [flicker_candle_chaos.mp4](./flicker_candle_chaos.mp4) |
| 283 | Flicker Candle Pulsing | Flicker | 1 | 1 | [flicker_candle_pulse.mp4](./flicker_candle_pulse.mp4) |
| 284 | TV Static Burst Mild | TV | 1 | 1 | [tv_static_burst_mild.mp4](./tv_static_burst_mild.mp4) |
| 285 | TV Static Burst Classic | TV | 0.9 | 0.9 | [tv_static_burst_classic.mp4](./tv_static_burst_classic.mp4) |
| 286 | TV Static Burst Heavy | TV | 0.7 | 0.7 | [tv_static_burst_heavy.mp4](./tv_static_burst_heavy.mp4) |
| 287 | TV Static Burst Retos osd-heavy | TV | 1.1 | 1.1 | [tv_static_burst_retro.mp4](./tv_static_burst_retro.mp4) |
| 288 | TV Static Burst Noise-heavy | TV | 0.6 | 0.6 | [tv_static_burst_noise.mp4](./tv_static_burst_noise.mp4) |
| 289 | TV Channel Change Mild | TV | 1 | 1 | [tv_channel_mild.mp4](./tv_channel_mild.mp4) |
| 290 | TV Channel Change Classic | TV | 0.9 | 0.9 | [tv_channel_classic.mp4](./tv_channel_classic.mp4) |
| 291 | TV Channel Change Heavy | TV | 0.7 | 0.7 | [tv_channel_heavy.mp4](./tv_channel_heavy.mp4) |
| 292 | TV Channel Change Retos osd-heavy | TV | 1.1 | 1.1 | [tv_channel_retro.mp4](./tv_channel_retro.mp4) |
| 293 | TV Channel Change Noise-heavy | TV | 0.6 | 0.6 | [tv_channel_noise.mp4](./tv_channel_noise.mp4) |
| 294 | TV Vertical Roll Mild | TV | 1 | 1 | [tv_v_roll_mild.mp4](./tv_v_roll_mild.mp4) |
| 295 | TV Vertical Roll Classic | TV | 0.9 | 0.9 | [tv_v_roll_classic.mp4](./tv_v_roll_classic.mp4) |
| 296 | TV Vertical Roll Heavy | TV | 0.7 | 0.7 | [tv_v_roll_heavy.mp4](./tv_v_roll_heavy.mp4) |
| 297 | TV Vertical Roll Retos osd-heavy | TV | 1.1 | 1.1 | [tv_v_roll_retro.mp4](./tv_v_roll_retro.mp4) |
| 298 | TV Vertical Roll Noise-heavy | TV | 0.6 | 0.6 | [tv_v_roll_noise.mp4](./tv_v_roll_noise.mp4) |
| 299 | TV H-Sync Tear Mild | TV | 1 | 1 | [tv_h_tear_mild.mp4](./tv_h_tear_mild.mp4) |
| 300 | TV H-Sync Tear Classic | TV | 0.9 | 0.9 | [tv_h_tear_classic.mp4](./tv_h_tear_classic.mp4) |
| 301 | TV H-Sync Tear Heavy | TV | 0.7 | 0.7 | [tv_h_tear_heavy.mp4](./tv_h_tear_heavy.mp4) |
| 302 | TV H-Sync Tear Retos osd-heavy | TV | 1.1 | 1.1 | [tv_h_tear_retro.mp4](./tv_h_tear_retro.mp4) |
| 303 | TV H-Sync Tear Noise-heavy | TV | 0.6 | 0.6 | [tv_h_tear_noise.mp4](./tv_h_tear_noise.mp4) |
| 304 | TV Screen Off Mild | TV | 1 | 1 | [tv_screen_off_mild.mp4](./tv_screen_off_mild.mp4) |
| 305 | TV Screen Off Classic | TV | 0.9 | 0.9 | [tv_screen_off_classic.mp4](./tv_screen_off_classic.mp4) |
| 306 | TV Screen Off Heavy | TV | 0.7 | 0.7 | [tv_screen_off_heavy.mp4](./tv_screen_off_heavy.mp4) |
| 307 | TV Screen Off Retos osd-heavy | TV | 1.1 | 1.1 | [tv_screen_off_retro.mp4](./tv_screen_off_retro.mp4) |
| 308 | TV Screen Off Noise-heavy | TV | 0.6 | 0.6 | [tv_screen_off_noise.mp4](./tv_screen_off_noise.mp4) |
| 309 | TV Power On Mild | TV | 1 | 1 | [tv_power_on_mild.mp4](./tv_power_on_mild.mp4) |
| 310 | TV Power On Classic | TV | 0.9 | 0.9 | [tv_power_on_classic.mp4](./tv_power_on_classic.mp4) |
| 311 | TV Power On Heavy | TV | 0.7 | 0.7 | [tv_power_on_heavy.mp4](./tv_power_on_heavy.mp4) |
| 312 | TV Power On Retos osd-heavy | TV | 1.1 | 1.1 | [tv_power_on_retro.mp4](./tv_power_on_retro.mp4) |
| 313 | TV Power On Noise-heavy | TV | 0.6 | 0.6 | [tv_power_on_noise.mp4](./tv_power_on_noise.mp4) |
| 314 | TV Phosphor Fade Mild | TV | 1 | 1 | [tv_phosphor_mild.mp4](./tv_phosphor_mild.mp4) |
| 315 | TV Phosphor Fade Classic | TV | 0.9 | 0.9 | [tv_phosphor_classic.mp4](./tv_phosphor_classic.mp4) |
| 316 | TV Phosphor Fade Heavy | TV | 0.7 | 0.7 | [tv_phosphor_heavy.mp4](./tv_phosphor_heavy.mp4) |
| 317 | TV Phosphor Fade Retos osd-heavy | TV | 1.1 | 1.1 | [tv_phosphor_retro.mp4](./tv_phosphor_retro.mp4) |
| 318 | TV Phosphor Fade Noise-heavy | TV | 0.6 | 0.6 | [tv_phosphor_noise.mp4](./tv_phosphor_noise.mp4) |
| 319 | TV Scan Crawl Mild | TV | 1 | 1 | [tv_scan_crawl_mild.mp4](./tv_scan_crawl_mild.mp4) |
| 320 | TV Scan Crawl Classic | TV | 0.9 | 0.9 | [tv_scan_crawl_classic.mp4](./tv_scan_crawl_classic.mp4) |
| 321 | TV Scan Crawl Heavy | TV | 0.7 | 0.7 | [tv_scan_crawl_heavy.mp4](./tv_scan_crawl_heavy.mp4) |
| 322 | TV Scan Crawl Retos osd-heavy | TV | 1.1 | 1.1 | [tv_scan_crawl_retro.mp4](./tv_scan_crawl_retro.mp4) |
| 323 | TV Scan Crawl Noise-heavy | TV | 0.6 | 0.6 | [tv_scan_crawl_noise.mp4](./tv_scan_crawl_noise.mp4) |
| 324 | TV Colour Bleed Mild | TV | 1 | 1 | [tv_color_bleed_mild.mp4](./tv_color_bleed_mild.mp4) |
| 325 | TV Colour Bleed Classic | TV | 0.9 | 0.9 | [tv_color_bleed_classic.mp4](./tv_color_bleed_classic.mp4) |
| 326 | TV Colour Bleed Heavy | TV | 0.7 | 0.7 | [tv_color_bleed_heavy.mp4](./tv_color_bleed_heavy.mp4) |
| 327 | TV Colour Bleed Retos osd-heavy | TV | 1.1 | 1.1 | [tv_color_bleed_retro.mp4](./tv_color_bleed_retro.mp4) |
| 328 | TV Colour Bleed Noise-heavy | TV | 0.6 | 0.6 | [tv_color_bleed_noise.mp4](./tv_color_bleed_noise.mp4) |
| 329 | TV VHS Tracking Mild | TV | 1 | 1 | [tv_vhs_track_mild.mp4](./tv_vhs_track_mild.mp4) |
| 330 | TV VHS Tracking Classic | TV | 0.9 | 0.9 | [tv_vhs_track_classic.mp4](./tv_vhs_track_classic.mp4) |
| 331 | TV VHS Tracking Heavy | TV | 0.7 | 0.7 | [tv_vhs_track_heavy.mp4](./tv_vhs_track_heavy.mp4) |
| 332 | TV VHS Tracking Retos osd-heavy | TV | 1.1 | 1.1 | [tv_vhs_track_retro.mp4](./tv_vhs_track_retro.mp4) |
| 333 | TV VHS Tracking Noise-heavy | TV | 0.6 | 0.6 | [tv_vhs_track_noise.mp4](./tv_vhs_track_noise.mp4) |
| 334 | Overlay TV Flip | Overlay | 1.8 | 1.8 | [overlay_tv_flip.mp4](./overlay_tv_flip.mp4) |
| 335 | Overlay TV Spin | Overlay | 1.8 | 1.8 | [overlay_tv_spin.mp4](./overlay_tv_spin.mp4) |
| 336 | Overlay TV Swing | Overlay | 1.6 | 1.6 | [overlay_tv_swing.mp4](./overlay_tv_swing.mp4) |
| 337 | Overlay TV Zoom | Overlay | 1.4 | 1.4 | [overlay_tv_zoom.mp4](./overlay_tv_zoom.mp4) |
| 338 | Overlay TV Channel | Overlay | 1.5 | 1.5 | [overlay_tv_channel.mp4](./overlay_tv_channel.mp4) |
| 339 | Overlay Phone Flip | Overlay | 1.8 | 1.8 | [overlay_phone_flip.mp4](./overlay_phone_flip.mp4) |
| 340 | Overlay Phone Spin | Overlay | 1.8 | 1.8 | [overlay_phone_spin.mp4](./overlay_phone_spin.mp4) |
| 341 | Overlay Phone Swing | Overlay | 1.6 | 1.6 | [overlay_phone_swing.mp4](./overlay_phone_swing.mp4) |
| 342 | Overlay Phone Zoom | Overlay | 1.4 | 1.4 | [overlay_phone_zoom.mp4](./overlay_phone_zoom.mp4) |
| 343 | Overlay Phone Channel | Overlay | 1.5 | 1.5 | [overlay_phone_channel.mp4](./overlay_phone_channel.mp4) |
| 344 | Overlay Monitor Flip | Overlay | 1.8 | 1.8 | [overlay_monitor_flip.mp4](./overlay_monitor_flip.mp4) |
| 345 | Overlay Monitor Spin | Overlay | 1.8 | 1.8 | [overlay_monitor_spin.mp4](./overlay_monitor_spin.mp4) |
| 346 | Overlay Monitor Swing | Overlay | 1.6 | 1.6 | [overlay_monitor_swing.mp4](./overlay_monitor_swing.mp4) |
| 347 | Overlay Monitor Zoom | Overlay | 1.4 | 1.4 | [overlay_monitor_zoom.mp4](./overlay_monitor_zoom.mp4) |
| 348 | Overlay Monitor Channel | Overlay | 1.5 | 1.5 | [overlay_monitor_channel.mp4](./overlay_monitor_channel.mp4) |
| 349 | Overlay Camera Flip | Overlay | 1.8 | 1.8 | [overlay_camera_flip.mp4](./overlay_camera_flip.mp4) |
| 350 | Overlay Camera Spin | Overlay | 1.8 | 1.8 | [overlay_camera_spin.mp4](./overlay_camera_spin.mp4) |
| 351 | Overlay Camera Swing | Overlay | 1.6 | 1.6 | [overlay_camera_swing.mp4](./overlay_camera_swing.mp4) |
| 352 | Overlay Camera Zoom | Overlay | 1.4 | 1.4 | [overlay_camera_zoom.mp4](./overlay_camera_zoom.mp4) |
| 353 | Overlay Camera Channel | Overlay | 1.5 | 1.5 | [overlay_camera_channel.mp4](./overlay_camera_channel.mp4) |
| 354 | Overlay Projector Flip | Overlay | 1.8 | 1.8 | [overlay_projector_flip.mp4](./overlay_projector_flip.mp4) |
| 355 | Overlay Projector Spin | Overlay | 1.8 | 1.8 | [overlay_projector_spin.mp4](./overlay_projector_spin.mp4) |
| 356 | Overlay Projector Swing | Overlay | 1.6 | 1.6 | [overlay_projector_swing.mp4](./overlay_projector_swing.mp4) |
| 357 | Overlay Projector Zoom | Overlay | 1.4 | 1.4 | [overlay_projector_zoom.mp4](./overlay_projector_zoom.mp4) |
| 358 | Overlay Projector Channel | Overlay | 1.5 | 1.5 | [overlay_projector_channel.mp4](./overlay_projector_channel.mp4) |
| 359 | Overlay Watch Flip | Overlay | 1.8 | 1.8 | [overlay_watch_flip.mp4](./overlay_watch_flip.mp4) |
| 360 | Overlay Watch Spin | Overlay | 1.8 | 1.8 | [overlay_watch_spin.mp4](./overlay_watch_spin.mp4) |
| 361 | Overlay Watch Swing | Overlay | 1.6 | 1.6 | [overlay_watch_swing.mp4](./overlay_watch_swing.mp4) |
| 362 | Overlay Watch Zoom | Overlay | 1.4 | 1.4 | [overlay_watch_zoom.mp4](./overlay_watch_zoom.mp4) |
| 363 | Overlay Watch Channel | Overlay | 1.5 | 1.5 | [overlay_watch_channel.mp4](./overlay_watch_channel.mp4) |
| 364 | Overlay Tablet Flip | Overlay | 1.8 | 1.8 | [overlay_tablet_flip.mp4](./overlay_tablet_flip.mp4) |
| 365 | Overlay Tablet Spin | Overlay | 1.8 | 1.8 | [overlay_tablet_spin.mp4](./overlay_tablet_spin.mp4) |
| 366 | Overlay Tablet Swing | Overlay | 1.6 | 1.6 | [overlay_tablet_swing.mp4](./overlay_tablet_swing.mp4) |
| 367 | Overlay Tablet Zoom | Overlay | 1.4 | 1.4 | [overlay_tablet_zoom.mp4](./overlay_tablet_zoom.mp4) |
| 368 | Overlay Tablet Channel | Overlay | 1.5 | 1.5 | [overlay_tablet_channel.mp4](./overlay_tablet_channel.mp4) |
| 369 | Overlay Laptop Flip | Overlay | 1.8 | 1.8 | [overlay_laptop_flip.mp4](./overlay_laptop_flip.mp4) |
| 370 | Overlay Laptop Spin | Overlay | 1.8 | 1.8 | [overlay_laptop_spin.mp4](./overlay_laptop_spin.mp4) |
| 371 | Overlay Laptop Swing | Overlay | 1.6 | 1.6 | [overlay_laptop_swing.mp4](./overlay_laptop_swing.mp4) |
| 372 | Overlay Laptop Zoom | Overlay | 1.4 | 1.4 | [overlay_laptop_zoom.mp4](./overlay_laptop_zoom.mp4) |
| 373 | Overlay Laptop Channel | Overlay | 1.5 | 1.5 | [overlay_laptop_channel.mp4](./overlay_laptop_channel.mp4) |
| 374 | Overlay Console Flip | Overlay | 1.8 | 1.8 | [overlay_console_flip.mp4](./overlay_console_flip.mp4) |
| 375 | Overlay Console Spin | Overlay | 1.8 | 1.8 | [overlay_console_spin.mp4](./overlay_console_spin.mp4) |
| 376 | Overlay Console Swing | Overlay | 1.6 | 1.6 | [overlay_console_swing.mp4](./overlay_console_swing.mp4) |
| 377 | Overlay Console Zoom | Overlay | 1.4 | 1.4 | [overlay_console_zoom.mp4](./overlay_console_zoom.mp4) |
| 378 | Overlay Console Channel | Overlay | 1.5 | 1.5 | [overlay_console_channel.mp4](./overlay_console_channel.mp4) |
| 379 | Overlay Cinema Flip | Overlay | 1.8 | 1.8 | [overlay_cinema_flip.mp4](./overlay_cinema_flip.mp4) |
| 380 | Overlay Cinema Spin | Overlay | 1.8 | 1.8 | [overlay_cinema_spin.mp4](./overlay_cinema_spin.mp4) |
| 381 | Overlay Cinema Swing | Overlay | 1.6 | 1.6 | [overlay_cinema_swing.mp4](./overlay_cinema_swing.mp4) |
| 382 | Overlay Cinema Zoom | Overlay | 1.4 | 1.4 | [overlay_cinema_zoom.mp4](./overlay_cinema_zoom.mp4) |
| 383 | Overlay Cinema Channel | Overlay | 1.5 | 1.5 | [overlay_cinema_channel.mp4](./overlay_cinema_channel.mp4) |

## Re-render

```bash
LD_LIBRARY_PATH=/tmp/al2023/lib PW_EXE=/tmp/chromium node qa/render-transition-videos.mjs
python3 qa/encode-transition-videos.py
```
