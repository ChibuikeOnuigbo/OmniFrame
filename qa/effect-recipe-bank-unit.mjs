import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { loadAppTs } from '../tools/mcp/appRender.mjs'

const catalog = await loadAppTs('src/lib/effectCatalog.ts')
const bank = await loadAppTs('src/lib/effectRecipeBank.ts')

assert.equal(catalog.getFxCatalog().length, 10_623, 'curated/materialized catalog baseline')
assert.equal(bank.GENERATED_RECIPE_COUNT, 139_425, 'indexed recipe bank size')
assert.equal(catalog.fxCatalogCount(), 150_048, 'base catalog remains above 150k without the optional authored pack')

const categorySum = catalog.FX_CATS
  .filter((category) => category.id !== 'all')
  .reduce((sum, category) => sum + catalog.fxCatalogCount(category.id), 0)
assert.equal(categorySum, 150_048, 'category counts partition the catalog')

const lastPage = catalog.queryFxCatalog({ offset: 150_047, limit: 1 })
assert.equal(lastPage.total, 150_048)
assert.equal(lastPage.entries[0].id, 'ofx-139425', 'last indexed recipe is reachable through paging')
assert.deepEqual(catalog.fxCatalogById('ofx-139425'), lastPage.entries[0], 'ID lookup reconstructs the paged recipe')
assert.equal(catalog.queryFxCatalog({ collection: 'generated', limit: 0 }).total, 139_425, 'generated collection count')
assert.equal(catalog.queryFxCatalog({ collection: 'curated', limit: 0 }).total, 10_623, 'curated collection stays separately measurable')

const seen = new Set()
const signatures = new Set()
for (let index = 0; index < bank.GENERATED_RECIPE_COUNT; index++) {
  const entry = bank.generatedRecipeAt(index)
  assert.ok(entry, `recipe ${index + 1} exists`)
  assert.ok(!seen.has(entry.id), `recipe ${entry.id} is unique`)
  seen.add(entry.id)
  if (index < 240) signatures.add(JSON.stringify(entry.patch))
}
assert.equal(seen.size, 139_425, 'all generated IDs are unique')
assert.ok(signatures.size > 220, 'sampled parameter patches vary materially')

const bokeh = catalog.queryFxCatalog({ q: 'lens bokeh', limit: 40 })
assert.ok(bokeh.total > 7_000, 'search indexes the generated lens family')
assert.ok(bokeh.entries.some((entry) => entry.id.startsWith('ofx-') && entry.patch.lensBokeh > 0), 'search returns editable bokeh patches')
const described = bank.generatedRecipeAt(0)
const descriptor = described.name.split(' · ')[1]
assert.ok(catalog.queryFxCatalog({ collection: 'generated', q: descriptor, limit: 20 }).entries.some((entry) => entry.id === described.id), 'displayed parameter descriptors are searchable')

for (let family = 0; family < bank.GENERATED_RECIPE_FAMILIES.length; family++) {
  const entry = bank.generatedRecipeAt(family)
  const params = catalog.paramsForPatch(entry.patch)
  assert.ok(params.length >= 6, `${entry.name} exposes editable controls`)
  assert.ok(params.some((param) => param.kind === 'number'), `${entry.name} exposes keyframeable numeric controls`)
}

const start = performance.now()
for (let page = 0; page < 20; page++) catalog.queryFxCatalog({ q: page % 2 ? 'motion' : 'light', offset: page * 60, limit: 60 })
const elapsed = performance.now() - start
assert.ok(elapsed < 1500, `20 indexed searches stay bounded (${elapsed.toFixed(1)} ms)`)

console.log(`effect-recipe-bank-unit: 150048 base recipes, 139425 indexed IDs, ${bank.GENERATED_RECIPE_FAMILIES.length} generated families PASS (${elapsed.toFixed(1)} ms search sweep)`)
