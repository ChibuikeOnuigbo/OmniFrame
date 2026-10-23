"""Generate src/lib/pillarPresets.ts — the pillar-deep transition catalogue.

Six pillars (blur, dissolve, light, flicker, glitch, tv) plus the overlay /
scene pillar, 50 named variants each = 350 presets. Every preset is a
parameter set for one of the family renderers in src/lib/pillarRenderers.ts
(family + params), so variants stay honest distinct looks, not clones.
Research sources: glitchology datamosh/glitch taxonomy (RGB split, slice
displacement, block corruption, pixel sort, VHS tear), Storyblocks flare
types (starburst / veiling / ghosting / anamorphic), ineedfx light-leak
families (leak, flicker, bokeh, film burn), CapCut category map (Blur,
Light, Glitch, Overlay, Camera), Alight Motion camera-object overlays
(viewfinder / device frames), CapCut TV-template pages (static, channel
surf, retro tv interface).
"""
import json

OUT = 'src/lib/pillarPresets.ts'

def mulberry_note(seed):
    return seed

presets = []

def add(pid, name, category, family, base, params, desc):
    presets.append(dict(id=pid, name=name, category=category, family=family,
                        baseDuration=base, params=params, description=desc))

# ---------------------------------------------------------------- GLITCH (50)
GL_STYLES = [
    ('slice',   'Slice',      'horizontal bands jump sideways like lost sync'),
    ('rgb',     'Rgb',        'red/blue channels drift apart into coloured fringes'),
    ('block',   'Block',      'corrupted macroblocks displaced across the frame'),
    ('sort',    'Sort',       'pixel-sort streaks drag bright rows across the cut'),
    ('vhs',     'Vhs',        'wobbly scanlines, colour bleed and tracking noise'),
    ('mosh',    'Mosh',       'datamosh melt: incoming motion smears the old frame'),
    ('static',  'Static',     'signal-noise bursts eat the frame in patches'),
    ('tear',    'Tear',       'big signal tears rip bands apart with white gaps'),
    ('shake',   'Shake',      'frame stutter-shakes with chromatic ghosts'),
    ('poster',  'Poster',     'posterized stutter steps with channel ghosts'),
]
GL_LEVELS = [
    ('mild',    0.35, 0.7, 'mild'),
    ('medium',  0.55, 0.6, 'medium'),
    ('heavy',   0.75, 0.5, 'heavy'),
    ('extreme', 0.92, 0.45, 'extreme'),
    ('tv',      0.65, 0.6, 'tv-flavoured'),
]
for sid, sname, sdesc in GL_STYLES:
    for lid, intensity, base, lname in GL_LEVELS:
        extra_scan = 0.5 if lid == 'tv' else 0.18
        extra_static = 0.55 if lid == 'tv' else 0.25
        add(f'glitch_{sid}_{lid}', f'Glitch {sname} {lname.capitalize()}', 'Glitch', 'glitch', base,
            dict(style=sid, intensity=intensity, scan=extra_scan, static=extra_static,
                 seed=hash(f'{sid}{lid}') % 997),
            f'{lname.capitalize()} {sdesc}; intensity {intensity:.2f}.')

