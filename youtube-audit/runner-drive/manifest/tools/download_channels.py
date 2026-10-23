#!/usr/bin/env python3
"""Parallel, resumable YouTube channel downloader with full metadata capture."""
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/home/user/editing-research-collection")
MANI = ROOT / "manifest"
CHAN = ROOT / "youtube-channels"
MANI.mkdir(exist_ok=True, parents=True)

MAXH = os.environ.get("MAXH", "1080")
WORKERS = int(os.environ.get("WORKERS", "4"))

def safe(s, n=90):
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", str(s or "untitled"))
    s = re.sub(r"\s+", " ", s).strip().strip(".")
    return s[:n] or "untitled"

def probe(p):
    """Return (width,height,fps,has_video,has_audio,duration,codec,abr) via ffprobe."""
    try:
        r = subprocess.run(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(p)],
                           capture_output=True, text=True, timeout=120)
        j = json.loads(r.stdout or "{}")
    except Exception:
        return {}
    vs = [s for s in j.get("streams",[]) if s.get("codec_type")=="video"]
    aus= [s for s in j.get("streams",[]) if s.get("codec_type")=="audio"]
    out = {"has_video": bool(vs), "has_audio": bool(aus)}
    if vs:
        v = vs[0]
        out["width"], out["height"] = v.get("width"), v.get("height")
        fr = v.get("avg_frame_rate") or v.get("r_frame_rate") or "0/0"
        try:
            a,b = fr.split("/"); out["fps"] = round(float(a)/float(b),3) if float(b) else None
        except Exception: out["fps"] = None
        out["vcodec"] = v.get("codec_name")
    if aus:
        out["acodec"] = aus[0].get("codec_name")
        try: out["audio_channels"] = aus[0].get("channels")
        except Exception: pass
    try: out["duration"] = round(float(j["format"]["duration"]),2)
    except Exception: pass
    try: out["size_bytes"] = int(j["format"]["size"])
    except Exception: pass
    return out

def dl(v):
    """Download one video. Returns a result dict."""
    slug, vid = v["channel_slug"], v["video_id"]
    outdir = CHAN / slug
    outdir.mkdir(parents=True, exist_ok=True)
    stem = f"{vid}_{safe(v.get('title'))}"
    target = outdir / f"{stem}.mp4"
    if target.exists() and target.stat().st_size > 10000:
        info = probe(target)
        return {**v, "status":"already_present", "local_path":str(target),
                "size_mb": round(target.stat().st_size/1e6,2), **info}
    cmd = ["yt-dlp","--no-warnings","--no-playlist",
           "-f", f"bv*[height<={MAXH}]+ba/b[height<={MAXH}]/bv*+ba/b",
           "--merge-output-format","mp4",
           "--retries","3","--fragment-retries","5","--socket-timeout","25",
           "--concurrent-fragments","4",
           "--no-part",
           "-o", str(outdir / (stem + ".%(ext)s")),
           v["url"]]
    for attempt in (1,2):
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        except subprocess.TimeoutExpired:
            if attempt==2: return {**v,"status":"failed","error":"timeout"}
            continue
        if p.returncode == 0:
            break
        err = (p.stderr or "").strip().splitlines()
        err = err[-1] if err else f"exit {p.returncode}"
        if attempt==2 or "members-only" in err.lower() or "private video" in err.lower() \
           or "not available" in err.lower() or "removed" in err.lower():
            return {**v,"status":"unavailable","error":err[:400]}
        time.sleep(3)
    if not target.exists():
        cands = list(outdir.glob(f"{vid}_*.mp4"))
        if not cands:
            return {**v,"status":"failed","error":"no output file produced"}
        target = cands[0]
    if target.stat().st_size < 10000:
        return {**v,"status":"failed","error":f"suspiciously small file ({target.stat().st_size} bytes)"}
    info = probe(target)
    if not info.get("has_video"):
        return {**v,"status":"failed","error":"no video stream after probe","local_path":str(target)}
    return {**v,"status":"downloaded","local_path":str(target),"filename":target.name,
            "size_mb": round(target.stat().st_size/1e6,2), **info}

if __name__ == "__main__":
    vids = json.load(open(MANI/"discovered-channels.json"))
    only = sys.argv[1] if len(sys.argv)>1 else None
    if only: vids=[x for x in vids if x["channel_slug"]==only]
    print(f"Downloading {len(vids)} videos, MAXH={MAXH}, workers={WORKERS}", flush=True)
    results=[]
    done=0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs={ex.submit(dl,v):v for v in vids}
        for f in as_completed(futs):
            r=f.result(); results.append(r); done+=1
            st=r.get("status")
            mark={"downloaded":"OK ","already_present":"SKP","unavailable":"NA ","failed":"ERR"}.get(st,"?  ")
            print(f"[{done}/{len(vids)}] {mark} {r['video_id']} {r.get('size_mb','-')}MB {(r.get('error') or '')[:80]}", flush=True)
            if done%10==0:
                json.dump(results, open(MANI/"download-results-channels.json","w"), indent=1)
    json.dump(results, open(MANI/"download-results-channels.json","w"), indent=1)
    from collections import Counter
    print(Counter(r["status"] for r in results))
    print("total GB:", round(sum(r.get("size_mb",0) or 0 for r in results)/1000,2))
