import assert from 'node:assert/strict'
import { loadAppTs } from '../tools/mcp/appRender.mjs'
const { fxCatalogById, queryFxCatalog, paramsForPatch } = await loadAppTs('src/lib/effectCatalog.ts')
const old = ['dblur-0','dblur-45','dblur-90','dblur-135','dblur-180','dblur-225','dblur-270','dblur-315','blur-horizontal','blur-vertical','blur-oblique']
const browse = queryFxCatalog({collection:'curated',cat:'blur',limit:1000})
assert.ok(browse.entries.some(e=>e.id==='directional-blur'))
assert.ok(!browse.entries.some(e=>old.includes(e.id)))
for(const id of old) assert.ok(fxCatalogById(id), 'old projects retain '+id)
for(const q of ['vertical blur','horizontal blur','oblique','diagonal']) assert.ok(queryFxCatalog({collection:'essentials',q}).entries.some(e=>e.id==='directional-blur'), q+' discovers parent')
assert.equal(queryFxCatalog({collection:'favorites',favorites:old}).total,old.length)
for(const id of ['blur-fan','blur-light-streak','essential-box-blur']) assert.ok(browse.entries.some(e=>e.id===id), 'distinct effect retained '+id)
assert.ok(paramsForPatch(fxCatalogById('directional-blur').patch).some(p=>p.key==='directionalBlurAngle'))
console.log('PASS 11 angle-only cards consolidated into parent controls; legacy IDs, favorites, search and distinct effects retained')
