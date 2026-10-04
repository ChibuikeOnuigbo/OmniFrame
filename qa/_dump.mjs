import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync('qa/reports/ui-strict-audit.json','utf8'));
const items = j.unique ?? j.all ?? [];
console.log('top-level keys:', Object.keys(j));
console.log('finding keys  :', Object.keys(items[0] ?? {}));
for (const rule of ['C01','C02','D06']) {
  const g = items.filter(f => (f.rule ?? f.id ?? '').startsWith(rule));
  console.log(`\n===== ${rule}  (${g.length}) =====`);
  const seen = new Set();
  for (const f of g) {
    const key = JSON.stringify(f, Object.keys(f).sort());
    if (seen.has(key)) continue;
    seen.add(key);
    console.log('  -', JSON.stringify(f).slice(0, 420));
  }
}
