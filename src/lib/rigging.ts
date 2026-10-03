/**
 * Rigging engine — the maths behind a 2D character skeleton.
 *
 * The whole point of a rig is that you animate *one* part and the rest follow.
 * That is a parent/child hierarchy: each part stores a transform relative to
 * its parent, and a part's world transform is its own transform composed onto
 * its parent's world transform, recursively. Move the shoulder and the
 * forearm and hand come with it, because they are children of it — the
 * animator never touches them.
 *
 * Two details make this more than a matrix stack:
 *
 *  - **Pivots.** A part rotates about its joint, not its centre. A forearm
 *    pivots at the elbow, so `pivot` is stored normalised within the part's
 *    own bounds and rotation is applied around it.
 *  - **Bend.** A plain bone rig rotates flat artwork, leaving a visible crease
 *    at the elbow or knee. Bend curves the part along its length instead of
 *    hinging it, which is what separates a rig from a puppet.
 *
 * Everything here is pure and side-effect free so it can be unit tested
 * without a DOM, a canvas or a store.
 */

import type {
  ClipTransform,
  Rig,
  RigBend,
  RigPart,
  RigPartKind,
  RigResolvedPart,
  RigSide,
} from '../types'

export const DEFAULT_PIVOTS: Record<RigPartKind, { x: number; y: number }> = {
  // Joints, not centres. A limb hangs from its top; the head sits on the neck.
  hair: { x: 0.5, y: 0.15 },
  face: { x: 0.5, y: 0.75 },
  head: { x: 0.5, y: 0.85 },
  neck: { x: 0.5, y: 0.9 },
  torso: { x: 0.5, y: 0.85 },
  armUpper: { x: 0.5, y: 0.1 },
  armLower: { x: 0.5, y: 0.1 },
  hand: { x: 0.5, y: 0.1 },
  legUpper: { x: 0.5, y: 0.08 },
  legLower: { x: 0.5, y: 0.08 },
  foot: { x: 0.5, y: 0.1 },
  clothing: { x: 0.5, y: 0.2 },
  accessory: { x: 0.5, y: 0.5 },
  custom: { x: 0.5, y: 0.5 },
}

/** Parts that normally hang off another, in anatomical order. */
export const DEFAULT_HIERARCHY: Partial<Record<RigPartKind, RigPartKind>> = {
  hair: 'head',
  face: 'head',
  head: 'neck',
  neck: 'torso',
  armUpper: 'torso',
  armLower: 'armUpper',
  hand: 'armLower',
  legUpper: 'torso',
  legLower: 'legUpper',
  foot: 'legLower',
  clothing: 'torso',
  accessory: 'torso',
}

export const PART_LABELS: Record<RigPartKind, string> = {
  hair: 'Hair',
  face: 'Face',
  head: 'Head',
  neck: 'Neck',
  torso: 'Torso',
  armUpper: 'Upper Arm',
  armLower: 'Forearm',
  hand: 'Hand',
  legUpper: 'Thigh',
  legLower: 'Shin',
  foot: 'Foot',
  clothing: 'Clothing',
  accessory: 'Accessory',
  custom: 'Custom',
}

