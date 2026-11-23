#!/usr/bin/env python3
"""Index installed Kdenlive effect metadata after the official AppImage is verified/extracted."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
installed = ROOT / '.cache/reference-apps/kdenlive/squashfs-root'
records = []
for path in sorted(installed.glob('usr/share/kdenlive/effects/*.xml')):
    root = ET.fromstring(path.read_text())
    # Both namespaced release files and older unnamespaced definitions occur.
    for node in root.iter():
        node.tag = node.tag.rsplit('}', 1)[-1]
    effects = [root] if root.tag == 'effect' else root.findall('.//effect')
    for effect in effects:
        records.append({
            'file': str(path.relative_to(installed)),
            'id': effect.get('id'), 'tag': effect.get('tag'),
            'name': effect.findtext('name', ''),
            'controls': [{k: v for k, v in node.attrib.items() if k in ('name', 'type', 'min', 'max', 'default', 'value')}
                         for node in effect.findall('parameter')],
        })
if not records:
    raise SystemExit('No effect XML found. Extract the verified Kdenlive AppImage first.')
out = ROOT / 'research/editor-capabilities/kdenlive-installed-effects.json'
out.write_text(json.dumps({
    'source_package': 'kdenlive-26.08.3-x86_64.AppImage',
    'evidence': 'Installed definition metadata; no native plugin code imported into OmniFrame.',
    'effects': records,
}, indent=2) + '\n')
print(f'{len(records)} installed effect definitions indexed; {sum(bool(r["controls"]) for r in records)} have parameter metadata')
