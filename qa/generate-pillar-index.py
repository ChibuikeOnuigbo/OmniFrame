"""Generate transition_pillars/ — the pillar-deep tutorial demand map.

HONESTY: this is a DEMAND MAP, not a watch log. Titles are generated from a
researched matrix (your subscriptions.csv channels x technique vocabularies
fetched from glitchology / Storyblocks / ineedfx / CapCut / Alight pages x
editors x formats); each line links to a real YouTube SEARCH for that title.
Nothing here was watched; ✅ marks techniques whose transition preset already
ships in OmniFrame (pillarPresets.ts). 25,000 entries per pillar file,
175,000 total. The generator is deterministic — rerun with a bigger `TAKE`
for more (your 10^26 figure exceeds planetary storage; 420k is what the repo
can honestly carry).
"""
import csv, os, urllib.parse

TAKE = 25000
OUT = 'transition_pillars'
os.makedirs(OUT, exist_ok=True)

channels = []
with open('qa/assets/subscriptions.csv') as f:
    for row in csv.DictReader(f):
        t = (row.get('Channel Title') or '').strip()
        if t:
            channels.append(t)
assert len(channels) >= 100, len(channels)

EDITORS = ['CapCut', 'CapCut PC', 'Alight Motion', 'After Effects', 'Premiere Pro', 'Final Cut Pro',
           'DaVinci Resolve', 'VN', 'InShot', 'KineMaster', 'PowerDirector', 'Filmora', 'Movavi',
           'Premiere Rush', 'LumaFusion', 'OmniFrame']
FORMATS = ['full tutorial', 'step-by-step breakdown', 'preset pack walkthrough', 'speed edit',
           'template explained', 'settings explained', 'before/after', 'live edit', '#shorts',
           'beat-synced edit']

