"""Extract reproducible, aspect-preserving video samples from acquired local media."""
import argparse,json,math,subprocess,tempfile,shutil,re
from pathlib import Path

def positive_duration(probe):
    candidates=[probe.get('format',{}).get('duration')]+[s.get('duration') for s in probe.get('streams',[])]
    for candidate in candidates:
        try:value=float(candidate)
        except (TypeError,ValueError):continue
        if math.isfinite(value) and value>0:return value
    raise ValueError('Acquired media has no positive measured duration; metadata is not a sampling clock')

def sample_times(duration,count=12):
    if not math.isfinite(duration) or duration<=0 or count<1:raise ValueError('positive duration and sample count required')
    return [duration*(i+.5)/count for i in range(count)]

def extract(source,destination,ffmpeg='ffmpeg',ffprobe='ffprobe',count=12):
    source=Path(source);destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    result=subprocess.run([ffprobe,'-v','error','-show_entries','format=duration:stream=width,height,r_frame_rate,duration','-of','json',str(source)],capture_output=True,text=True,check=True)
    probe=json.loads(result.stdout);duration=positive_duration(probe)
    video=next((s for s in probe.get('streams',[]) if s.get('width') and s.get('height')),None)
    if not video:raise ValueError('Acquired media has no video stream')
    frames=[]
    fit='scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1'
    for index,time in enumerate(sample_times(duration,count)):
        name=f'u{index:02d}.jpg';target=destination/name
        subprocess.run([ffmpeg,'-y','-v','error','-ss',f'{time:.6f}','-i',str(source),'-frames:v','1','-vf',fit,'-q:v','5',str(target)],capture_output=True,check=True,timeout=120)
        if not target.is_file() or target.stat().st_size==0:raise ValueError(f'No frame decoded at {time:.6f}s')
        frames.append({'file':name,'time_seconds':round(time,6)})
    scene_frames=[]
    with tempfile.TemporaryDirectory(prefix='omni-scene-') as tmp:
        scene=subprocess.run([ffmpeg,'-y','-v','info','-i',str(source),'-vf',"select='gt(scene,0.4)',showinfo,"+fit,'-vsync','vfr','-frames:v','6','-q:v','5',str(Path(tmp)/'s%d.jpg')],capture_output=True,text=True,timeout=300,check=True)
        times=[float(t) for t in re.findall(r'pts_time:([0-9.]+)',scene.stderr)]
        for index,target in enumerate(sorted(Path(tmp).glob('s*.jpg'))):
            shutil.copyfile(target,destination/target.name)
            scene_frames.append({'file':target.name,'time_seconds':times[index] if index<len(times) else None})
    report={'scene_frames':scene_frames,'source':source.name,'duration_seconds':duration,'duration_source':'ffprobe acquired media','probe':probe,'frames':frames,'fit':'contain with letterbox; never stretch','visual_review':'pending','audio_review':'not performed by frame extractor'}
    (destination/'sampling.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('destination');parser.add_argument('--ffmpeg',default='ffmpeg');parser.add_argument('--ffprobe',default='ffprobe');parser.add_argument('--count',type=int,default=12)
    args=parser.parse_args();print(json.dumps(extract(args.source,args.destination,args.ffmpeg,args.ffprobe,args.count)))
