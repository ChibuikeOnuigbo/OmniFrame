# Hancybox — every tool / effect / feature clicked in the video text (consolidated ONCE)

Source: `yt_hancy/hancy_explantion.json` — 79 videos listed of the channel's 123 (scanned 2026-10-23 via r.jina.ai proxy of youtube.com/@Hancybox/shorts and /videos (first render page of each tab)). Channel reports 123 videos; the Shorts tab first render page yields 48 shorts and the Videos tab 31+1 long-form entries. Remaining uploads sit behind YouTube infinite-scroll/JS and are unreachable from this sandbox (no frames, no scroll). Nothing beyond these is invented: every row below is either rewatched on a saved contact sheet, fetched as a per-video metadata page, or read off the channel listing.

Every line below comes from the video TEXT (titles + listing descriptions + rewatched contact-sheet captions for the 20 shorts). Nothing is invented; AI rows are logged and NEVER implemented (standing mandate).

## A. Consolidated unique list (what he actually touches, once each)

| tool / effect / feature (from video text) | videos | OmniFrame status |
|---|---|---|
| Glow / Edge Glow | 6 (1kFJZf_6-7Q, DmCUAPgTMUY, uyHDHO7zP88, yZOfRXLI4iI, AQV-mQzAs-U, 7blzGS1OaK4) | ✔ shipped — glow + edgeGlow engines (pixelGrade), droppable from Effects tab |
| Blur family (Gaussian/Lens/frosted) | 6 (_1fcL-aB1CU, T2TtWknCu60, AQV-mQzAs-U, up31uGaeqAE, VefvlhFbSsg, K2mSI59wPvg) | ✔ shipped — blur/zoomBlur/directionalBlur/fractalBlur/tiltShift |
| Vignette | 1 (vCrpT1dA6QU) | ✔ shipped — vignette engine + overlayFx vignette |
| Flicker | 1 (uyHDHO7zP88) | ✔ shipped — flicker engine |
| Chroma Key | 1 (yZOfRXLI4iI) | ✔ shipped — chromaKey engine |
| Echo Keyframes (motion trail) | 1 (K2mSI59wPvg) | ✔ shipped — echo/echoDecay/echoSpacing |
| Shake keys | 3 (s1ooaRgqvQ8, UP7UZkCOc-c, dp7Qyirt10E) | ✔ shipped — autoShake + oscillate (official AM props) |
| Grain / film look | 1 (DmCUAPgTMUY) | ✔ shipped — grain engine |
| Color grade / LUT grading | 6 (DmCUAPgTMUY, XtZkj2q3gOw, 1jj9eqVhNI4, up31uGaeqAE, SBpZd0VWoHQ, ndzaCeHlK3o) | ✔ shipped — LUT stack + grades (engine-agnostic, LumaFusion rows included) |
| Light Leaks / Lens Flare overlays | 2 (T2TtWknCu60, V9ApHueQbN0) | ✔ shipped — overlayFx lightleak + scene flare presets |
| Scanline overlay | 1 (yZOfRXLI4iI) | ✔ shipped — overlayFx scanlines |
| Masks / feather / mask reveal / wedge mask | 10 (AQV-mQzAs-U, 7blzGS1OaK4, vIDgGf3mGkY, ki2fYYQFH6s, jaa8Lpvo8h8, llLcDhbyBH0, Uqhsvo1Dg1A, Xk2YMWEh36k, oTSvVyrQJwk, 7o4NXRnoNjE) | ✔ shipped — clip masks + feather + scene wedge |
| Text tools (presets, per-char keys, path text) | 10 (1kFJZf_6-7Q, WJAO6OXE4kM, uyHDHO7zP88, vIDgGf3mGkY, ki2fYYQFH6s, bf0xqNBjLms, llLcDhbyBH0, Uqhsvo1Dg1A, YQTKn-5e_58, oTSvVyrQJwk) | ✔ shipped — create_text + TEXT_PRESETS + text panel keys |
| Keyframe graphs / easing / custom curves | 15 (UP7UZkCOc-c, Xk7JcX4yg5M, WKKO-2uHJvk, 5fgRG9uvL5o, N6cWx6W2KmE, vIDgGf3mGkY, hb_IkWQspxk, ysoVksCfUA0, Eyv5oyG8A5o, llLcDhbyBH0 …) | ✔ shipped — CurveEngine + Graph Editor (custom curves included) |
| Position/scale/rotation keys | 16 (UP7UZkCOc-c, WJAO6OXE4kM, xLs0M7fFfQA, _1fcL-aB1CU, CyPgA10kl7o, vCrpT1dA6QU, Q9Aka1vrJVQ, 7blzGS1OaK4, 1jj9eqVhNI4, vIDgGf3mGkY …) | ✔ shipped — transform keyframes |
| 3D rotation / 3D layers / 3D camera / null rig / parenting / parallax | 17 (vCrpT1dA6QU, oKaAETJzLq4, Q9Aka1vrJVQ, WKKO-2uHJvk, 5rCjWw8PNbY, N6cWx6W2KmE, 1jj9eqVhNI4, lthFvh04iVY, hb_IkWQspxk, jaa8Lpvo8h8 …) | ✔ shipped — null objects + parenting chains + ThreeViewer 3D layers/camera |
| Transitions | 3 (UP7UZkCOc-c, GkvcPJ-QohY, dp7Qyirt10E) | ✔ shipped — TRANSITION_PRESETS (glitch family moved to Effects) |
| Blend modes | 3 (UP7UZkCOc-c, yZOfRXLI4iI, up31uGaeqAE) | ✔ shipped — per-clip blendMode |
| Motion blur | 1 (up31uGaeqAE) | ✔ shipped — motionBlur engine |
| Freeze frame | 1 (pk_YpDArJT0) | ✔ shipped — freezeHold/freezeAt |
| Sharpen / unsharp | 1 (VefvlhFbSsg) | ✔ shipped — sharpen engine |
| Drawing layer (arrows/doodles) | 1 (CyPgA10kl7o) | ✔ shipped — drawing engine (15 tools incl. shapes) |
| Shape layers / shape paths | 8 (V9ApHueQbN0, Xk7JcX4yg5M, WKKO-2uHJvk, 5fgRG9uvL5o, K2mSI59wPvg, llLcDhbyBH0, Xk2YMWEh36k, 7o4NXRnoNjE) | ✔ shipped — shape masks + drawing shape tools (point-morph keys = backlog) |
| Duplicate / layer stack / stair-step / extrude copies | 7 (Qu9MxR8I5dM, _1fcL-aB1CU, T2TtWknCu60, ShCYvdqTQ3s, vCrpT1dA6QU, oKaAETJzLq4, 1jj9eqVhNI4) | ✔ shipped — duplicate_paste + tracks + 3D rotation extrude look |
| Solid backgrounds | 2 (T2TtWknCu60, Xk7JcX4yg5M) | ✔ shipped — new_background beds |
| Wipes (radial/linear) | 1 (Q9Aka1vrJVQ) | ✔ shipped — scene wipe/wedge presets |
| Adjustment layers | 1 (hb_IkWQspxk) | ✔ shipped — adjustment layers + dropped fx instances (board J) |
| Groups / grouped keys | 1 (5rCjWw8PNbY) | ✔ shipped — groups + lasso group selection |
| SFX / beat sync | 4 (ki2fYYQFH6s, Uqhsvo1Dg1A, CqWhP6zvmgM, Xk2YMWEh36k) | ✔ shipped — beatDetect + marker sync |
| Export / bitrate settings | 1 (VefvlhFbSsg) | ✔ shipped — export pipeline + settings |
| CapCut-specific rows (keyframes/transitions/effects/freeze) | 7 (GkvcPJ-QohY, pk_YpDArJT0, dp7Qyirt10E, FEhL2__m0n0, Xk2YMWEh36k, uwE0_X0k9Fo, 8bZh_p5zGRk) | ✔ shipped CapCut-equivalents — keyframes, transitions, effects tab, freeze |
| AI generation / avatars / voice / lip-sync / enhance | 35 (baqtB_b-SBU, s1ooaRgqvQ8, NAhfAEGRmr0, DmCUAPgTMUY, eBF0ETssh98, rsUw8ijzPow, xLs0M7fFfQA, GkvcPJ-QohY, XtZkj2q3gOw, WjZpCpk7oDg …) | ✖ NOT implemented — AI mandate: logged only, never built |
| Sponsor / talk / no editor demo | 9 (baqtB_b-SBU, NAhfAEGRmr0, xLs0M7fFfQA, MGat0jAwBDU, EtTwCO1tAD8, CqWhP6zvmgM, 1XOmiC9mG5w, aqhnWVVWH6k, 8Sw80XUJ7MQ) | — no editor feature demonstrated |

