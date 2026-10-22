#!/usr/bin/env python3
"""Pack collection into <=TARGET-byte ZIPs, per channel/group, using first-fit-decreasing."""
import json
from pathlib import Path
ROOT = Path("/home/user/editing-research-collection")
TARGET = 94_000_000

def groups():
    g=[]
    dirs=[p for p in (ROOT/"youtube-channels").iterdir() if p.is_dir()]
    dirs.sort(key=lambda d: sum(f.stat().st_size for f in d.rglob("*") if f.is_file()))
    for d in dirs:
        g.append((f"youtube-channels__{d.name}",
                  sorted([p for p in d.rglob("*") if p.is_file() and p.suffix.lower() in (".mp4",".webm",".mkv")])))
    g.append(("individual-videos", sorted([p for p in (ROOT/"individual-videos").rglob("*") if p.is_file() and p.suffix.lower()==".mp4"])))
    d=ROOT/"google-drive-assets"
    g.append(("google-drive-assets__media", sorted([p for p in d.glob("*") if p.is_file() and p.suffix.lower() in (".mp4",".mp3",".zip",".rar")])))
    g.append(("google-drive-assets__reference-screenshots", sorted([p for p in (d/"reference-screenshots").glob("*.png")])))
    g.append(("google-drive-assets__refernce-web-snapshot", sorted([p for p in (d/"refernce_extracted").rglob("*") if p.is_file()])))
    g.append(("anime-scene-packs__catalog", sorted([p for p in (ROOT/"anime-scene-packs").rglob("*") if p.is_file()])))
    g.append(("other-references", sorted([p for p in (ROOT/"other-references").rglob("*") if p.is_file()])))
    return g

plan=[]
for gname, files in groups():
    files=[f for f in files if f.exists() and f.stat().st_size>0]
    if not files: continue
    big=[f for f in files if f.stat().st_size > TARGET]
    small=sorted([f for f in files if f.stat().st_size <= TARGET],
                 key=lambda p: -p.stat().st_size)   # first-fit-decreasing
    bins=[]   # list of [files, bytes]
    for f in big:
        bins.append([[f], f.stat().st_size, True])
    for f in small:
        sz=f.stat().st_size
        for b in bins:
            if b[2]: continue
            if b[1]+sz <= TARGET:
                b[0].append(f); b[1]+=sz; break
        else:
            bins.append([[f], sz, False])
    for i,(bfs,bz,isbig) in enumerate(bins,1):
        plan.append({"name": f"{gname}__part{i:02d}",
                     "files":[str(x.relative_to(ROOT)) for x in bfs],
                     "content_bytes": bz, "split": isbig})
json.dump(plan, open(ROOT/"manifest/archive-plan.json","w"), indent=1)
tot=sum(p["content_bytes"] for p in plan)
print("archives:", len(plan), "content GB:", round(tot/1e9,2), "split:", sum(1 for p in plan if p["split"]))
print("avg MB/archive:", round(tot/len(plan)/1e6,1))
