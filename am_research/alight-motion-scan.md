# Alight Motion research sweep — YouTube search tabs + reference imagery (2026-10-23)

Scope: every searchable YouTube tab for "alight motion" that this sandbox can reach
(via the r.jina.ai proxy — direct YouTube returns 401), plus reference images of the
app's tabs/panels. Companion to `yt_hancy/hancy_explantion.*` (Hancybox channel pack).

## Tabs scanned (query: "alight motion" / "alight motion tutorial")
| tab | url filter (sp=) | yield |
|-----|------------------|-------|
| Channels | `EgIQAg==` | 18 channels (table below) |
| Videos | `EgIQAQ==` | top tutorial videos (table below) |
| Playlists / Courses | `EgIQAw==` | 7 course playlists (table below) |
| Shorts | `EgQQZABN` | top AM shorts (table below) |
| (channel tabs) | `@Hancybox/shorts`, `@Hancybox/videos` | see yt_hancy pack |

## Channels found (Channels tab)
| channel | subs | focus |
|---------|------|-------|
| @AlightMotion | 2.68M | OFFICIAL app channel (iPhone/iPad/M1 Mac/Android) |
| @kaziaidahhaque | 307K | AM tutorials |
| @Yosmellado | 160K | AM tutorials (Spanish) |
| @haninalightpresets | 40.6K | presets / editing help |
| @TysonTutorials | 35.4K | "become an Alight Motion pro" tutorials |
| @AlightMotiontamil | 24.1K | AM edits (SK Karthi Edit's, Tamil) |
| @alightmotionpresets9301 | 1.12K | presets |
| @Pinkiue_am | 723 | AM tutorials |
| @alightmotiontutorials9338 | 131 | beginner tutorials |
| @alighttutorial3782 | 127 | tutorials |
| @alightmotiontuts5891 | 281 | tuts |
| @alightmotionthevideoeditor8360 | 2.27K | AMTVE edits |
| @alightmotion930 / @AlightMotionCombined / @AlightMotion-p4u / @alightmotiontr / @Alightmotion-p6f / @alightmotion-f5u | <100 | small/duplicate-name channels |
Creators surfaced via Videos/Shorts tabs: @zack_indo (Zack_), @Exal.Visuals, @deepfriedsalte (viriri), @megstarr34, @chewyffon, @InfiniteDesigns., @WizzyTutorials, @VaultTubeofficial, @iv_expertize (Expertize Yt).

## Notable tutorial videos (Videos tab)
| video | channel | views | teaches |
|-------|---------|-------|---------|
| Tutorial how to tween in alight motion (0:20) | Zack_ | 1.3M | tweening / keyframe easing |
| Alight Motion COMPLETE BEGINNER TUTORIAL (8:18) | Exal.Visuals | 1.4M | basic features tour |
| BEGINNER'S Alight Motion Tutorial! (5:31) | viriri | 410K | Gacha sprite rigging: pivot points, layering body parts, oscillation + lighting effects |
| Tiktok style edit tutorial (14:38) | megstarr34 | 201K | TikTok-style edit chain |
| How to animate like ME with Alight Motion (12:11) | chewy | 351K | character animation, Ibis Paint presets hand-off |
| CapCut vs Alight Motion (6:09) | Exal.Visuals | 176K | editor comparison |
| I Tried Gold Motion… Is Alight Motion Cooked? (3:07, 10h old) | Tyson Tutorials | 3.1K | competitor app "Gold Motion": 3D environment tools, AI upscaling, custom effect creation |

## Course playlists (Playlists tab)
| playlist | owner | items | contents sampled |
|----------|-------|-------|------------------|
| Learn alight motion from zero to infinity | Infinite Designs | 20 | 01 Project creation, 02 Layers … |
| Alight motion beginners tutorial (Noob to pro) | Wizzy Tutorials | 23 | Time Remapping & Reverse Twixtor; Shake & Turbs like Sanchez |
| alight motion tutorial | megstarr34 | 52 | TikTok-style chain, trend edits |
| Alight Motion Premium Course | Vault Tube | 5 | "Edit Everything That You Can Imagine", UI Motion Graphics Hacks |
| Alight Motion Video Editing Full Course | Expertize Yt | 31 | 3h05 advanced 3D mobile editing |
| Motion Graphics Full Course Alight Motion | Expertize Yt | 27 | motion-graphics parts 1-5+, documentary editing |
| (22-video course, id GLa1ftH5C3c) | — | 22 | truncated in first render page |

## Top AM shorts (Shorts tab)
| short | views | subject |
|-------|-------|---------|
| X0pGhqSfVcU | 5.9M | Gacha animation tutorial |
| AZ3yV1b_gH8 | 4.6M | "Lasso on Alight doing the heavy lifting" (lasso selection) |
| BnCk15Y-5FY | 1.6M | headbop animation tutorial |
| 46LfMGZKTcI | 533K | animation tutorial part 2 |
| RBqpd9etFiI | 157K | "alight motion core" meme edit |

## Tool vocabulary harvested this sweep → OmniFrame status
| AM tool/term seen | where | OmniFrame |
|-------------------|-------|-----------|
| Time Remapping / Reverse / Twixtor-style slow-mo | Wizzy course | speed curves (board C) + proceduralFx reverse ✔ |
| Shake & "Turbs" (Turbulent Displace) | Wizzy course | autoShake ✔ / turbulent warp shipped ✔ |
| Oscillate | viriri tutorial summary + official guide page | shipped ✔ proceduralFx pfxOscillate (official props) |
| Pivot / anchor point per layer | viriri | partial (transform) |
| Layer parenting + Null object | many | null/group family ✔ |
| Camera object / 3D camera rig | images 10-12, Hancybox | null camera rig ✔ |
| Effect Browser categories | images 07-09 | AE-style rack ✔ |
| Keyframe graph editor / curves | images 04-06 | curve_set custom curves ✔ |
| Timeline & layer controls | images 01-03 | tracks/layer stack ✔ |
| Lasso selection | short AZ3yV1b_gH8 | shipped ✔ lasso_select (7th selection method) |
| Headbop / sprite rigging (body-part layers) | shorts + viriri | partial (null parenting) |

## Reference images (am_research/images/)
01 timeline+layer controls (alight-motion.online) · 02 canvas + add-element panel (screensdesign) ·
03 preview/playback/timeline (screensdesign) · 04-05 keyframe graph editor (filmora guide) ·
06 keyframe editor parts labelled (Apple Motion guide, comparison) · 07-09 Effect Browser
(alightmotionhq / alightmotionapkhd / liteapks) · 10 replace-image/parenting steps ·
11 layer parenting + null objects (alightmotionhq) · 12 camera object (motionalightdl).

## Honesty / coverage
Search tabs return only their first render page through the proxy (no infinite scroll),
so each table is "top results of that tab on 2026-10-23", not the full corpus. Video
frames are still un-downloadable here; "teaches" columns come from titles, descriptions
and YouTube's own AI summaries as labelled. Shipped rows landed 2026-10-23 (board I). Remaining GAPs: per-layer pivot/anchor UI.
