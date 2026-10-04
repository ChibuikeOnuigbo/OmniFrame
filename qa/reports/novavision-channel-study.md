# NovaVision / SnowProductions — Full Channel Study

**Channels studied (all videos):**
- [SnowProductions](https://www.youtube.com/channel/UC-D_JDc_ZvmXM8g8jh_bhcA) (@SnowProductionsss) — main channel: Nova Editor product videos + After Effects masterclasses + market commentary (Portuguese, ~58K views on top video)
- [NovaVisionHub](https://www.youtube.com/channel/UC0jFaVIChu_VbFJ2HFApJPQ) (@NovaVisionHubb, 1.67K subs) — tutorial channel: manga/MMV composition series, rigging deep-dives, NovaVision Library product content

**Method:** every video page was fetched and its full transcript read (11 transcripts; shorts and promo clips covered by title/transcript). This report is the distilled result: who he is, what he teaches, what he is building, and what it means for OmniFrame.

**Who he is:** a Brazilian video editor who monetizes the *international* editing market, teaches AE-style editing (manga/AMV edits, "rap geek" compositions, TikTok edits) on YouTube, and runs a company with a team. Two products: **NovaVision Library** (cloud asset library integrated into AE/Premiere: 5,000+ assets, layered pre-cut PSD characters, overlays, transitions, particles, sound FX, 3D assets, ~hundreds of TB) and **Nova Editor** (a free, zero-ads mobile editor — PC beta targeted for late in the year — combining CapCut AI + After Effects plugin power + Alight Motion complexity + Node Video 3D; R$18/mo or R$100/yr, only heavy server-side AI/collab/library features are paid).

---

## 1. Video inventory & breakdown

### SnowProductions (main channel)

| Video | Length | What it actually teaches |
| --- | --- | --- |
| **CapCut sucks, so I built my own video editor** (58K views) | 5:07 | Nova Editor launch manifesto — full feature list, pricing philosophy (see §2) |
| **I got tired of Alight Motion so I made my own app** (32K) | 5:23 | Q&A follow-up — puppet/bones, vocal separation, beat marking, RSMB, depth maps, PC beta, "we listen to the community" positioning |
| **My Biggest Fear Regarding AI Is Already Happening** (15K) | 8:35 | Market thesis 2026/27: AI auto-editing is coming but is expensive and far from replacing editors; "if you don't use AI, someone who does will replace you"; international market (USD) is the money |
| **Como animar personagens no After Effects (Aulão completo)** (14K) | 31:39 | The flagship masterclass: character rigging, puppet pins, hair/eye/head animation, graph editor (see §3) |
| **The editing style that sells in 2026 / This style makes video editors rich / Nobody teaches you this style** | 12–22 min | Style + monetization series: the "rap geek / MMV" aesthetic as a sellable skill |
| **Como editar 3D VIRAL Reels do Instagram** (1K) | 21:16 | 3D parallax reels workflow |
| **COMO FAZER CAMERA TRACKING 3D NO AFTER EFFECTS** (523) | 6:16 | 3D camera tracker workflow incl. a sharpening pre-pass trick to improve tracks |
| **Como Fazer Parallax no After Effects (jeito simples)** (1.7K) | 5:53 | 2.5D parallax from separated layers (see §3) |
| **AULA COMPLETA Como editar documentário, magnestmedia NO AFTER EFFECTS** | 27:22 | Documentary/magnestmedia-style long-form editing |
| **Como Usar After Effects do zero em 2025! / Aprenda AE em 5 minutos** | 4–18 min | Beginner onboarding to AE |

### NovaVisionHub (tutorial channel)

| Video | Length | What it actually teaches |
| --- | --- | --- |
| **Como Fazer Composições RAP GEEK (Para Iniciantes) — part 01** | 22:18 | The core MMV workflow: 24 fps comp, PSD character import, null-object parenting, parallax staging, pen-tool cutouts, hair/cape layer duplication |
| **Aprenda a Fazer COMPOSIÇÕES RAP GEEK do ZERO — part 2** | 16:47 | Scene finishing: drop shadows (shadow-only), orientation matching, Optical Flares sun (screen blend + 3D depth), S_Ramp overlay lighting, S_Rays god rays, adjustment layers |
| **Como Fazer composições AVANÇADAS no after effects** | 40:27 | Full rig walkthrough: anchor points at joints, rotation curves for arms/legs/ears/eyebrows, Flow easing plugin, position/opacity keying |
| **How to Make Manga EDITS Like a PRO (Beginner Tutorial)** | 16:47 | Same series, EN title |
| **NovaVision Library** (promo) | 0:51 | Product pitch: "no more masking, no more manual cutouts" — pre-cut layered PSDs as the unfair advantage |
| **TikTok Edits in After Effects** (collab) | 15:56 | Beat-marked editing: kick markers, Ctrl+Shift+D splits, shake presets (turbulent-displace, curves zoom, halftone, twitch), copy-paste effect chains per beat |
| Shorts | — | AI segmentation for manga animation, NovaVision Flow promo |

---

## 2. Nova Editor — competitive feature inventory (from the two launch videos)

Claimed capabilities, with the free/paid split he states:

**Free:** all effects, 4K export, subtitle creation, depth map, audio extraction from video, vocal/instrument separation, pitch shift, automatic beat marking, zero ads.

**Paid (server-cost rationale):** real-time collaboration, background removal, image creation/generation, in-app asset library, some templates. R$18/mo · R$100/yr.

Full claimed list: real-time multi-user collaboration · native 3D (lights, image mapping onto video, 3D model animation) · depth map (blur, time remapping, "real light") · upscale · background removal · rotobrush · character segmentation · beat marking · subtitles · sound-effect generation · 2D→3D · video tracking · camera tracking · VFX/image/video creation (GPT, Stable Diffusion, in-house "Nova Model 1" segmentation) · puppet tool + bone rigging "Duik Angela style" · Twixtor-style time remapping + RSMB pixel-vector motion blur · plugin-style effects (glow, liquid glass, tracer, hotspot, twitch, glitch, …) · cloud library (NovaVision) · minimalist Alight-Motion-like layout.

**Pain points he attacks (from user complaints he cites):** CapCut paywalling basics, AE's price/PC-only/plugin cost, Alight Motion's slow export, Node Video's "airplane cockpit" complexity, big apps not listening to the community.

## 3. Technique extraction (the actual editing knowledge)

1. **MMV/manga composition ("rap geek" style):** 1920×1080 @ **24 fps** standard; layered PSD characters (pre-cut: hair, cape, arms, ears, eyes, eyebrows); duplicate layer + mask (M → invert) for occluders like doors; null-object parenting to scale whole rigs without breaking positions; parallax staging by pushing background layers to z ≈ 2000–2500 and scaling up to fill frame.
2. **Rigging & animation:** anchor points moved to joints (Y key) before rotating (R) limbs; animate arms → head → details; easing via graph editor (F9) or the Flow plugin; hair/cape via puppet pins or duplicated cutout layers; head-turn trick with displacement-map layer + motion blur to avoid the "paper doll" shear artifacts.
3. **Lighting/compositing polish:** drop shadow with *shadow-only* mode to cast contact shadows; Optical Flares sun on a 3D layer behind mountains with screen blend; S_Ramp gradient overlay for directional light; S_Rays for god rays; color-matching backgrounds via curves/tritone/tint.
4. **Parallax detail work:** motion tile + mirror edges to avoid frame edges; optical compensation (reverse) for projection-correct expansion; channel blur as a focus-pull; camera moves on P with eased keys.
5. **Camera tracking:** sharpening pre-pass (Sharpen ~33 + Unsharp Mask) to improve tracker point detection; high-res/high-fps source; "detailed analysis" mode; create solid + camera; parent assets to the solid, then delete it; drop 3D models into the solved scene for VFX.
6. **TikTok/beat editing:** mark kicks manually; split (Ctrl+Shift+D) on beats; per-beat effect stacks: turbulent-displace shake → curves zoom (~0→800 scale punch) → halftone (dot frequency) → twitch; opacity ramps 0→100 with eased graphs; "most of an edit is copy-paste of effect chains you already made."

## 4. Mapping to OmniFrame

Already in the product (validate & surface them — they map 1:1 to his teaching):

| His workflow | OmniFrame today |
| --- | --- |
| Puppet pins / bone rigging | `src/lib/rigging.ts`, Drawing panel rig tools |
| Camera/point tracking | `src/lib/trackingEngine.ts` |
| Segmentation / rotobrush / "no more manual cutouts" | `bgRemovalEngine.ts`, `guidedMatting.ts`, selection masks |
| Recolor/color matching | `recolor.ts`, blend modes |
| Voice/instrument separation | voice isolation (studied in `qa/reports/voice-isolation-study.md`) |
| Keyframe easing / graph editor | GraphEditor with curve editing |
| 3D scenes | ThreePanel / ThreeViewer |
| Masking & drawing | DrawingEngine + mask subtools |

**Gaps his audience would expect next (priority order):**

1. **Beat marking** — automatic kick/onset detection on audio clips + snap-to-marker splitting. He names it explicitly as a headline free feature; OmniFrame has none.
2. **Shake/impact effect presets** — turbulent-displace shake, zoom punch, halftone, twitch as one-click presets on clips (his "copy-paste effect chain" flow).
3. **Layered PSD/character import with pre-cut layers** — import layered art keeping hair/cape/limbs as separately animatable clips (the core of his rigging classes; today everything needs manual masking).
4. **Parallax staging helper** — z-depth for image layers + camera with auto "scale to fill" (would make his part-01 tutorial a 2-minute job in OmniFrame).
5. **Depth map & RSMB-style motion blur / time remapping** — heavier items; pair with the existing tracking engine.
6. **Asset library concept** — his moat is NovaVision Library; an open/local asset panel (overlays, SFX, presets) is the counter-move that doesn't need servers.

## 5. Market thesis worth internalizing

- His audience is mobile-first, priced out of AE, and wants *one* app. OmniFrame's web-first position is the same wedge from the other direction (no install at all).
- His paid tier is justified purely by *server-side* cost (AI + library + collab). Everything local is free. That's a clean, defensible line for OmniFrame too.
- His content flywheel: free tutorials that teach a style → asset library that implements it → editor that automates it. OmniFrame docs/tutorials could follow the same arc (each tutorial = a QA-verified workflow, like this repo's E2Es).

---

*Studied 2026-10-04 · 11 full transcripts across both channels + shorts/promos · video URLs referenced in the tables above.*
