# Timeline

Clips use integer sequence frames. `sourceIn`/`sourceOut` identify the source window, `start` identifies sequence position, and speed segments map timeline frames to source frames.

Implemented operations:

- trim head/tail;
- split/blade;
- ripple insert/delete/trim;
- roll join;
- slip source window;
- slide clip with neighbour absorption;
- duplicate, move, compact, compound;
- snap to edges/markers;
- markers with labels/comments/ranges;
- speed, reverse, freeze and speed segments;
- command-based undo/redo and macro transactions.

The web workbench visualises the model with internal timeline scrolling. Frame-level zoom and virtualisation are engine/UI gates for larger projects.