export function identityTransform(): ClipTransform {
  return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
}

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * Compose a child transform onto a parent's world transform.
 *
 * Order matters: the child's translation is applied first in the parent's
 * space (so it inherits the parent's rotation and scale), then the parent's
 * transform maps the result into world space. Getting this backwards is the
 * classic rigging bug — children would translate in world axes while their
 * parent rotated, so limbs would fly off as the torso turned.
 */
export function composeTransforms(parent: ClipTransform, child: ClipTransform): ClipTransform {
  const pScaleX = parent.scaleX ?? parent.scale ?? 1
  const pScaleY = parent.scaleY ?? parent.scale ?? 1
  const angle = rad(parent.rotation || 0)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // Rotate and scale the child's local offset into the parent's frame.
  const lx = (child.x || 0) * pScaleX
  const ly = (child.y || 0) * pScaleY
  const rx = lx * cos - ly * sin
  const ry = lx * sin + ly * cos

  return {
    x: (parent.x || 0) + rx,
    y: (parent.y || 0) + ry,
    scale: (parent.scale ?? 1) * (child.scale ?? 1),
    scaleX: pScaleX * (child.scaleX ?? child.scale ?? 1),
    scaleY: pScaleY * (child.scaleY ?? child.scale ?? 1),
    rotation: (parent.rotation || 0) + (child.rotation || 0),
    // Opacity multiplies down the chain; a hidden parent hides its children.
    opacity: (parent.opacity ?? 1) * (child.opacity ?? 1),
    z: child.z ?? parent.z,
  }
}

/**
 * Rotation of a point about an arbitrary pivot.
 * `px/py` are the pivot and `x/y` the point, all in the same space.
 */
export function rotateAboutPivot(
  x: number,
  y: number,
  px: number,
  py: number,
  degrees: number,
): { x: number; y: number } {
  if (!degrees) return { x, y }
  const a = rad(degrees)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const dx = x - px
  const dy = y - py
  return { x: px + dx * cos - dy * sin, y: py + dx * sin + dy * cos }
}

/**
 * Resolve every part's world transform by walking the parent chain.
 *
 * Runs in O(n) with memoisation rather than O(n·depth), and tolerates the two
 * malformed-rig cases instead of hanging or throwing: a parent id that points
 * at nothing is treated as a root, and a cycle is broken at the repeated node.
 */
export function resolveRig(rig: Rig): RigResolvedPart[] {
  const byId = new Map<string, RigPart>()
  for (const p of rig.parts) byId.set(p.id, p)

  const cache = new Map<string, RigResolvedPart>()

  const resolve = (part: RigPart, seen: Set<string>): RigResolvedPart => {
    const cached = cache.get(part.id)
    if (cached) return cached

    // Cycle guard: if we re-enter a part we are already resolving, treat this
    // one as a root rather than recursing forever.
    if (seen.has(part.id)) {
      const local: RigResolvedPart = {
        part,
        world: { ...identityTransform(), ...part.transform },
        pivotWorld: {
          x: part.bounds.x + part.pivot.x * part.bounds.width,
          y: part.bounds.y + part.pivot.y * part.bounds.height,
        },
        chain: [part.id],
      }
      return local
    }
    seen.add(part.id)

    const parent = part.parentId ? byId.get(part.parentId) : undefined
    let world: ClipTransform
    let chain: string[]

    if (parent) {
      const pr = resolve(parent, seen)
      world = composeTransforms(pr.world, part.transform)
      chain = [...pr.chain, part.id]
    } else {
      world = { ...identityTransform(), ...part.transform }
      chain = [part.id]
    }

    // Pivot in character space: local pivot offset, carried by the world
    // transform. Rotation below happens about this point.
    const pxLocal = part.pivot.x * part.bounds.width
    const pyLocal = part.pivot.y * part.bounds.height
    const pivotWorld = {
      x: world.x + part.bounds.x + pxLocal,
      y: world.y + part.bounds.y + pyLocal,
    }

    const out: RigResolvedPart = { part, world, pivotWorld, chain }
    cache.set(part.id, out)
    seen.delete(part.id)
    return out
  }

  return rig.parts.map((p) => resolve(p, new Set()))
}

/** Resolve a single part, or null if it is not in the rig. */
export function resolvePart(rig: Rig, partId: string): RigResolvedPart | null {
  return resolveRig(rig).find((r) => r.part.id === partId) || null
}

/** Every part that hangs off `partId`, at any depth. */
export function descendantsOf(rig: Rig, partId: string): RigPart[] {
  const childrenOf = new Map<string, string[]>()
  for (const p of rig.parts) {
    if (!p.parentId) continue
    const list = childrenOf.get(p.parentId) || []
    list.push(p.id)
    childrenOf.set(p.parentId, list)
  }
  const out: RigPart[] = []
  const byId = new Map(rig.parts.map((p) => [p.id, p]))
  const stack = [...(childrenOf.get(partId) || [])]
  const seen = new Set<string>([partId])
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const part = byId.get(id)
    if (part) out.push(part)
    stack.push(...(childrenOf.get(id) || []))
  }
  return out
}

/**
 * Would assigning `parentId` to `partId` create a cycle?
 * Reparenting a part under one of its own descendants would orphan the whole
 * subtree, so the UI must refuse it.
 */
