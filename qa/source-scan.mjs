/**
 * Source-level scan for defects that never show up in the DOM.
 *
 * These are the things a reviewer catches by reading the code: colours
 * bypassing the theme, debug output left in, exceptions swallowed, list items
 * without keys, and unfinished work marked in comments. Each is reported with
 * file and line so it can be argued with.
 *
 * Usage: node qa/source-scan.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SRC = path.resolve('src')

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const files = walk(SRC)
const findings = []
const add = (rule, sev, file, line, evidence) =>
  findings.push({ rule, sev, file: path.relative(ROOT, file), line, evidence: String(evidence).slice(0, 140) })

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((raw, i) => {
    const line = i + 1
    const code = raw.trim()
    if (!code) return
    if (/^\s*(\/\/|\*|\/\*)/.test(code)) {
      // S03 unfinished work markers
      if (/\bTODO\b|\bFIXME\b|\bXXX\b|\bHACK\b/.test(raw)) add('S03', 'low', file, line, code.slice(0, 90))
      return
    }

    // S01 debug output left in production code.
    if (/\bconsole\.(log|debug|info|warn)\s*\(/.test(raw)) add('S01', 'medium', file, line, code.slice(0, 90))

    // S02 exception swallowed with an empty or comment-only catch.
    if (/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(raw)) {
      add('S02', 'high', file, line, 'empty catch block swallows the error')
    }
    if (/}\s*catch\s*\(/.test(raw)) {
      const body = (lines[i + 1] || '') + (lines[i + 2] || '')
      if (/^\s*\}\s*$/.test(lines[i + 1] || '') || /^\s*(\/\/[^*])?\s*\}\s*$/.test(lines[i + 1] || '')) {
        if (!/\S/.test(body.replace(/[{}]/g, '').replace(/\/\/.*/, ''))) {
          add('S02', 'high', file, line, 'empty catch block swallows the error')
        }
      }
    }

    // S04 hardcoded colour bypassing the theme tokens, in UI components only.
    // Logic modules (.ts) legitimately need literal colours for canvas pixels,
    // gradients and video processing, so they are out of scope. A line holding
    // several hexes is a palette or gradient, which is also intentional.
    if (file.endsWith('.tsx')) {
      const hexes = raw.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)
      if (hexes && hexes.length === 1) {
        add('S04', 'medium', file, line, `hardcoded colour ${hexes[0]} instead of a theme token`)
      }
    }

    // S06 inline onClick doing real work: hard to test, hard to reuse.
    if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{[^}]{80,}/.test(raw)) {
      add('S06', 'low', file, line, 'large inline onClick handler')
    }

    // S07 non-null assertion: a crash waiting for a refactor.
    const asserts = raw.match(/\w!\./g)
    if (asserts) add('S07', 'low', file, line, `${asserts.length} non-null assertion(s)`)

    // S08 dangerouslySetInnerHTML without sanitising.
    if (/dangerouslySetInnerHTML/.test(raw)) add('S08', 'high', file, line, 'dangerouslySetInnerHTML')

    // S09 setTimeout with no cleanup partner in the same file.
    if (/setTimeout\s*\(/.test(raw) && !/clearTimeout/.test(source)) {
      add('S09', 'medium', file, line, 'setTimeout with no clearTimeout anywhere in the file')
    }
  })

  if (file.endsWith('.tsx')) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const jsxReturns = (expression) => {
      if (ts.isParenthesizedExpression(expression)) return jsxReturns(expression.expression)
      if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return [expression]
      if (ts.isConditionalExpression(expression)) return [...jsxReturns(expression.whenTrue), ...jsxReturns(expression.whenFalse)]
      return []
    }
    const hasKey = (jsx) => {
      if (ts.isJsxFragment(jsx)) return false
      const opening = ts.isJsxElement(jsx) ? jsx.openingElement : jsx
      return opening.attributes.properties.some((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.text === 'key')
    }
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map') {
        const callback = node.arguments[0]
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const returns = []
          if (ts.isBlock(callback.body)) {
            const collect = (child) => {
              if (ts.isReturnStatement(child) && child.expression) returns.push(...jsxReturns(child.expression))
              else if (!ts.isFunctionLike(child)) ts.forEachChild(child, collect)
            }
            ts.forEachChild(callback.body, collect)
          } else returns.push(...jsxReturns(callback.body))
          if (returns.some((jsx) => !hasKey(jsx))) {
            add('S05', 'medium', file, tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
              '.map() returns JSX without a key prop')
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
}

// Dedupe identical rule+file+line.
const seen = new Set()
const uniq = findings.filter((f) => {
  const k = `${f.rule}|${f.file}|${f.line}`
  if (seen.has(k)) return false
  seen.add(k); return true
})

const byRule = {}
for (const f of uniq) byRule[f.rule] = (byRule[f.rule] || 0) + 1

console.log('=== Source Scan ===')
console.log(`files scanned: ${files.length}`)
console.log('\n--- totals by rule ---')
for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(5)} ${String(v).padStart(4)}`)
}
console.log(`\ntotal: ${uniq.length}`)

if (!process.argv.includes('--no-write')) {
  const out = path.join(ROOT, 'qa/reports/source-scan.json')
  fs.writeFileSync(out, JSON.stringify({ totals: { files: files.length, findings: uniq.length }, byRule, findings: uniq }, null, 2))
  console.log(`Wrote ${out}`)
}
if (process.argv.includes('--fail-on-high') && uniq.some(f => f.sev === 'high')) process.exitCode = 1
