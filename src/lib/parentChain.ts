import type { ClipTransform, GroupInstance, ParentRelationship } from '../types'

/**
 * Null-object / parenting math (research: Study_edits_videos/null-group-research.md).
 *
 * AE semantics implemented here:
 *  - a child's transform becomes relative to its parent (one-way, hierarchy chains),
 *  - inheritance is gated per link by inheritPosition / inheritRotation / inheritScale
 *    (AE: opacity never inherits — we never touch it here),
 *  - cycles are impossible (chain builder stops on revisit),
 *  - layer/track order is irrelevant (Alight Motion rule): we follow relationships only.
 */

export interface WorldAccum {
  x: number
  y: number
  rot: number
  sx: number
  sy: number
}

const IDENTITY: WorldAccum = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }

/** Root→direct-parent id chain for a clip (cycle-safe). */
export function buildParentChain(rels: ParentRelationship[], clipId: string): string[] {
  const chain: string[] = []
  const seen = new Set([clipId])
  let cur = clipId
  for (;;) {
    const rel = rels.find((r) => r.childId === cur)
    if (!rel || seen.has(rel.parentId)) break
    chain.unshift(rel.parentId)
    seen.add(rel.parentId)
    cur = rel.parentId
  }
  return chain
}

/**
 * Accumulated world motion a clip's CHILDREN inherit: the parent hierarchy's
 * evaluated transforms, gated link-by-link by the relationship flags, plus each
 * link's localOffset. `evalTransform` supplies the evaluated local transform
 * (keyframes included) for a clip id — kept injected so this module stays pure
 * and unit-testable without the playback engine.
 */
export function accumParentWorld(
  rels: ParentRelationship[],
  evalTransform: (clipId: string) => ClipTransform,
  clipId: string,
): WorldAccum {
  const rel = rels.find((r) => r.childId === clipId)
  const local = evalTransform(clipId)
  if (!rel) return { x: local.x, y: local.y, rot: local.rotation, sx: local.scale, sy: local.scale }
  const up = accumParentWorld(rels, evalTransform, rel.parentId)
  const base: WorldAccum = {
    x: rel.inheritPosition ? up.x + (rel.localOffset?.x || 0) : 0,
    y: rel.inheritPosition ? up.y + (rel.localOffset?.y || 0) : 0,
    rot: rel.inheritRotation ? up.rot + (rel.localOffset?.rotation || 0) : 0,
    sx: rel.inheritScale ? up.sx * (rel.localOffset?.scale || 1) : 1,
    sy: rel.inheritScale ? up.sy * (rel.localOffset?.scale || 1) : 1,
  }
  return { x: base.x + local.x, y: base.y + local.y, rot: base.rot + local.rotation, sx: base.sx * local.scale, sy: base.sy * local.scale }
}

/** World motion inherited BY `clipId` from its parent chain (what the renderer pre-applies). */
export function inheritedWorld(
  rels: ParentRelationship[],
  evalTransform: (clipId: string) => ClipTransform,
  clipId: string,
): WorldAccum {
  const rel = rels.find((r) => r.childId === clipId)
  if (!rel) return { ...IDENTITY }
  const up = accumParentWorld(rels, evalTransform, rel.parentId)
  return {
    x: rel.inheritPosition ? up.x + (rel.localOffset?.x || 0) : 0,
    y: rel.inheritPosition ? up.y + (rel.localOffset?.y || 0) : 0,
    rot: rel.inheritRotation ? up.rot + (rel.localOffset?.rotation || 0) : 0,
    sx: rel.inheritScale ? up.sx * (rel.localOffset?.scale || 1) : 1,
    sy: rel.inheritScale ? up.sy * (rel.localOffset?.scale || 1) : 1,
  }
}

/* ---------------- CapCut-style groups ---------------- */

/** Clicking any member selects the whole group (CapCut/Shotcut selection rule). */
export function expandGroupSelection(groups: GroupInstance[], ids: string[]): string[] {
  const out = new Set(ids)
  for (const g of groups) {
    if (g.memberIds.some((m) => out.has(m))) for (const m of g.memberIds) out.add(m)
  }
  return [...out]
}

/** Groups never overlap: strip the new members out of existing groups, drop emptied ones. */
export function regroupFor(groups: GroupInstance[], memberIds: string[]): GroupInstance[] {
  const members = new Set(memberIds)
  return groups
    .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => !members.has(m)) }))
    .filter((g) => g.memberIds.length > 0)
}
