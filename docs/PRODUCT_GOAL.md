# OmniFrame product goal

OmniFrame's goal is to become the most capable video and motion editor that
still feels fast, simple and smooth. One editable project should open in the
web app and the desktop app on Windows, macOS and Linux, with the same visible
result from preview and export.

“Best” is a direction backed by checks, not a release label. Each increment is
judged against four product gates:

1. **Capable.** A creator can finish the task inside OmniFrame with editable,
   keyframeable controls. Preset quantity never substitutes for a working
   render path, persistence, undo, masks and export.
2. **Fast and smooth.** Target p95 interface response is under 50 ms. Preview
   should hold its selected 30/60 fps frame budget on the reference project,
   degrade resolution before input responsiveness, avoid idle redraws and
   surface measured dropped frames rather than hiding them.
3. **Simple.** Common work stays one or two actions away. Panels use compact
   icons, search and progressive disclosure; each section keeps at most nine
   primary choices. Longer explanations live in Tutorial & Info.
4. **Everywhere and safe.** Browser and Tauri builds share render engines and
   project data. Release checks cover the web build plus Windows, macOS and
   Linux desktop packages. Autosave, recovery, undo and round-trip tests guard
   against lost work.

The acceptance rule is concrete: a feature is complete only when its visible
controls drive the shared preview/export renderer, survive save/reload and
undo, and pass an appropriate render or interaction check. Research queues,
effect names, model listings and downloaded tutorials remain evidence or
leads until those checks pass.
