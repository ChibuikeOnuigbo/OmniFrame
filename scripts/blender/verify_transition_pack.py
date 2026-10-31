import bpy,os,json
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
results=[]
for name in ['tv_crt_knobs_ph','tv_crt_silver_ph','arrow_oga','bullet_shell_oga','payphone_ph','concrete_shards_ph']:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets-source/transition-pack',name+'.blend'),load_ui=False,use_scripts=False)
    images=[image for image in bpy.data.images if image.source=='FILE' and image.users>0]
    assert all(image.packed_file for image in images),(name,'unpacked image dependency')
    expected=0 if name in ['arrow_oga','bullet_shell_oga'] else 3
    assert len(images)==expected,(name,'missing material maps',len(images))
    results.append({'id':name,'packedImages':len(images),'meshObjects':len([obj for obj in bpy.data.objects if obj.type=='MESH'])})
out=os.path.join(ROOT,'research/transition-assets/packed-source-check.json')
with open(out,'w') as f:json.dump({'passed':True,'results':results},f,indent=2)
print('PASS all six editable Blend files retain their packed texture dependencies')
