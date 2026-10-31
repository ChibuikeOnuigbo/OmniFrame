#!/usr/bin/env python3
import json, subprocess, sys, glob, os
from pathlib import Path
ROOT=Path("/home/user/editing-research-collection"); STG=ROOT/"_staging"; STG.mkdir(exist_ok=True)
plan=json.load(open(ROOT/"manifest/archive-plan.json"))
start=int(sys.argv[1]); count=int(sys.argv[2])
extra=[str(p.relative_to(ROOT)) for p in sorted((ROOT/"manifest").glob("*")) if p.is_file()]
if (ROOT/"README-COLLECTION.md").exists(): extra.append("README-COLLECTION.md")
built=[]
for e in plan[start:start+count]:
    nm=e["name"]; out=STG/f"{nm}.zip"
    for old in list(STG.glob(f"{nm}.z[0-9][0-9]"))+[out]:
        if Path(old).exists() and not e["split"]: Path(old).unlink()
    rel=e["files"]
    if e["split"]:
        for old in STG.glob(f"{nm}.z[0-9][0-9]"): old.unlink()
        if out.exists(): out.unlink()
        p=subprocess.run(["zip","-q","-X","-0","-s","90m",str(out),"-@"], input="\n".join(rel)+"\n",
                         text=True, cwd=str(ROOT), capture_output=True)
        if p.returncode!=0: print("ERR",nm,p.stderr[:200]); continue
        parts=sorted(STG.glob(f"{nm}.z[0-9][0-9]"))+[out]
        built.append({"name":nm,"parts":[p.name for p in parts],"bytes":[p.stat().st_size for p in parts],"split":True})
        print(f"{nm} SPLIT -> {[p.name for p in parts]}", flush=True)
    else:
        if not out.exists():
            p=subprocess.run(["zip","-q","-X","-9",str(out),"-@"], input="\n".join(rel+extra)+"\n",
                             text=True, cwd=str(ROOT), capture_output=True)
            if p.returncode!=0: print("ERR",nm,p.stderr[:200]); continue
        built.append({"name":nm,"parts":[out.name],"bytes":[out.stat().st_size],"split":False})
        print(f"{nm} {out.stat().st_size/1e6:.1f}MB", flush=True)
json.dump(built, open(ROOT/"manifest/_batch.json","w"), indent=1)
print("built", sum(len(b['parts']) for b in built), "files")
