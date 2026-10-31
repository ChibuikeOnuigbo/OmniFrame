"""OmniFrame original device model factory. Requires Blender 4.2+; no external images.
Run: blender --background --python scripts/blender/generate_device_pack.py -- --out public/models/device_transitions
Creates physically modeled GLB devices with a dedicated ScreenSurface mesh and rig root.
Does not claim to render or install Blender in environments where Blender is absent.
"""
import bpy, math, json, os, sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[ARGS.index("--out") + 1]) if "--out" in ARGS else os.path.abspath("public/models/device_transitions")
os.makedirs(OUT, exist_ok=True)
DEVICES = {
    "phone_modern_black": ("phone", 0.075, 0.155, 0.0018, 0.004, (0.055,0.061,0.072,1)),
    "phone_modern_silver": ("phone", 0.075, 0.155, 0.0022, 0.004, (0.57,0.61,0.67,1)),
    "phone_frameless_dark": ("phone", 0.074, 0.159, 0.0009, 0.004, (0.09,0.10,0.12,1)),
    "monitor_gaming_black": ("monitor", 0.530, 0.298, 0.006, 0.012, (0.028,0.030,0.037,1)),
    "monitor_clean_office": ("monitor", 0.530, 0.298, 0.004, 0.010, (0.19,0.20,0.22,1)),
    "tv_flat_black": ("tv", 0.960, 0.540, 0.005, 0.015, (0.024,0.025,0.029,1)),
    "laptop_open_dark": ("laptop", 0.310, 0.190, 0.004, 0.005, (0.075,0.082,0.092,1)),
}

def mat(name, color, metallic, roughness):
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = color
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = roughness
    return m

def box(name, loc, dims, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new("Machined edge bevel", "BEVEL")
        mod.width = bevel; mod.segments = 5
        if hasattr(mod, "affect"): mod.affect = "EDGES"
        mod2 = o.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return o

def build(name, kind, w, h, bezel, thick, col):
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
    frame = mat("Anodized frame",col,0.74 if kind!="tv" else 0.25,0.29)
    glass = mat("Screen glass", (0.018,0.024,0.034,1),0.08,0.19)
    dark = mat("Dark polymer", (0.025,0.027,0.032,1),0,0.38)
    root = bpy.data.objects.new("DeviceRig_ROOT",None); bpy.context.collection.objects.link(root)
    root.empty_display_type="PLAIN_AXES"
    # Author in XY with front +Z; cancel Blender's Z-up -> glTF Y-up
    # conversion so consumers see the documented +Y-up, +Z-front device.
    root.rotation_euler.x = math.pi / 2
    body=box("Outer shell", (0,0,-thick*.7),(w+bezel*2,h+bezel*2,thick*2.2),frame,bezel*.8)
    body.parent=root
    # An explicit front-facing display quad, not cube-atlas UVs. Its full
    # 0..1 UV rectangle is ready for a dynamic video texture.
    mesh = bpy.data.meshes.new("Display quad UV")
    z = thick * .45
    vertices=[]
    radius=.004 if kind=="phone" else .0009
    for cx,cy,start in [(w/2-radius,-h/2+radius,-math.pi/2),(w/2-radius,h/2-radius,0),(-w/2+radius,h/2-radius,math.pi/2),(-w/2+radius,-h/2+radius,math.pi)]:
        for i in range(9):
            a=start+i*math.pi/16
            vertices.append((cx+radius*math.cos(a),cy+radius*math.sin(a),z))
    mesh.from_pydata(vertices, [], [tuple(range(len(vertices)))])
    mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for li in polygon.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            mesh.uv_layers.active.data[li].uv=(v.x/w+.5,v.y/h+.5)
    screen=bpy.data.objects.new("ScreenSurface", mesh)
    bpy.context.collection.objects.link(screen)
    screen.data.materials.append(glass)
    screen.parent=root
    bezel_mesh=box("Front frame", (0,0,thick*.10),(w+bezel*1.65,h+bezel*1.65,thick*.5),dark,bezel*.45)
    bezel_mesh.parent=root
    # Depth order: opaque front ring at Z=.1t; ScreenSurface Z=.45t.
    # This uses a full front panel underneath the screen, not a chroma green cutout.
    # The emission-screen material can be reassigned dynamically in glTF/Three.js.
    if kind=="monitor":
        stem=box("Pedestal neck", (0,-h/2-.035,-thick*1.3),(.018,.080,.016),frame,.004)
        base=box("Pedestal foot", (0,-h/2-.075,.015),(.145,.009,.085),frame,.006)
        stem.parent=root;base.parent=root
        if "gaming" in name:
            bpy.data.objects.remove(base,do_unlink=True)
            for side in (-1,1):
                foot=box("Gaming V foot", (side*.053,-h/2-.075,.03),(.12,.009,.025),frame,.004)
                foot.rotation_euler.y=side*.42;foot.parent=root
    elif kind=="tv":
        for x in (-w*.37,w*.37):
            foot=box("TV foot", (x,-h/2-.019,-thick),(.054,.035,.070),dark,.003)
            foot.parent=root
    elif kind=="laptop":
        deck=box("Keyboard deck", (0,-h/2-.016,.085),(w+bezel*2,.009,.19),frame,.005)
        deck.parent=root
        kb=box("Keyboard insert", (0,-h/2-.010,.065),(w*.79,.001,.09),dark,.002)
        kb.parent=root
        trackpad=box("Trackpad", (0,-h/2-.010,.137),(w*.33,.001,.037),dark,.002)
        trackpad.parent=root
        hinge=box("Hinge pivot", (0,-h/2-.011,-thick*.5),(w*.78,.012,.012),dark,.003)
        hinge.parent=root
    if kind=="phone":
        for y in (.025, .047):
            button=box("Side button", (w/2+bezel*.85,y,-thick*.45),(.0018,.016,.003),frame,.0006)
            button.parent=root
        camera=box("Rear camera housing", (-w*.27,h*.32,-thick*1.88),(.024,.031,.003),dark,.003)
        camera.parent=root
        for dx,dy in [(-.005,-.007),(.005,.007)]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.0035,depth=.001,location=(-w*.27+dx,h*.32+dy,-thick*2.12))
            lens=bpy.context.object;lens.name="Rear camera lens";lens.data.materials.append(glass);lens.parent=root
        speaker=box("Speaker opening", (0,h/2+bezel*.45,thick*.37),(.018,.0008,.0005),dark,.0002)
        speaker.parent=root
    # Position in a coordinate system where the display faces +Z and +Y is up.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    glb=os.path.join(OUT,name+".glb")
    bpy.ops.export_scene.gltf(filepath=glb,export_format="GLB",export_apply=False,
       export_yup=True, use_selection=True)
    meta={
      "id":name,"kind":kind,"format":"glb","path":name+".glb",
      "screenObject":"ScreenSurface","rigRoot":"DeviceRig_ROOT",
      "screenWidthMeters":w,"screenHeightMeters":h,
      "screenAspect":round(w/h,6),
      "screenUV":[[0,1],[1,1],[1,0],[0,0]],
      "renderMode":"dynamic-glTF-screen-texture",
      "unit":"meter","authoredBy":"OmniFrame procedural Blender source"
    }
    with open(os.path.join(OUT,name+".json"),"w",encoding="utf8") as f:json.dump(meta,f,indent=2)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,name+".blend"))
    print("SAVED",glb)

for name,data in DEVICES.items():
    build(name,*data)
print("Created",len(DEVICES),"original source models in",OUT)
