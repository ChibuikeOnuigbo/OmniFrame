# emu_im_save — Toji Motion & Gold Motion research (2026-10-25)

## What was asked vs what is possible here (honesty first)
Asked: download the Toji Motion / Gold Motion APKs, set up a server + Android emulator, run them,
take screenshots AND a screen recording of the whole setup, then AI-explain the UI.

Verified in this sandbox (`setup-attempt.log`):
- **No emulator toolchain exists**: `adb`, `emulator`, `qemu-system-x86_64`, `genymotion`,
  `avdmanager`, `sdkmanager` all MISSING; `/dev/kvm` absent → an Android emulator CANNOT boot here
  (needs KVM + a display; this container has neither).
- **APK hosts are outside the sandbox download allowlist** (bash reaches only github/npm/pypi hosts):
  `curl https://dland.apkpure.com/…` → "Could not resolve host". So no APK binary can enter this
  workspace, and installing/running/recording the mods here is impossible.
- Therefore: **no emulator screenshots and no screen recording were produced, and none are faked.**
  Everything below is real and labelled with its true source.

## What IS in this folder (all real)
| file | what it is | source |
|---|---|---|
| setup-attempt.log | the toolchain/download verification above | this sandbox |
| toji-ui-1.png | AM-mod "Blending & Opacity" screen (blend family chips, opacity, transport) | liteapks.com/alight-motion.html |
| toji-ui-2.png | AM-mod list screen (skin reference) | liteapks.com |
| toji-ui-3.png | "Edit Points" vector point editor w/ bézier handles + value column | liteapks.com |
| toji-ui-4.webp | AM-mod effect-grid skin reference | modder.me |
| gold-settings-1.png | Gold Motion home + "GOLD MOTION EXTRA" menu (Upscale/Project Doctor/Reverse/Twixtor/DFR/Audio Converter) | memudownload.com/gold-motion-apk |
| gold-settings-2.png | same screen, second mirror (consistency proof) | fmmods.xyz/gold-motion-apk |
| gold-effects-ref.webp | AM-shell multi-track timeline (6 lanes, stair-step clips, eye toggles) | alightpromodi.com |
| UI-EXPLAINED.md | AI vision analysis: every section of every screenshot, + honest OmniFrame crosswalk | generated from the files above |
| ai_explain/ | AI-GENERATED explanation art for chat viewing ONLY — never app evidence | generate_image |

## App identities (research)
- **Toji Motion** — Toji Labs' modified Alight Motion (package `com.alightcreative.motion`), "new design + ~60 extra effects"; site tojilabs.github.io/tojimotion. Community-reported crashy if you tap fast (reddit r/AlightMotion).
- **Gold Motion v7.0.4** — PNKJ / GoldMods' modified Alight Motion: golden UI, 2,700+ unlocked effects/presets, XML/ZIP import, Twixtor optical-flow slow-mo, AI upscaling, DFR dead-frame remover, audio meter + search, custom-effects maker, 3D camera sliders, local auto-backup. ~259 MB, Android 7+.
- Both are UNOFFICIAL MODS of Alight Motion — research-only here; OmniFrame never copies mod code.

## Run it YOURSELF (the setup this sandbox can't do) — emulator + recording guide
1. **Android Studio route (free, official):** install Android Studio → SDK Manager → SDK Tools → tick
   "Android Emulator" + "Android SDK Platform-Tools"; AVD Manager → create device (Pixel 7, API 34,
   **x86_64 system image with Google APIs**); enable VT-x/AMD-V (and on Windows WHPX/HAXM) in BIOS —
   the emulator refuses to boot without hardware virtualisation, same blocker this sandbox hit.
2. **Player route (easier):** BlueStacks 5 or Nox — both are explicitly the documented way to run
   Alight Motion on PC (tomsguide/softonic guides); sideload the APK by dragging it onto the player.
3. **Install the APK:** `adb install TojiMotion.apk` (or drag-drop in the player). Allow
   "install unknown apps" for the source.
4. **Screenshots:** `adb exec-out screencap -p > shot.png` — or in-player: PrtSc / player capture button.
5. **Screen recording of the whole setup:** `scrcpy --record setup.mp4` (mirrors + records the device
   over adb); emulator-only alternative: `adb shell screenrecord /sdcard/setup.mp4` then `adb pull`.
6. Save everything into this folder (`emu_im_save/`) so the corpus keeps one home.

## Feature crosswalk → OmniFrame (honest, mandate-aware)
See UI-EXPLAINED.md table. Short version: blend picker/opacity/transport/ruler/eyes/trim/track FAB/
◆-keys = shipped; vector point pad + Elements/Cloud = partial; Reverse + extractAudio = shipped;
AI upscaling = logged NEVER implemented (AI mandate); Twixtor optical flow / DFR / Project Doctor =
researched backlog.
