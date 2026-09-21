# OmniFrame evidence and research memory

> Append-oriented QA/research ledger. Every claim carries an evidence tag and status. This file distinguishes observed facts from untested scope; NOT-TESTED rows are retained as an explicit backlog rather than silently implying coverage.

## Run identity
- Date: 2026-09-20
- Branch: arena/01a0bf54-omniframe
- Browser: packaged Chromium, real headed engine driven by Playwright
- Primary result: 74 PASS, zero unexpected console/page/request errors
- Results: `qa/reports/stress-results.json`
- Log: `qa/reports/stress-run.log`
- Export probe: `qa/reports/export-probe.txt`
- Export decode errors: `qa/reports/export-decode-errors.txt` (zero bytes)

## Implemented scope discovered from source
- [SOURCE-CODE] PASS Media model is `video | image | audio` in `src/types.ts`.
- [SOURCE-CODE] PASS Timeline supports placement, selection, pointer move, edge trim, split, delete, undo, redo, track mute/hide/lock, zoom, ruler seek, and frame mode.
- [SOURCE-CODE] PASS Preview uses a real canvas and media elements.
- [SOURCE-CODE] PASS Export uses canvas captureStream and MediaRecorder; it is not a mocked download.
- [SOURCE-CODE] NOT-SUPPORTED Text, effects, transitions, templates, masks, tracking, Omniframe transforms, and 3D are panel placeholders, not implemented editing features.

## Browser run assertions
### Browser assertion B001
- Evidence tag: OBSERVED
- Status: PASS
- Observation: empty state visible
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 1.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B002
- Evidence tag: OBSERVED
- Status: PASS
- Observation: three media clips imported
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 2.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B003
- Evidence tag: OBSERVED
- Status: PASS
- Observation: video imported
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 3.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B004
- Evidence tag: OBSERVED
- Status: PASS
- Observation: image imported
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 4.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B005
- Evidence tag: OBSERVED
- Status: PASS
- Observation: audio imported
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 5.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B006
- Evidence tag: OBSERVED
- Status: PASS
- Observation: video starts at zero
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 6.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B007
- Evidence tag: OBSERVED
- Status: PASS
- Observation: image appended after video
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 7.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B008
- Evidence tag: OBSERVED
- Status: PASS
- Observation: audio starts independently at zero
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 8.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B009
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Space starts playback
- Detail: 00:00:00:00->00:00:00:28
- Primary evidence: `qa/reports/stress-results.json` result 9.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B010
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Space pauses playback
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 10.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B011
- Evidence tag: OBSERVED
- Status: PASS
- Observation: image clip drag maps pixels to time
- Detail: 8.003->6.0027 at 51.0651px/s
- Primary evidence: `qa/reports/stress-results.json` result 11.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B012
- Evidence tag: OBSERVED
- Status: PASS
- Observation: video left trim preserves source timing
- Detail: start=0.9332 in=0.9332 dur=7.0698
- Primary evidence: `qa/reports/stress-results.json` result 12.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B013
- Evidence tag: OBSERVED
- Status: PASS
- Observation: video right trim changes duration
- Detail: 7.0698->6.0907
- Primary evidence: `qa/reports/stress-results.json` result 13.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B014
- Evidence tag: OBSERVED
- Status: PASS
- Observation: ruler scrub seeks to 3s
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 14.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B015
- Evidence tag: OBSERVED
- Status: PASS
- Observation: video split creates two clips
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 15.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B016
- Evidence tag: OBSERVED
- Status: PASS
- Observation: split conserves duration
- Detail: 2.0668+4.0239
- Primary evidence: `qa/reports/stress-results.json` result 16.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B017
- Evidence tag: OBSERVED
- Status: PASS
- Observation: undo restores pre-split state
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 17.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B018
- Evidence tag: OBSERVED
- Status: PASS
- Observation: redo restores split state
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 18.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B019
- Evidence tag: OBSERVED
- Status: PASS
- Observation: frame mode sets 2400 px/s
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 19.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B020
- Evidence tag: OBSERVED
- Status: PASS
- Observation: zoom preserves logical clip times
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 20.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B021
- Evidence tag: OBSERVED
- Status: PASS
- Observation: fit/zoom-in/zoom-out controls execute
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 21.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B022
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Safe areas active state
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 22.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B023
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Grid active state
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 23.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B024
- Evidence tag: OBSERVED
- Status: PASS
- Observation: preview 50%
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 24.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B025
- Evidence tag: OBSERVED
- Status: PASS
- Observation: preview 100%
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 25.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B026
- Evidence tag: OBSERVED
- Status: PASS
- Observation: preview 200%
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 26.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B027
- Evidence tag: OBSERVED
- Status: PASS
- Observation: locked track prevents clip deletion
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 27.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B028
- Evidence tag: OBSERVED
- Status: PASS
- Observation: track unlock restores editability
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 28.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B029
- Evidence tag: OBSERVED
- Status: PASS
- Observation: audio track mute toggle
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 29.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B030
- Evidence tag: OBSERVED
- Status: PASS
- Observation: video track visibility toggle
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 30.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B031
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Audio opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 31.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B032
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Text opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 32.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B033
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Effects opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 33.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B034
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Transitions opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 34.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B035
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Templates opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 35.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B036
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Masks opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 36.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B037
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Tracking opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 37.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B038
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Omniframe opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 38.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B039
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel 3D opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 39.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B040
- Evidence tag: OBSERVED
- Status: PASS
- Observation: panel Media opens
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 40.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B041
- Evidence tag: OBSERVED
- Status: PASS
- Observation: transform sliders visible
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 41.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B042
- Evidence tag: OBSERVED
- Status: PASS
- Observation: scale slider keyboard interaction
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 42.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B043
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Delete removes selected image
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 43.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B044
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Ctrl+Z restores deleted image
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 44.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B045
- Evidence tag: OBSERVED
- Status: PASS
- Observation: Ctrl+Shift+Z reapplies delete
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 45.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B046
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1920x1080 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 46.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B047
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1600x900 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 47.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B048
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1440x900 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 48.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B049
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1366x768 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 49.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B050
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1280x720 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 50.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B051
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1024x768 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 51.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B052
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 834x1194 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 52.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B053
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 768x1024 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 53.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B054
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 430x932 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 54.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B055
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 414x896 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 55.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B056
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 390x844 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 56.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B057
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 375x812 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 57.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B058
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 360x800 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 58.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B059
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1100x800 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 59.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B060
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 1000x800 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 60.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B061
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 900x800 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 61.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B062
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 850x800 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 62.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B063
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 700x850 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 63.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B064
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 600x850 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 64.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B065
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 500x850 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 65.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B066
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 450x850 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 66.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B067
- Evidence tag: OBSERVED
- Status: PASS
- Observation: responsive 400x844 no page/header overflow
- Detail: {"doc":0,"body":0,"header":0}
- Primary evidence: `qa/reports/stress-results.json` result 67.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B068
- Evidence tag: OBSERVED
- Status: PASS
- Observation: resize preserves timeline state
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 68.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B069
- Evidence tag: OBSERVED
- Status: PASS
- Observation: edited multi-media export downloaded
- Detail: /home/user/OmniFrame/qa/exports/omniframe-export.mp4
- Primary evidence: `qa/reports/stress-results.json` result 69.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B070
- Evidence tag: OBSERVED
- Status: PASS
- Observation: refresh intentionally resets non-persistent project
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 70.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B071
- Evidence tag: OBSERVED
- Status: PASS
- Observation: refresh returns clean empty state
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 71.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B072
- Evidence tag: OBSERVED
- Status: PASS
- Observation: unexpected console/page errors
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 72.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B073
- Evidence tag: OBSERVED
- Status: PASS
- Observation: unexpected failed requests
- Detail: No additional value emitted.
- Primary evidence: `qa/reports/stress-results.json` result 73.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

