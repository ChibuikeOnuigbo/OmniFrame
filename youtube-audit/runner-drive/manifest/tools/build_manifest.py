#!/usr/bin/env python3
"""Build all-videos.csv / all-videos.json / download-errors.csv from the collection on disk."""
import json, csv, subprocess, os
from pathlib import Path

ROOT = Path("/home/user/editing-research-collection")
MANI = ROOT / "manifest"
MANI.mkdir(exist_ok=True, parents=True)

def probe(p):
    try:
        r = subprocess.run(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(p)],
                           capture_output=True, text=True, timeout=120)
        j = json.loads(r.stdout or "{}")
    except Exception:
        return {}
    vs=[s for s in j.get("streams",[]) if s.get("codec_type")=="video"]
    aus=[s for s in j.get("streams",[]) if s.get("codec_type")=="audio"]
    o={"has_video":bool(vs),"has_audio":bool(aus)}
    if vs:
        v=vs[0]; o["width"]=v.get("width"); o["height"]=v.get("height")
        try:
            a,b=(v.get("avg_frame_rate") or "0/0").split("/")
            o["fps"]=round(float(a)/float(b),3) if float(b) else None
        except Exception: o["fps"]=None
        o["vcodec"]=v.get("codec_name")
    if aus: o["acodec"]=aus[0].get("codec_name"); o["audio_channels"]=aus[0].get("channels")
    try: o["duration_s"]=round(float(j["format"]["duration"]),2)
    except Exception: o["duration_s"]=None
    try: o["size_bytes"]=int(j["format"]["size"])
    except Exception: o["size_bytes"]=None
    return o

rows=[]
# ---- channel downloads ----
res = json.load(open(MANI/"download-results-channels.json"))
for r in res:
    rows.append(dict(
        source="youtube_channel", origin=r["channel_name"], origin_slug=r["channel_slug"],
        video_id=r["video_id"], title=r.get("title"), url=r["url"],
        kind=r.get("kind"), status=r["status"], error=r.get("error",""),
        local_path=r.get("local_path",""), filename=r.get("filename") or Path(r.get("local_path","")).name,
        size_bytes=r.get("size_bytes"), duration_s=r.get("duration_s") or r.get("duration"),
        width=r.get("width"), height=r.get("height"), fps=r.get("fps"),
        vcodec=r.get("vcodec"), acodec=r.get("acodec"),
        has_audio=r.get("has_audio"), classification=""))
# ---- individual videos ----
IND = json.load(open(MANI/"individual-videos.json"))
for r in IND:
    p=Path(r["local_path"])
    pr=probe(p) if p.exists() else {}
    rows.append(dict(source="youtube_individual", origin="individual", origin_slug="individual",
        video_id=r["video_id"], title=r["title"], url=r["url"], kind="video",
        status="downloaded" if pr.get("has_video") else (r.get("status") or "unavailable"),
        error=r.get("error",""), local_path=str(p), filename=p.name,
        size_bytes=pr.get("size_bytes"), duration_s=pr.get("duration_s"),
        width=pr.get("width"), height=pr.get("height"), fps=pr.get("fps"),
        vcodec=pr.get("vcodec"), acodec=pr.get("acodec"),
        has_audio=pr.get("has_audio"), classification=""))
# ---- google drive ----
DRV = json.load(open(MANI/"google-drive-assets.json"))
for r in DRV:
    p=Path(r["local_path"]); pr=probe(p) if p.exists() else {}
    rows.append(dict(source="google_drive", origin="drive folder 1uP9ySa8...",
        origin_slug="google-drive-assets", video_id=r.get("drive_id",""), title=r["title"],
        url=r.get("web_view_link",""), kind=r.get("type"),
        status="downloaded" if (p.exists() and p.stat().st_size>0) else "failed",
        error=r.get("error",""), local_path=str(p), filename=p.name,
        size_bytes=pr.get("size_bytes") or (p.stat().st_size if p.exists() else None),
        duration_s=pr.get("duration_s"), width=pr.get("width"), height=pr.get("height"),
        fps=pr.get("fps"), vcodec=pr.get("vcodec"), acodec=pr.get("acodec"),
        has_audio=pr.get("has_audio"), classification=""))

FIELDS=["source","origin","origin_slug","video_id","title","url","kind","status","error",
        "local_path","filename","size_bytes","duration_s","width","height","fps","vcodec","acodec","has_audio","classification"]
rows.sort(key=lambda r:(r["source"], r["origin_slug"], str(r.get("title"))))
with open(MANI/"all-videos.csv","w",newline="") as f:
    w=csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
    for r in rows: w.writerow({k:r.get(k,"") for k in FIELDS})
json.dump(rows, open(MANI/"all-videos.json","w"), indent=1)

errs=[r for r in rows if r["status"] in ("failed","unavailable","error")]
with open(MANI/"download-errors.csv","w",newline="") as f:
    w=csv.DictWriter(f, fieldnames=["source","origin_slug","video_id","title","url","status","error"]); w.writeheader()
    for r in errs: w.writerow({k:r.get(k,"") for k in ["source","origin_slug","video_id","title","url","status","error"]})

from collections import Counter
print("rows:", len(rows))
print(Counter((r["source"], r["status"]) for r in rows))
print("errors:", len(errs))
