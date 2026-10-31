"""Normalize licensed sources, preserve PBR maps, add live-video surfaces and shard rig.
No source Blend scripts are opened/executed. Requires fetch-transition-sources.py first.
"""
import bpy,math,os,json,random,sys
from mathutils import Matrix,Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
CACHE='/workspace/reference-3d'
PROPS=os.path.join(ROOT,'public/models/transition_assets');DEVICES=os.path.join(ROOT,'public/models/device_transitions')
SOURCE=os.path.join(ROOT,'assets-source/transition-pack')
for directory in [PROPS,DEVICES,SOURCE]:os.makedirs(directory,exist_ok=True)
FRONT=Matrix.Rotation(-math.pi/2,4,'X')

def clear():bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=color;s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough
    return m
def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']
def bounds():
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in meshes() for v in o.data.vertices]
    return Vector(tuple(min(p[i] for p in points) for i in range(3))),Vector(tuple(max(p[i] for p in points) for i in range(3)))
def bake(rotation):
    bpy.context.view_layer.update()
    for o in meshes():
        m=rotation@o.matrix_world;o.parent=None;o.matrix_world=Matrix.Identity(4);o.data=o.data.copy();o.data.transform(m);o.data.update()
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    bpy.context.view_layer.update()
def save(name,directory,metadata):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,name+'.blend'),compress=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(directory,name+'.glb'),export_format='GLB',export_yup=False,use_selection=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
    metadata.update({'id':name,'path':name+'.glb','editableSource':'assets-source/transition-pack/'+name+'.blend','coordinateSystem':'+Y up, +Z front','textures':'embedded; no external runtime URLs'})
    with open(os.path.join(directory,name+'.json'),'w') as f:json.dump(metadata,f,indent=2,ensure_ascii=False)
def load_gltf(asset):bpy.ops.import_scene.gltf(filepath=os.path.join(CACHE,asset,asset+'.gltf'))
def video_surface(name,width,height,z=0,cx=0,cy=0):
    radius=min(width,height)*.065;vertices=[]
    for x,y,a in [(width/2-radius,-height/2+radius,-math.pi/2),(width/2-radius,height/2-radius,0),(-width/2+radius,height/2-radius,math.pi/2),(-width/2+radius,-height/2+radius,math.pi)]:
        for i in range(9):
            angle=a+i*math.pi/16;vertices.append((cx+x+radius*math.cos(angle),cy+y+radius*math.sin(angle),z))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[tuple(range(len(vertices)))]);mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        for li in p.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co;mesh.uv_layers.active.data[li].uv=((v.x-cx)/width+.5,(v.y-cy)/height+.5)
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(material('Live video replacement',(0.03,.04,.06,1)))
    return obj

for asset,name,screen in [
    ('Television_01','tv_crt_knobs_ph',(-.056,.248,.216,.388,.268)),
    ('television_02','tv_crt_silver_ph',(-.003,.259,.125,.326,.236)),
]:
    clear();load_gltf(asset);bake(FRONT)
    cx,cy,z,w,h=screen
    for o in meshes():o.data.transform(Matrix.Translation((-cx,-cy,-z)))
    video_surface('ScreenSurface',w,h)
    save(name,DEVICES,{'kind':'tv','format':'glb','screenObject':'ScreenSurface','screenWidthMeters':w,'screenHeightMeters':h,'screenAspect':w/h,'sourceAsset':asset,'source':'Poly Haven','sourceLicense':'CC0-1.0','modifications':'Normalized front/origin and fitted a separate live-video surface; original body PBR maps preserved.'})

clear();bpy.ops.wm.obj_import(filepath=os.path.join(CACHE,'arrows/arrow1.obj'));bake(FRONT)
lo,hi=bounds();center=(lo+hi)/2;scale=2.2/(hi-lo).x
gold=material('OmniFrame warm metallic gold',(1,.48,.055,1),.8,.23)
for o in meshes():o.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-center));o.data.materials.clear();o.data.materials.append(gold);o.name='ArrowChevrons'
save('arrow_oga',PROPS,{'source':'OpenGameArt / Savino','sourceLicense':'CC0-1.0','sourceAsset':'arrow1.obj','modifications':'Reoriented, normalized and assigned original gold PBR material. Original arrow source has no textures.'})

clear();bpy.ops.import_scene.fbx(filepath=os.path.join(CACHE,'Pistol3D/bulletShell.fbx'))
# X is the direction of travel. Original shell's long axis is Y.
rotation=Matrix(((0,1,0,0),(0,0,1,0),(1,0,0,0),(0,0,0,1)));bake(rotation)
lo,hi=bounds();center=(lo+hi)/2;scale=1.8/max(hi-lo)
for o in meshes():
    o.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-center));o.name='BulletShell'
    for m in o.data.materials:
        if not m.use_nodes:continue
        shader=m.node_tree.nodes.get('Principled BSDF')
        if shader:shader.inputs['Metallic'].default_value=.75;shader.inputs['Roughness'].default_value=.27