## B. All scanned videos, once, with their verbatim tool text

| # | kind | id | tools/effects/features in video text |
|---|---|---|---|
| 1 | short | baqtB_b-SBU | basic cuts/captions only — no AM feature demo |
| 2 | short | Qu9MxR8I5dM | layer stack, duplicate/stair-step clips, keyframes |
| 3 | short | 1kFJZf_6-7Q | Glow, Edge Glow on logo/text |
| 4 | short | s1ooaRgqvQ8 | AI gen — comp cuts only |
| 5 | short | UP7UZkCOc-c | position/scale keyframes, graphs (easing), shake keys, transitions, blend modes |
| 6 | short | NAhfAEGRmr0 | AI design — no AM demo |
| 7 | short | DmCUAPgTMUY | color grade, grain/film look, glow over AI stills; keyframed zooms |
| 8 | short | WJAO6OXE4kM | Text presets, Move & Transform keyframes |
| 9 | short | eBF0ETssh98 | AI image gen — minimal edit |
| 10 | short | rsUw8ijzPow | AI gen — cut/compare only |
| 11 | short | xLs0M7fFfQA | screen-record insert, tilt transform; AI voice |
| 12 | short | GkvcPJ-QohY | CapCut keyframes/transitions (not AM) |
| 13 | short | pk_YpDArJT0 | CapCut freeze; AM equivalent = freeze frame hold |
| 14 | short | XtZkj2q3gOw | AI gen — grade/cuts |
| 15 | short | _1fcL-aB1CU | layer duplicate + linear position keys, Gaussian/Lens Blur bed |
| 16 | short | T2TtWknCu60 | duplicate layer + scale up, Lens Blur, Light Leaks/Lens Flare overlay |
| 17 | short | uyHDHO7zP88 | Flicker, Glow, text layers |
| 18 | short | WjZpCpk7oDg | AI gen — assembly cuts |
| 19 | short | MGat0jAwBDU | AI design — no AM demo |
| 20 | short | V9ApHueQbN0 | shape/path stroke + gradient fill, trim/reveal keys, Lens Flare |
| 21 | short | ShCYvdqTQ3s | layer stack, staircase duplicate, keyframes |
| 22 | short | N7-UHBSPs7Y | AI gen cards — AM comp only |
| 23 | short | EtTwCO1tAD8 | screen inserts, dialogs; no AM feature |
| 24 | short | CyPgA10kl7o | scale keyframes (constant cuts), drawing layer for arrows |
| 25 | short | vCrpT1dA6QU | layer-stack extrude (duplicates + Z/3D rotation), Vignette |
| 26 | short | oKaAETJzLq4 | Null object, parenting, layer stack |
| 27 | short | Xk7JcX4yg5M | shape layers, ease graphs, solid background |
| 28 | short | Q9Aka1vrJVQ | 3D rotation Y (flip), Radial/Linear Wipe |
| 29 | short | yZOfRXLI4iI | Chroma Key, blend modes, Glow, scanline overlay |
| 30 | short | AQV-mQzAs-U | Blur (frosted), white overlay + feather, Edge Glow + Glow |
| 31 | short | 7blzGS1OaK4 | mask reveal, scale/position keys, glow sweep |
| 32 | short | WKKO-2uHJvk | 3D layers, null + camera orbit, shape layers |
| 33 | short | 5fgRG9uvL5o | shape path keyframes (point morph), graphs |
| 34 | short | 5rCjWw8PNbY | parenting helper, null object, grouped keyframes |
| 35 | short | N6cWx6W2KmE | 3D camera, null rig, parallax layer offsets, graphs |
| 36 | short | 1jj9eqVhNI4 | layer-copy extrude, 3D rotation, shadow/grade |
| 37 | short | vIDgGf3mGkY | text layer + position keys, mask window, easing |
| 38 | short | ki2fYYQFH6s | text bubbles, scale/position keys, mask reveal, tap sfx sync |
| 39 | short | lthFvh04iVY | 3D rotation, position fan keys, shadow layers |
| 40 | short | up31uGaeqAE | overlay footage + blend mode, motion blur, darken grade |
| 41 | short | hb_IkWQspxk | null + camera, graphs, adjustment layers |
| 42 | short | jaa8Lpvo8h8 | 3D rotation + mask wedge, warp-style keys |
| 43 | short | VefvlhFbSsg | sharpen/unsharp, export bitrate settings |
| 44 | short | ysoVksCfUA0 | keyframe graphs/easing (custom curves), value graph editing |
| 45 | short | K2mSI59wPvg | Echo keyframes (motion trail), shape/blur clouds, position keys |
| 46 | short | dp7Qyirt10E | CapCut shake keyframes/transitions (not AM) |
| 47 | short | Eyv5oyG8A5o | Null object, 3D scene parenting, camera follow, graphs |
| 48 | short | SBpZd0VWoHQ | LUT/color grading in LumaFusion (not AM) |
| 49 | video | Y4mlgs0Uwx0 | AI gen + edit assembly |
| 50 | video | IkaO7oliFVU | AI avatars/video |
| 51 | video | FEhL2__m0n0 | CapCut edit + AI gen |
| 52 | video | IHxjVFyVf70 | AI avatar |
| 53 | video | X6VnostD_1Y | AI image+video |
| 54 | video | bf0xqNBjLms | AI voice |
| 55 | video | hymjcShp6pU | 3D scene rig, camera moves, AI stills |
| 56 | video | cKpxjOjgguw | AI image |
| 57 | video | llLcDhbyBH0 | shape layers, masks, graphs, nulls, text tools, keyframe workflow |
| 58 | video | UTBrKWAEapo | AI image edits |
| 59 | video | Uqhsvo1Dg1A | mask highlight window, position keys, paper texture, text sync |
| 60 | video | CqWhP6zvmgM | AI lip-sync |
| 61 | video | 1XOmiC9mG5w | sponsor software |
| 62 | video | urXIRFKdFm8 | 3D camera, null rig, layer depth stack, AI stills |
| 63 | video | ndzaCeHlK3o | AI enhance |
| 64 | video | Xk2YMWEh36k | shape layers, easing graphs, sync sfx, masks |
| 65 | video | FyHDL7Zg3iw | AI image |
| 66 | video | uwE0_X0k9Fo | CapCut effects |
| 67 | video | aqhnWVVWH6k | AI avatar |
| 68 | video | YQTKn-5e_58 | AI video |
| 69 | video | esE4CpRslaE | AI video |
| 70 | video | oTSvVyrQJwk | text layer tools (4): presets, per-char keys, mask reveal, path text |
| 71 | video | xC27lk8IvZ8 | 3D layers, camera, null rig, depth stack, graphs |
| 72 | video | SgMZO1sq4j8 | AI pipeline |
| 73 | video | rRtOZSAG9FI | AI |
| 74 | video | 8Sw80XUJ7MQ | AI avatar |
| 75 | video | 8bZh_p5zGRk | AI tools roundup |
| 76 | video | 6Y6atnoqqdU | null object, camera parent, whip moves, graphs |
| 77 | video | C6tNv8juqn0 | AI |
| 78 | video | De_GBXCcC94 | 3D camera, null rig, parenting, graphs, layer depth |
| 79 | video | 7o4NXRnoNjE | shape/mask/graph hacks |

## C. AI mandate (logged, never implemented)

baqtB_b-SBU, s1ooaRgqvQ8, NAhfAEGRmr0, DmCUAPgTMUY, eBF0ETssh98, rsUw8ijzPow, xLs0M7fFfQA, GkvcPJ-QohY, XtZkj2q3gOw, WjZpCpk7oDg, MGat0jAwBDU, N7-UHBSPs7Y, Y4mlgs0Uwx0, IkaO7oliFVU, FEhL2__m0n0, IHxjVFyVf70, X6VnostD_1Y, bf0xqNBjLms, hymjcShp6pU, cKpxjOjgguw, UTBrKWAEapo, CqWhP6zvmgM, 1XOmiC9mG5w, urXIRFKdFm8, ndzaCeHlK3o, FyHDL7Zg3iw, aqhnWVVWH6k, YQTKn-5e_58, esE4CpRslaE, SgMZO1sq4j8, rRtOZSAG9FI, 8Sw80XUJ7MQ, 8bZh_p5zGRk, C6tNv8juqn0

Per-video long explanations: `yt_hancy/hancy_explantion.{md,html,csv,xlsx,docx,pdf,json}`. Per-short AM-name rewatch: `Study_edits_videos/handbox-rewatch-alightmotion.md`.