### Browser assertion B074
- Evidence tag: OBSERVED
- Status: PASS
- Observation: expected reload-time blob aborts classified
- Detail: 1
- Primary evidence: `qa/reports/stress-results.json` result 74.
- Neighbor evidence: `qa/reports/stress-run.log`.
- Limit: this assertion proves only its stated behavior, not adjacent unsupported features.

## Responsive evidence matrix
Each viewport was reached by resizing one active loaded project without reload. The overflow and state checks are observed. Control-specific rows not directly invoked at that exact size are explicitly NOT-TESTED. Screenshots are under `qa/screenshots/viewport-WxH.png`.

### Responsive cell 1920x1080 / page horizontal overflow
- Viewport: 1920x1080
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: None for this measured property.

### Responsive cell 1920x1080 / header horizontal overflow
- Viewport: 1920x1080
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: None for this measured property.

### Responsive cell 1920x1080 / loaded timeline preserved
- Viewport: 1920x1080
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: None for this measured property.

### Responsive cell 1920x1080 / Media dock visible
- Viewport: 1920x1080
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / preview visible
- Viewport: 1920x1080
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / timeline visible
- Viewport: 1920x1080
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / import control
- Viewport: 1920x1080
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / export control
- Viewport: 1920x1080
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / play/pause control
- Viewport: 1920x1080
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / frame mode control
- Viewport: 1920x1080
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / timeline zoom controls
- Viewport: 1920x1080
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / preview zoom controls
- Viewport: 1920x1080
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / video track controls
- Viewport: 1920x1080
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / audio track controls
- Viewport: 1920x1080
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / inspector visibility
- Viewport: 1920x1080
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / dock navigation
- Viewport: 1920x1080
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / pointer clip drag
- Viewport: 1920x1080
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1920x1080 / keyboard shortcut routing
- Viewport: 1920x1080
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1920x1080.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / page horizontal overflow
- Viewport: 1600x900
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: None for this measured property.

### Responsive cell 1600x900 / header horizontal overflow
- Viewport: 1600x900
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: None for this measured property.

### Responsive cell 1600x900 / loaded timeline preserved
- Viewport: 1600x900
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: None for this measured property.

### Responsive cell 1600x900 / Media dock visible
- Viewport: 1600x900
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / preview visible
- Viewport: 1600x900
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / timeline visible
- Viewport: 1600x900
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / import control
- Viewport: 1600x900
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / export control
- Viewport: 1600x900
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / play/pause control
- Viewport: 1600x900
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / frame mode control
- Viewport: 1600x900
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / timeline zoom controls
- Viewport: 1600x900
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / preview zoom controls
- Viewport: 1600x900
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / video track controls
- Viewport: 1600x900
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / audio track controls
- Viewport: 1600x900
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / inspector visibility
- Viewport: 1600x900
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / dock navigation
- Viewport: 1600x900
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / pointer clip drag
- Viewport: 1600x900
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1600x900 / keyboard shortcut routing
- Viewport: 1600x900
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1600x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / page horizontal overflow
- Viewport: 1440x900
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: None for this measured property.

### Responsive cell 1440x900 / header horizontal overflow
- Viewport: 1440x900
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: None for this measured property.

### Responsive cell 1440x900 / loaded timeline preserved
- Viewport: 1440x900
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: None for this measured property.

### Responsive cell 1440x900 / Media dock visible
- Viewport: 1440x900
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / preview visible
- Viewport: 1440x900
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / timeline visible
- Viewport: 1440x900
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / import control
- Viewport: 1440x900
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / export control
- Viewport: 1440x900
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / play/pause control
- Viewport: 1440x900
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / frame mode control
- Viewport: 1440x900
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / timeline zoom controls
- Viewport: 1440x900
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / preview zoom controls
- Viewport: 1440x900
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / video track controls
- Viewport: 1440x900
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / audio track controls
- Viewport: 1440x900
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / inspector visibility
- Viewport: 1440x900
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / dock navigation
- Viewport: 1440x900
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / pointer clip drag
- Viewport: 1440x900
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1440x900 / keyboard shortcut routing
- Viewport: 1440x900
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1440x900.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / page horizontal overflow
- Viewport: 1366x768
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: None for this measured property.

### Responsive cell 1366x768 / header horizontal overflow
- Viewport: 1366x768
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: None for this measured property.

### Responsive cell 1366x768 / loaded timeline preserved
- Viewport: 1366x768
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: None for this measured property.

### Responsive cell 1366x768 / Media dock visible
- Viewport: 1366x768
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / preview visible
- Viewport: 1366x768
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / timeline visible
- Viewport: 1366x768
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / import control
- Viewport: 1366x768
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / export control
- Viewport: 1366x768
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / play/pause control
- Viewport: 1366x768
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / frame mode control
- Viewport: 1366x768
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / timeline zoom controls
- Viewport: 1366x768
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / preview zoom controls
- Viewport: 1366x768
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / video track controls
- Viewport: 1366x768
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / audio track controls
- Viewport: 1366x768
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / inspector visibility
- Viewport: 1366x768
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / dock navigation
- Viewport: 1366x768
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / pointer clip drag
- Viewport: 1366x768
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1366x768 / keyboard shortcut routing
- Viewport: 1366x768
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1366x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / page horizontal overflow
- Viewport: 1280x720
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: None for this measured property.

### Responsive cell 1280x720 / header horizontal overflow
- Viewport: 1280x720
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: None for this measured property.

### Responsive cell 1280x720 / loaded timeline preserved
- Viewport: 1280x720
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: None for this measured property.

### Responsive cell 1280x720 / Media dock visible
- Viewport: 1280x720
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / preview visible
- Viewport: 1280x720
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / timeline visible
- Viewport: 1280x720
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / import control
- Viewport: 1280x720
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / export control
- Viewport: 1280x720
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / play/pause control
- Viewport: 1280x720
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / frame mode control
- Viewport: 1280x720
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / timeline zoom controls
- Viewport: 1280x720
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / preview zoom controls
- Viewport: 1280x720
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / video track controls
- Viewport: 1280x720
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / audio track controls
- Viewport: 1280x720
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / inspector visibility
- Viewport: 1280x720
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / dock navigation
- Viewport: 1280x720
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / pointer clip drag
- Viewport: 1280x720
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1280x720 / keyboard shortcut routing
- Viewport: 1280x720
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1280x720.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / page horizontal overflow
- Viewport: 1024x768
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: None for this measured property.

### Responsive cell 1024x768 / header horizontal overflow
- Viewport: 1024x768
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: None for this measured property.

### Responsive cell 1024x768 / loaded timeline preserved
- Viewport: 1024x768
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: None for this measured property.

### Responsive cell 1024x768 / Media dock visible
- Viewport: 1024x768
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / preview visible
- Viewport: 1024x768
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / timeline visible
- Viewport: 1024x768
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / import control
- Viewport: 1024x768
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / export control
- Viewport: 1024x768
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / play/pause control
- Viewport: 1024x768
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / frame mode control
- Viewport: 1024x768
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / timeline zoom controls
- Viewport: 1024x768
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / preview zoom controls
- Viewport: 1024x768
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / video track controls
- Viewport: 1024x768
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / audio track controls
- Viewport: 1024x768
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / inspector visibility
- Viewport: 1024x768
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / dock navigation
- Viewport: 1024x768
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / pointer clip drag
- Viewport: 1024x768
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1024x768 / keyboard shortcut routing
- Viewport: 1024x768
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1024x768.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / page horizontal overflow
- Viewport: 834x1194
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: None for this measured property.