# ----------------------------------------------------------------- BLUR (50)
BL_MODES = [
    ('cross',     'Cross',     'both frames blur up and cross-fade through the haze'),
    ('push_l',    'Push Left', 'directional smear pushes the frame left into the next'),
    ('push_r',    'Push Right','directional smear pushes the frame right into the next'),
    ('push_u',    'Push Up',   'directional smear lifts the frame into the next'),
    ('push_d',    'Push Down', 'directional smear drops the frame into the next'),
    ('zoom_in',   'Zoom In',   'zoom-blur rushes inward past the cut'),
    ('zoom_out',  'Zoom Out',  'zoom-blur pulls back and settles on the new shot'),
    ('spin',      'Radial Spin','radial swirl blurs the frame around its centre'),
    ('whip',      'Whip',      'whip-pan streak blur snaps across the cut'),
    ('tilt',      'Tilt Shift','tilt-shift band racks focus from old to new'),
]
BL_LEVELS = [
    ('soft',   0.30, 1.1, 'soft'),
    ('medium', 0.50, 0.9, 'medium'),
    ('strong', 0.72, 0.7, 'strong'),
    ('dreamy', 0.85, 1.4, 'dreamy long-ease'),
    ('snap',   0.55, 0.4, 'snap fast-ease'),
]
for mid, mname, mdesc in BL_MODES:
    for lid, amount, base, lname in BL_LEVELS:
        add(f'blur_{mid}_{lid}', f'Blur {mname} {lname.capitalize()}', 'Blur', 'blur', base,
            dict(mode=mid, amount=amount, seed=hash(f'{mid}{lid}') % 997),
            f'{lname.capitalize()} {mdesc}.')

# ------------------------------------------------------------- DISSOLVE (50)
DI_MODES = [
    ('cross',    'Cross',      'plain opacity blend, the editorial workhorse'),
    ('film',     'Film',       'gamma-weighted film-style blend with grain'),
    ('additive', 'Additive',   'incoming light adds over the outgoing frame'),
    ('subtract', 'Subtractive','incoming frame subtracts out of the old one'),
    ('dip_black','Dip Black',  'dip through black between the shots'),
    ('dip_white','Dip White',  'dip through white between the shots'),
    ('dip_color','Dip Color',  'dip through a tinted card between the shots'),
    ('gamma',    'Gamma',      'heavy gamma curve bends the crossfade'),
    ('luma',     'Luma Gradient','gradient mask reveals the new shot across the frame'),
    ('dither',   'Noise Dither','random cell thresholds dissolve the frame like dithering'),
]
DI_VARS = [
    ('linear', 0.9,  'linear ease'),
    ('smooth', 1.2,  'smooth ease'),
    ('fast',   0.6,  'fast ease'),
    ('slow',   1.8,  'slow ease'),
    ('radial', 1.2,  'radial shape'),
]
for mid, mname, mdesc in DI_MODES:
    for vid, base, vname in DI_VARS:
        add(f'dissolve_{mid}_{vid}', f'Dissolve {mname} {vname.capitalize()}', 'Dissolve', 'dissolve', base,
            dict(mode=mid, ease=vid, seed=hash(f'{mid}{vid}') % 997),
            f'{vname.capitalize()}: {mdesc}.')

# ----------------------------------------------------------------- LIGHT (50)
LI_MODES = [
    ('leak_l',   'Leak Left',    'warm leak sweeps in from the left edge'),
    ('leak_r',   'Leak Right',   'warm leak sweeps in from the right edge'),
    ('leak_top', 'Leak Top',     'leak bleeds down from the top edge'),
    ('flash_white','Flash White','frame blows out to white and recovers'),
    ('flash_color','Flash Color','frame blows out through a tinted flash'),
    ('flare_ana','Anamorphic',   'blue anamorphic streak sweeps the lens'),
    ('flare_star','Starburst',   'starburst flare blooms over the cut'),
    ('flare_ghost','Ghosting',   'ghost orbs trail across the frame'),
    ('bokeh',    'Bokeh Burst',  'soft bokeh discs bloom through the cut'),
    ('filmburn', 'Film Burn',    'film-burn edge glow eats the frame'),
]
LI_HUES = [
    ('warm',    35,  0.9, 'warm'),
    ('gold',    50,  0.8, 'gold'),
    ('magenta', 320, 0.8, 'magenta'),
    ('cyan',    190, 0.7, 'cyan'),
    ('cool',    215, 0.9, 'cool'),
]
for mid, mname, mdesc in LI_MODES:
    for hid, hue, base, hname in LI_HUES:
        add(f'light_{mid}_{hid}', f'Light {mname} {hname.capitalize()}', 'Light', 'light', base,
            dict(mode=mid, hue=hue, seed=hash(f'{mid}{hid}') % 997),
            f'{hname.capitalize()} hue: {mdesc}.')

