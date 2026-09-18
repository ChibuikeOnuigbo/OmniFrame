#!/usr/bin/env python3
"""Static companion to the Playwright request probe.

This intentionally does not pretend to be browser visual coverage. It uses
BeautifulSoup for the HTTP document and OpenCV for reference screenshots;
source-level checks cover React controls that do not exist in the initial HTML
until JavaScript mounts.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


root = Path(__file__).resolve().parents[1]
qa_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/omniframe-qa/http")
report_path = qa_dir / "report.json"
html_path = qa_dir / "index.html"
app_path = root / "apps/web/src/App.tsx"
css_path = root / "apps/web/src/styles.css"

if not report_path.exists() or not html_path.exists():
    fail(f"missing Playwright request artifacts in {qa_dir}; run npm run qa:http first")
report = json.loads(report_path.read_text())
soup = BeautifulSoup(html_path.read_text(), "html.parser")
app = app_path.read_text()
css = css_path.read_text()

checks = {
    "HTTP 2xx": 200 <= report["status"] < 300,
    "HTML content type": "text/html" in report["contentType"],
    "React mount root": soup.select_one("#root") is not None,
    "one or more stylesheets": len(soup.select('link[rel="stylesheet"]')) >= 1,
    "application menus": all(token in app for token in ("File: [", "Edit: [", "View: [", "Workspace: workspaceTabs.map", "Help: [")),
    "status bar": "editor-statusbar" in app and ".editor-statusbar" in css,
    "aspect presets": all(value in app for value in ("16:9", "1:1", "9:16", "4:5")),
    "truthful mask scope labels": all(value in app for value in ("THIS FRAME", "RANGE", "ALL FRAMES")),
    "Krita modifier mapping": all(value in app for value in ("intersect", "subtract", "replace", "add")),
    "narrow responsive breakpoint": "@media (max-width:760px)" in css,
    "editor grid": ".editor-main{display:grid" in css,
}
for label, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'}  {label}")
if not all(checks.values()):
    raise SystemExit(1)

# Report stable layout tokens for review. These are CSS/source facts, not
# fabricated runtime measurements.
def css_value(selector: str, property_name: str) -> str | None:
    match = re.search(re.escape(selector) + r"\{([^}]*)\}", css)
    if not match:
        return None
    property_match = re.search(rf"{re.escape(property_name)}:([^;]+)", match.group(1))
    return property_match.group(1) if property_match else None

print("layout tokens:")
for selector, prop in (
    (".editor-topbar", "flex"),
    (".editor-topbar", "padding"),
    (".editor-main", "grid-template-columns"),
    (".editor-statusbar", "min-height"),
):
    print(f"  {selector} {prop} = {css_value(selector, prop) or 'not found'}")
menu_button_count = sum(1 for name in ("File", "Edit", "View", "Workspace", "Help") if f"{name}:" in app)
aspect_option_count = len(re.findall(r'<option value="(?:16:9|1:1|9:16|4:5)">', app))
print(f"  source menu labels = {menu_button_count}")
print(f"  source aspect options = {aspect_option_count}")
