"""Inspect downloaded geometry without executing source Blend scripts."""
import bpy,sys,json,math,os
from mathutils import Vector
root='/workspace/reference-3d'
out=os.path.join(root,'inspection');os.makedirs(out,exist_ok=True)
records=[]
for name in ['Television_01','television_02','korean_public_payphone_01','arrows','bulletShell']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if name=='arrows':bpy.ops.wm.obj_import(filepath=os.path.join(root,'arrows','arrow1.obj'))
    elif name=='bulletShell':bpy.ops.import_scene.fbx(filepath=os.path.join(root,'Pistol3D','bulletShell.fbx'))
    else:bpy.ops.import_scene.gltf(filepath=os.path.join(root,name,name+'.gltf'))
    objects=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    points=[obj.matrix_world@Vector(v) for obj in objects for v in obj.bound_box]
    minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)));maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center=(minimum+maximum)/2;size=maximum-minimum
    record={'id':name,'min':list(minimum),'max':list(maximum),'size':list(size),'objects':[{'name':o.name,'verts':len(o.data.vertices),'materials':[m.name for m in o.data.materials]} for o in objects]}
    records.append(record)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=False
    scene.render.resolution_x=400;scene.render.resolution_y=400;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    world=bpy.data.worlds.new('Studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.18,.22,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for pos in [(-2,-3,4),(3,2,4)]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(pos)*max(size));light=bpy.context.object;light.data.energy=180*max(size)**2;light.data.shape='DISK';light.data.size=max(size)*3
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=max(size)*1.4
    for i,position in enumerate([(0,-4,.6),(0,4,.6),(4,0,.6),(-4,0,.6)]):
        camera.location=center+Vector(position)*max(size)
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=os.path.join(out,f'{name}-{i}.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(out,'geometry.json'),'w') as f:json.dump(records,f,indent=2)
