"""Render the first infantry batch from exported GLBs in both game-side colours."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
PALETTES = [('RED SIDE', {'team_cloth': '9b4f4f', 'team_paint': '7f3f3b'}),
            ('BLUE SIDE', {'team_cloth': '587493', 'team_paint': '3f5872'})]
MODELS = [('infantry_flail', 'FLAILMAN'), ('infantry_crossbow', 'CROSSBOWMAN'), ('infantry_pavise', 'PAVISE BEARER')]
def linear(h):
    values = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values)
def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
    return m
base=material('Display stone',(.18,.205,.17));ground=material('Studio',(.31,.34,.285))
labelmat=material('Label',(.65,.63,.48))
for row,(side,palette) in enumerate(PALETTES):
    for col,(name,label) in enumerate(MODELS):
        before=set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/3d/models/units'/f'{name}.glb'))
        added=set(bpy.context.scene.objects)-before
        anchor=bpy.data.objects.new(f'{side} {name}',None);bpy.context.collection.objects.link(anchor)
        for obj in added:
            if obj.parent is None: obj.parent=anchor
            if obj.type=='MESH':
                for slot in obj.material_slots:
                    source=slot.material
                    key=source.name.split('.')[0]
                    if key in palette:
                        copy=source.copy();color=linear(palette[key]);copy.diffuse_color=(*color,1)
                        copy.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
                        slot.material=copy
        # Figures face downstage, presented at a shared physical scale.
        anchor.rotation_euler.z=-math.pi/2
        anchor.location=((col-1)*2.1, row*2.6, .10)
        bpy.ops.mesh.primitive_cube_add(size=1, location=((col-1)*2.1,row*2.6,.035))
        tile=bpy.context.object;tile.scale=(1.85,1.85,.13);tile.data.materials.append(base)
        bevel=tile.modifiers.new('Soft display edge','BEVEL');bevel.width=.06;bevel.segments=1
        bpy.ops.object.text_add(location=((col-1)*2.1,row*2.6-.82,.12),rotation=(0,0,0))
        t=bpy.context.object;t.data.body=label;t.data.align_x='CENTER';t.data.size=.125;t.data.extrude=0;t.data.materials.append(labelmat)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.06));bpy.context.object.data.materials.append(ground)
target=Vector((0,1.25,.70));bpy.ops.object.camera_add(location=(5.2,-9.8,9.5));cam=bpy.context.object
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.65
scene=bpy.context.scene;scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,-4,9));light=bpy.context.object;light.data.energy=1800;light.data.size=7
light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Studio world')
scene.world.color=(.4,.4,.4);scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1440;scene.render.resolution_y=1120;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'tools/art/blender/previews/infantry-batch.png')
bpy.ops.render.render(write_still=True)
