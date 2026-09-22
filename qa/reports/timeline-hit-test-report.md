# Timeline hit-test report

The centralized capture-phase resolver uses the actual event target and `closest()` semantic surface rather than current selection.

Current priority:
1. input / textarea / contenteditable → native ownership
2. menu / listbox / select / option → popup ownership
3. physical timeline clip → typed from clip data and project store
4. preview stage → canvas
5. media library → media panel
6. editor remainder → empty editor

A VIDEO_CLIP target was resolved from a real filmstrip under the pointer. A subsequent canvas right-click resolved CANVAS and contained no clip commands. The resolver does not change selection merely to determine context.

Track lane, header, ruler, gap, and playhead semantics remain explicitly listed as future work rather than guessed from current selection.