save('bullet_shell_oga',PROPS,{'source':'OpenGameArt / AlexanderZotov','sourceLicense':'CC0-1.0','sourceAsset':'bulletShell.fbx','modifications':'Only the shell geometry is included, not the pistol. Reoriented/normalized; original material colors retained with metallic response.'})

clear();load_gltf('korean_public_payphone_01');bake(FRONT)
lo,hi=bounds();center=(lo+hi)/2;scale=2.2/max(hi-lo)
for o in meshes():
    o.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-center));bpy.context.view_layer.objects.active=o
    dec=o.modifiers.new('Preview geometry budget','DECIMATE');dec.ratio=.18;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
save('payphone_ph',PROPS,{'source':'Poly Haven / UM JOORIN','sourceLicense':'CC0-1.0','sourceAsset':'korean_public_payphone_01','modifications':'Normalized and decimated to 18% of source faces; original base-color, normal and metallic/roughness maps retained.'})

# Convex Voronoi cells tile the full image plane; each is a real separate prism.
clear();m=material('Poly Haven cracked concrete',(1,1,1,1),0,.8);nodes=m.node_tree.nodes;links=m.node_tree.links;shader=nodes.get('Principled BSDF')
for kind in ['diff','nor_gl','arm']:
    tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(os.path.join(CACHE,'cracked_concrete','textures',f'cracked_concrete_{kind}_1k.jpg'))
    if kind=='diff':links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    else:
        tex.image.colorspace_settings.name='Non-Color'
        if kind=='nor_gl':
            normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        else:
            separate=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],separate.inputs['Color']);links.new(separate.outputs['Green'],shader.inputs['Roughness']);links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
def clip_half(poly,a,b,c):
    out=[]
    for i,p in enumerate(poly):
        q=poly[(i+1)%len(poly)];dp=a*p[0]+b*p[1]-c;dq=a*q[0]+b*q[1]-c
        if dp<=1e-9:out.append(p)
        if (dp<0)!=(dq<0):
            t=dp/(dp-dq);out.append((p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t))
    return out
rng=random.Random(207);points=[(-1+(x+.5+rng.uniform(-.28,.28))*2/7,-1+(y+.5+rng.uniform(-.28,.28))*2/5) for y in range(5) for x in range(7)]
for index,p in enumerate(points):
    polygon=[(-1,-1),(1,-1),(1,1),(-1,1)]
    for q in points:
        if p==q:continue
        polygon=clip_half(polygon,2*(q[0]-p[0]),2*(q[1]-p[1]),q[0]**2+q[1]**2-p[0]**2-p[1]**2)
    cx=sum(v[0] for v in polygon)/len(polygon);cy=sum(v[1] for v in polygon)/len(polygon)
    group=bpy.data.objects.new(f'Fragment_{index:02d}',None);bpy.context.collection.objects.link(group);group.location=(cx,cy,0)
    polygon=[(cx+(x-cx)*.996,cy+(y-cy)*.996) for x,y in polygon];n=len(polygon)
    vertices=[(x-cx,y-cy,z) for z in [-.045,.012] for x,y in polygon]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(f'ShardMesh_{index:02d}');mesh.from_pydata(vertices,[],faces);mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        for li in face.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co;mesh.uv_layers.active.data[li].uv=((v.x+cx)/2+.5,(v.y+cy)/2+.5)
    body=bpy.data.objects.new(f'ConcreteShard_{index:02d}',mesh);bpy.context.collection.objects.link(body);body.parent=group;body.data.materials.append(m)
    frontmesh=bpy.data.meshes.new(f'VideoFace_{index:02d}');frontmesh.from_pydata([(x-cx,y-cy,.014) for x,y in polygon],[],[tuple(range(n))]);frontmesh.uv_layers.new(name='UVMap')
    for face in frontmesh.polygons:
        for li in face.loop_indices:
            v=frontmesh.vertices[frontmesh.loops[li].vertex_index].co;frontmesh.uv_layers.active.data[li].uv=((v.x+cx)/2+.5,(v.y+cy)/2+.5)
    video=bpy.data.objects.new(f'VideoShard_{index:02d}',frontmesh);bpy.context.collection.objects.link(video);video.parent=group;video.data.materials.append(material('Video face '+str(index),(.18,.2,.23,1)))
save('concrete_shards_ph',PROPS,{'source':'OmniFrame Voronoi geometry + Poly Haven / Dimitrios Savva material','sourceLicense':'CC0-1.0 (material)','sourceAsset':'cracked_concrete','fragmentCount':len(points),'videoFaces':'VideoShard_* with full-image UVs','modifications':'Original deterministic 35-piece prism rig with mapped CC0 concrete backs/edges and separate live-video fronts; no physics simulation claimed.'})
print('Built two textured live-screen TVs and four 3D transition props')
