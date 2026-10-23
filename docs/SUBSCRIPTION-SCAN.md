# Subscription scan — tutorial channels & mined techniques

Source: `subscriptions.csv` you uploaded (211 channels). Classification is
by channel name + the tutorial channels already studied. The full CSV stays
out of the repo; only this derived scan is committed.

## Tiers

- **TUTORIAL (8)** — channels whose purpose is teaching editing:
  - Zept Tutorials
  - Dr. Xenios Tutorials🔭
  - Wizzy Tutorials
  - Tyson Tutorials
  - Zenny Tutorials
  - mxtstutorials
  - Noelle Tutorials
  - NDK Edit (tutorial channel — watermark series studied end-to-end last wave)
- **EDIT-CREATOR (45)** — edit/AMV/VFX creators; style references,
  some also teach:
  - Z Edit
  - Way to Editz
  - Zero Percent Edits
  - JINSE EDITZ
  - @Uchiha_Edit
  - Donatik_x_Editzz_
  - DR.ERIKEDITZ
  - Asd Edits
  - Era_editz
  - XATORU EDITS
  - ZEE_EDITS
  - hoboedits
  - Atharv Shadow Edits
  - SORA EDITZ
  - CapEditz219
  - Noobedit
  - INFERNO Edits
  - NDK Edit
  - CAF Edits
  - VoidEditz
  - Chino's Animated
  - SILVESTA EDITS
  - Davinci
  - ShadyEditZ
  - Venro Editz
  - HCEDITZ41
  - Animatic
  - ZeeSHu_Editz
  - JOHAN EDITZ
  - Anri Editz
  - YahyaEdits
  - Editiverse
  - Oriki Edit 2.0
  - UzlAnime
  - Clocx_Editz
  - SaxenzEditszz
  - JJKROAR EDITS
  - RAD_EDITZ
  - ANIMEX1I
  - EchoEdits6
  - catchthedit
  - SiLeX EDITZ
  - SARAN EDITZ
  - Phanimations
  - Spider Maneditz58
- **OTHER (159)** — everything else (music, anime, gaming,
  commentary…); not mined for editing technique.

## What was actually consumed (and how)

Route that works in this sandbox: your gateway
(`arena-asset-gateway…workers.dev/?url=…`) fetching YouTube **RSS feeds**
(`feeds/videos.xml?channel_id=…`) and watch pages → titles, descriptions,
timestamps, related videos. Direct yt-dlp from the sandbox is blocked (TLS
cut), and the gateway returns pages/RSS as text — **no video frames are
decoded or watched**, so nothing below claims frame-level viewing.

Mined this wave (recent titles):
- **Noelle Tutorials** — retro text (already built), video composition,
  4K upscale.
- **Wizzy Tutorials** — "How to Make YOUR OWN Shake Effects" (magnitude /
  frequency / angle; smooth, aggressive, random shakes) → built.
- **Zept Tutorials** — AE-like grid transitions, 3 easy effects, masks,
  flow edits → transitions/masks already exist in-app; grid transition queued.
- **NDK Edit** — watermark beginner→advanced (built last wave).

Built from the scan this wave (in `src/lib/textPresets.ts`): `shake-smooth`,
`shake-aggressive` (Wizzy's system: decaying magnitude, frequency-shaped),
plus the technique-queue looks the scan kept surfacing: `fire-text`,
`ice-text`, `gold-text`, `gradient-flow`, `long-shadow`, `blur-focus`,
`vhs-text`, `word-pop` — 33 presets total, all with MP4 vetting packs.

Queued next (from scan + tutorial.md): grid transition (Zept), text behind
object, write-on handwriting, video-inside-text, kinetic beat type, fire
particles. Deep back-catalogue mining of all 45 EDIT-CREATOR channels is a
large job — it proceeds channel-by-channel per wave, RSS-first.

## The 100,000-title index

`tutorial.md` now carries 100,000 numbered tutorial titles generated from
this scan: tutorial channels × techniques (incl. mined ones) × editors ×
YouTube title formulas. They are a **demand map** (what to build next), not
100,000 watched videos; rows that exist as app presets are marked ✅.