# --------------------------------------------------------------- FLICKER (50)
FL_MODES = [
    ('film',      'Film',      'frame-rate flicker jitters brightness like old stock'),
    ('strobe_b',  'Strobe Black',  'hard black strobe cuts punctuate the change'),
    ('strobe_w',  'Strobe White',  'hard white strobe cuts punctuate the change'),
    ('frameskip', 'Frame Skip','frames repeat and drop in a stuttering hand-off'),
    ('gate',      'Gate Flicker','projector gate flicker with dust and jitter'),
    ('burn',      'Burn Flash', 'over-exposed burn frames flare between shots'),
    ('blink',     'Blink Dip',  'quick eyelid-blink brightness dips hide the cut'),
    ('vintage',   'Vintage',    'sepia vintage flicker with gentle weave'),
    ('projector', 'Projector',  'projector lamp flicker with scale breathe'),
    ('candle',    'Candle',     'low-frequency candlelight flicker warms the cut'),
]
FL_VARS = [
    ('subtle',  6,  0.20, 0.9, 'subtle'),
    ('classic', 10, 0.45, 0.7, 'classic'),
    ('hard',    14, 0.70, 0.5, 'hard'),
    ('chaos',   18, 0.85, 0.45, 'chaotic'),
    ('pulse',   4,  0.35, 1.0, 'pulsing'),
]
for mid, mname, mdesc in FL_MODES:
    for vid, hz, depth, base, vname in FL_VARS:
        add(f'flicker_{mid}_{vid}', f'Flicker {mname} {vname.capitalize()}', 'Flicker', 'flicker', base,
            dict(mode=mid, hz=hz, depth=depth, seed=hash(f'{mid}{vid}') % 997),
            f'{vname.capitalize()} {hz} Hz depth {depth:.2f}: {mdesc}.')

# ------------------------------------------------------------------- TV (50)
TV_MODES = [
    ('static_burst','Static Burst', 'analogue snow bursts over the hand-off'),
    ('channel',     'Channel Change','channel-surf: static snap then new picture with OSD'),
    ('v_roll',      'Vertical Roll', 'vertical hold slips and the frame rolls away'),
    ('h_tear',      'H-Sync Tear',   'horizontal sync tears bands apart'),
    ('screen_off',  'Screen Off',    'CRT collapse to a bright line, then black'),
    ('power_on',    'Power On',      'power-on line expands into the new picture'),
    ('phosphor',    'Phosphor Fade', 'green phosphor afterglow burns into the next'),
    ('scan_crawl',  'Scan Crawl',    'a crawling scan band carries the new picture in'),
    ('color_bleed', 'Colour Bleed',  'chroma bleeds and smears before settling'),
    ('vhs_track',   'VHS Tracking',  'VHS tracking band of noise rolls through'),
]
TV_VARS = [
    ('mild',    0.35, 1.0, 'mild'),
    ('classic', 0.55, 0.9, 'classic'),
    ('heavy',   0.75, 0.7, 'heavy'),
    ('retro',   0.60, 1.1, 'retos OSD-heavy'),
    ('noise',   0.85, 0.6, 'noise-heavy'),
]
for mid, mname, mdesc in TV_MODES:
    for vid, intensity, base, vname in TV_VARS:
        osd = 1 if (vid == 'retro' or mid == 'channel') else 0
        add(f'tv_{mid}_{vid}', f'TV {mname} {vname.capitalize()}', 'TV', 'tv', base,
            dict(mode=mid, intensity=intensity, osd=osd, seed=hash(f'{mid}{vid}') % 997),
            f'{vname.capitalize()} intensity {intensity:.2f}: {mdesc}.')

