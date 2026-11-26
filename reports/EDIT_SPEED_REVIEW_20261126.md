# Edit and speed review — 26 November 2026

Created an original six-second 1280×720 edit through the running editor store:
three cuts from the local Pexels coast fixture, keyed blur, and three titles with
position/opacity keys. Export used the actual browser export engine. This is a
simple workflow demonstration, not a recreation of the user's reference edits.

## Results

Final run (software Chromium, Vite development server):

| Preview | Sampled render p50 | Sampled render p95 | Long tasks / maximum |
|---|---:|---:|---:|
| Full | 11.4 ms | 33.4 ms | 2 / 59 ms |
| Low | 5.0 ms | 8.6 ms | 1 / 56 ms |

Each window lasted about 4.5 seconds. Measurements sample the engine's last render
time every 10 ms; they are not all-frame distributions or unique presented FPS.
Five runs were retained as JSON. The initial Low→Full run favored Full; four
Full→Low repeats favored Low at p95. Run order, warm-up and shared-host load are
not controlled enough to quantify a reliable quality-mode speedup. This is not
an A/B application optimization benchmark.

All five six-second exports took 6.13–6.21 seconds. The final one took 6.135 seconds.
Export records in real time, so this does not establish faster-than-realtime encoding.

The original 300 ms screenshot delay captured a stale title after seeking to 3 s.
The final test waits for decoder readiness, which took **444 ms**, then allows a
300 ms redraw settling window. Visually inspected final screenshot correctly shows
BREATHE. This is decoder-ready latency, not precise seek-to-present latency.
The earlier screenshot is retained as evidence of the insufficient fixed wait.

The portable `.omni` embeds the source video. Reopening verifies six clips, one
asset and all four blur keys on each video clip. Titles and keyed blur are created
through editor actions; title key persistence is not separately asserted here.
The complete final MP4 decodes with FFmpeg `-xerror` and original time base.
An initial null-sink check rounded VFR timestamps to nominal frame ticks, reporting
collisions; retaining source time base (`-enc_time_base -1 -vsync 0`) decodes cleanly.
Reviewed the initial six-frame contact sheet and final preview/export screenshots.
This is sampled visual inspection, not a frame-by-frame perceptual certification.

Repeated 100-clip stress: 100 IDs/blob URLs reuse one source, with blur and 100 catalog instances. Store setup 218 ms; revisit waits 11–101 ms;
eviction/source release, rapid-seek settling, boundary playback, pause and project
reset passed. Polling waits do not measure exact presentation. No page errors.

## Ratings and limits

Subjective ratings for the tested scope: **speed 6/10**, **appearance 6/10**,
**workflow reliability 7/10**. The UI has a clear monitor/timeline split, but a dense
icon rail, truncated panel heading and substantial empty inspector space remain.
The small demo works and exports; noticeable seek delay and variable long tasks
prevent a higher speed rating. No claim of superiority to CapCut, After Effects
or Blender: no matched competitor/hardware test was performed.

Production code is unchanged. Improvements are repeatable speed/export/persistence
checks, portable evidence and output isolation for the existing stress test.
Node syntax checks, git whitespace check and source lint pass. Lint still reports
277 heuristic findings below its blocking threshold. Full build/unit/browser gates
were not rerun for this test-only change; earlier gate results remain historical.

Remaining: diverse real camera imports, sustained A/V drift, actual presented-frame
latency, long projects, 4K layered work, native desktop and GPU benchmarks. Next:
profile the 444 ms seek across decoder readiness and canvas presentation using
long-GOP sources; do not infer lag-free playback from render submission counts.

## Evidence and rerun

- `qa-output/edit-speed-review/final/coast-edit.mp4`
- `qa-output/edit-speed-review/final/coast-edit.omni`
- `qa-output/edit-speed-review/final/editor.png`
- `qa-output/edit-speed-review/final/report.json`
- `qa-output/edit-speed-review/stress/revisit.json`

With Vite on 5183, run the following sequentially to avoid benchmark contention:

```sh
ORDER=reverse OUT=/tmp/omniframe-edit-review node qa/edit-speed-review-e2e.mjs
OUT=/tmp/omniframe-stress-review node qa/stress-revisit-e2e.mjs
```