### Responsive cell 834x1194 / header horizontal overflow
- Viewport: 834x1194
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: None for this measured property.

### Responsive cell 834x1194 / loaded timeline preserved
- Viewport: 834x1194
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: None for this measured property.

### Responsive cell 834x1194 / Media dock visible
- Viewport: 834x1194
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / preview visible
- Viewport: 834x1194
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / timeline visible
- Viewport: 834x1194
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / import control
- Viewport: 834x1194
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / export control
- Viewport: 834x1194
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / play/pause control
- Viewport: 834x1194
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / frame mode control
- Viewport: 834x1194
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / timeline zoom controls
- Viewport: 834x1194
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / preview zoom controls
- Viewport: 834x1194
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / video track controls
- Viewport: 834x1194
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / audio track controls
- Viewport: 834x1194
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / inspector visibility
- Viewport: 834x1194
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / dock navigation
- Viewport: 834x1194
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / pointer clip drag
- Viewport: 834x1194
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 834x1194 / keyboard shortcut routing
- Viewport: 834x1194
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-834x1194.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / page horizontal overflow
- Viewport: 768x1024
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: None for this measured property.

### Responsive cell 768x1024 / header horizontal overflow
- Viewport: 768x1024
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: None for this measured property.

### Responsive cell 768x1024 / loaded timeline preserved
- Viewport: 768x1024
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: None for this measured property.

### Responsive cell 768x1024 / Media dock visible
- Viewport: 768x1024
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / preview visible
- Viewport: 768x1024
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / timeline visible
- Viewport: 768x1024
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / import control
- Viewport: 768x1024
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / export control
- Viewport: 768x1024
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / play/pause control
- Viewport: 768x1024
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / frame mode control
- Viewport: 768x1024
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / timeline zoom controls
- Viewport: 768x1024
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / preview zoom controls
- Viewport: 768x1024
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / video track controls
- Viewport: 768x1024
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / audio track controls
- Viewport: 768x1024
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / inspector visibility
- Viewport: 768x1024
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / dock navigation
- Viewport: 768x1024
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / pointer clip drag
- Viewport: 768x1024
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 768x1024 / keyboard shortcut routing
- Viewport: 768x1024
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-768x1024.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / page horizontal overflow
- Viewport: 430x932
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: None for this measured property.

### Responsive cell 430x932 / header horizontal overflow
- Viewport: 430x932
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: None for this measured property.

### Responsive cell 430x932 / loaded timeline preserved
- Viewport: 430x932
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: None for this measured property.

### Responsive cell 430x932 / Media dock visible
- Viewport: 430x932
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / preview visible
- Viewport: 430x932
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / timeline visible
- Viewport: 430x932
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / import control
- Viewport: 430x932
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / export control
- Viewport: 430x932
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / play/pause control
- Viewport: 430x932
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / frame mode control
- Viewport: 430x932
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / timeline zoom controls
- Viewport: 430x932
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / preview zoom controls
- Viewport: 430x932
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / video track controls
- Viewport: 430x932
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / audio track controls
- Viewport: 430x932
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / inspector visibility
- Viewport: 430x932
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / dock navigation
- Viewport: 430x932
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / pointer clip drag
- Viewport: 430x932
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 430x932 / keyboard shortcut routing
- Viewport: 430x932
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-430x932.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / page horizontal overflow
- Viewport: 414x896
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: None for this measured property.

### Responsive cell 414x896 / header horizontal overflow
- Viewport: 414x896
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: None for this measured property.

### Responsive cell 414x896 / loaded timeline preserved
- Viewport: 414x896
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: None for this measured property.

### Responsive cell 414x896 / Media dock visible
- Viewport: 414x896
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / preview visible
- Viewport: 414x896
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / timeline visible
- Viewport: 414x896
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / import control
- Viewport: 414x896
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / export control
- Viewport: 414x896
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / play/pause control
- Viewport: 414x896
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / frame mode control
- Viewport: 414x896
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / timeline zoom controls
- Viewport: 414x896
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / preview zoom controls
- Viewport: 414x896
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / video track controls
- Viewport: 414x896
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / audio track controls
- Viewport: 414x896
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / inspector visibility
- Viewport: 414x896
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / dock navigation
- Viewport: 414x896
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / pointer clip drag
- Viewport: 414x896
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 414x896 / keyboard shortcut routing
- Viewport: 414x896
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-414x896.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / page horizontal overflow
- Viewport: 390x844
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: None for this measured property.

### Responsive cell 390x844 / header horizontal overflow
- Viewport: 390x844
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: None for this measured property.

### Responsive cell 390x844 / loaded timeline preserved
- Viewport: 390x844
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: None for this measured property.

### Responsive cell 390x844 / Media dock visible
- Viewport: 390x844
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / preview visible
- Viewport: 390x844
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / timeline visible
- Viewport: 390x844
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / import control
- Viewport: 390x844
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / export control
- Viewport: 390x844
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / play/pause control
- Viewport: 390x844
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / frame mode control
- Viewport: 390x844
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / timeline zoom controls
- Viewport: 390x844
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / preview zoom controls
- Viewport: 390x844
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / video track controls
- Viewport: 390x844
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / audio track controls
- Viewport: 390x844
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / inspector visibility
- Viewport: 390x844
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / dock navigation
- Viewport: 390x844
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / pointer clip drag
- Viewport: 390x844
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 390x844 / keyboard shortcut routing
- Viewport: 390x844
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-390x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / page horizontal overflow
- Viewport: 375x812
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: None for this measured property.

### Responsive cell 375x812 / header horizontal overflow
- Viewport: 375x812
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: None for this measured property.

### Responsive cell 375x812 / loaded timeline preserved
- Viewport: 375x812
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: None for this measured property.

### Responsive cell 375x812 / Media dock visible
- Viewport: 375x812
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / preview visible
- Viewport: 375x812
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / timeline visible
- Viewport: 375x812
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / import control
- Viewport: 375x812
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / export control
- Viewport: 375x812
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / play/pause control
- Viewport: 375x812
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / frame mode control
- Viewport: 375x812
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / timeline zoom controls
- Viewport: 375x812
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / preview zoom controls
- Viewport: 375x812
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / video track controls
- Viewport: 375x812
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / audio track controls
- Viewport: 375x812
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / inspector visibility
- Viewport: 375x812
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / dock navigation
- Viewport: 375x812
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / pointer clip drag
- Viewport: 375x812
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 375x812 / keyboard shortcut routing
- Viewport: 375x812
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-375x812.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / page horizontal overflow
- Viewport: 360x800
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: None for this measured property.

### Responsive cell 360x800 / header horizontal overflow
- Viewport: 360x800
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: None for this measured property.

### Responsive cell 360x800 / loaded timeline preserved
- Viewport: 360x800
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: None for this measured property.

### Responsive cell 360x800 / Media dock visible
- Viewport: 360x800
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / preview visible
- Viewport: 360x800
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / timeline visible
- Viewport: 360x800
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / import control
- Viewport: 360x800
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / export control
- Viewport: 360x800
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / play/pause control
- Viewport: 360x800
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / frame mode control
- Viewport: 360x800
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / timeline zoom controls
- Viewport: 360x800
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / preview zoom controls
- Viewport: 360x800
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / video track controls
- Viewport: 360x800
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / audio track controls
- Viewport: 360x800
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / inspector visibility
- Viewport: 360x800
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / dock navigation
- Viewport: 360x800
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / pointer clip drag
- Viewport: 360x800
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 360x800 / keyboard shortcut routing
- Viewport: 360x800
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-360x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / page horizontal overflow
- Viewport: 1100x800
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: None for this measured property.

