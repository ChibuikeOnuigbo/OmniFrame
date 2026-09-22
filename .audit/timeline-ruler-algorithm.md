# OmniFrame adaptive ruler algorithm

## Authoritative model

The project stores timeline positions and durations as continuous seconds and carries an explicit project FPS selected from 23.976, 24, 25, 29.97, 30, 50, 59.94, 60, or 120. `pxPerSec` is the viewport scale. Display rounding does not modify clip or playhead state.

The same scale drives clip left/width, ruler tick positions, playhead transform, ruler seeking, and wheel-zoom anchoring. Wheel zoom computes time below the pointer from current `scrollLeft`, changes scale, then restores that time under the same pointer coordinate.

## Interval selection

`chooseTickInterval()` forms a sorted candidate ladder from exact project-frame multiples and 1/2/5-style wall-clock intervals. It selects the finest interval meeting the 72 CSS-pixel major-label budget. Minor ticks subdivide major intervals by two or five according to available spacing. At frame-readable scale, exact frame timestamps are generated only for the bounded visible range.

## Rendering bounds

The generator starts at the first tick at or before visible start and ends at visible end. Browser evidence confirms bounded major-tick counts and no adjacent label intersections at 40, 160, 640, and 2400 px/s. Tick times are exposed through deterministic QA attributes.

## Maximum scale

The current maximum is 8000 px/s. This yields 66.67 CSS px per frame at 120 fps, exceeding the practical 5–8 px target while remaining horizontally scrollable. Ruler nodes remain visible-range bounded, although clip content width can be large for long projects; full long-project content virtualization remains future work.

## Fractional rates

Frame timestamps use the real project rate. Display timecode uses rounded nominal SMPTE frame fields. Drop-frame notation is not implemented and is not claimed.
