/**
 * Unit tests for the rigging engine (src/lib/rigging.ts).
 *
 * These are pure-maths tests, deliberately: hierarchy composition, pivot
 * rotation, bend sampling and cycle detection are where a rig silently
 * produces wrong motion, and none of them need a DOM to check.
 *
 * Usage: node qa/rigging-unit.mjs
 */

import {
  autoRig,
  composeTransforms,
  descendantsOf,
  identityTransform,
  normaliseZ,
  paintOrder,
  resolveRig,
  rotateAboutPivot,
  sampleBend,
  sampleWind,
  suggestPartName,
  wouldCycle,
} from '../src/lib/rigging.ts'

let passed = 0
let failed = 0
const failures = []

function ok(name, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    failures.push(name + (detail ? ` — ${detail}` : ''))
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

const part = (over = {}) => ({
  id: 'p',
  name: 'P',
  kind: 'custom',
  side: 'center',
  cutoutUrl: '',
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  pivot: { x: 0.5, y: 0.5 },
  parentId: null,
  z: 0,
  transform: identityTransform(),
  ...over,
})

const rig = (parts) => ({ id: 'r', name: 'R', parts, createdAt: 0, updatedAt: 0 })

console.log('=== rigging engine ===')

// --- hierarchy -----------------------------------------------------------
{
  // The core promise: move the parent, the child follows without being touched.
  const r = rig([
    part({ id: 'shoulder', name: 'Shoulder', z: 0 }),
    part({ id: 'forearm', name: 'Forearm', parentId: 'shoulder', z: 1 }),
    part({ id: 'hand', name: 'Hand', parentId: 'forearm', z: 2 }),
  ])
  const before = resolveRig(r)
  const handBefore = before.find((x) => x.part.id === 'hand').world

  const moved = rig(r.parts.map((p) => (p.id === 'shoulder' ? { ...p, transform: { ...p.transform, x: 100 } } : p)))
  const after = resolveRig(moved)
  const handAfter = after.find((x) => x.part.id === 'hand').world

  ok('child inherits parent translation', near(handAfter.x, handBefore.x + 100),
     `expected ${handBefore.x + 100}, got ${handAfter.x}`)
  ok('own transform of child unchanged', near(after.find((x) => x.part.id === 'hand').part.transform.x, 0))
  ok('chain is root-first', after.find((x) => x.part.id === 'hand').chain.join('>') === 'shoulder>forearm>hand',
     after.find((x) => x.part.id === 'hand').chain.join('>'))
}

{
  // Rotating a parent must carry the child around the parent's pivot, not
  // translate it along world axes. This is the classic rigging bug.
  const r = rig([
    part({ id: 'torso', bounds: { x: 0, y: 0, width: 1, height: 1 }, pivot: { x: 0.5, y: 0.5 } }),
    part({ id: 'head', parentId: 'torso', transform: { ...identityTransform(), y: -50 } }),
  ])
  const rotated = rig(r.parts.map((p) => (p.id === 'torso' ? { ...p, transform: { ...p.transform, rotation: 90 } } : p)))
  const head = resolveRig(rotated).find((x) => x.part.id === 'head').world
  // A point 50 above the origin, rotated 90deg, lands 50 to the right.
  ok('child rotation follows parent pivot', near(head.x, 50, 1e-6) && near(head.y, 0, 1e-6),
     `got (${head.x.toFixed(3)}, ${head.y.toFixed(3)}), expected (50, 0)`)
}

{
  // Scale must compound down the chain.
  const r = rig([
    part({ id: 'a', transform: { ...identityTransform(), scale: 2 } }),
    part({ id: 'b', parentId: 'a', transform: { ...identityTransform(), scale: 3 } }),
  ])
  const b = resolveRig(r).find((x) => x.part.id === 'b').world
  ok('scale compounds down the chain', near(b.scale, 6), `expected 6, got ${b.scale}`)
}

{
  // Hiding a parent hides everything below it.
  const r = rig([
    part({ id: 'a', transform: { ...identityTransform(), opacity: 0.5 } }),
    part({ id: 'b', parentId: 'a', transform: { ...identityTransform(), opacity: 0.5 } }),
  ])
  const b = resolveRig(r).find((x) => x.part.id === 'b').world
  ok('opacity multiplies down the chain', near(b.opacity, 0.25), `expected 0.25, got ${b.opacity}`)
}

// --- robustness ----------------------------------------------------------
{
  // A dangling parent id must not crash or drop the part.
  const r = rig([part({ id: 'orphan', parentId: 'does-not-exist' })])
  let out
  try { out = resolveRig(r) } catch (e) { out = null }
  ok('dangling parent id is treated as root', !!out && out.length === 1 && near(out[0].world.x, 0))
}

{
  // A cycle must terminate rather than blow the stack.
  const r = rig([
    part({ id: 'a', parentId: 'b' }),
    part({ id: 'b', parentId: 'a' }),
  ])
  let out
  try { out = resolveRig(r) } catch (e) { out = null }
  ok('cycle terminates instead of recursing forever', !!out && out.length === 2)
}

{
  const r = rig([
    part({ id: 'a' }),
    part({ id: 'b', parentId: 'a' }),
    part({ id: 'c', parentId: 'b' }),
  ])
  ok('wouldCycle: self-parent is a cycle', wouldCycle(r, 'a', 'a') === true)
  ok('wouldCycle: parenting under own child is a cycle', wouldCycle(r, 'a', 'b') === true)
  ok('wouldCycle: parenting under own descendant is a cycle', wouldCycle(r, 'a', 'c') === true)
  ok('wouldCycle: parenting under an unrelated part is fine', wouldCycle(r, 'a', null) === false)
  ok('descendantsOf finds the whole subtree',
     descendantsOf(r, 'a').map((p) => p.id).sort().join(',') === 'b,c')
}

// --- pivots --------------------------------------------------------------
{
  // Rotation happens about the pivot: the pivot itself must not move.
  const p = rotateAboutPivot(10, 10, 10, 10, 45)
  ok('pivot point is stationary under rotation', near(p.x, 10) && near(p.y, 10))
  const q = rotateAboutPivot(20, 10, 10, 10, 90)
  ok('point rotates 90deg about pivot', near(q.x, 10, 1e-9) && near(q.y, 20, 1e-9),
     `got (${q.x.toFixed(3)}, ${q.y.toFixed(3)}), expected (10, 20)`)
  const z = rotateAboutPivot(20, 10, 10, 10, 0)
  ok('zero rotation is a no-op', near(z.x, 20) && near(z.y, 10))
}

{
  // Pivots resolve into character space, offset by bounds.
  const r = rig([
    part({ id: 'arm', bounds: { x: 0.5, y: 0.25, width: 0.2, height: 0.4 }, pivot: { x: 0.5, y: 0.1 } }),
  ])
  const resolved = resolveRig(r)[0]
  ok('pivot resolves into character space',
     near(resolved.pivotWorld.x, 0.6) && near(resolved.pivotWorld.y, 0.29),
     `got (${resolved.pivotWorld.x}, ${resolved.pivotWorld.y}), expected (0.6, 0.29)`)
}

// --- bend ----------------------------------------------------------------
{
  const bend = { angle: 90, start: 0.2, end: 0.8 }
  ok('bend is zero before the bend region', sampleBend(bend, 0.1) === 0)
  ok('bend is full after the bend region', near(sampleBend(bend, 0.9), 90))
  ok('bend eases through the middle (smoothstep)',
     near(sampleBend(bend, 0.5), 45, 1e-6), `expected 45 at midpoint, got ${sampleBend(bend, 0.5)}`)
  ok('bend is monotonic', (() => {
    let prev = -1
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = sampleBend(bend, t)
      if (v < prev - 1e-9) return false
      prev = v
    }
    return true
  })())
  ok('no bend config means no rotation', sampleBend(undefined, 0.5) === 0)
  ok('zero-angle bend is a no-op', sampleBend({ angle: 0, start: 0, end: 1 }, 0.5) === 0)
}

