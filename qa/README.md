# QA evidence workspace

This folder is intentional and versioned. It separates reproducible QA inputs from generated output:

- `images/` — empty-by-default location for locally captured or legally redistributable reference images;
- `captures/` — Playwright screenshots and per-viewport DOM geometry reports (generated, not committed by default);
- `measurements/` — OpenCV/NumPy JSON measurements and image-diff reports (generated, not committed by default);
- `fixtures/` — small, locally generated media fixtures only; do not add user footage;
- `reference-manifest.json` — URLs, licences and retrieval status for comparative references.

Install the optional research/measurement environment in a virtual environment:

```bash
python -m venv /tmp/omniframe-qa
/tmp/omniframe-qa/bin/pip install -r qa/requirements.txt
```

Run the browser capture after installing a browser executable:

```bash
node scripts/capture-qa.mjs --base-url http://127.0.0.1:4174 --output-dir qa/captures
python scripts/compare-qa.py --baseline qa/captures/reference.png --candidate qa/captures/current.png --output qa/measurements/diff.json
```

The capture script fails honestly when Chromium is unavailable. It does not turn a request-context or source inspection into visual coverage. Image-search downloads, generated screenshots and user media are ignored by default unless a reviewer intentionally adds a small, licensed fixture.