### Responsive cell 1100x800 / header horizontal overflow
- Viewport: 1100x800
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: None for this measured property.

### Responsive cell 1100x800 / loaded timeline preserved
- Viewport: 1100x800
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: None for this measured property.

### Responsive cell 1100x800 / Media dock visible
- Viewport: 1100x800
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / preview visible
- Viewport: 1100x800
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / timeline visible
- Viewport: 1100x800
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / import control
- Viewport: 1100x800
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / export control
- Viewport: 1100x800
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / play/pause control
- Viewport: 1100x800
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / frame mode control
- Viewport: 1100x800
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / timeline zoom controls
- Viewport: 1100x800
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / preview zoom controls
- Viewport: 1100x800
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / video track controls
- Viewport: 1100x800
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / audio track controls
- Viewport: 1100x800
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / inspector visibility
- Viewport: 1100x800
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / dock navigation
- Viewport: 1100x800
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / pointer clip drag
- Viewport: 1100x800
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1100x800 / keyboard shortcut routing
- Viewport: 1100x800
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1100x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / page horizontal overflow
- Viewport: 1000x800
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: None for this measured property.

### Responsive cell 1000x800 / header horizontal overflow
- Viewport: 1000x800
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: None for this measured property.

### Responsive cell 1000x800 / loaded timeline preserved
- Viewport: 1000x800
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: None for this measured property.

### Responsive cell 1000x800 / Media dock visible
- Viewport: 1000x800
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / preview visible
- Viewport: 1000x800
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / timeline visible
- Viewport: 1000x800
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / import control
- Viewport: 1000x800
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / export control
- Viewport: 1000x800
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / play/pause control
- Viewport: 1000x800
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / frame mode control
- Viewport: 1000x800
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / timeline zoom controls
- Viewport: 1000x800
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / preview zoom controls
- Viewport: 1000x800
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / video track controls
- Viewport: 1000x800
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / audio track controls
- Viewport: 1000x800
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / inspector visibility
- Viewport: 1000x800
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / dock navigation
- Viewport: 1000x800
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / pointer clip drag
- Viewport: 1000x800
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 1000x800 / keyboard shortcut routing
- Viewport: 1000x800
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-1000x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / page horizontal overflow
- Viewport: 900x800
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: None for this measured property.

### Responsive cell 900x800 / header horizontal overflow
- Viewport: 900x800
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: None for this measured property.

### Responsive cell 900x800 / loaded timeline preserved
- Viewport: 900x800
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: None for this measured property.

### Responsive cell 900x800 / Media dock visible
- Viewport: 900x800
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / preview visible
- Viewport: 900x800
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / timeline visible
- Viewport: 900x800
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / import control
- Viewport: 900x800
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / export control
- Viewport: 900x800
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / play/pause control
- Viewport: 900x800
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / frame mode control
- Viewport: 900x800
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / timeline zoom controls
- Viewport: 900x800
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / preview zoom controls
- Viewport: 900x800
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / video track controls
- Viewport: 900x800
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / audio track controls
- Viewport: 900x800
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / inspector visibility
- Viewport: 900x800
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / dock navigation
- Viewport: 900x800
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / pointer clip drag
- Viewport: 900x800
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 900x800 / keyboard shortcut routing
- Viewport: 900x800
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-900x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / page horizontal overflow
- Viewport: 850x800
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: None for this measured property.

### Responsive cell 850x800 / header horizontal overflow
- Viewport: 850x800
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: None for this measured property.

### Responsive cell 850x800 / loaded timeline preserved
- Viewport: 850x800
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: None for this measured property.

### Responsive cell 850x800 / Media dock visible
- Viewport: 850x800
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / preview visible
- Viewport: 850x800
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / timeline visible
- Viewport: 850x800
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / import control
- Viewport: 850x800
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / export control
- Viewport: 850x800
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / play/pause control
- Viewport: 850x800
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / frame mode control
- Viewport: 850x800
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / timeline zoom controls
- Viewport: 850x800
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / preview zoom controls
- Viewport: 850x800
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / video track controls
- Viewport: 850x800
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / audio track controls
- Viewport: 850x800
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / inspector visibility
- Viewport: 850x800
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / dock navigation
- Viewport: 850x800
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / pointer clip drag
- Viewport: 850x800
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 850x800 / keyboard shortcut routing
- Viewport: 850x800
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-850x800.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / page horizontal overflow
- Viewport: 700x850
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: None for this measured property.

### Responsive cell 700x850 / header horizontal overflow
- Viewport: 700x850
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: None for this measured property.

### Responsive cell 700x850 / loaded timeline preserved
- Viewport: 700x850
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: None for this measured property.

### Responsive cell 700x850 / Media dock visible
- Viewport: 700x850
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / preview visible
- Viewport: 700x850
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / timeline visible
- Viewport: 700x850
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / import control
- Viewport: 700x850
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / export control
- Viewport: 700x850
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / play/pause control
- Viewport: 700x850
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / frame mode control
- Viewport: 700x850
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / timeline zoom controls
- Viewport: 700x850
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / preview zoom controls
- Viewport: 700x850
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / video track controls
- Viewport: 700x850
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / audio track controls
- Viewport: 700x850
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / inspector visibility
- Viewport: 700x850
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / dock navigation
- Viewport: 700x850
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / pointer clip drag
- Viewport: 700x850
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 700x850 / keyboard shortcut routing
- Viewport: 700x850
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-700x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / page horizontal overflow
- Viewport: 600x850
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: None for this measured property.

### Responsive cell 600x850 / header horizontal overflow
- Viewport: 600x850
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: None for this measured property.

### Responsive cell 600x850 / loaded timeline preserved
- Viewport: 600x850
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: None for this measured property.

### Responsive cell 600x850 / Media dock visible
- Viewport: 600x850
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / preview visible
- Viewport: 600x850
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / timeline visible
- Viewport: 600x850
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / import control
- Viewport: 600x850
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / export control
- Viewport: 600x850
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / play/pause control
- Viewport: 600x850
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / frame mode control
- Viewport: 600x850
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / timeline zoom controls
- Viewport: 600x850
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / preview zoom controls
- Viewport: 600x850
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / video track controls
- Viewport: 600x850
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / audio track controls
- Viewport: 600x850
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / inspector visibility
- Viewport: 600x850
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / dock navigation
- Viewport: 600x850
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / pointer clip drag
- Viewport: 600x850
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 600x850 / keyboard shortcut routing
- Viewport: 600x850
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-600x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / page horizontal overflow
- Viewport: 500x850
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: None for this measured property.

### Responsive cell 500x850 / header horizontal overflow
- Viewport: 500x850
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: None for this measured property.

### Responsive cell 500x850 / loaded timeline preserved
- Viewport: 500x850
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: None for this measured property.

### Responsive cell 500x850 / Media dock visible
- Viewport: 500x850
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / preview visible
- Viewport: 500x850
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / timeline visible
- Viewport: 500x850
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / import control
- Viewport: 500x850
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / export control
- Viewport: 500x850
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / play/pause control
- Viewport: 500x850
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / frame mode control
- Viewport: 500x850
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / timeline zoom controls
- Viewport: 500x850
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / preview zoom controls
- Viewport: 500x850
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / video track controls
- Viewport: 500x850
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / audio track controls
- Viewport: 500x850
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / inspector visibility
- Viewport: 500x850
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / dock navigation
- Viewport: 500x850
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / pointer clip drag
- Viewport: 500x850
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 500x850 / keyboard shortcut routing
- Viewport: 500x850
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-500x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / page horizontal overflow
- Viewport: 450x850
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: None for this measured property.

