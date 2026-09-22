"""Render actual exported camp GLBs as a labelled, common-scale gallery.

No catalog/manifest is required and no model is changed. Blender --background
--python this_file.py; optional -- --output /tmp/camp-batch.png. --models-dir
can point to an isolated directory of GLBs during source geometry review.
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
MODELS = [
    ('tent_small', 'RIDGE TENT', (-7.5, 3.8), (4.15, 4.10), 0),
    ('tent_pavilion', 'PAVILION', (-2.5, 3.8), (4.80, 5.1), 0),
    ('baggage_cart', 'BAGGAGE CART', (2.5, 3.8), (3.7, 4.6), -.32),
    ('wagon_abandoned', 'ABANDONED WAGON', (7.5, 3.8), (4.2, 5.1), -.32),
    ('camp_barrels', 'BARRELS AND CRATE', (-7.8, -2.1), (2.30, 2.5), 0),
    ('camp_sacks', 'SACKS AND BUNDLE', (-5.2, -2.1), (2.30, 2.5), 0),
    ('camp_fire', 'COLD COOKING FIRE', (-2.6, -2.1), (2.30, 2.5), 0),
    ('ammunition_pile', 'STONE SHOT', (0, -2.1), (2.30, 2.5), 0),
    ('haystack', 'HAYSTACK', (2.6, -2.1), (2.30, 2.5), 0),
    ('timber_pile', 'TIMBER PILE', (5.2, -2.1), (2.30, 2.8), -.28),
    ('discarded_equipment', 'DISCARDED EQUIPMENT', (7.8, -2.1), (2.65, 2.5), 0),
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
    return (Vector(tuple(min(p[i] for p in points) for i in range(3))),
            Vector(tuple(max(p[i] for p in points) for i in range(3))))


def import_model(directory, name, position, turn):
    path = directory/(name+'.glb')
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
    anchor.location = (position[0]-centre.x*math.cos(turn)+centre.y*math.sin(turn),
                       position[1]-centre.x*math.sin(turn)-centre.y*math.cos(turn), .12-lo.z)
    return list(added)


def label(text, position, size, mat):
    bpy.ops.object.text_add(location=position)
    obj = bpy.context.object
    obj.name = text+'_label'
    obj.data.body = text
    obj.data.align_x = 'CENTER'
    obj.data.size = size
    obj.data.materials.append(mat)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path,
                        default=ROOT/'tools/art/blender/previews/camp-batch.png')
    parser.add_argument('--models-dir', type=Path, default=ROOT/'assets/3d/models/props')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tile_mat = material('Camp display stone', (.21, .235, .192))
    floor_mat = material('Camp studio ground', (.32, .345, .287))
    label_mat = material('Camp gallery lettering', (.76, .73, .59))
    contents = []
    for name, title, position, tile_size, turn in MODELS:
        contents.extend(import_model(args.models_dir, name, position, turn))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(*position, .055))
        tile = bpy.context.object
        tile.name = name+'_display_tile'
        tile.scale = (*tile_size, .11)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        tile.data.materials.append(tile_mat)
        bevel = tile.modifiers.new('Display edge', 'BEVEL')
        bevel.width = .035
        bevel.segments = 1
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        contents.append(tile)
        contents.append(label(title, (position[0], position[1]-tile_size[1]/2+.16, .121),
                              .185 if position[1] > 0 else .125, label_mat))
    contents.append(label('CAMP AND RURAL PROPS  /  COMMON PHYSICAL SCALE',
                          (0, -4.1, .005), .23, label_mat))
    # A metre bar makes the common scale explicit without a borrowed figure.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -4.45, .016))
    bar = bpy.context.object
    bar.scale = (1, .035, .025)
    bar.data.materials.append(label_mat)
    contents.append(bar)
    contents.append(label('1 m', (0, -4.83, .015), .16, label_mat))
    bpy.context.view_layer.update()
    points = mesh_points(contents)
    lo, hi = bounds(points)
    target = (lo+hi)/2
    bpy.ops.object.camera_add(location=target+Vector((11, -24, 24)))
    camera = bpy.context.object
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1450
    scene.render.resolution_percentage = 100
    bpy.context.view_layer.update()
    screen_lo, screen_hi = bounds([camera.matrix_world.inverted() @ point for point in points])
    aspect = scene.render.resolution_x/scene.render.resolution_y
    camera.data.ortho_scale = max(screen_hi.x-screen_lo.x,
                                 (screen_hi.y-screen_lo.y)*aspect)*1.14
    camera.location += camera.matrix_world.to_quaternion() @ Vector(
        ((screen_lo.x+screen_hi.x)/2, (screen_lo.y+screen_hi.y)/2, 0))
    bpy.ops.mesh.primitive_plane_add(size=150, location=(0, 0, -.03))
    bpy.context.object.data.materials.append(floor_mat)
    bpy.ops.object.light_add(type='AREA', location=(-7, -11, 23))
    light = bpy.context.object
    light.data.energy = 8000
    light.data.shape = 'DISK'
    light.data.size = 14
    light.rotation_euler = (target-light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.world = bpy.data.worlds.new('Camp studio world')
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
