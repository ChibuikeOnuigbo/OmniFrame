/** Attempt every release, then report the first failure (including thrown undefined). */
export function cleanupAll(...steps: Array<() => void>): void {
  let failed = false
  let firstError: unknown
  for (const step of steps) {
    try { step() } catch (error) {
      if (!failed) { failed = true; firstError = error }
    }
  }
  if (failed) throw firstError
}
