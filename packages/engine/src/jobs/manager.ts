/**
 * JobManager — every expensive operation in OmniFrame runs through here.
 *
 * Priorities follow the spec: interactive preview > visible frame > nearby frames
 * > export > background cache work. A higher-priority job preempts (cancels the
 * queued, not running, portion of) lower-priority work.
 */

export type JobPriority = 'interactive' | 'visible' | 'nearby' | 'export' | 'background';

export const JOB_PRIORITY_ORDER: Record<JobPriority, number> = {
  interactive: 0,
  visible: 1,
  nearby: 2,
  export: 3,
  background: 4,
};

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface JobProgress {
  stage: string;
  done: number;
  total: number;
  etaMs: number | null;
  elapsedMs: number;
}

export interface JobOptions<T> {
  id?: string;
  name: string;
  priority?: JobPriority;
  run: (ctx: JobContext) => Promise<T>;
  onProgress?: (p: JobProgress) => void;
  onState?: (s: JobState) => void;
}

export interface JobContext {
  signal: AbortSignal;
  report: (done: number, total: number, stage?: string) => void;
  throwIfCancelled: () => void;
}

export class JobCancelledError extends Error {
  constructor(id: string) {
    super(`Job ${id} was cancelled`);
    this.name = 'JobCancelledError';
  }
}

export interface JobHandle<T> {
  id: string;
  name: string;
  priority: JobPriority;
  state: JobState;
  cancel: () => void;
  result: Promise<T>;
}

let jobCounter = 0;

export class JobManager {
  private queue: Array<{
    handle: JobHandle<unknown>;
    options: JobOptions<unknown>;
    controller: AbortController;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  }> = [];
  private running = new Map<string, AbortController>();
  private history: Array<{ id: string; name: string; state: JobState; ms: number; error?: string }> = [];

  constructor(public maxConcurrent = navigatorHardwareConcurrency()) {}

  submit<T>(options: JobOptions<T>): JobHandle<T> {
    const id = options.id ?? `job_${++jobCounter}_${Math.random().toString(36).slice(2, 7)}`;
    const priority = options.priority ?? 'background';
    const controller = new AbortController();
    let resolveFn!: (v: unknown) => void;
    let rejectFn!: (e: unknown) => void;
    const result = new Promise<unknown>((res, rej) => {
      resolveFn = res;
      rejectFn = rej;
    });
    const handle: JobHandle<T> = {
      id,
      name: options.name,
      priority,
      state: 'queued',
      cancel: () => {
        controller.abort();
        handle.state = 'cancelled';
        this.queue = this.queue.filter((q) => q.handle.id !== id);
        options.onState?.('cancelled');
        rejectFn(new JobCancelledError(id));
      },
      result: result as Promise<T>,
    };
    this.queue.push({
      handle: handle as JobHandle<unknown>,
      options: options as JobOptions<unknown>,
      controller,
      resolve: resolveFn,
      reject: rejectFn,
    });
    this.sortQueue();
    void this.pump();
    return handle;
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => JOB_PRIORITY_ORDER[a.handle.priority] - JOB_PRIORITY_ORDER[b.handle.priority]);
  }

  private async pump(): Promise<void> {
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      const started = Date.now();
      next.handle.state = 'running';
      next.options.onState?.('running');
      this.running.set(next.handle.id, next.controller);
      const signal = next.controller.signal;
      let lastReport = Date.now();
      const ctx: JobContext = {
        signal,
        throwIfCancelled: () => {
          if (signal.aborted) throw new JobCancelledError(next.handle.id);
        },
        report: (done, total, stage = 'working') => {
          const now = Date.now();
          lastReport = now;
          const elapsed = now - started;
          const etaMs = done > 0 && total > done ? (elapsed / done) * (total - done) : null;
          next.options.onProgress?.({ stage, done, total, etaMs, elapsedMs: elapsed });
        },
      };
      try {
        const value = await next.options.run(ctx);
        if (signal.aborted) throw new JobCancelledError(next.handle.id);
        next.handle.state = 'done';
        next.options.onState?.('done');
        this.history.push({ id: next.handle.id, name: next.options.name, state: 'done', ms: Date.now() - started });
        next.resolve(value);
      } catch (err) {
        const cancelled = signal.aborted || err instanceof JobCancelledError;
        next.handle.state = cancelled ? 'cancelled' : 'failed';
        next.options.onState?.(next.handle.state);
        this.history.push({
          id: next.handle.id,
          name: next.options.name,
          state: next.handle.state,
          ms: Date.now() - started,
          error: cancelled ? undefined : String((err as Error)?.message ?? err),
        });
        if (cancelled) next.reject(new JobCancelledError(next.handle.id));
        else next.reject(err);
      } finally {
        this.running.delete(next.handle.id);
        void lastReport;
      }
      void this.pump();
    }
  }

  cancel(id: string): boolean {
    const ctrl = this.running.get(id);
    if (ctrl) {
      ctrl.abort();
      return true;
    }
    const q = this.queue.find((x) => x.handle.id === id);
    if (q) {
      q.handle.cancel();
      return true;
    }
    return false;
  }

  cancelAll(): void {
    for (const q of [...this.queue]) q.handle.cancel();
    for (const ctrl of this.running.values()) ctrl.abort();
  }

  active(): Array<{ id: string; name: string; state: JobState; priority: JobPriority }> {
    return [
      ...this.queue.map((q) => ({
        id: q.handle.id,
        name: q.handle.name,
        state: 'queued' as JobState,
        priority: q.handle.priority,
      })),
      ...[...this.running.keys()].map((id) => ({
        id,
        name: id,
        state: 'running' as JobState,
        priority: 'background' as JobPriority,
      })),
    ];
  }

  getHistory(): ReadonlyArray<{ id: string; name: string; state: JobState; ms: number; error?: string }> {
    return this.history;
  }
}

function navigatorHardwareConcurrency(): number {
  const g = globalThis as { navigator?: { hardwareConcurrency?: number } };
  const n = g.navigator?.hardwareConcurrency ?? 4;
  // Leave one core for the UI thread and one for decode.
  return Math.max(1, Math.min(8, n - 2));
}
