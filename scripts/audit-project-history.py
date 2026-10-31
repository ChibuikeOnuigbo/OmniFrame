"""Inventory repository evidence and historical requirements without treating claims as proof."""
import os,re,json,csv,subprocess,datetime,collections
from urllib.parse import urlsplit
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/repo-audit';OUT.mkdir(parents=True,exist_ok=True)
now=datetime.datetime.now(datetime.timezone.utc);cutoff=now-datetime.timedelta(days=7)
tracked=set(subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode(errors='replace').split('\0'));tracked.discard('')
log=subprocess.check_output(['git','-c','core.quotepath=false','log','--format=@@%H\t%ct','--name-only','HEAD'],cwd=ROOT).decode(errors='replace')
changed={};stamp=None;commit=None
for line in log.splitlines():
 if line.startswith('@@'):
  commit,epoch=line[2:].split('\t');stamp=int(epoch)
 elif line and stamp is not None and line not in changed:changed[line]=(stamp,commit)
modified=set(subprocess.check_output(['git','diff','--name-only'],cwd=ROOT).decode(errors='replace').splitlines())
SKIP={'.git','node_modules','dist','dist-ssr','ort-runtime','__pycache__','.pytest_cache'}
media_ext={'.png','.jpg','.jpeg','.webp','.gif','.svg','.mp4','.webm','.mov','.mkv','.mp3','.wav','.ogg','.flac','.glb','.gltf','.blend','.ttf','.otf','.woff','.woff2','.cube','.onnx'}
text_ext={'.md','.txt','.json','.csv','.ndjson','.xml','.html'}
url_re=re.compile(r'https?://[^\s<>"\x27`\]\)]+')
ref_re=re.compile(r'\b(?:src|qa|tools|scripts|public|evidence|test_ans_result|Study_edits_videos)/[A-Za-z0-9_./-]+\.(?:mjs|js|ts|tsx|py|json|md|mp4|png|jpg|jpeg)\b')
files=[];links=collections.defaultdict(list);search_links=collections.Counter();claims=[];docs=[];ui=[];categories=collections.Counter();exclusions=[]
for parent,dirs,names in os.walk(ROOT,followlinks=False):
 rel_parent=Path(parent).relative_to(ROOT).as_posix()
 for d in list(dirs):
  rel=(Path(rel_parent)/d).as_posix().removeprefix('./')
  if d in SKIP or rel in {'public/ort','reports/repo-audit'}:
   dirs.remove(d);exclusions.append(rel)
 for name in names:
  p=Path(parent)/name;rel=p.relative_to(ROOT).as_posix()
  if p.is_symlink():
   files.append({'path':rel,'kind':'symlink','tracked':rel in tracked});continue
  try:stat=p.stat()
  except OSError as e:files.append({'path':rel,'error':str(e)});continue
  ext=p.suffix.lower();kind='media' if ext in media_ext else 'code' if ext in {'.ts','.tsx','.mjs','.js','.py','.rs','.css'} else 'document' if ext in text_ext else 'other'
  epoch,sha=changed.get(rel,(None,None));date=datetime.datetime.fromtimestamp(epoch,datetime.timezone.utc) if epoch else None
  age=(now-date).total_seconds()/86400 if date else None
  record={'path':rel,'kind':kind,'extension':ext,'bytes':stat.st_size,'tracked':rel in tracked,'modified_in_current_work':rel in modified or rel not in tracked,'git_last_change':date.isoformat() if date else None,'git_commit':sha,'age_days':round(age,2) if age is not None else None,'older_than_7_days':age>7 if age is not None else None,'mtime_not_used_for_age':True,'regenerable_cache':rel.startswith('.cache/')}
  if ext=='.png':
   try:
    with p.open('rb') as f:header=f.read(24)
    if header[:8]==b'\x89PNG\r\n\x1a\n':record['width']=int.from_bytes(header[16:20],'big');record['height']=int.from_bytes(header[20:24],'big')
   except OSError:pass
  files.append(record);categories[kind]+=1
  # Never inspect credential material. File names are sufficient for inventory.
  sensitive=any(part in name.lower() for part in ['cookie','credential','.pem','private-key']) or name.startswith('.env')
  if sensitive or stat.st_size>24*1024*1024:continue
  if kind=='code' and ext=='.tsx' and rel.startswith('src/'):
   text=p.read_text(errors='replace');ui.append({'file':rel,'test_ids':sorted(set(re.findall(r'data-testid=["\x27]([^"\x27]+)',text))),'labels':sorted(set(re.findall(r'aria-label=["\x27]([^"\x27]+)',text)))})
  if ext not in text_ext:continue
  text=p.read_text(errors='replace')
  headings=[]
  for line_no,line in enumerate(text.splitlines(),1):
   for url in url_re.findall(line):
    if '/results?' in url:
     search_links[rel]+=1
     continue
    if urlsplit(url).hostname in {'drive.google.com','docs.google.com','www.youtube.com','youtube.com','youtu.be','www.reddit.com','reddit.com'} and len(links[url])<40:links[url].append({'file':rel,'line':line_no})
   heading=re.match(r'^(#{1,6})\s+(.+)',line)
   if heading:headings.append({'line':line_no,'title':heading.group(2)[:250]})
   refs=ref_re.findall(line)
   if refs:
    missing=[ref for ref in set(refs) if not (ROOT/ref).is_file()]
    if missing:claims.append({'file':rel,'line':line_no,'missing_references':missing,'excerpt':line[:300],'status':'reference_missing_not_a_verified_implementation'})
  if ext=='.md' or re.search(r'quiz|task|tutorial|mandate',name,re.I):
   normalized=[re.sub(r'\s*(?:\(Variation Iteration \d+\)|[—-] Phase \d+)','',re.sub(r'^\[[^]]+\]\s*','',h['title'])).strip() for h in headings]
   doc={'file':rel,'lines':len(text.splitlines()),'headings':headings,'distinct_normalized_headings':len(set(normalized)),'age_days':record['age_days'],'older_than_7_days':record['older_than_7_days'],'task_keyword_hits':len(re.findall(r'\b(?:quiz|quizzes|task|mandate|acceptance|must|failed|blocked|requested)\b',text,re.I))}
   docs.append(doc)
