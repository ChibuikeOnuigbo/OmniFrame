#!/usr/bin/env python3
"""Build ZIP archives (<=92MB each) of the collection, in groups, into _staging/."""
import json, os, subprocess, sys, shutil
from pathlib import Path

ROOT = Path("/home/user/editing-research-collection")
STG  = ROOT / "_staging"
TARGET = 92 * 1024 * 1024        # accumulate to <92MB per archive (Drive hard cap 100MB)
SPLIT  = "90m"                   # for single files bigger than an archive

STG.mkdir(exist_ok=True)

def manifest_files():
    return sorted([p for p in (ROOT/"manifest").glob("*") if p.is_file()])

def plan():
    """Yield lists of .relative_to(ROOT) paths, grouped, each group <= TARGET."""
    groups = []
    # 1) youtube channels, one group per channel
    chroot = ROOT/"youtube-channels"
    for d in sorted([p for p in chroot.iterdir() if p.is_dir()]):
        files = sorted([p for p in d.rglob("*") if p.is_file() and p.suffix.lower() in (".mp4",".webm",".mkv",".m4a")])
        groups.append((f"youtube-channels__{d.name}", files))
    # 2) individual videos
    d = ROOT/"individual-videos"
    groups.append(("individual-videos", sorted([p for p in d.rglob("*") if p.is_file()])))
    # 3) google drive assets (videos/audio/archives) and screenshots separately
    d = ROOT/"google-drive-assets"
    media = sorted([p for p in d.glob("*") if p.is_file() and p.suffix.lower() in (".mp4",".mp3",".zip",".rar")])
    groups.append(("google-drive-assets__media", media))
    shots = sorted([p for p in (d/"reference-screenshots").glob("*.png")])
    groups.append(("google-drive-assets__reference-screenshots", shots))
    ref = sorted([p for p in (d/"refernce_extracted").rglob("*") if p.is_file()])
    groups.append(("google-drive-assets__refernce-web-snapshot", ref))
    # 4) anime scene packs catalog
    d = ROOT/"anime-scene-packs"
    groups.append(("anime-scene-packs__catalog", sorted([p for p in d.rglob("*") if p.is_file()])))
    # 5) other references
    d = ROOT/"other-references"
    groups.append(("other-references", sorted([p for p in d.rglob("*") if p.is_file()])))
    return groups

def write_zip(name, members, extra=None):
    """members: absolute paths. Returns list of produced zip paths."""
    out = STG / f"{name}.zip"
    if out.exists(): out.unlink()
    rel = [str(p.relative_to(ROOT)) for p in members]
    # stage manifest copy inside archive
    lst = STG / "_list.txt"
    lines = [f"editing-research-collection/{r}" for r in rel]
    if extra:
        lines += [f"editing-research-collection/{e}" for e in extra]
    lst.write_text("\n".join(lines) + "\n")
    cmd = ["zip","-q","-X","-9","-@",str(out), "-j" ] if False else None
    # use cwd=ROOT so relative paths are stored with the collection root prefix
    p = subprocess.run(["zip","-q","-X","-9",str(out),"-@"],
                       input="\n".join(rel + (extra or [])) + "\n",
                       text=True, cwd=str(ROOT), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"zip failed: {p.stderr[:300]}")
    return [out]

def main():
    which = sys.argv[1] if len(sys.argv)>1 else "all"
    budget = int(sys.argv[2]) if len(sys.argv)>2 else 8   # max archives to build this run
    built = []
    man = [str(p.relative_to(ROOT)) for p in manifest_files()]
    README = "README-COLLECTION.md"
    extra = man + ([README] if (ROOT/README).exists() else [])

    for gname, files in plan():
        if which != "all" and gname != which: continue
        if not files: continue
        cur, cursz = [], 0
        part = 1
        chunks = []
        for f in files:
            sz = f.stat().st_size
            if sz > TARGET:
                if cur: chunks.append(cur); cur, cursz = [], 0
                chunks.append([f])                      # oversized -> own split archive
                continue
            if cursz + sz > TARGET and cur:
                chunks.append(cur); cur, cursz = [], 0
            cur.append(f); cursz += sz
        if cur: chunks.append(cur)

        for ch in chunks:
            tot = sum(x.stat().st_size for x in ch)
            nm = f"{gname}__part{part:02d}"
            if tot > TARGET:                            # single oversized file -> split zip
                out = STG / f"{nm}.zip"
                for old in STG.glob(f"{nm}.z*"): old.unlink()
                rel = [str(x.relative_to(ROOT)) for x in ch]
                p = subprocess.run(["zip","-q","-X","-0","-s",SPLIT,str(out),"-@"],
                                   input="\n".join(rel)+"\n", text=True,
                                   cwd=str(ROOT), capture_output=True)
                if p.returncode != 0: raise RuntimeError(p.stderr[:300])
                parts = sorted(STG.glob(f"{nm}.z*")) + [out]
                built.append((nm, [str(x) for x in parts], tot, "split"))
                print(f"BUILT {nm} SPLIT {tot/1e6:.1f}MB -> {len(parts)} parts", flush=True)
            else:
                outs = write_zip(nm, ch, extra)
                built.append((nm, [str(x) for x in outs], tot, "single"))
                print(f"BUILT {nm} {tot/1e6:.1f}MB {len(ch)} files", flush=True)
            part += 1
            if len(built) >= budget:
                break
        if len(built) >= budget: break

    json.dump([{"name":n,"parts":p,"content_mb":round(s/1e6,2),"kind":k} for n,p,s,k in built],
              open(ROOT/"manifest/_build-batch.json","w"), indent=1)
    print(f"\n{len(built)} archives built into _staging/")

if __name__ == "__main__":
    main()
