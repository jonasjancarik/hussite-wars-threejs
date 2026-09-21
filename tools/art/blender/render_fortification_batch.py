"""Render the actual exported fortification GLBs at a shared physical scale.

Blender --background --factory-startup --python-exit-code 1 --python this_file.py
Optional private preview: append -- --output /tmp/fortification-batch.png.
No manifest or catalog is needed, and no model/source files are modified.
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
MODELS = [
    # Tall buildings stand behind the low wall modules. All use scale 1.
    ('fort_tower_square', 'SQUARE TOWER', (-11.6, 5.9), (6.5, 6.3), 0),
    ('fort_manor', 'FORTIFIED MANOR', (-3.7, 5.9), (7.4, 7.4), 0),
    ('fort_gatehouse', 'GATEHOUSE', (4.4, 5.6), (7.4, 6.1), 0),
    ('fort_tower_round', 'ROUND TOWER', (11.7, 5.9), (6.3, 6.3), 0),
    ('fort_wall', 'STRAIGHT WALL', (-10.4, -5.9), (7.0, 3.2), 0),
    ('fort_wall_corner', 'WALL CORNER', (-.4, -5.0), (7.5, 7.8), 0),
    ('timber_palisade', 'TIMBER PALISADE', (10.0, -6.0), (7.0, 3.2), math.pi),
]


def material(name, colour):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = .94
    return mat


def mesh_points(objects):
    return [obj.matrix_world @ vertex.co for obj in objects if obj.type == 'MESH'
            for vertex in obj.data.vertices]


def bounds(points):
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return lo, hi


def import_model(name, position, turn):
    directory = 'props' if name == 'timber_palisade' else 'buildings'
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
    anchor.rotation_euler.z = turn
    rotated_x = centre.x*math.cos(turn)-centre.y*math.sin(turn)
    rotated_y = centre.x*math.sin(turn)+centre.y*math.cos(turn)
    anchor.location = (position[0]-rotated_x, position[1]-rotated_y, .16-lo.z)
    return list(added)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path,
                        default=ROOT/'tools/art/blender/previews/fortification-batch.png')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tile_mat = material('Fortification display stone', (.21, .235, .192))
    ground_mat = material('Fortification studio ground', (.32, .345, .287))
    label_mat = material('Fortification display labels', (.71, .69, .565))
    contents = []
    for name, label, position, tile_size, turn in MODELS:
        contents.extend(import_model(name, position, turn))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(*position, .075))
        tile = bpy.context.object
        tile.name = name+'_display_tile'
        tile.scale = (*tile_size, .15)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        tile.data.materials.append(tile_mat)
        bevel = tile.modifiers.new('Worn display edge', 'BEVEL')
        bevel.width = .055
        bevel.segments = 1
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        contents.append(tile)
        bpy.ops.object.text_add(location=(position[0], position[1]-tile_size[1]/2+.20, .161))
        label_obj = bpy.context.object
        label_obj.name = name+'_display_label'
        label_obj.data.body = label
        label_obj.data.align_x = 'CENTER'
        label_obj.data.size = .32
        label_obj.data.extrude = 0
        label_obj.data.materials.append(label_mat)
        # Convert display labels only so their complete extents enter framing.
        bpy.ops.object.convert(target='MESH')
        contents.append(bpy.context.object)
    bpy.context.view_layer.update()
    points = mesh_points(contents)
    lo, hi = bounds(points)
    target = (lo+hi)/2
    bpy.ops.object.camera_add(location=target+Vector((18, -34, 30)))
    camera = bpy.context.object
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = 2200
    scene.render.resolution_y = 1450
    scene.render.resolution_percentage = 100
    bpy.context.view_layer.update()
    projected = [camera.matrix_world.inverted() @ point for point in points]
    screen_lo, screen_hi = bounds(projected)
    aspect = scene.render.resolution_x/scene.render.resolution_y
    camera.data.ortho_scale = max(screen_hi.x-screen_lo.x,
                                 (screen_hi.y-screen_lo.y)*aspect)*1.14
    # Centre the actual projection, including the elbow-origin corner module.
    shift = camera.matrix_world.to_quaternion() @ Vector(
        ((screen_lo.x+screen_hi.x)/2, (screen_lo.y+screen_hi.y)/2, 0))
    camera.location += shift
    bpy.ops.mesh.primitive_plane_add(size=250, location=(0, 0, -.025))
    bpy.context.object.name = 'Fortification studio floor'
    bpy.context.object.data.materials.append(ground_mat)
    bpy.ops.object.light_add(type='AREA', location=(-10, -15, 30))
    light = bpy.context.object
    light.name = 'Fortification studio softbox'
    light.data.energy = 14500
    light.data.shape = 'DISK'
    light.data.size = 20
    light.rotation_euler = (target-light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.world = bpy.data.worlds.new('Fortification studio world')
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
