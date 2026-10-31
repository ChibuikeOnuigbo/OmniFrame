"""Index the supplied collection manifest without treating its claims as new viewing."""
import argparse,csv,io,json,zipfile
from collections import Counter
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('archive',type=Path)
parser.add_argument('--out',type=Path,default=Path('research/new_study_vdieos/drive-collection-index.json'))
args=parser.parse_args()
with zipfile.ZipFile(args.archive) as archive:
    rows=json.loads(archive.read('manifest/all-videos.json'))
    plans=json.loads(archive.read('manifest/archive-plan.json'))
    uploads=list(csv.DictReader(io.StringIO(archive.read('manifest/upload-log.csv').decode())))
    locations={file:plan['name'] for plan in plans for file in plan['files']}
    records=[]
    for row in rows:
        original=row.get('local_path') or ''
        relative=original.split('/editing-research-collection/')[-1]
        records.append({
            'id':row.get('video_id'),'title':row.get('title'),'url':row.get('url'),
            'source':row.get('source'),'kind':row.get('kind'),'channel':row.get('origin_slug'),
            'manifestClaim':row.get('status'),'manifestError':row.get('error'),
            'manifestDuration':row.get('duration_s'),'width':row.get('width'),'height':row.get('height'),
            'fps':row.get('fps'),'relativePath':relative,'archivePlan':locations.get(relative),
            'reviewStatus':'metadata only; no new viewing or download verification for this record',
        })
    report={
        'source':'User-provided 00_MANIFEST-AND-REPORT.zip; original collection claims preserved separately',
        'records':records,'recordCount':len(records),'archivePlans':len(plans),
        'kindCounts':dict(Counter(row.get('kind') for row in rows)),
        'sourceCounts':dict(Counter(row.get('source') for row in rows)),
        'manifestClaimCounts':dict(Counter(row.get('status') for row in rows)),
        'uploadedArchives':[{'name':row['archive_name'],'driveId':row['drive_file_id'],'bytes':int(row['size_bytes']),'kind':row['kind']} for row in uploads],
        'scope':'Metadata inventory. Consult access-refresh.json and per-video notes for newly acquired/reviewed sources. The complete creator catalogs have not been watched.',
    }
args.out.parent.mkdir(parents=True,exist_ok=True)
args.out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({key:report[key] for key in ['recordCount','archivePlans','kindCounts','sourceCounts','manifestClaimCounts']}))
