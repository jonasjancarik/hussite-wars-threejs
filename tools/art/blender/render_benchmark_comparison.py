"""Render matched close views of original and flattened benchmark infantry."""

from pathlib import Path
import json
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
CAPTURES = ROOT / "experiments/sudomer-diorama/captures/benchmark"
SHARED_ROOT = ROOT / "assets/3d"
MODEL_PATHS = json.loads((SHARED_ROOT / "model-paths.json").read_text())
VARIANTS = ("infantry_shield", "infantry_polearm", "infantry_handgun")


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(flat):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for x, name in zip((-2.2, 0.0, 2.2), VARIANTS):
        before = set(bpy.context.scene.objects)
        filename = f"{name}_flat.glb" if flat else f"{name}.glb"
        path = (ROOT / "experiments/sudomer-diorama/assets/models/benchmark" / filename
                if flat else SHARED_ROOT / MODEL_PATHS[name])
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported = set(bpy.context.scene.objects) - before
        for obj in imported:
            if obj.parent is None:
                obj.location.x += x

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    ground = bpy.context.object
    ground_material = bpy.data.materials.new("Ground")
    ground_material.diffuse_color = (0.16, 0.20, 0.10, 1.0)
    ground.data.materials.append(ground_material)

    bpy.ops.object.light_add(type="AREA", location=(-4.0, -5.0, 8.0))
    key = bpy.context.object
    key.data.energy = 1100
    key.data.shape = "DISK"
    key.data.size = 5.0
    look_at(key, (0, 0, 1.2))
    bpy.ops.object.light_add(type="AREA", location=(5.0, 1.0, 4.0))
    fill = bpy.context.object
    fill.data.energy = 500
    fill.data.size = 4.0
    look_at(fill, (0, 0, 1.2))

    bpy.ops.object.camera_add(location=(6.7, -10.5, 5.4))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 6.4
    look_at(camera, (0, 0, 1.25))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("Benchmark world")
    scene.world.color = (0.035, 0.035, 0.035)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(CAPTURES / ("flat-models.png" if flat else "scene-models.png"))
    bpy.ops.render.render(write_still=True)


def main():
    CAPTURES.mkdir(parents=True, exist_ok=True)
    render(False)
    render(True)


if __name__ == "__main__":
    main()
