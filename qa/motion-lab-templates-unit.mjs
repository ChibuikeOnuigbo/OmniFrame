import assert from 'node:assert/strict'
import { BUILTIN_TEMPLATES, MOTION_LAB_TEMPLATES, TEMPLATE_CATEGORIES, searchTemplates } from '../src/lib/templatePresets.ts'

assert.equal(MOTION_LAB_TEMPLATES.length, 201, 'Motion Lab contains 201 original recipes')
assert.equal(new Set(MOTION_LAB_TEMPLATES.map((template) => template.id)).size, 201, 'recipe ids are unique')
assert.equal(new Set(MOTION_LAB_TEMPLATES.map((template) => template.name)).size, 201, 'recipe names are unique')
assert.ok(BUILTIN_TEMPLATES.length >= 205, 'legacy templates remain available')
assert.ok(TEMPLATE_CATEGORIES.length >= 16, 'broad motion-design category coverage')

for (const template of MOTION_LAB_TEMPLATES) {
  assert.equal(template.origin, 'omniframe-original')
  assert.ok(template.category, `${template.id} category`)
  assert.ok(template.duration >= 4 && template.duration <= 10, `${template.id} duration`)
  assert.ok(['16:9', '9:16', '1:1', '4:5'].includes(template.aspect), `${template.id} aspect`)
  assert.equal(template.palette.length, 3, `${template.id} palette`)
  assert.ok(template.motion, `${template.id} motion`)
  assert.ok(template.backdrop, `${template.id} backdrop`)
  assert.ok(template.slots.length >= 2, `${template.id} editable slots`)
  assert.equal(new Set(template.slots.map((slot) => slot.id)).size, template.slots.length, `${template.id} slot ids`)
}

assert.ok(searchTemplates('chart').some((template) => template.category === 'Data'), 'tag search finds data recipes')
assert.ok(searchTemplates('vertical').some((template) => template.aspect === '9:16'), 'tag search finds vertical recipes')
assert.ok(searchTemplates('', 'Maps').every((template) => template.category === 'Maps'), 'category filter is exact')
assert.equal(searchTemplates('no-template-can-match-this-string').length, 0, 'empty search result')

const motions = new Set(MOTION_LAB_TEMPLATES.map((template) => template.motion))
assert.equal(motions.size, 12, 'all twelve editable entrance families are represented')
console.log(`PASS ${MOTION_LAB_TEMPLATES.length} original recipes, ${TEMPLATE_CATEGORIES.length} categories and ${motions.size} motion families`)
