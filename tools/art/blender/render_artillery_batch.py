"""Render exported artillery with independently placed red/blue gun crews."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
PALETTES=[{'team_cloth':'9b4f4f','team_paint':'7f3f3b'},
          {'team_cloth':'587493','team_paint':'3f5872'}]
MODELS=[('artillery_houfnice','HOUFNICE'),('artillery_tarasnice','TARASNICE'),('artillery_bombard','BOMBARDA')]

def linear(h):
    channels=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in channels)

def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    shader=m.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.9
    return m

def model(name,parent,position,palette,scale=1):
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/models/units'/f'{name}.glb'))
    added=set(bpy.context.scene.objects)-before
    anchor=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(anchor)
    anchor.parent=parent;anchor.location=position;anchor.scale=(scale,)*3
    for obj in added:
        if obj.parent is None: obj.parent=anchor
        if obj.type=='MESH':
            for slot in obj.material_slots:
                source=slot.material;key=source.name.split('.')[0]
                if key in palette:
                    copy=source.copy();color=linear(palette[key]);copy.diffuse_color=(*color,1)
                    copy.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
                    slot.material=copy

base=material('Display stone',(.18,.205,.17));ground=material('Studio',(.31,.34,.285))
labelmat=material('Label',(.65,.63,.48))
for row,palette in enumerate(PALETTES):
    for col,(name,label) in enumerate(MODELS):
        anchor=bpy.data.objects.new(label,None);bpy.context.collection.objects.link(anchor)
        anchor.location=((col-1)*4.0,row*4.1,.10);anchor.rotation_euler.z=-math.pi/2
        model(name,anchor,(0,0,0),palette)
        for side in (-1,1): model('artillery_gunner',anchor,(-.5,side*1.2,0),palette,1.05)
        bpy.ops.mesh.primitive_cube_add(size=1,location=((col-1)*4.0,row*4.1,.035))
        tile=bpy.context.object;tile.scale=(3.65,3.70,.13);tile.data.materials.append(base)
        bevel=tile.modifiers.new('Display edge','BEVEL');bevel.width=.06;bevel.segments=1
        bpy.ops.object.text_add(location=((col-1)*4.0,row*4.1-1.62,.12))
        text=bpy.context.object;text.data.body=label;text.data.align_x='CENTER';text.data.size=.19;text.data.materials.append(labelmat)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.06));bpy.context.object.data.materials.append(ground)
target=Vector((0,2,.55));bpy.ops.object.camera_add(location=(7.5,-14,13))
cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=13.7
scene=bpy.context.scene;scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-4,-6,13));light=bpy.context.object;light.data.energy=3200;light.data.size=10
light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Studio world');scene.world.color=(.4,.4,.4)
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1600;scene.render.resolution_y=1120;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'tools/art/blender/previews/artillery-batch.png')
bpy.ops.render.render(write_still=True)
