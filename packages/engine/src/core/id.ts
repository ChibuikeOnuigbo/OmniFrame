/**
 * Stable, collision-resistant identifiers.
 * Every persisted object in a .vxproj carries one of these so that references
 * survive reordering, duplication and undo/redo.
 */
let counter = 0;

export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 0xffff;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}

export function shortId(prefix = 'id'): string {
  counter = (counter + 1) % 0xffff;
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