// --- wind ----------------------------------------------------------------
{
  ok('disabled wind returns zero', sampleWind({ enabled: false, amplitude: 20, frequency: 1, lag: 0.5, bias: 0 }, 1, 1) === 0)
  const w = { enabled: true, amplitude: 10, frequency: 1, lag: 0.5, bias: 0 }
  ok('wind output stays within amplitude bounds', (() => {
    for (let t = 0; t < 5; t += 0.01) {
      if (Math.abs(sampleWind(w, t, 2)) > 10 * 2.5 + 1e-9) return false
    }
    return true
  })())
  ok('wind bias is applied', sampleWind({ ...w, amplitude: 0, bias: 15 }, 0, 0) === 15)
  // Comparing |sin| at one instant proves nothing about the envelope -- the
  // phase differs by depth. Compare peaks over a full cycle instead.
  ok('deeper parts sway further', (() => {
    const peak = (depth) => {
      let m = 0
      for (let t = 0; t < 2; t += 0.001) m = Math.max(m, Math.abs(sampleWind(w, t, depth)))
      return m
    }
    return peak(3) > peak(0)
  })())
}

// --- auto-rig ------------------------------------------------------------
{
  const parts = [
    part({ id: 'torso', kind: 'torso' }),
    part({ id: 'upperL', kind: 'armUpper', side: 'left' }),
    part({ id: 'lowerL', kind: 'armLower', side: 'left' }),
    part({ id: 'handL', kind: 'hand', side: 'left' }),
  ]
  const out = autoRig(parts)
  const byId = Object.fromEntries(out.map((p) => [p.id, p]))
  ok('autoRig links forearm to upper arm', byId.lowerL.parentId === 'upperL', String(byId.lowerL.parentId))
  ok('autoRig links hand to forearm', byId.handL.parentId === 'lowerL', String(byId.handL.parentId))
  ok('autoRig links upper arm to torso', byId.upperL.parentId === 'torso', String(byId.upperL.parentId))
  ok('autoRig leaves the torso as root', byId.torso.parentId === null)
  ok('autoRig result has no cycles', !out.some((p) => wouldCycle(rig(out), p.id, p.parentId)))
}

