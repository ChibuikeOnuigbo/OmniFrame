# Alight Motion — Intensive Study (TYMM corpus)

Studied corpus — 12 project XMLs, all downloaded from the user's Drive into
`new_doc_toll_research/alight/`, all parsed + imported by the app:

| File | Title | Res / fps | Layers | Mapped fx | Keyframed props |
|---|---|---|---|---|---|
| hardtrekk-hero.xml | number hardtrekk - hero x edit (5hr+) final | 1920×1080 @120 | 80 | 378 | 369 |
| warps.xml | Warps | 1920×1080 @30 | 15 | 49 | 42 |
| cc-5plus1.xml | Cc Pack (5 CC + 1 Bonus) | 1920×1080 @30 | 60 | 148 | 1 |
| cc-tymm-pack.xml | Cc Pack 1,000 subs (TYMM) | 1920×1080 | 78 | 182 | 1 |
| Onyankopon.xml | New Project (Onyankopon) | 1920×1080 | 121 | 413 | 176 |
| Evergreen.xml | New Project (Evergreen) | 1920×1080 | 41 | 112 | 73 |
| shakes.xml | Shakes (MOLOB/ZNEPTUNE/FLOW/NANIMALO/RANDOM/JELLY…) | 1920×1080 | 10 | 34 | 47 |
| pf/LOSER - PF.xml | LOSER | — | 75 | 247 | — |
| pf/Lawless - PF.xml | Lawless | — | 73 | 299 | — |
| pf/Mi Mi Mi - PF.xml | Mi Mi Mi | — | 97 | 417 | — |
| pf/Montagem Guerreirro - PF.xml | Montagem Guerreirro | — | 94 | 333 | — |
| pf/Tiki Tiki - PF.xml | Tiki Tiki | — | 99 | 222 | — |

AM versions seen: `5.0.161.106019` (hero, warps) and `5.0.270.1002578` (cc).

## XML anatomy (v5 export)

```xml
<scene title width height fps totalTime="ms" bgcolor="#AARRGGBB" am="…">
  <bookmark t="ms"/>                     <!-- timeline markers -->
  <shape id label startTime endTime="ms" fillType="media|color|gradient"
         fillVideo="content://…" speed mediaFillMode s=".rect">
    <transform>
      <location value="x,y,z"> <kf t="0..1" v="x,y,z" e="cubicBezier x1 y1 x2 y2"/> </location>
      <scale value="sx,sy">   <kf …/> </scale>
      <rotation value="deg"/> <opacity value="0..1"/> <anchor …/>
    </transform>
    <fillColor value="#AARRGGBB"/>
    <effect id="com.alightcreative.effects.tile" locallyApplied="true">
      <property name="scale" type="float" value="1.0"/>
      <property name="…" type="float"><kf t v e="cubicBezier …"/></property>
    </effect>
    <gain value="dB"/> <property name="size" type="vec2" value="w,h"/>
  </shape>
  <text id startTime endTime size="28" font="imported?name=CircularStd-Black.otf"
        wrapWidth align> <transform>…</transform> <content>CC 1</content> </text>
  <nullobj id label parent type="perspective"> …keyframed rig null… </nullobj>
</scene>
```

Key findings:
- **Times are ms**; `<kf t>` is **normalised 0..1 over the layer span**; easing
  `cubicBezier x1 y1 x2 y2` maps 1:1 onto the app's custom curve points
  `[[0,0],[x1,y1],[x2,y2],[1,1]]` (src/lib/animation/CurveEngine.ts).
- **329 nullobj rigs** in the corpus, **321 of them keyframed** — the shake/warp
  motion lives on parented nulls, not on the media layers. Imported as data
  (`includeNulls` materialises them as clips).
- **Media refs are Android `content://` uris** — unresolvable off-device. The
  importer creates labelled placeholder layers; swap real footage with
  `replace_video` (carryEffects=true keeps the whole AM chain).
- Layer types: `shape` (rect/gradient/media fill), top-level `text` (with
  `font="imported?name=…"`, size in px at project resolution, wrapWidth, align),
  `nullobj` (rig), plus `group` nesting on some exports.

## Effect scan → site catalog

~100 unique effect ids across the corpus (top counts: lift 457, tile 435,
oscillate3 206, motionblur4 153, shake2 152, zoomblur3 147,
turbulentdisplace3 129, exposure 126, squeeze 124, jitter 79, satvib 78…).
**Every id is listed in `AM_EFFECT_MAP` (src/lib/alightXml.ts)** — mapped to
real ClipEffect engine patches where an honest equivalent exists (≈75 entries:
AM Deep Glow → glow, AM Oscillate → oscillate+freq, AM Shake → autoShake,
AM RGB Glitch → glitch/rgb, AM Minimax Blur → minimax, …). Transform/text/
transition-only machinery (transform2, scaleassist, texttransform, wipe2,
dissolve…) maps to `null` and is preserved as raw data on the clip
(`clip.amEffects`) and in the JSON dumps.

`AM_FX_CATALOG` is merged into `src/lib/effectCatalog.ts` → all mapped AM
effects appear in the site Effects panel (trace: *"Alight Motion v5 XML study"*)
and in MCP `fx_catalog`, editable + keyframeable like every other fx.

## App integration (shipped)

- `src/lib/alightXml.ts` — parser (regex, runs identically browser + headless),
  effect map/catalog, normalised import model (`alightToImport`).
- MCP tool **`alight_import {path, includeNulls}`** — rebuilds the composition
  (layers→clips, AM fx→engine patches, kf→CurveEngine keys with the original
  bezier easing, gain→volume dB→linear) and writes the full data dump to
  `data_motiondesijg/alight/<title>.json` (raw parse + normalised import).
- Browser: MediaPanel **“Import Alight XML”** button → `store.importAlightXml`
  (sets project name/dims/fps, creates assets+clips, transform, effects, CE
  keys, volume).
- Proof renders: `test_ans_result/alight-warps-import.mp4` (Warps @ 1920×1080,
  app-made frames — media layers are placeholders by design).
- Text-layer scan (55 layers): subtitle chains
  `texttransform + textspacing + gradientoverlay2` on Teko-Bold / LOVELY /
  AGENCYB / Kenyan Coffee / Okay Jelly / Heavitas / CircularStd-Black /
  **Quicksand_Bold (in the TYMM font pack — stem name match)** → recorded in
  `new_doc_toll_research/CC-SCAN.md`.

## Honest limits

- `content://` media cannot be resolved — placeholders + re-link via
  replace_video. Gradient fills rasterise flat; `drawing.progress`, masks
  (`<mask>` blocks), and group nesting depth are data-only (not re-rendered).
- AM effect→engine mapping is a visual-equivalence patch set, not a
  bit-exact reimplementation of Alight's proprietary shaders; unmapped ids
  stay in the dump for future mapping. Similarity NOT MEASURED (no declared
  metric) — per standing honesty rule.