### Responsive cell 450x850 / header horizontal overflow
- Viewport: 450x850
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: None for this measured property.

### Responsive cell 450x850 / loaded timeline preserved
- Viewport: 450x850
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: None for this measured property.

### Responsive cell 450x850 / Media dock visible
- Viewport: 450x850
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / preview visible
- Viewport: 450x850
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / timeline visible
- Viewport: 450x850
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / import control
- Viewport: 450x850
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / export control
- Viewport: 450x850
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / play/pause control
- Viewport: 450x850
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / frame mode control
- Viewport: 450x850
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / timeline zoom controls
- Viewport: 450x850
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / preview zoom controls
- Viewport: 450x850
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / video track controls
- Viewport: 450x850
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / audio track controls
- Viewport: 450x850
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / inspector visibility
- Viewport: 450x850
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / dock navigation
- Viewport: 450x850
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / pointer clip drag
- Viewport: 450x850
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 450x850 / keyboard shortcut routing
- Viewport: 450x850
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-450x850.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / page horizontal overflow
- Viewport: 400x844
- Check: page horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: None for this measured property.

### Responsive cell 400x844 / header horizontal overflow
- Viewport: 400x844
- Check: header horizontal overflow
- Evidence tag: MEASURED
- Status: PASS
- Actual: Measured zero overflow.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: None for this measured property.

### Responsive cell 400x844 / loaded timeline preserved
- Viewport: 400x844
- Check: loaded timeline preserved
- Evidence tag: MEASURED
- Status: PASS
- Actual: Loaded clip count remained stable across resize.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: None for this measured property.

### Responsive cell 400x844 / Media dock visible
- Viewport: 400x844
- Check: Media dock visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / preview visible
- Viewport: 400x844
- Check: preview visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / timeline visible
- Viewport: 400x844
- Check: timeline visible
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / import control
- Viewport: 400x844
- Check: import control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / export control
- Viewport: 400x844
- Check: export control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / play/pause control
- Viewport: 400x844
- Check: play/pause control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / frame mode control
- Viewport: 400x844
- Check: frame mode control
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / timeline zoom controls
- Viewport: 400x844
- Check: timeline zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / preview zoom controls
- Viewport: 400x844
- Check: preview zoom controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / video track controls
- Viewport: 400x844
- Check: video track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / audio track controls
- Viewport: 400x844
- Check: audio track controls
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / inspector visibility
- Viewport: 400x844
- Check: inspector visibility
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / dock navigation
- Viewport: 400x844
- Check: dock navigation
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / pointer clip drag
- Viewport: 400x844
- Check: pointer clip drag
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

### Responsive cell 400x844 / keyboard shortcut routing
- Viewport: 400x844
- Check: keyboard shortcut routing
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Actual: Presence may be visible in screenshot, but no dedicated interaction was executed at this exact viewport.
- Screenshot: `qa/screenshots/viewport-400x844.png`
- Follow-up: Execute the named control at this exact viewport before upgrading status.

## Export validation
- [MEASURED] PASS Downloaded file size is 3,019,027 bytes for the latest run.
- [MEASURED] PASS Container duration is 11.49 seconds.
- [MEASURED] PASS Video is H.264 Constrained Baseline, 1280x720, 16:9, approximately 28.69 fps average.
- [MEASURED] PASS Audio is Opus, 48 kHz stereo.
- [MEASURED] PASS Full FFmpeg decode exited zero with zero decoder error bytes.
- [SCREENSHOT] PASS Export frame 01 is black during the intentional gap introduced by left trim.
- [SCREENSHOT] PASS Export frames 02 and 03 visibly contain the Pexels landscape composition.

## Fixture provenance
- [SOURCE-CODE] PASS `qa/fixtures/pexels-landscape-962322.jpg` comes from Pexels photo page https://www.pexels.com/photo/scenic-view-of-mountains-near-the-ocean-962322/.
- [MEASURED] PASS JPEG is 1260x709 and decodes.
- [MEASURED] PASS `pexels-cinematic-8s.webm` is deterministic motion media generated from that still; it is not downloaded stock video.
- [MEASURED] PASS Derived WebM is VP8 1280x720 30fps with Vorbis audio and 8.00 seconds duration.
- [MEASURED] PASS Generated OGG is 6.00 seconds, Vorbis, 48kHz mono.

## Explicit remaining backlog
### Backlog Q001
- Item: library-to-timeline pointer drag/drop
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q002
- Item: minimum zoom pointer move
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q003
- Item: maximum zoom pointer move
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q004
- Item: timeline horizontal scroll while dragging
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q005
- Item: left trim while track locked
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q006
- Item: right trim while track locked
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q007
- Item: split while track locked
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q008
- Item: move while track locked
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q009
- Item: destination locked-track rejection
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q010
- Item: frame step at duration boundary
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q011
- Item: reverse playback to zero
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q012
- Item: rapid repeated split
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q013
- Item: rapid undo/redo sequence
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q014
- Item: repeated import same file
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q015
- Item: repeated export
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q016
- Item: invalid media import recovery
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q017
- Item: object URL revocation during asset deletion
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q018
- Item: Playwright trace capture
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q019
- Item: Playwright video recording
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q020
- Item: recording FFprobe
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q021
- Item: recording representative frame extraction
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q022
- Item: multi-clip z/layer order
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q023
- Item: audio-only export semantics
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q024
- Item: network offline launch
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q025
- Item: desktop Tauri packaging
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q026
- Item: Windows runtime
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q027
- Item: macOS runtime
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.

### Backlog Q028
- Item: Linux packaged runtime
- Evidence tag: NOT-TESTED
- Status: NOT-TESTED
- Reason: Not covered by the completed 74-assertion run.
- Acceptance: exercise in a real browser or native package as appropriate.
- Required evidence: log assertion plus screenshot/trace when visually meaningful.
- Reporting rule: do not promote to PASS from source inspection alone.


# Completion addendum — 2026-09-20 advanced pass

This addendum supersedes earlier `NOT-TESTED` backlog rows where the same named behavior now has evidence below. Earlier rows are retained to preserve the append-only audit history.

## Advanced real-browser run

