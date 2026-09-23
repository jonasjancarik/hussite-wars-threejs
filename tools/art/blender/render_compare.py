"""Render a row of exported GLBs from any models root with a fixed camera.

Point two runs at the same models, once at a snapshot copy of
assets/3d/models taken before a change and once at the rebuilt tree, to
get directly comparable before/after images:

    blender --background --factory-startup --python-exit-code 1 \
        --python tools/art/blender/render_compare.py -- \
        --root /tmp/before --output /tmp/before.png infantry_spear war_wagon

`--root` defaults to assets/3d/models. Models resolve through
assets/3d/model-paths.json. `--yaw` turns the camera about the row in
degrees; `--red` paints team_cloth/team_paint in the red side colours.
Reads GLBs only; exports and changes nothing.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
PATHS = json.loads((ROOT/'assets/3d/model-paths.json').read_text())
RED = {'team_cloth': (.33, .075, .065), 'team_paint': (.25, .05, .04)}


def principled(material):
    return next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('models', nargs='+')
    parser.add_argument('--root', type=Path, default=ROOT/'assets/3d/models')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--yaw', type=float, default=0)
    parser.add_argument('--red', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cursor = 0.0
    for name in args.models:
        before = set(bpy.context.scene.objects)
        path = args.root/PATHS[name].removeprefix('models/')
        bpy.ops.import_scene.gltf(filepath=str(path))
        added = set(bpy.context.scene.objects)-before
        anchor = bpy.data.objects.new(name+'_row', None)
        bpy.context.collection.objects.link(anchor)
        for obj in added:
            if obj.parent is None:
                obj.parent = anchor
            for slot in getattr(obj, 'material_slots', []):
                key = slot.material.name.split('.')[0] if slot.material else ''
                if args.red and key in RED:
                    slot.material = slot.material.copy()
                    principled(slot.material).inputs['Base Color'].default_value = (*RED[key], 1)
        bpy.context.view_layer.update()
        points = [o.matrix_world @ Vector(c) for o in added if o.type == 'MESH' for c in o.bound_box]
        low = min(p.x for p in points)
        high = max(p.x for p in points)
        anchor.location.x = cursor-low
        cursor += high-low+.6
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    centre, size = (lo+hi)/2, max(hi-lo)
    ground = bpy.data.materials.new('Compare ground')
    ground.use_nodes = True
    principled(ground).inputs['Base Color'].default_value = (.30, .33, .26, 1)
    bpy.ops.mesh.primitive_plane_add(size=size*40, location=(centre.x, centre.y, lo.z))
    bpy.context.object.data.materials.append(ground)
    yaw = math.radians(args.yaw)
    offset = Vector((1.4, -1.9, 1.25))
    offset = Vector((offset.x*math.cos(yaw)-offset.y*math.sin(yaw),
                     offset.x*math.sin(yaw)+offset.y*math.cos(yaw), offset.z))
    bpy.ops.object.camera_add(location=centre+offset*size)
    camera = bpy.context.object
    camera.rotation_euler = (centre-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = size*1.25
    scene = bpy.context.scene
    scene.camera = camera
    bpy.ops.object.light_add(type='SUN')
    sun = bpy.context.object
    sun.data.energy = 3.2
    sun.data.color = (1, .93, .82)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35)+yaw)
    scene.world = bpy.data.worlds.new('Compare sky')
    scene.world.use_nodes = True
    background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (.55, .62, .72, 1)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = 'AgX'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 900
    scene.render.filepath = str(args.output)
    bpy.ops.render.render(write_still=True)


main()
