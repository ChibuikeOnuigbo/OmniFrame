"""Verify sampling-clock recovery and real portrait-frame geometry."""
import json,math,runpy,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
module=runpy.run_path(str(ROOT/'scripts/extract-study-evidence.py'))
assert module['positive_duration']({'format':{'duration':'4'},'streams':[{'duration':'0'}]})==4
assert module['positive_duration']({'format':{'duration':'0'},'streams':[{'duration':'4'}]})==4
for duration in [0,-1,float('nan')]:
 try:module['sample_times'](duration);raise AssertionError('invalid clock accepted')
 except ValueError:pass
try:module['positive_duration']({'format':{'duration':'0'}});raise AssertionError('zero probe accepted')
except ValueError:pass
with tempfile.TemporaryDirectory(prefix='omni-study-') as tmp:
 source=Path(tmp)/'portrait.mp4'
 ff=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import ff from '@ffmpeg-installer/ffmpeg';console.log(JSON.stringify(ff.path))"],cwd=ROOT))
 subprocess.run([ff,'-y','-v','error','-f','lavfi','-i','testsrc2=size=180x320:rate=12:duration=3','-c:v','libx264','-threads','1',str(source)],check=True)
 report=module['extract'](source,Path(tmp)/'frames',ffmpeg=ff,count=3)
 assert [x['time_seconds'] for x in report['frames']]==[.5,1.5,2.5]
 # Decode a sample and inspect the actual letterbox: 180:320 content in 640:360.
 raw=subprocess.check_output([ff,'-v','error','-i',str(Path(tmp)/'frames/u01.jpg'),'-f','rawvideo','-pix_fmt','rgb24','-'])
 assert len(raw)==640*360*3
 pixel=lambda x,y:raw[(y*640+x)*3:(y*640+x+1)*3]
 assert max(pixel(20,180))<4 and max(pixel(620,180))<4
 assert max(pixel(320,180))>20
 output=ROOT/'qa-output/study';output.mkdir(parents=True,exist_ok=True)
 (output/'sampling-regression.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS acquired-byte duration, zero/NaN rejection, distinct sample times and real portrait letterboxing')
