"""Same-scale gallery of the nine exported settlement GLBs.

Run with Blender; optionally append -- --output /tmp/settlement-batch.png.
Reads model files directly, without a manifest or catalog, and exports no assets.
"""
import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_fortification_batch import bounds, material, mesh_points


ROOT = Path(__file__).resolve().parents[3]
MODELS = [
    ('church_gothic', 'GOTHIC CHURCH', (-10.1, 8.2), (8.6, 13.1)),
    ('monastery_wing', 'MONASTERY WING', (1.0, 8.3), (9.2, 5.5)),
    ('townhouse', 'TOWNHOUSE', (11.0, 8.1), (5.6, 7.2)),
    ('house_timber', 'TIMBER COTTAGE', (-11.3, -4.2), (6.3, 5.6)),
    ('house_plaster', 'PLASTER COTTAGE', (-2.1, -3.1), (6.3, 6.0)),
    ('barn', 'BARN', (7.1, -3.0), (7.3, 5.9)),
    ('shed', 'SHED', (-7.0, -11.0), (4.2, 3.8)),
    ('well', 'ROOFED WELL', (-.5, -11.0), (3.6, 3.6)),
    ('fence_gate', 'OPEN FENCE GATE', (8.2, -11.0), (6.7, 3.5)),
]


def import_model(name, position):
    directory = 'props' if name in {'well', 'fence_gate'} else 'buildings'
    path = ROOT/'assets/3d/models'/directory/(name+'.glb')
    if not path.is_file():
        raise FileNotFoundError(f'Build {name} with build_assets.py before rendering: {path}')
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    added = set(bpy.context.scene.objects)-before
    bpy.context.view_layer.update()
    lo, hi = bounds(mesh_points(added))
    centre = (lo+hi)/2
    anchor = bpy.data.objects.new(name+'_display', None)
    bpy.context.collection.objects.link(anchor)
    for obj in added:
        if obj.parent is None:
            obj.parent = anchor
    anchor.location = (position[0]-centre.x, position[1]-centre.y, .16-lo.z)
    return list(added)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path,
                        default=ROOT/'tools/art/blender/previews/settlement-batch.png')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stone = material('Settlement display stone', (.21, .235, .192))
    floor = material('Settlement studio floor', (.32, .345, .287))
    lettering = material('Settlement labels', (.71, .69, .565))
    contents = []
    for name, label, position, tile_size in MODELS:
        contents.extend(import_model(name, position))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(*position, .075))
        tile = bpy.context.object
        tile.name = name+'_display_tile'
        tile.scale = (*tile_size, .15)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        tile.data.materials.append(stone)
        bevel = tile.modifiers.new('Display edge', 'BEVEL')
        bevel.width = .055
        bevel.segments = 1
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        contents.append(tile)
        bpy.ops.object.text_add(location=(position[0], position[1]-tile_size[1]/2+.19, .161))
        label_obj = bpy.context.object
        label_obj.name = name+'_display_label'
        label_obj.data.body = label
        label_obj.data.align_x = 'CENTER'
        label_obj.data.size = .31
        label_obj.data.materials.append(lettering)
        bpy.ops.object.convert(target='MESH')
        contents.append(bpy.context.object)
    bpy.context.view_layer.update()
    points = mesh_points(contents)
    lo, hi = bounds(points)
    target = (lo+hi)/2
    bpy.ops.object.camera_add(location=target+Vector((17, -36, 32)))
    camera = bpy.context.object
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1650
    scene.render.resolution_percentage = 100
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    screen_lo, screen_hi = bounds([inverse @ point for point in points])
    aspect = scene.render.resolution_x/scene.render.resolution_y
    camera.data.ortho_scale = max(screen_hi.x-screen_lo.x,
                                 (screen_hi.y-screen_lo.y)*aspect)*1.14
    shift = camera.matrix_world.to_quaternion() @ Vector(
        ((screen_lo.x+screen_hi.x)/2, (screen_lo.y+screen_hi.y)/2, 0))
    camera.location += shift
    bpy.ops.mesh.primitive_plane_add(size=250, location=(0, 0, -.025))
    bpy.context.object.data.materials.append(floor)
    bpy.ops.object.light_add(type='AREA', location=(-10, -15, 31))
    light = bpy.context.object
    light.data.energy = 16000
    light.data.shape = 'DISK'
    light.data.size = 21
    light.rotation_euler = (target-light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.world = bpy.data.worlds.new('Settlement studio world')
    scene.world.color = (.42, .42, .42)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = 'AgX'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(args.output.resolve())
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
