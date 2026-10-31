"""Recover public licensed 3D sources; verify published sizes/hashes, never use viewer caches."""
import argparse,hashlib,json,subprocess,zipfile,re
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--cache',type=Path,default=Path('/workspace/reference-3d'))
parser.add_argument('--manifest',type=Path,default=Path('research/transition-assets/source-manifest.json'))
args=parser.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
records=[]
def fetch(url,destination,expected=None):
    destination.parent.mkdir(parents=True,exist_ok=True)
    if not destination.exists():
        temporary=destination.with_name(destination.name+'.part')
        subprocess.run(['curl','--fail','--location','--connect-timeout','15','--max-time','60','--max-filesize','104857600','--silent','--show-error','--output',str(temporary),url],check=True)
        temporary.replace(destination)
    data=destination.read_bytes()
    if expected:
        if len(data)!=expected['size']:raise ValueError('Size mismatch: '+str(destination))
        if hashlib.md5(data).hexdigest()!=expected['md5']:raise ValueError('MD5 mismatch: '+str(destination))
    return {'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'file':str(destination.relative_to(args.cache))}

catalog_path=args.cache/'polyhaven-models.json'
fetch('https://api.polyhaven.com/assets?t=models',catalog_path)
catalog=json.loads(catalog_path.read_text())
textures_path=args.cache/'polyhaven-textures.json'
fetch('https://api.polyhaven.com/assets?t=textures',textures_path)
texture_catalog=json.loads(textures_path.read_text())
for asset in ['Television_01','television_02','korean_public_payphone_01','cracked_concrete']:
    manifest_path=args.cache/(asset+'-files.json')
    fetch('https://api.polyhaven.com/files/'+asset,manifest_path)
    manifest=json.loads(manifest_path.read_text());gltf=manifest['gltf']['1k']['gltf']
    folder=args.cache/asset
    files=[]
    if asset!='cracked_concrete':files.append(fetch(gltf['url'],folder/(asset+'.gltf'),gltf))
    for name,entry in gltf['include'].items():
        if asset=='cracked_concrete' and not name.startswith('textures/'):continue
        if '..' in Path(name).parts or Path(name).is_absolute():raise ValueError('Unsafe source path')
        files.append(fetch(entry['url'],folder/name,entry))
    records.append({'id':asset,'source':'Poly Haven','sourcePage':'https://polyhaven.com/a/'+asset,'license':'CC0-1.0','licenseURL':'https://polyhaven.com/license','authors':(catalog.get(asset) or texture_catalog.get(asset) or {}).get('authors',{}),'kind':'PBR material' if asset=='cracked_concrete' else '3D model','resolution':'1k','files':files})

for name,url,page,author in [
    ('arrows.zip','https://opengameart.org/sites/default/files/arrows.zip','https://opengameart.org/content/arrow-symbols','Savino'),
    ('Pistol3D.zip','https://opengameart.org/sites/default/files/Pistol3D.zip','https://opengameart.org/content/3d-low-poly-pistol-with-bullet-shell','AlexanderZotov'),
]:
    archive=args.cache/name;file=fetch(url,archive)
    out=args.cache/archive.stem;out.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            path=(out/entry.filename).resolve()
            if not path.is_relative_to(out.resolve()):raise ValueError('Unsafe archive path')
            if entry.is_dir():path.mkdir(parents=True,exist_ok=True)
            else:
                path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(z.read(entry))
    records.append({'id':archive.stem,'source':'OpenGameArt','sourcePage':page,'license':'CC0-1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/','authors':author,'kind':'3D model archive','selectedFiles':['arrow1.obj'] if name=='arrows.zip' else ['bulletShell.fbx'],'files':[file]})
args.manifest.parent.mkdir(parents=True,exist_ok=True)
args.manifest.write_text(json.dumps({'assets':records,'scope':'Original source cache is separate from optimized runtime GLBs. Geometry/material modifications are recorded by the Blender build. Sketchfab downloads require authentication and are not claimed as acquired.'},indent=2,ensure_ascii=False)+'\n')
print('Verified',len(records),'public source packages/materials')
