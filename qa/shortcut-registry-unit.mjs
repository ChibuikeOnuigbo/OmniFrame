import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadAppTs } from '../tools/mcp/appRender.mjs'

const registry = await loadAppTs('src/lib/settingsRegistry.ts')
const storeSource = readFileSync('src/store.ts', 'utf8')

assert.ok(registry.EDITABLE_SHORTCUTS.length >= 40, 'at least forty configurable editing commands')
assert.match(storeSource, /DEFAULT_SHORTCUTS[^=]*=\s*\{\s*\.\.\.EDITABLE_SHORTCUT_DEFAULTS\s*\}/, 'runtime defaults come from the settings registry')
assert.equal(new Set(registry.EDITABLE_SHORTCUTS.map((item) => item.id)).size, registry.EDITABLE_SHORTCUTS.length, 'shortcut action IDs are unique')

const event = (key, options = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...options })
assert.ok(registry.shortcutMatches(event('b', { ctrlKey: true }), 'Ctrl+B'))
assert.ok(registry.shortcutMatches(event('b', { metaKey: true }), 'Ctrl+B'), 'Command activates Ctrl bindings on macOS')
assert.ok(!registry.shortcutMatches(event('b'), 'Ctrl+B'), 'modifiers match exactly')
assert.ok(registry.shortcutMatches(event('Z', { ctrlKey: true, shiftKey: true }), 'Ctrl+Y / Ctrl+Shift+Z'), 'alternative chords work')
assert.ok(registry.shortcutMatches(event(' ', {}), 'Space'))
assert.ok(registry.shortcutMatches(event('Backspace'), 'Delete / Backspace'))
assert.ok(registry.shortcutMatches(event('+', { shiftKey: true }), 'Shift+='), 'shift-produced symbols normalize to physical key labels')
assert.ok(registry.shortcutMatches(event('?', { shiftKey: true }), 'Shift+/'), 'help shortcut handles question-mark key output')
assert.ok(!registry.shortcutMatches(event('e', { shiftKey: true }), ''), 'cleared binding is disabled')

const searchable = registry.searchSettings('previous marker')
assert.ok(searchable.some((item) => item.id === 'shortcut.prevMarker'), 'new shortcuts are indexed in Settings search')
assert.ok(registry.SETTINGS_REGISTRY.filter((item) => item.category === 'shortcuts').every((item) => item.scope === 'user' && item.persistent), 'shortcut settings are user-persistent')

console.log(`shortcut-registry-unit: ${registry.EDITABLE_SHORTCUTS.length} persistent configurable commands PASS`)