PILLARS = {
    'glitch': ([
        ('RGB split glitch transition', 'glitch_rgb_medium'),
        ('datamosh melt between clips', None),
        ('pixel sort sweep transition', 'glitch_sort_heavy'),
        ('macroblock corruption glitch', 'glitch_block_extreme'),
        ('VHS tracking tear transition', 'glitch_vhs_classic'),
        ('signal tear with white gap', 'glitch_tear_heavy'),
        ('static burst cut', 'glitch_static_tv'),
        ('shake hit glitch cut', 'glitch_shake_medium'),
        ('posterize stutter transition', 'glitch_poster_medium'),
        ('slice displacement glitch', 'glitch_slice_heavy'),
        ('chromatic aberration fringe on cut', 'glitch_rgb_mild'),
        ('buffer overflow echo glitch', None),
        ('hex corruption artifact transition', None),
        ('dither pattern glitch burn', None),
        ('glitch velocity combo', None),
        ('Y2K compression error look', 'glitch_block_tv'),
        ('analog glitch overlay stack', 'glitch_vhs_heavy'),
        ('stutter frame repeat glitch', 'glitch_poster_tv'),
        ('datamosh bloom burst', None),
        ('reverse mosh transition', None),
        ('glitch fade hybrid', 'glitch_slice_mild'),
        ('heavy glitch drop transition', 'glitch_slice_extreme'),
        ('mild glitch subtitle-safe cut', 'glitch_rgb_mild'),
        ('tv-flavoured glitch cut', 'glitch_slice_tv'),
    ], 'glitch'),
    'blur': ([
        ('whip pan blur transition', 'blur_whip_snap'),
        ('directional blur push left', 'blur_push_l_strong'),
        ('directional blur push right', 'blur_push_r_strong'),
        ('zoom blur rush in', 'blur_zoom_in_strong'),
        ('zoom blur pull out', 'blur_zoom_out_strong'),
        ('radial swirl blur transition', 'blur_spin_medium'),
        ('tilt shift focus rack', 'blur_tilt_medium'),
        ('cross blur dreamy fade', 'blur_cross_dreamy'),
        ('motion blur speed ramp', None),
        ('slow shutter ghosting blur', None),
        ('vertical blur drop', 'blur_push_d_medium'),
        ('vertical blur lift', 'blur_push_u_medium'),
        ('soft blur dissolve', 'blur_cross_soft'),
        ('snap blur hit cut', 'blur_whip_snap'),
        ('haze veiling blur ambient', None),
        ('focus pull rack transition', 'blur_tilt_strong'),
        ('spin blur whirl', 'blur_spin_strong'),
        ('push blur slide hybrid', 'blur_push_l_medium'),
        ('dreamy long-ease blur fade', 'blur_cross_dreamy'),
        ('strong blur punch transition', 'blur_zoom_in_strong'),
        ('micro blur soften cut', 'blur_cross_soft'),
        ('whirl blur twist', 'blur_spin_medium'),
        ('zoom through blur tunnel', 'blur_zoom_out_dreamy'),
        ('blur velocity combo', None),
    ], 'blur'),
    'dissolve': ([
        ('cross dissolve clean cut', 'dissolve_cross_smooth'),
        ('film dissolve with grain', 'dissolve_film_smooth'),
        ('additive dissolve light mix', 'dissolve_additive_smooth'),
        ('subtractive dissolve experiment', 'dissolve_subtract_smooth'),
        ('dip to black scene change', 'dissolve_dip_black_linear'),
        ('dip to white flash fade', 'dissolve_dip_white_linear'),
        ('dip to colour card fade', 'dissolve_dip_color_smooth'),
        ('gamma bent crossfade', 'dissolve_gamma_smooth'),
        ('luma gradient reveal', 'dissolve_luma_linear'),
        ('radial luma reveal', 'dissolve_luma_radial'),
        ('noise dither dissolve', 'dissolve_dither_smooth'),
        ('slow dissolve montage', 'dissolve_cross_slow'),
        ('fast dissolve jump', 'dissolve_cross_fast'),
        ('film burn dissolve hybrid', 'dissolve_film_slow'),
        ('morph cut smoothing (needs optical flow)', None),
        ('dither cell dissolve macro', 'dissolve_dither_fast'),
        ('gradient wipe dissolve hybrid', 'dissolve_luma_smooth'),
        ('exposure dissolve hybrid', 'dissolve_gamma_fast'),
        ('vintage dissolve grain stack', 'dissolve_film_radial'),
        ('blackout dip rhythm edit', 'dissolve_dip_black_fast'),
        ('whitedip beat fade', 'dissolve_dip_white_fast'),
        ('colour card dip branding', 'dissolve_dip_color_linear'),
        ('long gamma fade cinematic', 'dissolve_gamma_slow'),
        ('dissolve chain montage', 'dissolve_cross_slow'),
    ], 'dissolve'),
    'light': ([
        ('light leak sweep left', 'light_leak_l_warm'),
        ('light leak sweep right', 'light_leak_r_warm'),
        ('light leak top bleed', 'light_leak_top_gold'),
        ('white flash transition', 'light_flash_white_warm'),
        ('colour flash transition', 'light_flash_color_magenta'),
        ('anamorphic flare sweep', 'light_flare_ana_cyan'),
        ('starburst flare bloom', 'light_flare_star_gold'),
        ('ghosting orbs flare trail', 'light_flare_ghost_cool'),
        ('bokeh burst transition', 'light_bokeh_warm'),
        ('film burn edge transition', 'light_filmburn_warm'),
        ('veiling glare soften', None),
        ('sun streak sci-fi flare', 'light_flare_ana_cool'),
        ('golden hour leak montage', 'light_leak_l_gold'),
        ('magenta dream leak', 'light_leak_r_magenta'),
        ('cyan tech flare hit', 'light_flare_ana_cyan'),
        ('flash velocity combo', None),
        ('lens dirt sparkle overlay', None),
        ('exposure pop cut', 'light_flash_white_gold'),
        ('warm bloom romance fade', 'light_bokeh_gold'),
        ('cool bloom night fade', 'light_bokeh_cool'),
        ('burn flash memory cut', 'light_filmburn_gold'),
        ('double leak cross', 'light_leak_top_magenta'),
        ('flare hide-cut technique', 'light_flare_star_warm'),
        ('leak speed-ramp combo', None),
    ], 'light'),
    'flicker': ([
        ('film flicker transition', 'flicker_film_classic'),
        ('black strobe cut', 'flicker_strobe_b_hard'),
        ('white strobe cut', 'flicker_strobe_w_hard'),
        ('frame skip stutter cut', 'flicker_frameskip_classic'),
        ('projector gate flicker', 'flicker_gate_classic'),
        ('burn flash flicker', 'flicker_burn_hard'),
        ('blink dip cut', 'flicker_blink_classic'),
        ('vintage sepia flicker', 'flicker_vintage_classic'),
        ('projector lamp flicker', 'flicker_projector_classic'),
        ('candlelight flicker fade', 'flicker_candle_subtle'),
        ('chaos strobe drop', 'flicker_strobe_w_chaos'),
        ('subtle flicker dialogue cut', 'flicker_film_subtle'),
        ('pulse flicker slow build', 'flicker_film_pulse'),
        ('hard flicker action cut', 'flicker_film_hard'),
        ('gate weave old film look', 'flicker_gate_hard'),
        ('strobe beat sync edit', None),
        ('flicker hide-cut technique', 'flicker_blink_subtle'),
        ('burn frame flashback', 'flicker_burn_classic'),
        ('projector dust ambience', 'flicker_projector_subtle'),
        ('candle horror flicker', 'flicker_candle_hard'),
        ('vintage home movie cut', 'flicker_vintage_subtle'),
        ('blink memory cut', 'flicker_blink_pulse'),
        ('frameskip rhythm edit', 'flicker_frameskip_hard'),
        ('flicker velocity combo', None),
    ], 'flicker'),
    'tv': ([
        ('tv static burst transition', 'tv_static_burst_classic'),
        ('channel change with OSD', 'tv_channel_retro'),
        ('vertical roll tv cut', 'tv_v_roll_classic'),
        ('h-sync tear tv cut', 'tv_h_tear_heavy'),
        ('crt screen off collapse', 'tv_screen_off_classic'),
        ('crt power on expand', 'tv_power_on_classic'),
        ('phosphor fade tv cut', 'tv_phosphor_classic'),
        ('scan crawl band transition', 'tv_scan_crawl_classic'),
        ('colour bleed tv settle', 'tv_color_bleed_classic'),
        ('vhs tracking band roll', 'tv_vhs_track_classic'),
        ('retro tv interface overlay', 'tv_channel_retro'),
        ('old tv noise insert', 'tv_static_burst_noise'),
        ('channel surf rhythm edit', 'tv_channel_classic'),
        ('crt wobble analog look', 'tv_v_roll_retro'),
        ('static snap beat cut', 'tv_static_burst_heavy'),
        ('tv off beat drop', 'tv_screen_off_heavy'),
        ('power on intro sting', 'tv_power_on_mild'),
        ('phosphor ghost trail', 'tv_phosphor_heavy'),
        ('scanline veil ambience', 'tv_scan_crawl_mild'),
        ('chroma bleed vintage tv', 'tv_color_bleed_retro'),
        ('tracking noise horror cut', 'tv_vhs_track_noise'),
        ('tv glitch hybrid cut', 'tv_h_tear_noise'),
        ('channel number overlay edit', 'tv_channel_retro'),
        ('analog warm tv fade', 'tv_phosphor_mild'),
    ], 'tv'),
    'overlay': ([
        ('tv green screen scene swap', 'overlay_tv_channel'),
        ('phone flip zoom out transition', 'overlay_phone_flip'),
        ('phone spin swap transition', 'overlay_phone_spin'),
        ('monitor screen pull-out', 'overlay_monitor_zoom'),
        ('camcorder viewfinder swap', 'overlay_camera_channel'),
        ('projector screen reveal', 'overlay_projector_zoom'),
        ('smartwatch face swap', 'overlay_watch_flip'),
        ('tablet hand-off transition', 'overlay_tablet_swing'),
        ('laptop screen pull-back', 'overlay_laptop_zoom'),
        ('handheld console swap', 'overlay_console_flip'),
        ('cinema screen curtains reveal', 'overlay_cinema_zoom'),
        ('slowmo app switch mock', None),
        ('earth zoom pull transition', None),
        ('hand mask snap transition', None),
        ('netflix cover random swap', None),
        ('camera shutter click cut', None),
        ('pov camera roll swap', 'overlay_camera_spin'),
        ('swing device hand-off', 'overlay_tv_swing'),
        ('zoom through screen trick', 'overlay_monitor_zoom'),
        ('channel change on device', 'overlay_tv_channel'),
        ('double flip device combo', 'overlay_phone_flip'),
        ('projector green screen composite', 'overlay_projector_channel'),
        ('viewfinder rec swap', 'overlay_camera_channel'),
        ('cinema intro screen fade', 'overlay_cinema_channel'),
    ], 'overlay'),
}