# --------------------------------------------------------------- OVERLAY (50)
OV_SCENES = [
    ('tv',       'TV',       'retro television set; the picture lives in its screen'),
    ('phone',    'Phone',    'smartphone; camera pulls out, phone flips, pulls back in'),
    ('monitor',  'Monitor',  'desktop monitor on a stand'),
    ('camera',   'Camera',   'camcorder viewfinder with rec dot and grid'),
    ('projector','Projector','projected screen on a dark wall'),
    ('watch',    'Watch',    'smartwatch face with strap and crown'),
    ('tablet',   'Tablet',   'tablet held landscape'),
    ('laptop',   'Laptop',   'laptop with open base'),
    ('console',  'Console',  'handheld console with grips and buttons'),
    ('cinema',   'Cinema',   'cinema screen between curtains'),
]
OV_MOTIONS = [
    ('flip',    1.8, 'horizontal flip of the device swaps the picture'),
    ('spin',    1.8, 'full spin of the device swaps the picture'),
    ('swing',   1.6, 'pendulum swing of the device swaps the picture'),
    ('zoom',    1.4, 'zoom through the screen into the new picture'),
    ('channel', 1.5, 'static channel-change on the screen swaps the picture'),
]
for sid, sname, sdesc in OV_SCENES:
    for mid, base, mdesc in OV_MOTIONS:
        add(f'overlay_{sid}_{mid}', f'Overlay {sname} {mid.capitalize()}', 'Overlay', 'overlay', base,
            dict(scene=sid, motion=mid, seed=hash(f'{sid}{mid}') % 997),
            f'{sdesc}; {mdesc}.')

assert len(presets) == 350, len(presets)
ids = [p['id'] for p in presets]
assert len(set(ids)) == 350

lines = []
lines.append("/**")
lines.append(" * Pillar-deep transition catalogue — 350 presets across seven pillars:")
lines.append(" * Blur, Dissolve, Light, Flicker, Glitch, TV and Overlay/Scene,")
lines.append(" * 50 named variants each. GENERATED by qa/generate-pillar-presets.py;")
lines.append(" * every preset is a parameter set for the family renderers in")
lines.append(" * src/lib/pillarRenderers.ts. Base seconds are the out-of-the-box")
lines.append(" * length; users raise/lower inside the 0.1-5s cap.")
lines.append(" */")
lines.append("import type { TransitionType } from '../types'")
lines.append("")
lines.append("export interface PillarParams { [key: string]: number | string }")
lines.append("")
lines.append("export interface PillarPresetDef {")
lines.append("  id: TransitionType")
lines.append("  name: string")
lines.append("  category: 'Blur' | 'Dissolve' | 'Light' | 'Flicker' | 'Glitch' | 'TV' | 'Overlay'")
lines.append("  family: 'glitch' | 'blur' | 'dissolve' | 'light' | 'flicker' | 'tv' | 'overlay'")
lines.append("  baseDuration: number")
lines.append("  params: PillarParams")
lines.append("  description: string")
lines.append("}")
lines.append("")
lines.append("export const PILLAR_PRESETS: PillarPresetDef[] = [")
for p in presets:
    params = ', '.join(f"{k}: {v if isinstance(v, (int, float)) else json.dumps(v)}" for k, v in p['params'].items())
    lines.append(f"  {{ id: '{p['id']}', name: {json.dumps(p['name'])}, category: '{p['category']}', family: '{p['family']}', baseDuration: {p['baseDuration']}, params: {{ {params} }}, description: {json.dumps(p['description'])} }},")
lines.append("]")
lines.append("")
open(OUT, 'w').write('\n'.join(lines) + '\n')
print('wrote', OUT, len(presets), 'presets')

# ---- types.ts: extend the TransitionType union with the 350 pillar ids ----
tp = 'src/types.ts'
s = open(tp).read()
union_add = '\n  // Pillar-deep variants (generated by qa/generate-pillar-presets.py)\n  | ' + '\n  | '.join(f"'{i}'" for i in ids)
marker = "| 'glitch'\n"
assert marker in s, 'union marker missing'
s = s.replace(marker, "| 'glitch'" + union_add + '\n', 1)
open(tp, 'w').write(s)
print('types.ts union extended to', 33 + 350, 'members')
