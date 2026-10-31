"""Render the exported GLBs in Blender Cycles, not a surrogate SVG/model."""
import bpy, math, os, sys, json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
root=os.path.abspath(args[0] if args else 'public/models/device_transitions')
out=os.path.abspath(args[1] if len(args)>1 else 'qa-output/device-transitions/model-previews')
os.makedirs(out,exist_ok=True)
manifest=[]
for filename in sorted(os.listdir(root)):
 if not filename.endswith('.glb'): continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=os.path.join(root,filename))
 screen=next((o for o in bpy.context.scene.objects if o.name=='ScreenSurface'),None)
 assert screen is not None, filename+' missing ScreenSurface'
 # Asymmetric original screen card proves UV orientation and visibility.
 image=bpy.data.images.new('Original UV card',width=256,height=256)
 pixels=[]
 for y in range(256):
  for x in range(256):
   if y>128: c=(.95,.12,.06,1) if x<128 else (.06,.8,.18,1)
   else: c=(.06,.2,.95,1) if x<128 else (.95,.65,.03,1)
   if abs(x-y)<3:c=(1,1,1,1)
   pixels.extend(c)
 image.pixels=pixels
 material=bpy.data.materials.new('UV proof display');material.use_nodes=True
 nodes=material.node_tree.nodes;nodes.clear();texture=nodes.new('ShaderNodeTexImage');texture.image=image
 emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=.8
 output=nodes.new('ShaderNodeOutputMaterial');material.node_tree.links.new(texture.outputs['Color'],emission.inputs['Color']);material.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
 screen.data.materials.clear();screen.data.materials.append(material)
 # Exporter converts from Blender's scene axes to glTF. The import correctly
 # restores Blender's world axes; derive camera directions from the screen.
 bpy.context.view_layer.update()
 center=sum((screen.matrix_world@v.co for v in screen.data.vertices),Vector())/len(screen.data.vertices)
 normal=(screen.matrix_world.to_3x3()@screen.data.polygons[0].normal).normalized()
 up=(screen.matrix_world.to_3x3()@Vector((0,1,0))).normalized();right=up.cross(normal).normalized()
 span=max((screen.matrix_world@a.co-screen.matrix_world@b.co).length for a in screen.data.vertices for b in screen.data.vertices)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=False
 scene.render.threads_mode='FIXED';scene.render.threads=2
 scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
 scene.world.color=(.12,.12,.12);scene.view_settings.view_transform='AgX'
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.lens=50
 for label,direction,power in [('Key',normal+right+up,55),('Rim',-normal-right+up,70),('Fill',normal-right,25)]:
  bpy.ops.object.light_add(type='AREA',location=center+direction*span*1.6);light=bpy.context.object;light.name=label;light.data.energy=power;light.data.shape='DISK';light.data.size=span*2;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 for label,side,vertical in [('front',0,.05),('three-quarter',.55,.2),('side',1.8,.15)]:
  camera.location=center+(normal+right*side+up*vertical).normalized()*span*2.3
  camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
  dest=os.path.join(out,filename[:-4]+'-'+label+'.png');scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
  manifest.append({'model':filename,'view':label,'file':os.path.relpath(dest,os.getcwd()),'renderer':'Blender Cycles 4.3.2 CPU','samples':12,'size':[512,512]})
with open(os.path.join(out,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