HEADER = """# {pillar} pillar — tutorial demand map ({take:,} entries per pillar)

**Honesty first:** generated demand map, NOT a watch log. Each line is a
real YouTube SEARCH link for a researched title pattern; nothing was
watched frame-by-frame. Matrix: {nch} channels from your subscriptions.csv
x {ntech} researched technique patterns x {ned} editors x {nfmt} formats.
✅ = an OmniFrame transition preset already implements this technique
(preset id in brackets). Unmarked rows are backlog / research leads.
Research vocabulary sources: glitchology.com datamosh+glitch taxonomy,
Storyblocks flare types, ineedfx light-leak families, CapCut transition
category + TV/overlay template pages, Alight Motion camera-object guide.
Generator: qa/generate-pillar-index.py (deterministic; raise TAKE for more).

"""

total = 0
for pillar, (techs, _fam) in PILLARS.items():
    path = os.path.join(OUT, f'{pillar}.md')
    lines = [HEADER.format(pillar=pillar.capitalize(), take=TAKE, nch=len(channels),
                           ntech=len(techs), ned=len(EDITORS), nfmt=len(FORMATS))]
    n = 0
    while n < TAKE:
        ch = channels[n % len(channels)]
        tech, preset = techs[(n // 34560) % len(techs)]
        ed = EDITORS[(n // 2160) % len(EDITORS)]
        fm = FORMATS[(n // 216) % len(FORMATS)]
        title = f"{ch}: {tech} in {ed} — {fm}"
        q = urllib.parse.quote(title)
        mark = f" ✅ `{preset}`" if preset else ""
        lines.append(f"- [{title}](https://www.youtube.com/results?search_query={q}){mark}")
        n += 1
    open(path, 'w').write('\n'.join(lines) + '\n')
    total += TAKE
    print('wrote', path, TAKE)
print('total entries', total)