- [OBSERVED] PASS 32 advanced assertions completed in packaged Chromium after upgrading to Vite 8.3.0.
- [OBSERVED] PASS Invalid `text/plain` import produced zero assets and zero clips.
- [OBSERVED] PASS The temporary object URL created for invalid import was revoked.
- [OBSERVED] PASS Reimporting the same legitimate image created an independent asset and clip.
- [OBSERVED] PASS A real HTML5 drag from the media library to timeline lanes created a clip.
- [MEASURED] PASS Library drop at the requested X coordinate produced start time `1.9792s`, within tolerance of 2s.
- [OBSERVED] PASS Locked video rejected real pointer movement.
- [OBSERVED] PASS Locked video rejected real left trim.
- [OBSERVED] PASS Locked video rejected real right trim.
- [OBSERVED] PASS Locked video rejected split.
- [OBSERVED] PASS Locked video rejected inspector deletion.
- [OBSERVED] PASS Unlock restored editing state.
- [MEASURED] PASS Timeline reached minimum zoom of 8 px/s.
- [MEASURED] PASS Pointer movement at 8 px/s moved audio from 0s to 4s for a 32px drag.
- [MEASURED] PASS Timeline reached maximum zoom of 8000 px/s.
- [MEASURED] PASS Pointer movement at 8000 px/s remained time-accurate within the test tolerance.
- [OBSERVED] PASS Timeline scrolled horizontally to 12000px at maximum zoom.
- [OBSERVED] PASS Arrow-left at zero remained clamped at frame zero.
- [OBSERVED] PASS Arrow-right at project duration remained clamped at project duration.
- [OBSERVED] PASS Shift+ArrowLeft stepped one second backward.
- [OBSERVED] PASS J reverse transport reached zero and paused.
- [OBSERVED] PASS Four rapid splits created five stable video segments.
- [OBSERVED] PASS Four rapid undo operations restored one video segment.
- [OBSERVED] PASS Four rapid redo operations restored all split segments.
- [OBSERVED] PASS Multiple image/video elements overlapped at two seconds.
- [SOURCE-CODE] PASS Timeline insertion order is deterministic; active preview selection follows track order.
- [OBSERVED] PASS Two consecutive exports generated independent MP4 downloads.
- [MEASURED] PASS First repeat-test MP4 duration is 18.98 seconds.
- [MEASURED] PASS Second repeat-test MP4 duration is 19.34 seconds.
- [MEASURED] PASS Both MP4 files contain 1280x720 H.264 video and 48kHz stereo Opus audio.
- [MEASURED] PASS Both MP4 video streams decode fully to frame MD5 with exit code zero and zero decoder diagnostics.
- [MEASURED] PASS Both MP4 audio streams decode fully to PCM MD5 with exit code zero.
- [OBSERVED] PASS Page-hide lifecycle revoked all seven object URLs created in the final advanced run.
- [OBSERVED] PASS Reload returned a clean project after lifecycle release.
- [OBSERVED] PASS Advanced run produced zero page exceptions, console errors, or unexpected request failures.
- [RECORDING] PASS Final Playwright recording duration is 58.76 seconds, VP8, 1440x900, 25fps.
- [MEASURED] PASS Recording fully decodes with zero video decoder diagnostics.
- [RECORDING] PASS Playwright trace includes screenshots, DOM snapshots, and source capture.

## Final baseline regression

- [OBSERVED] PASS Stress suite completed 74 assertions after Vite 8.3.0 upgrade.
- [OBSERVED] PASS All 22 responsive viewport checks remained green.
- [OBSERVED] PASS Stress run had zero console/page errors and zero unexpected request failures.
- [OBSERVED] PASS The one request abort was a `blob:` load interrupted by the deliberate reload and was explicitly classified.
- [MEASURED] PASS TypeScript `tsc --noEmit` completed with exit code zero.
- [MEASURED] PASS Vite 8.3.0 production build completed successfully.
- [MEASURED] PASS `npm audit` reports zero known vulnerabilities at every severity.

## Desktop packaging status

- [SOURCE-CODE] PASS A real Tauri 2 package manifest, Rust entry point, build script, capability file, and application configuration now exist under `src-tauri/`.
- [SOURCE-CODE] PASS Tauri configuration points production packaging at `../dist` and development at `http://localhost:5173`.
- [SOURCE-CODE] PASS Tauri CSP permits only local application resources plus required blob/data media resources.
- [MEASURED] PASS Tauri CLI 2.11.5 parsed the package and application configuration.
- [MEASURED] BLOCKED Linux native compilation cannot run in this sandbox because `cargo`, `rustc`, `webkit2gtk-4.1`, and `rsvg2` are absent.
- [MEASURED] BLOCKED Windows runtime execution requires a Windows runner, which this Linux sandbox does not provide.
- [MEASURED] BLOCKED macOS runtime execution requires a macOS runner, which this Linux sandbox does not provide.
- [MEASURED] BLOCKED Linux runtime execution requires the missing Rust and WebKitGTK system prerequisites.
- [SOURCE-CODE] PASS Exact blocker output is preserved at `qa/reports/tauri-info.txt` and `qa/reports/tauri-build-attempt.txt`.

## OSS research completion

- [SOURCE-CODE] PASS Seventeen explicitly named repositories were ranked and recorded; no claim of studying every editor is made.
- [SOURCE-CODE] PASS Every corpus record contains the exact retrieved branch-head commit and GitHub-reported license metadata.
- [SOURCE-CODE] PASS OpenCut, ffmpeg.wasm, and react-timeline-editor were shallow-cloned outside production source for structural inspection.
- [SOURCE-CODE] PASS No corpus code was copied into OmniFrame.
- [SOURCE-CODE] PASS GPL and MPL repositories remain reference-only under the project's MIT/Apache-only shipping policy.
- [SOURCE-CODE] PASS Repositories reported as `NOASSERTION` remain blocked from shipping use pending manual license verification.
- [SOURCE-CODE] PASS Full ranked findings are in `research/MEMORY.md`; machine-readable metadata is in `research/repository-metadata.jsonl`.

# Preview overflow correction — 2026-09-21

- [SCREENSHOT] FAIL User evidence `image-1.png` showed the preview's 200% canvas participating in layout overflow and exposing a vertical scrollbar.
- [SOURCE-CODE] FAIL Root cause was `Preview.tsx` assigning 2560×1440 CSS dimensions to the canvas inside an `overflow-auto` flex child.
- [SOURCE-CODE] PASS The preview is now a fixed `min-w-0 min-h-0 overflow-hidden` viewport; zoomed media never changes editor layout dimensions.
- [SOURCE-CODE] PASS The 1280×720 rendering stage is centered absolutely and zoomed with a compositor transform rather than oversized layout width/height.
- [SOURCE-CODE] PASS Fit scale is derived from a `ResizeObserver`, preserving the full 16:9 stage within both available width and height.
- [OBSERVED] PASS At 200%, computed preview overflow is `hidden` with a measured 872×572 viewport and no preview scrollbar.
- [OBSERVED] PASS Real pointer drag panned the 200% stage by 100px while remaining clipped to the preview viewport.
- [OBSERVED] PASS Pan is bounded against scaled canvas edges so users cannot lose the media beyond its reachable limits.
- [OBSERVED] PASS Fit preview reset pan to zero and recentered the canvas.
- [SOURCE-CODE] PASS Preview controls are excluded from the pan pointer-capture path, preventing zoom buttons from being swallowed during a panned state.
- [SCREENSHOT] PASS `qa/screenshots/stress-08-preview-200-panned.png` shows the zoomed/panned image clipped cleanly with no canvas scrollbar or main-layout overflow.
- [OBSERVED] PASS Updated Chromium stress suite completed 77 assertions with zero browser errors and zero unexpected failed requests.
- [OBSERVED] PASS All 22 responsive loaded-project viewport checks remained green after the preview architecture change.

# Persistent inspector toggle and end-play restart — 2026-09-21

- [SCREENSHOT] FAIL User evidence showed two inspector slide icons: one beside Export and one in the right-edge rail.
- [SOURCE-CODE] FAIL Root cause was independent inspector toggles in both `TopBar.tsx` and `RightPanel.tsx`.
- [SOURCE-CODE] PASS The duplicate top-bar inspector control beside Export has been removed.
- [SOURCE-CODE] PASS One right-edge inspector control now persists in both expanded and collapsed states.
- [SOURCE-CODE] PASS The persistent control flips between `PanelRightClose` and `PanelRightOpen` according to state.
- [SOURCE-CODE] PASS The control exposes `Hide inspector` / `Show inspector`, `aria-label`, and `aria-expanded` state.
- [OBSERVED] PASS Chromium found zero inspector-toggle buttons in the top bar.
- [OBSERVED] PASS Chromium found exactly one persistent inspector toggle while the inspector was open.
- [OBSERVED] PASS Clicking it closed the inspector while retaining exactly one `Show inspector` control.
- [OBSERVED] PASS Clicking again reopened the inspector and restored exactly one `Hide inspector` control.
- [SCREENSHOT] PASS `qa/screenshots/stress-09-panels.png` visibly shows no icon beside Export and one toggle on the inspector edge.
- [SOURCE-CODE] PASS `play()` and `togglePlay()` now reset the playhead to zero before starting when it is at project duration.
- [OBSERVED] PASS Space pressed at project end restarted playback at `00:00:00:*`.
- [OBSERVED] PASS Space paused the restarted playback normally.
- [OBSERVED] PASS Updated Chromium stress suite completed 83 assertions with zero runtime errors and zero unexpected request failures.
- [OBSERVED] PASS Preview zoom remained overflow-free and all 22 responsive checks remained green.

