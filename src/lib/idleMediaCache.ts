/** Evict oldest inactive resources; never sacrifice an active composition layer. */
export function pruneIdleMedia<T>(cache: Map<string, T>, active: ReadonlySet<T>, release: (entry: T) => void, limit = 16): void {
  for (const [id, entry] of cache) {
    if (cache.size <= limit) break
    if (active.has(entry)) continue
    release(entry)
    cache.delete(id)
  }
}