{
  // A user's manual link must survive auto-rig.
  const parts = [
    part({ id: 'torso', kind: 'torso' }),
    part({ id: 'head', kind: 'head', parentId: 'torso' }),
  ]
  const out = autoRig(parts)
  ok('autoRig preserves existing parents', out.find((p) => p.id === 'head').parentId === 'torso')
}

{
  // Left/right must not cross: a left forearm prefers the left upper arm.
  const parts = [
    part({ id: 'upperR', kind: 'armUpper', side: 'right' }),
    part({ id: 'upperL', kind: 'armUpper', side: 'left' }),
    part({ id: 'lowerL', kind: 'armLower', side: 'left' }),
    part({ id: 'lowerR', kind: 'armLower', side: 'right' }),
  ]
  const out = autoRig(parts)
  const byId = Object.fromEntries(out.map((p) => [p.id, p]))
  ok('autoRig matches side, not just kind',
     byId.lowerL.parentId === 'upperL' && byId.lowerR.parentId === 'upperR',
     `L->${byId.lowerL.parentId}, R->${byId.lowerR.parentId}`)
}

// --- ordering & naming ---------------------------------------------------
{
  const parts = [
    part({ id: 'c', z: 5 }),
    part({ id: 'a', z: 0 }),
    part({ id: 'b', z: 3 }),
  ]
  ok('paintOrder sorts back to front', paintOrder(parts).map((p) => p.id).join(',') === 'a,b,c')
  const norm = normaliseZ(parts)
  ok('normaliseZ keeps relative order',
     paintOrder(norm).map((p) => p.id).join(',') === 'a,b,c')
  ok('normaliseZ produces dense indices',
     norm.map((p) => p.z).sort().join(',') === '0,1,2', norm.map((p) => p.z).join(','))
}

{
  ok('suggestPartName uses the L/R convention',
     suggestPartName([], 'armUpper', 'left') === 'Upper Arm L')
  ok('suggestPartName marks the right side too',
     suggestPartName([], 'armUpper', 'right') === 'Upper Arm R')
  const taken = [part({ id: 'a', name: 'Upper Arm L' })]
  ok('suggestPartName disambiguates duplicates',
     suggestPartName(taken, 'armUpper', 'left') === 'Upper Arm L 2',
     suggestPartName(taken, 'armUpper', 'left'))
  ok('suggestPartName omits suffix for centre parts',
     suggestPartName([], 'torso', 'center') === 'Torso')
}

// --- composeTransforms edge cases ---------------------------------------
{
  const id = identityTransform()
  const t = { ...identityTransform(), x: 10, y: 20, rotation: 30 }
  ok('composing with identity is a no-op', (() => {
    const c = composeTransforms(id, t)
    return near(c.x, 10) && near(c.y, 20) && near(c.rotation, 30)
  })())
  ok('composing two identities is identity', (() => {
    const c = composeTransforms(id, id)
    return near(c.x, 0) && near(c.y, 0) && near(c.scale, 1) && near(c.rotation, 0)
  })())
}

console.log(`\n=== ${passed} passed / ${failed} failed ===`)
if (failed) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
