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
    "phone_modern_black": ("phone", 0.075, 0.155, 0.008, 0.004, (0.055,0.061,0.072,1)),
    "phone_modern_silver": ("phone", 0.075, 0.155, 0.008, 0.004, (0.57,0.61,0.67,1)),
    "phone_frameless_dark": ("phone", 0.074, 0.159, 0.004, 0.004, (0.09,0.10,0.12,1)),
    "monitor_gaming_black": ("monitor", 0.320, 0.182, 0.011, 0.015, (0.028,0.030,0.037,1)),
    "monitor_clean_office": ("monitor", 0.320, 0.182, 0.009, 0.012, (0.19,0.20,0.22,1)),
    "tv_flat_black": ("tv", 0.440, 0.248, 0.007, 0.012, (0.024,0.025,0.029,1)),
    "laptop_open_dark": ("laptop", 0.310, 0.190, 0.008, 0.009, (0.075,0.082,0.092,1)),
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
    body=box("Outer shell", (0,0,-thick*.7),(w+bezel*2,h+bezel*2,thick*2.2),frame,bevel*.8)
    body.parent=root
    screen=box("ScreenSurface", (0,0,thick*.45),(w,h,0.0005),glass,min(bezel*.2,.0006))
    screen.parent=root
    bezel_mesh=box("Front frame", (0,0,thick*.10),(w+bezel*1.65,h+bezel*1.65,thick*.5),dark,bezel*.45)
    bezel_mesh.parent=root
    # Depth order: opaque front ring at Z=.1t; ScreenSurface Z=.45t.
    # This uses a full front panel underneath the screen, not a chroma green cutout.
    # The emission-screen material can be reassigned dynamically in glTF/Three.js.
    if kind=="monitor":
        stem=box("Pedestal neck", (0,-h/2-.035,-thick*1.3),(.018,.080,.016),frame,.004)
        base=box("Pedestal foot", (0,-h/2-.075,-thick*1.0),(.145,.026,.085),frame,.006)
        stem.parent=root;base.parent=root
    elif kind=="tv":
        for x in (-w*.37,w*.37):
            foot=box("TV foot", (x,-h/2-.019,-thick),(.054,.035,.070),dark,.003)
            foot.parent=root
    elif kind=="laptop":
        deck=box("Keyboard deck", (0,-h/2-.057,-h*.28),(w+bezel*2,.125,.009),frame,.005)
        deck.parent=root
        kb=box("Keyboard insert", (0,-h/2-.05,-h*.272),(w*.79,.074,.001),dark,.002)
        kb.parent=root
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
    print("SAVED",glb)

for name,data in DEVICES.items():
    build(name,*data)
print("Created",len(DEVICES),"original source models in",OUT)
