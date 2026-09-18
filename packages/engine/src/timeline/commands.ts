/**
 * Command-pattern undo/redo. Complex user actions (one Omniframe edit, one mask
 * propagation, one tracking correction) collapse into a single macro command so the
 * user sees one undo, not forty.
 */

export interface Command {
  readonly id: string;
  readonly label: string;
  do(): void;
  undo(): void;
  /** Optional: merge with a following command of the same kind (scrubbing a slider). */
  merge?(next: Command): boolean;
}

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private batch: Command[] | null = null;
  private batchLabel = '';
  private listeners = new Set<() => void>();

  constructor(public limit = 200) {}

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  execute(cmd: Command): void {
    cmd.do();
    if (this.batch) {
      this.batch.push(cmd);
      return;
    }
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.merge && last.merge(cmd)) {
      // The existing command keeps its original `prev` value and receives the newest
      // value through merge(). Both commands already ran, so do not replace the stack
      // entry with `cmd` (that would make undo land on the intermediate scrub value).
      this.redoStack.length = 0;
      this.emit();
      return;
    }
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.emit();
  }

  /** Group several commands into one user-visible transaction. */
  beginBatch(label: string): void {
    if (this.batch) return;
    this.batch = [];
    this.batchLabel = label;
  }

  endBatch(): void {
    if (!this.batch) return;
    const cmds = this.batch;
    this.batch = null;
    if (cmds.length === 0) return;
    const label = this.batchLabel || 'Batch';
    this.execute(new MacroCommand(label, cmds));
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): string | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.redoStack.push(cmd);
    this.emit();
    return cmd.label;
  }

  redo(): string | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.do();
    this.undoStack.push(cmd);
    this.emit();
    return cmd.label;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit();
  }

  undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  entries(): { undo: string[]; redo: string[] } {
    return {
      undo: this.undoStack.map((c) => c.label),
      redo: this.redoStack.map((c) => c.label).reverse(),
    };
  }
}

export class MacroCommand implements Command {
  readonly id = `macro_${Math.random().toString(36).slice(2, 8)}`;
  constructor(readonly label: string, private readonly cmds: Command[]) {}
  do(): void {
    for (const c of this.cmds) c.do();
  }
  undo(): void {
    for (let i = this.cmds.length - 1; i >= 0; i--) this.cmds[i].undo();
  }
}

/** Generic setter command — covers the long tail of property edits. */
export class SetPropCommand<T, K extends keyof T> implements Command {
  readonly id: string;
  private prev: T[K];
  constructor(
    private readonly target: T,
    private readonly key: K,
    private next: T[K],
    readonly label: string,
  ) {
    this.prev = target[key];
    this.id = `set_${String(key)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  do(): void {
    this.target[this.key] = this.next;
  }
  undo(): void {
    this.target[this.key] = this.prev;
  }
  /**
   * Slider/scrub edits on the same property collapse into one command. The original
   * value remains in `prev`, while the newest value is retained for redo.
   */
  merge(next: Command): boolean {
    if (!(next instanceof SetPropCommand)) return false;
    if (next.target !== this.target || next.key !== this.key) return false;
    this.next = next.next;
    return true;
  }
}

/** A command whose do/undo are explicit function pairs (used for structural edits). */
export class FnCommand implements Command {
  readonly id = `fn_${Math.random().toString(36).slice(2, 8)}`;
  constructor(
    readonly label: string,
    private readonly apply: () => void,
    private readonly revert: () => void,
  ) {}
  do(): void {
    this.apply();
  }
  undo(): void {
    this.revert();
  }
}
