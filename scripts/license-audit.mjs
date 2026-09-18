import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lockPath = path.join(root, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const allowed = new Set(['MIT', 'MIT*', 'MIT-0', 'Apache-2.0', 'Apache-2.0 OR MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'CC0-1.0', 'Python-2.0']);
const review = new Set(['LGPL-2.1+', 'LGPL-3.0', 'MPL-2.0', 'GPL-2.0', 'GPL-3.0', 'CC-BY-4.0']);
const blocked = new Set(['AGPL-3.0', 'CC-BY-NC-4.0', 'UNLICENSED', 'UNKNOWN', '']);
const issues = [];
const reviewed = [];
for (const [location, meta] of Object.entries(lock.packages ?? {})) {
  if (!location || location === '') continue;
  const name = location.replace(/^node_modules\//, '');
  let licence = typeof meta.license === 'string' ? meta.license : 'UNKNOWN';
  const resolved = typeof meta.resolved === 'string' ? meta.resolved : '';
  if (location === 'apps/web' || resolved === 'apps/web') licence = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/package.json'), 'utf8')).license ?? licence;
  if (location === 'packages/engine' || resolved === 'packages/engine') licence = JSON.parse(fs.readFileSync(path.join(root, 'packages/engine/package.json'), 'utf8')).license ?? licence;
  if (name === 'webgl-constants' && fs.existsSync(path.join(root, 'node_modules/webgl-constants/LICENSE'))) licence = 'MIT';
  reviewed.push({ name, licence, version: meta.version ?? 'workspace' });
  if (blocked.has(licence)) issues.push(`${name}@${meta.version ?? 'workspace'} has blocked/unknown licence ${licence || 'UNKNOWN'}`);
  else if (review.has(licence)) console.warn(`review: ${name}@${meta.version ?? 'workspace'} uses ${licence}`);
  else if (!allowed.has(licence)) console.warn(`unclassified: ${name}@${meta.version ?? 'workspace'} uses ${licence}`);
}
const registry = fs.readFileSync(path.join(root, 'packages/engine/src/models/registry.ts'), 'utf8');
for (const match of registry.matchAll(/id:\s*'(isnet-onnx|cotracker)'[\s\S]*?shippable:\s*(true|false)/g)) {
  if (match[2] === 'true') issues.push(`model registry marks ${match[1]} shippable`);
}
fs.writeFileSync(path.join(root, 'license-audit-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), packageCount: reviewed.length, issues, reviewed }, null, 2) + '\n');
if (issues.length) {
  console.error(`Licence audit failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}
console.log(`Licence audit passed: reviewed ${reviewed.length} lockfile entries; model registry has no incompatible shippable entry.`);