export function wouldCycle(rig: Rig, partId: string, parentId: string | null): boolean {
  if (!parentId) return false
  if (partId === parentId) return true
  const descendantIds = new Set(descendantsOf(rig, partId).map((p) => p.id))
  return descendantIds.has(parentId)
}

/**
 * Sample a bend along a part, returning rotation in degrees at `t` (0..1)
 * measured from the pivot toward the far end.
 *
 * Linear would still crease. Smoothstep across the bend region means the curve
 * eases in and out, so a limb reads as flexing rather than folding.
 */
export function sampleBend(bend: RigBend | undefined, t: number): number {
  if (!bend || !bend.angle) return 0
  const start = Math.min(bend.start, bend.end)
  const end = Math.max(bend.start, bend.end)
  if (t <= start) return 0
  if (t >= end) return bend.angle
  const span = end - start
  if (span <= 0) return bend.angle
  const u = (t - start) / span
  const smooth = u * u * (3 - 2 * u)
  return bend.angle * smooth
}

/**
 * Secondary motion: hair and cloth lag behind the part that drives them.
 *
 * The lag is what sells it — a trailing sine offset by the part's depth in the
 * chain, so the tip of the hair moves later than the root. Amplitude scales
 * with chain depth so deeper (floppier) parts sway further.
 */
export function sampleWind(
  wind: Rig['parts'][number]['wind'],
  time: number,
  depth: number,
  seed = 0,
): number {
  if (!wind || !wind.enabled) return 0
  // Guard on enabled only, not amplitude: a constant bias (wind from one
  // side) is meaningful even with zero sway.
  if (!wind.amplitude && !wind.bias) return 0
  const phase = time * wind.frequency * Math.PI * 2 + seed * 0.7 + depth * (wind.lag || 0) * 0.9
  const sway = Math.sin(phase) * wind.amplitude * Math.min(1 + depth * 0.25, 2.5)
  return sway + (wind.bias || 0)
}

/**
 * Build a plausible skeleton from a set of parts by matching anatomical
 * defaults — the "rigged in one tap" step.
 *
 * Only fills in parents that are currently unset, so a user's manual links are
 * never overwritten. Picks the root-most candidate: for a left forearm it
 * prefers a left upper arm over a right one, and falls back to a centre part.
 */
export function autoRig(parts: RigPart[]): RigPart[] {
  const findKind = (kind: RigPartKind, side: RigSide): RigPart | undefined =>
    parts.find((p) => p.kind === kind && (p.side === side || p.side === 'center')) ||
    parts.find((p) => p.kind === kind && p.side === 'center') ||
    parts.find((p) => p.kind === kind)

  return parts.map((part) => {
    if (part.parentId) return part
    const parentKind = DEFAULT_HIERARCHY[part.kind]
    if (!parentKind) return part
    const parent = findKind(parentKind, part.side)
    if (!parent || parent.id === part.id) return part
    // A part may only be parented to something outside its own subtree.
    if (wouldCycle({ id: 'probe', name: '', parts, createdAt: 0, updatedAt: 0 }, part.id, parent.id)) {
      return part
    }
    return { ...part, parentId: parent.id }
  })
}

/** Parts sorted back-to-front for painting. */
export function paintOrder(parts: RigPart[]): RigPart[] {
  return [...parts].sort((a, b) => (a.z || 0) - (b.z || 0))
}

/** Normalise z values to 0..n-1 after reordering, keeping the sequence dense. */
export function normaliseZ(parts: RigPart[]): RigPart[] {
  const ordered = paintOrder(parts)
  const zById = new Map(ordered.map((p, i) => [p.id, i]))
  return parts.map((p) => ({ ...p, z: zById.get(p.id) ?? p.z }))
}

/**
 * Suggest a name for a new part, including the L/R convention segmenters rely
 * on so the animator can tell a left arm from a right one at a glance.
 */
export function suggestPartName(parts: RigPart[], kind: RigPartKind, side: RigSide): string {
  const base = PART_LABELS[kind]
  const suffix = side === 'left' ? ' L' : side === 'right' ? ' R' : ''
  const candidate = `${base}${suffix}`
  const taken = new Set(parts.map((p) => p.name))
  if (!taken.has(candidate)) return candidate
  let n = 2
  while (taken.has(`${candidate} ${n}`)) n++
  return `${candidate} ${n}`
}
