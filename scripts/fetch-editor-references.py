#!/usr/bin/env python3
"""Download official reference apps locally; verify upstream SHA256 before use."""
import concurrent.futures
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/reference-apps'
OUT = ROOT / 'research/editor-capabilities/reference-downloads.json'
APPS = {
    'kdenlive': 'https://download.kde.org/stable/kdenlive/26.08/linux/kdenlive-26.08.3-x86_64.AppImage',
    'glaxnimate': 'https://download.kde.org/stable/glaxnimate/0.6.0/linux/glaxnimate-0.6.0-x86_64.AppImage',
}


def fetch(item):
    name, url = item
    target = CACHE / url.rsplit('/', 1)[1]
    part = target.with_suffix('.part')
    row = {'app': name, 'url': url, 'checksum_url': url + '.sha256', 'local': str(target.relative_to(ROOT))}
    try:
        with urllib.request.urlopen(url + '.sha256', timeout=60) as response:
            expected = re.search(r'\b[0-9a-fA-F]{64}\b', response.read().decode()).group().lower()
        if not target.exists():
            offset = part.stat().st_size if part.exists() else 0
            request = urllib.request.Request(url, headers={'Range': f'bytes={offset}-'} if offset else {})
            with urllib.request.urlopen(request, timeout=60) as response:
                resume = response.status == 206 and response.headers.get('Content-Range', '').startswith(f'bytes {offset}-')
                row['resolved_url'] = response.url
                with part.open('ab' if resume else 'wb') as stream:
                    while block := response.read(1024 * 1024):
                        stream.write(block)
        source = target if target.exists() else part
        with source.open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        row.update(bytes=source.stat().st_size, sha256=actual, expected_sha256=expected)
        if actual != expected:
            raise ValueError('SHA256 mismatch; file left untrusted and unexecuted')
        if source == part:
            part.rename(target)
        row['status'] = 'verified'
    except Exception as error:
        row.update(status='failed', error=str(error))
    return row


if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(fetch, APPS.items()):
            rows.append(result)
            OUT.write_text(json.dumps(rows, indent=2) + '\n')
            print(result['app'], result['status'], flush=True)
