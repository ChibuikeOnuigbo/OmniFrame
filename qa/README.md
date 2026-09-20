# OmniFrame QA

## Real browser end-to-end test

Start the application:

```bash
npm install
npm run dev
```

In another terminal run:

```bash
npm run qa:e2e
```

The runner is self-contained:

- extracts npm-packaged headless Chromium (no browser CDN required)
- extracts its NSS/NSPR runtime on minimal Linux hosts
- generates a deterministic 5-second moving VP8/Vorbis fixture with FFmpeg
- imports the real media file
- asserts playback time advances
- switches to frame-level timeline zoom
- splits and asserts the clip count changes from one to two
- exports and waits for the real download
- captures desktop, tablet, and mobile screenshots
- fails on unexpected browser console/page errors

Set `CHROME_PATH` to use an installed Chromium/Chrome executable. Set `VIDEO` to
use a specific local media file. Set `URL` to target a different running app.

Outputs are written to `qa/shots/`.

## Export validation

The exported artifact can be decoded and inspected with the npm-packaged FFmpeg:

```bash
FF=$(node -p "require('@ffmpeg-installer/ffmpeg').path")
"$FF" -v error -i qa/shots/export-omniframe-export.mp4 -f null -
"$FF" -hide_banner -i qa/shots/export-omniframe-export.mp4
```

## Non-browser logic checks

Timeline/timecode math has a separate Level 2 check. It does not replace browser
QA:

```bash
node --experimental-strip-types scripts/verify-engine.ts
```
