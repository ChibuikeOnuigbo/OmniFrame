/** Compatibility entry point. One canonical runner owns the queue/cursor.
 * SLICE=N is accepted by qa/newglitch-batch.mjs for existing invocations. */
await import('../../qa/newglitch-batch.mjs')
