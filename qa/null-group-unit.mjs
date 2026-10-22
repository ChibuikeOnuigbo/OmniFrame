// Unit QA for null-object parenting math + CapCut group selection rules.
// Transforms src/lib/parentChain.ts with sucrase (no browser needed).
import { transform } from 'sucrase'
import { readFileSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const src = readFileSync(new URL('../src/lib/parentChain.ts', import.meta.url), 'utf8')
const dir = mkdtempSync(join(tmpdir(), 'omni-pc-'))
const bundle = join(dir, 'parentChain.mjs')
writeFileSync(bundle, transform(src, { transforms: ['typescript'] }).code)
const { buildParentChain, inheritedWorld, accumParentWorld, expandGroupSelection, regroupFor } = await import(bundle)

let fails = 0
const ok = (name, cond) => { if (!cond) { fails++; console.log('FAIL', name) } else console.log('ok', name) }

const rel = (childId, parentId, flags = {}) => ({
  childId, parentId,
  inheritPosition: flags.pos ?? true,
  inheritRotation: flags.rot ?? true,
  inheritScale: flags.scale ?? true,
  localOffset: { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
})
const T = (o = {}) => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ...o })

// chain
const rels = [rel('b', 'a'), rel('c', 'b')]
ok('chain root→parent', JSON.stringify(buildParentChain(rels, 'c')) === JSON.stringify(['a', 'b']))
ok('chain no parent', buildParentChain(rels, 'a').length === 0)
const cyc = [rel('a', 'b'), rel('b', 'a')]
ok('cycle safe', buildParentChain(cyc, 'a').length <= 2)

// inheritance gating
const evals = { a: T({ x: 10, y: 5, scale: 2, rotation: 30 }), b: T(), c: T() }
const ev = (id) => evals[id]
let w = inheritedWorld([rel('c', 'b'), rel('b', 'a')], ev, 'c')
ok('pos+scale+rot inherit through 2 links', w.x === 10 && w.sx === 2 && w.rot === 30)
w = inheritedWorld([rel('c', 'b'), rel('b', 'a', { scale: false })], ev, 'c')
ok('scale gate stops scale only', w.x === 10 && w.sx === 1 && w.rot === 30)
w = inheritedWorld([rel('c', 'b'), rel('b', 'a', { pos: false, rot: false, scale: false })], ev, 'c')
ok('all gates off = identity', w.x === 0 && w.sx === 1 && w.rot === 0)
ok('no opacity channel in world accum', !('opacity' in w))
w = inheritedWorld([], ev, 'c')
ok('unparented = identity', w.x === 0 && w.sx === 1)

// localOffset rides the link
w = inheritedWorld([rel('c', 'b', {}), rel('b', 'a')], { ...ev, b: T() } && ((id) => id === 'b' ? T({ x: 1 }) : evals[id]), 'c')
ok('localOffset/parent local compose', w.x === 11)

// groups
const groups = [{ id: 'g1', name: 'G1', memberIds: ['a', 'b'], collapsed: false, locked: false, hidden: false }]
const exp = expandGroupSelection(groups, ['b'])
ok('member click expands to group', new Set(exp).size === 2 && exp.includes('a') && exp.includes('b'))
ok('non-member selection untouched', expandGroupSelection(groups, ['z']).length === 1)
const rg = regroupFor(groups, ['b'])
ok('regroup strips overlap', rg.length === 1 && rg[0].memberIds.join() === 'a')
ok('regroup drops emptied', regroupFor(groups, ['a', 'b']).length === 0)

console.log(fails ? `${fails} failures` : 'NULL/GROUP UNIT QA: PASS')
process.exit(fails ? 1 : 0)