# Timeline playback, pause, and scrub responsiveness — 2026-09-21

- [OBSERVED] FAIL User reported delayed pause response, black preview flashes when seeking during playback, and slow canvas updates during playhead dragging.
- [SOURCE-CODE] FAIL The decoder synchronization path reassigned `HTMLMediaElement.currentTime` on every animation frame even while the previous seek was still pending.
- [SOURCE-CODE] FAIL Repeated current-time assignments could restart Chromium decoder work approximately 60 times per second and delay arrival at the requested frame.
- [SOURCE-CODE] FAIL The visible canvas was cleared to black before confirming that every active visual source had a decoded current frame.
- [SOURCE-CODE] PASS Media seeks now use a WeakMap-backed latest-target vector and allow only one in-flight seek per decoder.
- [SOURCE-CODE] PASS Rapid playhead updates are coalesced: while a media element is seeking, new desired time replaces the vector target and is applied after decoder completion.
- [SOURCE-CODE] PASS The preview renderer now uses a fixed 1280×720 offscreen back buffer.
- [SOURCE-CODE] PASS A composite is committed atomically to the visible canvas only when every active visual source has current decoded data.
- [SOURCE-CODE] PASS During decoder latency, the last complete visible composite is retained instead of flashing black.
- [SOURCE-CODE] PASS Store playback transitions are subscribed directly by the preview engine so video/audio pause synchronously rather than waiting for the next animation frame.
- [OBSERVED] PASS Measured Space-to-paused UI response was 17.4ms in the final Chromium run.
- [OBSERVED] PASS Every decoded video/audio element reported `paused === true` immediately after the Space pause transition.
- [OBSERVED] PASS Clicking the ruler while playback was active retained a non-black canvas composite.
- [MEASURED] PASS Nine-point canvas luma remained above the non-black threshold during click-seek.
- [OBSERVED] PASS Five rapid pointer scrub positions each retained the same valid composite while the decoder coalesced work.
- [MEASURED] PASS Rapid-scrub luma samples were `4108,4108,4108,4108,4108`; no black frame was exposed.
- [MEASURED] PASS The final coalesced scrub target reached decoded `readyState >= HAVE_CURRENT_DATA` in 344.0ms.
- [OBSERVED] PASS Chromium stress suite increased to 89 passing assertions with zero runtime errors and zero unexpected request failures.
- [MEASURED] PASS Post-change export remained H.264 1280×720 plus 48kHz stereo Opus and decoded fully with zero video/audio decoder errors.

# Timeline render isolation and hidden media-error audit — 2026-09-21

- [SOURCE-CODE] FAIL Timeline subscribed its full React component tree to `playhead`; playback therefore reconciled every ruler tick, track, clip, and control at animation-frame frequency.
- [SOURCE-CODE] PASS Live timecode is now an isolated imperative store subscriber that updates only one text node.
- [SOURCE-CODE] PASS Ruler and lane playhead markers are isolated imperative subscribers using GPU-friendly `translate3d` transforms.
- [SOURCE-CODE] PASS The main Timeline component no longer subscribes to playhead changes.
- [SOURCE-CODE] PASS Split reads the current playhead only when invoked, avoiding a render subscription solely for event-handler data.
- [MEASURED] PASS Timeline render counter remained exactly `11` throughout the measured 820ms active playback interval.
- [OBSERVED] PASS Timecode and both playhead markers continued updating while the clip/track tree did not rerender.
- [MEASURED] PASS Final Space pause response remained 17.0ms after render isolation.
- [MEASURED] PASS Final coalesced rapid-scrub decode completed in 387.9ms while retaining a non-black composite.
- [OBSERVED] PASS All hidden HTMLMediaElement `MediaError` objects were explicitly inspected after loaded-project resize and editing; result was an empty array.
- [OBSERVED] PASS Console errors, page exceptions, unhandled browser failures, unexpected request failures, and hidden decoder/network media errors were all zero.
- [OBSERVED] PASS Updated Chromium suite completed 91 assertions.
- [MEASURED] PASS TypeScript and the Vite production build remained successful.

# Narrow-panel recovery and final performance regression — 2026-09-21

- [SOURCE-CODE] PASS Left-dock tab buttons now expose `aria-pressed`, making hidden/open state observable without depending on transient width animation.
- [SOURCE-CODE] PASS The expandable media panel exposes explicit `data-open` state for browser regression evidence.
- [OBSERVED] PASS At 400×844, the automatically hidden inspector reopened from its persistent edge control.
- [OBSERVED] PASS At 400×844, the inspector closed again and retained its recovery control.
- [OBSERVED] PASS At 400×844, the hidden Media panel reopened from the permanent icon rail.
- [MEASURED] PASS Reopening the Media panel at 400×844 produced zero document horizontal overflow.
- [OBSERVED] PASS The narrow Media panel closed again without losing its rail control.
- [MEASURED] PASS Timeline render count remained exactly 11 during the measured active-playback interval; playhead animation caused zero clip-tree rerenders.
- [MEASURED] PASS Final Space pause response was 12.0ms.
- [MEASURED] PASS Final coalesced scrub decode reached the requested frame in 307.4ms with no black flash.
- [OBSERVED] PASS Hidden HTMLMediaElement error audit remained empty.
- [OBSERVED] PASS Final Chromium suite completed 96 assertions with zero console/page errors and zero unexpected request failures.
- [MEASURED] PASS TypeScript, Vite production build, and npm audit all passed; npm audit reported zero vulnerabilities.

# Public landing page — 2026-09-21

- [SOURCE-CODE] PASS The root URL now opens a dedicated concise landing page; `#studio` opens the editor directly.
- [SOURCE-CODE] PASS Landing copy discusses open source, local-first editing, precise cuts, multi-track media, responsive timelines, and exports without readiness/status language.
- [SOURCE-CODE] PASS The page has one primary `Open Studio` call to action and one real GitHub open-source link.
- [SOURCE-CODE] PASS Clicking `Open Studio` runs a 520ms branded wipe transition before mounting the editor and updating the URL hash.
- [SOURCE-CODE] PASS Reduced-motion users receive a shortened transition and globally minimized animation durations.
- [SOURCE-CODE] PASS Browser back navigation returns from `#studio` to the landing page.
- [SOURCE-CODE] PASS Existing editor QA routes now use `#studio`, keeping landing and studio concerns independently testable.
- [SCREENSHOT] PASS Desktop landing evidence is `qa/screenshots/landing-1440x900.png`.
- [SCREENSHOT] PASS Mobile landing evidence is `qa/screenshots/landing-360x800.png`.
- [SCREENSHOT] PASS In-progress transition evidence is `qa/screenshots/landing-transition.png`.
- [OBSERVED] PASS Landing opened by default and displayed its hero, open-source link, and single studio CTA.
- [MEASURED] PASS Landing had zero horizontal page/body overflow at 1920×1080, 1440×900, 1024×768, 768×1024, 430×932, 390×844, and 360×800.
- [OBSERVED] PASS The wipe was visibly active 180ms after the CTA click and the studio mounted after completion.
- [OBSERVED] PASS Landing browser suite completed 17 assertions with zero runtime errors and zero failed requests.
- [OBSERVED] PASS Studio stress suite remained at 96 passing assertions after routing integration.
- [MEASURED] PASS TypeScript and Vite production build remained successful.

