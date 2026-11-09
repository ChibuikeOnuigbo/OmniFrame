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

## Current measurable milestones

- Keep at least 150,000 stable executable recipe IDs available through paged
  search while reporting recipe, renderer-family and full-motion acceptance
  counts separately. Do not materialize the whole indexed bank in the UI.
- Add missing effect families as bounded shared render kernels with editable
  parameters, keyframes, effect-region masks and visual fixtures; avoid padding
  the catalog with names that map to no renderer.
- Maintain one project and render contract across browser preview, browser
  export and the Tauri desktop targets. Web typecheck/build and browser QA run
  on each increment; Windows, macOS and Linux installers remain release-CI
  gates rather than claims made from this Linux runner alone.
- Use official documentation and clearly licensed source/assets for research.
  Downloaded APKs are inspected statically and never executed on the runner.
- Keep the ten primary left-dock modes under a repeatable 200-control UI gate:
  visible focus, at least 24×24 targets, explicit selected semantics, quieter
  hover states and unclipped grid/flex grouping.
