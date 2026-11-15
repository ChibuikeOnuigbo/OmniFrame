/** Collect only object URLs in plain project data; never walk DOM/native objects. */
function objectUrls(value: unknown, urls = new Set<string>(), seen = new Set<object>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith('blob:')) urls.add(value)
    else if (value.includes('blob:')) for (const match of value.matchAll(/blob:[^\s"'()]+/g)) urls.add(match[0])
  } else if (value && typeof value === 'object' && !seen.has(value)) {
    if (value instanceof Map || value instanceof Set) {
      seen.add(value)
      for (const child of value instanceof Map ? value.entries() : value.values()) objectUrls(child, urls, seen)
      return urls
    }
    const prototype = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return urls
    seen.add(value)
    for (const child of Object.values(value)) objectUrls(child, urls, seen)
  }
  return urls
}

/** Release discarded media while retaining URLs still used by preserved settings/libraries. */
export function releaseDiscardedProjectUrls(previous: unknown, next: unknown): void {
  const retained = objectUrls(next)
  for (const url of objectUrls(previous)) if (!retained.has(url)) URL.revokeObjectURL(url)
}