summary={'generated_at':now.isoformat(),'window_start_utc':cutoff.isoformat(),'age_source':'last tracked content change from Git; checkout mtimes are not evidence dates; untracked current-work files have unknown historical age','files':len(files),'tracked_files':sum(f.get('tracked',False) for f in files),'kinds':dict(categories),'media_files':sum(f.get('kind')=='media' for f in files),'png_screenshots':sum(f.get('extension')=='.png' and any(k in f['path'].lower() for k in ['screen','shot','evidence','proof']) for f in files),'older_than_7_days':sum(f.get('older_than_7_days') is True for f in files),'recent_7_days':sum(f.get('older_than_7_days') is False for f in files),'unknown_age':sum(f.get('age_days') is None for f in files),'missing_reference_occurrences':len(claims),'unique_missing_references':len({r for c in claims for r in c['missing_references']}),'indexed_source_urls':len(links),'generated_search_url_occurrences_by_file':dict(search_links),'ui_modules':len(ui),'excluded_generated_or_dependency_trees':exclusions,'limitations':['Inventory is not functional or visual acceptance.','Existing completion claims are not promoted to verified status.','Git dates can differ from capture dates; per-report dates require separate review.','No credential files were read.']}
for name,data in [('summary.json',summary),('file-inventory.json',files),('document-index.json',docs),('missing-references.json',claims),('link-index.json',[{'url':url,'references':refs} for url,refs in links.items()]),('ui-index.json',ui)]:
 (OUT/name).write_text(json.dumps(data,indent=2,ensure_ascii=True)+'\n')
with (OUT/'file-inventory.csv').open('w',newline='',errors='backslashreplace') as f:
 fields=['path','kind','extension','bytes','tracked','modified_in_current_work','git_last_change','age_days','older_than_7_days','width','height','regenerable_cache'];writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(files)
print(json.dumps(summary,indent=2))
print('Most repeated missing test references:',collections.Counter(r for c in claims for r in c['missing_references'] if r.startswith('qa/')).most_common(12))

# Recovery questions preserve every distinct historical feature/failure without inflating repetition.
questions=[]
for doc in docs:
 if doc['file'] not in {'New_failuer.md','new_feature_addede.md'}:continue
 groups=collections.defaultdict(list)
 for h in doc['headings'][1:]:
  title=re.sub(r'\s*(?:\(Variation Iteration \d+\)|[—-] Phase \d+)','',re.sub(r'^\[[^]]+\]\s*','',h['title'])).strip()
  groups[title].append(h['line'])
 for title,lines in groups.items():questions.append({'question':f"Can the current app demonstrate {title} with a reproducible test and a real artifact?",'source':doc['file'],'lines':lines,'repeated_declarations':len(lines),'status':'unverified_historical_claim','age_days':doc['age_days']})
(OUT/'historical-questions.json').write_text(json.dumps(questions,indent=2)+'\n')
