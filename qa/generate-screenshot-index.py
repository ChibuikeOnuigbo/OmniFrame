#!/usr/bin/env python3
"""Generate ui_downlaod_study/SCREENSHOTS.md — an index linking EVERY
screenshot in the repo (UI sections, reference study, preset vetting
stills, evidence, QA captures), grouped by area. Regenerate:
  python3 qa/generate-screenshot-index.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "ui_downlaod_study"
IMG = {".png", ".jpg", ".jpeg", ".webp"}

EXCLUDE_PARTS = {"node_modules", ".git", "zip-extract", "src-tauri", "dist", "build"}
# app icons / stock assets are not screenshots
EXCLUDE_DIRS = {"src-tauri/icons", "public/assets"}


def rel(p: Path) -> str:
    return Path(__import__("os").path.relpath(p, OUT_DIR)).as_posix()


def collect(base: Path) -> list[Path]:
    if not base.exists():
        return []
    out = []
    for p in sorted(base.rglob("*")):
        if p.suffix.lower() not in IMG or not p.is_file():
            continue
        parts = set(p.relative_to(ROOT).parts)
        if parts & EXCLUDE_PARTS:
            continue
        if p.relative_to(ROOT).as_posix().startswith(tuple(EXCLUDE_DIRS)):
            continue
        out.append(p)
    return out


GROUPS: list[tuple[str, str, Path]] = [
    ("Reference app (the loaded work)", "The extracted ReferenceTool mirror, served and screenshotted, plus the declutter before/after set.", OUT_DIR),
    ("Preset vetting stills (testing_asset_etc)", "Three frames per text preset (early / mid / settled) — the MP4s next to them are the primary vetting format.", ROOT / "testing_asset_etc"),
    ("Evidence — improvements", "Feature-wave proof shots.", ROOT / "evidence" / "improvements"),
    ("Evidence — screenshots", "UI declutter + sub-mode channeling proof (SS-xxx series).", ROOT / "evidence" / "screenshots"),
    ("Evidence — cutouts", "Cutout / segmentation series.", ROOT / "evidence" / "cutouts"),
    ("Evidence — tutorials", "Tutorial-study captures.", ROOT / "evidence" / "tutorials"),
    ("Evidence — voice", "Voice / separation benchmark captures.", ROOT / "evidence" / "voice"),
    ("Evidence — rotomask isolation", "Roto/mask isolation series.", ROOT / "evidence" / "rotomask-isolation"),
    ("QA captures", "Automated-suite screenshots and fixtures.", ROOT / "qa"),
    ("Docs research", "Reference research imagery (CapCut study etc).", ROOT / "docs" / "research"),
    ("Evidence — other", "Remaining evidence roots.", ROOT / "evidence"),
]


def main() -> None:
    seen: set[Path] = set()
    sections: list[str] = []
    total = 0
    for title, blurb, base in GROUPS:
        files = [p for p in collect(base) if p not in seen]
        # 'Evidence — other' should only take evidence files not already grouped
        if title == "Evidence — other":
            files = [p for p in files if p.parent == base or "improvements" not in str(p)]
        seen.update(files)
        if not files:
            continue
        total += len(files)
        lines = [f"## {title} ({len(files)})", "", blurb, ""]
        # sections/ gets numbered display; others a compact link list
        if base == OUT_DIR:
            in_sections = [p for p in files if p.parent.name == "sections"]
            root_files = [p for p in files if p.parent == base]
            for p in root_files:
                lines.append(f"- [{p.name}]({rel(p)})")
            if in_sections:
                lines += ["", "### Every UI section (fresh captures)", ""]
                for p in in_sections:
                    pretty = p.stem.split("-", 1)[-1].replace("-", " ").title()
                    lines.append(f"- [{p.stem} — {pretty}]({rel(p)})")
            lines.append("")
        else:
            for p in files:
                label = p.relative_to(base).as_posix()
                lines.append(f"- [{label}]({rel(p)})")
            lines.append("")
        sections.append("\n".join(lines))

    header = f"""# SCREENSHOTS.md — every screenshot in the project ({total} linked)

All screenshots taken across the loaded work and the app's development:
the reference app study, **every UI section** (fresh captures in
`sections/`), preset vetting stills, feature evidence and QA captures.
Videos (the primary vetting format) live next to the stills in
`testing_asset_etc/` (`00-VETTING-REEL.mp4` + per-preset `preview.mp4`).

Regenerate: `python3 qa/generate-screenshot-index.py` ·
Section captures: `node qa/ui-sections-capture.mjs`

"""
    (OUT_DIR / "SCREENSHOTS.md").write_text(header + "\n".join(sections))
    print(f"SCREENSHOTS.md: {total} screenshots linked")


if __name__ == "__main__":
    main()