# Consolidated preview zoom control — 2026-09-21

- [SOURCE-CODE] PASS Removed separate Fit, 50%, 100%, and 200% preset buttons from the preview toolbar.
- [SOURCE-CODE] PASS Added one compact 25%–200% range slider with 5% increments.
- [SOURCE-CODE] PASS Added one Auto Fit icon that measures and centers the canvas inside the preview viewport.
- [SOURCE-CODE] PASS The toolbar exposes only one zoom text value: the current percentage.
- [SOURCE-CODE] PASS Slider changes retain bounded canvas panning and never alter editor layout dimensions.
- [SOURCE-CODE] PASS Auto Fit resets pan to zero and restores measured contain scaling.
- [OBSERVED] PASS Real Chromium drove the slider to 50%, 100%, and 200% and observed matching canvas scale values.
- [OBSERVED] PASS Chromium verified that the three duplicate percentage buttons no longer exist.
- [SCREENSHOT] PASS Updated compact toolbar is visible in `qa/screenshots/stress-08-preview-zoom.png`.
- [OBSERVED] PASS Full studio stress suite completed 97 assertions with zero runtime errors and zero unexpected failed requests.
- [MEASURED] PASS TypeScript and Vite production build remained successful.

# Automatic media tracks, source visuals, and audio extraction — 2026-09-21

- [SOURCE-CODE] PASS Removed the requested landing badge “Open-source video editing”.
- [SOURCE-CODE] PASS Removed the requested landing note “Runs in your browser”.
- [SOURCE-CODE] PASS Landing feature cards now read Masking, Tracking, and 3D editing with concise supporting text.
- [SOURCE-CODE] PASS New and reset projects start with zero tracks instead of manually created blank Video 1 / Audio 1 rows.
- [SOURCE-CODE] PASS Import and placement automatically create the first required track and label it `Video` or `Audio`; subsequent same-kind tracks receive numeric suffixes.
- [SOURCE-CODE] PASS Timeline classification is derived from actual clips: `Empty`, `Video`, `Audio`, or `Video + Audio`.
- [SOURCE-CODE] PASS Classification appears in the fixed track-header corner rather than crowding transport controls.
- [SOURCE-CODE] PASS Imported videos receive a real JPEG thumbnail captured from a decoded source frame.
- [SOURCE-CODE] PASS Video clips repeat that source thumbnail as a filmstrip; image clips use the real imported image.
- [SOURCE-CODE] PASS Imported audio is decoded through Web Audio and summarized into 96 normalized real sample peaks.
- [SOURCE-CODE] PASS Audio clips render those decoded peaks as a waveform rather than decorative/random bars.
- [SOURCE-CODE] PASS Extract Audio creates a separately selectable, movable, trimmable audio asset and clip aligned with its source video.
- [SOURCE-CODE] PASS Extraction mutes the source video clip volume to prevent doubled playback.
- [SOURCE-CODE] PASS Extraction is idempotent per source clip and its action disappears after successful extraction.
- [OBSERVED] PASS Empty Chromium project contained zero manual blank tracks.
- [OBSERVED] PASS A video-only import created exactly one track and classified the sequence as `Video`.
- [OBSERVED] PASS An audio-only import created exactly one track and classified the sequence as `Audio`.
- [OBSERVED] PASS Mixed video/image/audio import classified the sequence as `Video + Audio`.
- [OBSERVED] PASS Browser found source filmstrips on visual clips and one decoded waveform on the audio fixture.
- [OBSERVED] PASS Extract Audio changed a video-only sequence to `Video + Audio`, created one independent audio clip, and changed source video volume to zero.
- [SOURCE-CODE] PASS Research and independent UI decisions are recorded at `research/capcut-timeline-audio.md` with exact CapCut and OpenShot URLs.
- [OBSERVED] PASS Updated Chromium suite completed 108 assertions with zero runtime errors and zero unexpected request failures.
- [MEASURED] PASS TypeScript and Vite production build remained successful.

# Landing-to-Studio scene mask transition — 2026-09-21

- [OBSERVED] FAIL The previous purple wipe covered the viewport while the landing page remained underneath, so revealed regions did not progressively become the Studio.
- [SOURCE-CODE] PASS Studio now mounts immediately beneath the landing scene when the CTA is activated.
- [SOURCE-CODE] PASS The landing scene remains above Studio only while a 680ms polygon clip-path animation removes it from left to right.
- [SOURCE-CODE] PASS The angled mask boundary acts as the moving transition edge; every area behind that edge is the live Studio scene.
- [SOURCE-CODE] PASS The URL changes to `#studio` only after the visual transition completes, then the landing scene unmounts.
- [SOURCE-CODE] PASS Reduced-motion users complete the same scene switch in 60ms.
- [OBSERVED] PASS At 220ms, both the underlying Studio and the masked landing scene were simultaneously visible.
- [MEASURED] PASS Browser-observed in-progress mask was a nontrivial animated polygon, including `polygon(18.56% 0px, 101.38% 0px, 99.66% 100%, 16.84% 100%)`.
- [SCREENSHOT] PASS `qa/screenshots/landing-transition.png` visibly shows Studio on the revealed left side and landing content on the retained right side.
- [OBSERVED] PASS Landing transition suite completed 19 assertions with zero runtime errors and zero failed requests.
- [OBSERVED] PASS Full Studio stress regression remained at 108 passing assertions with zero runtime errors and zero unexpected request failures.
- [MEASURED] PASS TypeScript and production build remained successful.

# Landing-to-Studio combined wave reveal refinement — 2026-09-21

- [SOURCE-CODE] PASS Studio mounts underneath the landing page before transition motion begins.
- [SOURCE-CODE] PASS The landing scene itself is clipped away; there is no opaque purple sheet hiding both scenes.
- [SOURCE-CODE] PASS The moving boundary uses a sixteen-point alternating mask edge to create a restrained wave/ripple while revealing Studio behind it.
- [OBSERVED] PASS At 220ms, Landing remained visible on the unreached side while the already-revealed side displayed the live Studio.
- [MEASURED] PASS Mid-transition computed polygon contained sixteen responsive percentage points and was neither `none` nor a flat inset.
- [SCREENSHOT] PASS Combined-scene evidence is `qa/screenshots/landing-transition.png`.
- [OBSERVED] PASS Studio remained mounted after the mask completed and the route changed to `#studio`.
- [OBSERVED] PASS Landing transition suite completed 19 assertions with zero runtime errors and zero failed requests.

# Restored branded wave over combined scene transition — 2026-09-21

- [USER-CORRECTION] The original purple sweep was intended to remain; only its masking behavior needed improvement.
- [SOURCE-CODE] PASS Restored a broad branded violet wave band as the visible transition edge.
- [SOURCE-CODE] PASS The wave is layered above both scenes while Landing remains clipped ahead and live Studio remains revealed behind.
- [SOURCE-CODE] PASS The band and landing mask share the same 680ms easing and traverse the viewport together.
- [SOURCE-CODE] PASS Both sides of the violet band use alternating polygon points, preserving the energetic original motion without reverting to an opaque full-screen sheet.
- [SCREENSHOT] PASS `qa/screenshots/landing-transition.png` shows Studio on the revealed left, Landing on the unreached right, and the violet wave between them.
- [OBSERVED] PASS At 220ms the branded wave was visible, positioned inside the viewport, and the live Studio was already mounted below the completed mask region.
- [OBSERVED] PASS Landing suite completed 21 assertions with zero runtime errors and zero failed requests.
