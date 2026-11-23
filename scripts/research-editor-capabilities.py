#!/usr/bin/env python3
"""Index official editor manuals into a reproducible local research ledger.

HTML stays in the ignored cache; only titles, links, hashes and control names
are recorded. This is a documentation inventory, not visual feature acceptance.
"""
import concurrent.futures
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/reference-apps/docs'
OUT = ROOT / 'research/editor-capabilities'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links, self.headings, self.rows = [], [], []
        self.href = None
        self.label, self.heading, self.row, self.cell = [], None, None, None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href, self.label = dict(attrs).get('href'), []
        if tag in ('h1', 'h2', 'h3'):
            self.heading = []
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = []

    def handle_data(self, data):
        if self.href:
            self.label.append(data)
        if self.heading is not None:
            self.heading.append(data)
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.href:
            self.links.append((self.href, ' '.join(' '.join(self.label).split())))
            self.href = None
        if tag in ('h1', 'h2', 'h3') and self.heading is not None:
            self.headings.append(' '.join(' '.join(self.heading).replace('¶', '').replace('\uf0c1', '').split()))
            self.heading = None
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None:
                self.row.append(' '.join(' '.join(self.cell).split()))
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def fetch(url):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.html')
    try:
        if path.exists():
            data = path.read_bytes()
        else:
            request = urllib.request.Request(url, headers={'User-Agent': 'OmniFrame-documentation-review/1.0'})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read(4_000_000)
            path.write_bytes(data)
        page = Page(data.decode('utf-8', errors='replace'))
        return {'url': url, 'title': page.headings[0] if page.headings else '',
                'headings': page.headings, 'sha256': hashlib.sha256(data).hexdigest(),
                'bytes': len(data), 'controls': [row[:2] for row in page.rows if len(row) >= 2],
                'links': page.links}
    except Exception as error:
        return {'url': url, 'error': str(error), 'links': []}


def links(record, prefix):
    return {urllib.parse.urldefrag(urllib.parse.urljoin(record['url'], href))[0]
            for href, _ in record['links']
            if urllib.parse.urljoin(record['url'], href).startswith(prefix) and '.html' in href}


def parallel(urls):
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(fetch, sorted(urls)))


def main():
    kden = fetch('https://docs.kdenlive.org/en/effects_and_filters.html')
    prefixes = ['https://docs.kdenlive.org/en/effects_and_filters/video_effects/',
                'https://docs.kdenlive.org/en/effects_and_filters/audio_effects/']
    urls = set().union(*(links(kden, prefix) for prefix in prefixes))
    groups = parallel(urls)
    urls |= set().union(*(links(page, prefix) for page in groups for prefix in prefixes))
    known = {page['url']: page for page in groups}
    known.update((page['url'], page) for page in parallel(urls - known.keys()))
    # Scan leaf effect pages, including their parameter tables, once each.
    result = []
    for url, page in sorted(known.items()):
        page.pop('links', None)
        page['family'] = url.split('/effects_and_filters/', 1)[1].split('/')[0]
        page['group'] = url.split('/effects_and_filters/', 1)[1].split('/')[1].removesuffix('.html')
        page['kind'] = 'effect' if len(url.split('/effects_and_filters/', 1)[1].split('/')) > 2 and not url.endswith('/index.html') else 'category'
        result.append(page)
    (OUT / 'kdenlive-manual-index.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'Kdenlive: {len(result)} pages, {sum("error" in page for page in result)} errors', flush=True)

    glax_root = fetch('https://docs.glaxnimate.org/en/index.html')
    seen = {glax_root['url']: glax_root}
    for _ in range(4):
        next_urls = set().union(*(links(page, 'https://docs.glaxnimate.org/en/') for page in seen.values())) - seen.keys()
        if not next_urls:
            break
        seen.update((page['url'], page) for page in parallel(next_urls))
    for page in seen.values():
        page.pop('links', None)
    (OUT / 'glaxnimate-manual-index.json').write_text(json.dumps(list(seen.values()), indent=2) + '\n')
    print(f'Glaxnimate: {len(seen)} pages, {sum("error" in page for page in seen.values())} errors', flush=True)

    adobe_url = 'https://helpx.adobe.com/after-effects/desktop/apply-effects-and-animation-presets/effects-and-animation-presets/effect-list.html'
    adobe = fetch(adobe_url)
    if 'error' not in adobe:
        raw = CACHE / (hashlib.sha256(adobe_url.encode()).hexdigest() + '.html')
        effects, category, first = [], '', False
        for row in Page(raw.read_text()).rows:
            if not row:
                continue
            if row[0] == 'Category':
                first = True
                continue
            if first and len(row) >= 2:
                category, name = row[:2]
                first = False
            else:
                name = row[0]
            if category:
                effects.append({'group': category, 'name': name})
        (OUT / 'adobe-effect-index.json').write_text(json.dumps({
            'source': adobe_url, 'evidence': 'Official effect-name table indexed; names do not establish OmniFrame feature parity.',
            'effects': effects,
        }, indent=2) + '\n')
        print(f'After Effects: {len(effects)} effect names indexed', flush=True)
    else:
        print(f'After Effects index failed: {adobe["error"]}', flush=True)

    capcut = fetch('https://www.capcut.com/tools/desktop-video-editor')
    capcut['download_links'] = sorted({urllib.parse.urljoin(capcut['url'], href) for href, _ in capcut.pop('links', []) if 'download_pc' in href})
    capcut['evidence'] = 'Public product page and official download entry points; no native installation or plugin import.'
    (OUT / 'capcut-product-index.json').write_text(json.dumps(capcut, indent=2) + '\n')


if __name__ == '__main__':
    main()
