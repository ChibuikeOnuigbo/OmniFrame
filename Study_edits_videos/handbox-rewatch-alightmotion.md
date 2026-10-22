# Hancybox rewatch (2026-10-22) — Alight Motion tool mapping

Full rewatch of the @Hancybox shorts set on the saved contact sheets
(`youtube-audit/evidence/micro/<id>.jpg`), INCLUDING the AI-workflow shorts
(this time by mandate). AI tools are logged but NEVER implemented; every
non-AI tool he touches is researched by its editor name (he works mainly in
**Alight Motion**) and implemented where OmniFrame lacked it.

## Per-short log
| id | seen on rewatch | editor tool (AM name where applicable) | OmniFrame |
|----|------------------|----------------------------------------|-----------|
| Qu9MxR8I5dM / ShCYvdqTQ3s / oKaAETJzLq4 | editor-UI bed, layer list + stair-step clips | timeline layer stack, duplicate/stair-step | duplicate_paste, tracks |
| 1kFJZf_6-7Q | pink typo + glowing IG logo | Glow / Edge Glow | effect glow/edgeGlow (NEW) |
| WJAO6OXE4kM | dual-style typo over live action | Text presets + Move&Transform keys | create_text + curves |
| rsUw8ijzPow | feathered white card inset | Feather + Fade | mask feather |
| xLs0M7fFfQA | tilted screen-record insert = **ElevenLabs voice UI** | AI audio — NOT implemented | — (mandate) |
| _1fcL-aB1CU | blurred-blob bed | Gaussian/Lens Blur | blur |
| T2TtWknCu60 | prism light-leak bed | Light Leaks / Lens Flare | overlayFx lightleak |
| uyHDHO7zP88 | flash-burst specks | Flicker + Glow | effect flicker (NEW) |
| N7-UHBSPs7Y | **KlingAI + Nano Banana** start/end card | AI gen — NOT implemented | — (mandate) |
| EtTwCO1tAD8 | desktop UI + dialog list inset | settings dialogs | AE rack |
| CyPgA10kl7o | red doodle arrow over blurred bed | drawing layer | drawing engine |
| vCrpT1dA6QU | tilted gold card on grey vignette | Vignette | effect vignette (NEW) |
| Xk7JcX4yg5M | flat grey bed | Solid Color | new_background |
| Q9Aka1vrJVQ | diagonal red wedge wipe | Radial/Linear Wipe | scene wedge |
| yZOfRXLI4iI | logo lockup + green strip | Chroma Key | chromaKey |
| AQV-mQzAs-U | glowing cyan wireframe phone | Edge Glow + Glow | effect edgeGlow (NEW) |
| V9ApHueQbN0 | anamorphic flare sting | Lens Flare | scene flare |
| K2mSI59wPvg | drifting plane with thin trail | **Echo Keyframes** (motion trail) | effect echo (NEW) |

## Implemented this pass (AM official names, guide.alightmotion.com/effects)
Pixel family (pixelGrade, app + headless one maths): Zoom Blur, Directional
Blur, Glow, Edge Glow, Tilt Shift (Lens Blur band), Vignette, Flicker,
Tiles (mirror flag), Pinch/Bulge, Swirl, Gradient Map, Threshold, Unsharp
Mask (sharpen), Find Edges. Procedural family (proceduralFx, both renderers):
Echo Keyframes, Auto-Shake, Time Quantization (strobe), Motion Blur, Speed
reverse, freeze-frame hold. Rack +18 entries; effect_set carries every key.
Evidence: test_ans_result/evidence/F-*.png, F_amfx/*.mp4, timeline-F.png.

## Not implemented (mandate: no AI features)
ElevenLabs voice UI, KlingAI/Nano-Banana start-end gen, Seedance/Lovart
sponsor beats — logged only.
