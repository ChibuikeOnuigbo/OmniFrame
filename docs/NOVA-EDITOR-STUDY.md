# Nova Editor study — "I Made My Own CapCut in 60 Days" (MatttVfx)

Source: YouTube `3b9GpqVeRNY` (5:47, published 2026-10-13). Full
**transcript read; no frames were viewed or claimed watched.** Nova
Editor (NovaVision Flow) markets: After Effects tools + Alight Motion
layout + CapCut-style AI tools, free, phone-first, with a paid cloud
library and extensions. Below: what OmniFrame already had, what this
wave added, and what is deliberately NOT claimed.

## Feature map

| Nova claim (transcript) | OmniFrame status |
|---|---|
| Full 3D: rig bones, import models, textures, lights, AO, reflections | Already: 3D scene tab, OBJ import, rigging/FK armature with pivot points (`da04a32`), lights (Point/Spot layer) |
| 2D rigging + puppet tool + hair physics | Already: rigging panel, puppet pins + sway, drawing/rig suites; hair-physics strand sim is partial — not claimed complete |
| Cutout / background removal / rotoscoping | Already: background removal modal, RotoMask, Smart Patch |
| Depth maps + relight | Partial: Light layer relights by position; true depth-map estimation not bundled — not claimed |
| Generate images/videos | Via YOUR provider key (see below) — OmniFrame itself generates nothing |
| Auto beat detect | Already shipped (`fb456aa`): Auto Beat + Custom Auto Beat |
| Import AE projects / AE presets / Alight XML / PSD "perfectly" | PSD layered import exists (flattened-preview limits documented). AE project/Alight XML perfect import is **not claimed** — their formats are proprietary binaries; Custom Effects JSON is OmniFrame's shareable preset format instead |
| Cloud library (icons/overlays/presets/3D/SFX), learns from imports + likes | Local equivalent shipped this wave: Pack library with **taste learning** (likes + placements reorder "For you", on-device only). No cloud, no account, no paid tier |
| Smart blend mode when adding overlays | Pack overlays already composite as overlay clips at the playhead |
| ~100 named effects (Colorama, BCC/CC suites, datamosh…) | Named-suite equivalence is not claimed. This wave added the per-pixel family CSS filters can't do: **Solarize, Vibrance, Posterize, Grain, Pixelate/Mosaic** (`src/lib/pixelGrade.ts`), alongside existing brightness/contrast/blur/LUTs/light |
| Audio FX: lowpass, reverb, telephone, lo-fi, bitcrush | Already: audio panel EQ/filters/reverb family + voice tools |
| Community presets: download/share/import | Already: Custom Effects export/import JSON (`23ee7d4`), Scene Recipes |
| Extensions: custom layouts (CapCut/Alight), custom shortcuts | Already: Layout Manager + editable shortcuts. This wave added the **Alight Motion layout preset** (CapCut layout already existed) |
| Keyboard/mouse extension | Already: full shortcut rebinding in Settings |

## Shipped this wave (user-directed)

1. **API key setting, connected properly.** Provider state moved from a
   TopBar-local form into the store, so the whole studio shares one
   connection. The test is now a full check: model ping + latency +
   `/models` listing + "does your chosen model exist on this account".
   The key lives in tab memory only — never localStorage, never .omni.
2. **Model equivalents.** Settings → Models: six capability tabs
   (Chat/Vision/Image/Video/Transcribe/Embeddings) with same-tier
   models per provider (`src/lib/modelCatalog.ts`). Picking one sets
   the active model + remembers the per-capability choice; equivalent
   chips switch provider + model together. No more free-text guessing.
3. **Train your own model.** Your saved Custom Effects become
   (brief → effect JSON) training pairs: validated JSONL export
   (OpenAI chat format), token estimate, <10-example warning, and —
   with a connected OpenAI-compatible key — one-click fine-tune submit
   (file upload → job) with status polling; the resulting tuned model
   auto-selects when training succeeds. Training runs on the provider;
   OmniFrame prepares and submits, it does not train locally.
4. **Library that learns.** Pack assets get Like buttons; likes and
   placements build an on-device taste profile that reorders the
   **For you** view. Resettable ("Forget my taste"); nothing uploaded.
5. **Alight Motion layout** preset + the five pixel-grade effects.

Verified by `qa/models-training-e2e.mjs` against a **mocked** provider
(no real key, no network): connection, equivalents, JSONL validity,
submit/poll, taste ordering, layout, and solarize pixel math
(blue 37,99,235 → 34,98,17 measured). Evidence:
`evidence/improvements/21-models-training.png`.
