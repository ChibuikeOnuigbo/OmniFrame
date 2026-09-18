/**
 * LRU cache with a byte budget. Used for decoded frames, masks, tracking results,
 * compiled shader sources and lightmap bakes. Entries may declare a byte cost so
 * a single 4K frame can evict hundreds of thumbnails.
 */
export interface CacheEntry<V> {
  value: V;
  bytes: number;
  hits: number;
  createdAt: number;
}

export class LruCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();
  private bytes = 0;

  constructor(
    readonly maxBytes: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.map.size;
  }

  get usedBytes(): number {
    return this.bytes;
  }

  get(key: K): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    // refresh recency
    this.map.delete(key);
    e.hits++;
    this.map.set(key, e);
    return e.value;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V, bytes = 1): void {
    const existing = this.map.get(key);
    if (existing) {
      this.bytes -= existing.bytes;
      this.map.delete(key);
      if (this.onEvict && existing.value !== value) this.onEvict(key, existing.value);
    }
    this.map.set(key, { value, bytes, hits: 0, createdAt: Date.now() });
    this.bytes += bytes;
    this.evict();
  }

  delete(key: K): boolean {
    const e = this.map.get(key);
    if (!e) return false;
    this.bytes -= e.bytes;
    this.map.delete(key);
    if (this.onEvict) this.onEvict(key, e.value);
    return true;
  }

  clear(): void {
    for (const [k, e] of this.map) this.onEvict?.(k, e.value);
    this.map.clear();
    this.bytes = 0;
  }

  /** Evicts until we are under budget. Returns how many entries were dropped. */
  evict(): number {
    let dropped = 0;
    while (this.bytes > this.maxBytes && this.map.size > 0) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      const key = oldest.value;
      const e = this.map.get(key);
      this.map.delete(key);
      if (e) {
        this.bytes -= e.bytes;
        this.onEvict?.(key, e.value);
        dropped++;
      }
    }
    return dropped;
  }

  keys(): K[] {
    return [...this.map.keys()];
  }

  stats(): { entries: number; bytes: number; maxBytes: number } {
    return { entries: this.map.size, bytes: this.bytes, maxBytes: this.maxBytes };
  }
}
