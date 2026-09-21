"""Review the remaining roster roles from their final GLBs on six display tiles."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
PALETTES={'red':{'team_cloth':'9b4f4f','team_paint':'7f3f3b'},'blue':{'team_cloth':'587493','team_paint':'3f5872'}}

def linear(h):
    v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)

def material(name,color):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
    return mat

def model(name,parent,position,palette,scale=1):
    import json
    paths=json.loads((ROOT/'assets/3d/model-paths.json').read_text())
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d'/paths[name]))
    objects=set(bpy.context.scene.objects)-before
    anchor=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(anchor)
    anchor.parent=parent;anchor.location=position;anchor.scale=(scale,)*3
    for obj in objects:
        if obj.parent is None:obj.parent=anchor
        if obj.type=='MESH':
            for slot in obj.material_slots:
                source=slot.material;key=source.name.split('.')[0]
                if key in PALETTES[palette]:
                    copy=source.copy();colour=linear(PALETTES[palette][key]);copy.diffuse_color=(*colour,1)
                    copy.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*colour,1);slot.material=copy

panels=[
 ('PILGRIMS','red',[('civilian_adult',(0,-.60,0),1),('civilian_woman',(0,.60,0),1),('civilian_child',(.50,.02,0),1)]),
 ('FIELD CAPTAIN','red',[('commander_captain',(0,0,0),1.2),('commander_standard',(-.25,.82,0),.70)]),
 ('ARMOURED NOBLE','blue',[('commander_noble',(0,0,0),1.2),('commander_standard',(-.25,.82,0),.70)]),
 ('CLERIC','red',[('commander_cleric',(0,0,0),1.2),('commander_standard',(-.25,.82,0),.70)]),
 ('DISMOUNTED KNIGHT','blue',[('infantry_dismounted',(0,0,0),1.15)]),
 ('FIELD GARRISON','red',[('field_blockhouse',(0,0,0),.86)]),
]
base=material('Display stone',(.18,.205,.17));ground=material('Studio',(.31,.34,.285));labelmat=material('Label',(.65,.63,.48))
for i,(title,palette,figures) in enumerate(panels):
    col=i%3;row=i//3
    anchor=bpy.data.objects.new(title,None);bpy.context.collection.objects.link(anchor)
    anchor.location=((col-1)*3.6,row*3.6,.10);anchor.rotation_euler.z=-math.pi/2
    for name,position,scale in figures:model(name,anchor,position,palette,scale)
    bpy.ops.mesh.primitive_cube_add(size=1,location=((col-1)*3.6,row*3.6,.035))
    tile=bpy.context.object;tile.scale=(3.3,3.3,.13);tile.data.materials.append(base)
    bevel=tile.modifiers.new('Display edge','BEVEL');bevel.width=.06;bevel.segments=1
    bpy.ops.object.text_add(location=((col-1)*3.6,row*3.6-1.48,.12))
    obj=bpy.context.object;obj.data.body=title;obj.data.align_x='CENTER';obj.data.size=.15;obj.data.materials.append(labelmat)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.06));bpy.context.object.data.materials.append(ground)
target=Vector((0,1.8,.60));bpy.ops.object.camera_add(location=(6.4,-11.4,11.8));cam=bpy.context.object
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=13.4
scene=bpy.context.scene;scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-4,-6,11));light=bpy.context.object;light.data.energy=2700;light.data.size=8
light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Studio world');scene.world.color=(.4,.4,.4)
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1600;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'tools/art/blender/previews/unit-completion.png')
bpy.ops.render.render(write_still=True)
