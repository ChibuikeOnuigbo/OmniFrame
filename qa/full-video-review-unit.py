import json, pathlib, runpy, subprocess, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
module = runpy.run_path(str(ROOT / 'scripts' / 'extract-full-video-review.py'))
assert module['review_interval'](60) == 2
assert module['review_interval'](600) == 5
assert module['review_interval'](2400) == 10

with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    source = tmp / 'source.mp4'
    subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=8','-c:v','libx264','-pix_fmt','yuv420p',str(source)], check=True)
    report = module['extract_review'](source, tmp / 'out')
    assert report['status'] == 'FULL_DURATION_EVIDENCE'
    assert report['duration_seconds'] >= 7.9
    assert report['sample_interval_seconds'] == 2
    assert report['contact_sheet_count'] == 1
    assert (tmp / 'out' / 'sheet-001.jpg').stat().st_size > 1000
    assert json.loads((tmp / 'out' / 'review.json').read_text())['expected_sample_count'] == 4
print('PASS full-duration timestamped review extraction')
