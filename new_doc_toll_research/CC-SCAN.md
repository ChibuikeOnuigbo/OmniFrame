# CC (TYMM) Drive Folder — Full Scan

Source: Google Drive folder `Cc - TYMM` (`14RVrkp5bdWy9LgwUXHzlRwIdT8aKHhYa`),
scanned 2026-10-29. Everything below is list-verified via the Drive API this
session (names + sizes exact). Media files are catalogued, NOT downloaded
(≈120 MB of overlay video / 40+ sfx — heavy; the XMLs and Shakes pack were
downloaded and are imported by the app).

## Subfolders

| Folder | Contents | Disposition |
|---|---|---|
| Cc | `5 Cc + 1 Bonus Pack.xml` (AM project) | downloaded → `alight/cc-5plus1.xml`, imported (60 clips, 148 mapped fx) |
| Free ( Project-Files ) | `Onyankopon.xml`, `Evergreen.xml` | downloaded → imported (121 + 41 clips) |
| Shakes | `Shakes.xml` (10 shake presets: MOLOB, ZNEPTUNE, FLOW, NANIMALO, RANDOM, JELLY, …) | downloaded → `alight/shakes.xml`, imported (34 mapped fx, 47 keyframed props — the shake motion is on keyframed nullobj rigs) |
| Back Grounds | 42 images (jpg/png: `2.jpg`…`98.jpg`, `france.jpg`, `2049219 (1).png`, `278a.png`, `7t.png`) | catalogued; usable via import_media (fit/cover) |
| Overlays | 38 videos — full list below | catalogued; usable via import_video + blend modes |
| Sfx | 5 subfolders, 41 files — full list below | catalogued; audio pack data |

## Overlays (38, exact names)

Overlay_14.mp4 (6.8 MB) · Overlay_12.mov · Overlay_.mp4 · RPReplay_Final1717184839.mov ·
trim.341D6EDD-AA4D-4DC1-BA3E-AFED46FB3255.mov · splash overlay [C90ADDB].mp4 ·
video0-48.mov.mp4 · New Project 85 [BD70097].mp4 · Overlay 78 [C896C0C].mp4 ·
Christmas snow 4K Background animation free particles VFX [Relaxing Screensaver](1080P_HD).mp4 ·
2632d2c4-c600-4555-b443-51ccd4adbdb4 [476C826/ FD5F169 / ABCC55A / 553A991 / 445A062 / 400DA5F / 1ED6154 / 71514AE / 5119FAD].mp4 (9 variants) ·
4cc0f0f3-73a4-425e-af84-c6b170b25e56.mp4 · 0003c12c-58f2-4b7c-b671-1a117edb8405.mp4 ·
8411643c-b19f-474d-94ee-fb17cfe538d1.mp4 · White___Purple_Fire_Sparks.mp4 ·
BCC RIPPLE OVERLAY _ RIPPLE OVERLAY _ BACKGROUND VIDEO _ AFTER EFFECTS _ ALIGHT MOTION _ CAPCUT.mp4 ·
Firebending_black_screen_2.mp4 · Random Overlay (51).mp4 (11.9 MB) ·
InShot_20250616_130201564.mp4 · Green_Screen_Bomb_Explosion_Effect__Free_VFX_Footage….mp4 ·
copy_E4CC02FB-56F2-414B-8586-11219D07F573.mp4 · Project_Name_48.mp4 ·
Angel Wings [0BD2F9D].mp4 · a4f384b0-f8dc-4e8b-b149-ea85ca1d2051.mov ·
Dark_Cinematic_Background_Overlay720P_HD.mov · Red_neon_overlay_.mp4 (19.5 MB) ·
overlay_like_6ft3_by_suchie.mov · Shatter overlay.mp4 ·
Music Audio Beat - Spectrum [overlay].mp4 · water_texture_2.mp4

App usage recipe (universal tools): `import_video` overlay → track above the
base → `edit_element {blendMode:'screen'|'lighten'|'overlay'}` for
light/spark/snow overlays, `chromaKey` for the green-screen explosion,
`lumaKey` for black-background fire/neon, plus TYMM LUT grade on top.

## Sfx (41 files)

- **Anime (6):** teleportation one piece.mp3 · Teleport (DBZ).mp3 · Sharingan.mp3 ·
  Naruto hand seals.mp3 · Itachi Mangekyou Sharingan.mp3 · Chidori.mp4
- **Swoosh (7):** Speed swoosh.mp3 · Standard Swoosh.wav · Fast swoosh reverb.mp3 ·
  Fast swoosh down.mp3 / down 2.mp3 · 1Swoosh.wav · SFX- Swoosh01.mp3
- **Whoosh (5):** whoosh 1.mp3 … whoosh 5.wav
- **Random (5):** Water_Drop.wav · 9 XP Error Whoosh.mp3 · glass.mp3 · Goat whoosh.wav · Time stop.wav
- **Bonus (18):** Katana.wav · Knife.wav · put sword 03/06.wav · kuni sfx.mp3 ·
  Sword blood 05/06/07.wav · Sword grip 03/05/06.wav · Sword Hit 10/11/12.wav ·
  Sword slice.wav · Sword Slicing.mp3 · sword cutting.mp3 ·
  UI_Sounds__Futuristic_sound_effects_example(256k).mp3

## Text presets / pack data (from the CC + corpus XMLs)

55 AM text layers scanned across the corpus (`/tmp` extraction → dumps in
`data_motiondesijg/alight/*.json`). Recurring CC subtitle look:

- **Chain:** `texttransform + textspacing + gradientoverlay2` (mapped in-app to
  AM Gradient Overlay fx; textspacing kept as data)
- **Fonts:** Teko-Bold (16 layers, hero), LOVELY.otf (8, Onyankopon),
  AGENCYB.ttf + Kenyan Coffee Bd (Evergreen), Okay Jelly (Onyankopon endcard),
  Heavitas (Warps counters), CircularStd-Black (CC labels),
  **Quicksand_Bold (Shakes titles — font file IS in the TYMM pack:
  `public/fonts/Quicksand_Bold.ttf`, registered under that exact stem)**
- **Geometry:** 1920×1080 canvas; subtitles centred x=960, y≈925–1045,
  size 24–28 px; big titles size 48–80 px (NUMBER/X hero title 80 px)
- Example strings: “KERI UDAN FOR ME”, “DON'T LEAVE ME ALONE.”,
  “ALL I WANTED WAS TO FIND / A WAY TO CHANGE YOU INTO A HUMAN.”,
  “SUBSCRIBE / PLEASE / You'll LIKE IT”, “Bowa… / lost to this guy?”

## mega.nz overlays folder

`https://mega.nz/folder/PGplxaTb#WKshBgtCxklZnXo_BtdGEw` — NOT reachable from
this sandbox (outbound allowlist: github/npm/pypi only; mega.nz not included).
Recorded here so a later run with network access (or a manual download into
`new_doc_toll_research/`) can pick it up. Nothing from mega.nz is claimed done.
