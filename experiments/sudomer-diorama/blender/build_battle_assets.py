"""Export the static, crew-accounted assets used by the Sudoměř battle.

Run with Blender 5.2:
  blender --background --python blender/build_battle_assets.py
"""
from pathlib import Path
import hashlib
import json
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "blender/source"
OUTPUT = ROOT / "assets/models/battle"


def material_color(obj):
    material = obj.data.materials[0]
    shader = material.node_tree.nodes.get("Principled BSDF") if material.use_nodes else None
    return tuple(shader.inputs["Base Color"].default_value if shader else material.diffuse_color)


def flatten(source_name, output_name, excluded=()):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / f"{source_name}.blend"))
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    vertices, colors, faces, smooth = [], [], [], []
    triangles = 0
    source_objects = []
    for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
        if obj.type != "MESH" or obj.name.startswith("Preview_") or any(obj.name.startswith(prefix) for prefix in excluded):
            continue
        source_objects.append(obj.name)
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        offset = len(vertices)
        color = material_color(obj)
        vertices.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        colors.extend([color] * len(mesh.vertices))
        for polygon in mesh.polygons:
            faces.append(tuple(offset + index for index in polygon.vertices))
            smooth.append(polygon.use_smooth)
            triangles += len(polygon.vertices) - 2
        evaluated.to_mesh_clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    mesh = bpy.data.meshes.new(f"{output_name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon, use_smooth in zip(mesh.polygons, smooth):
        polygon.use_smooth = use_smooth
    attribute = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="POINT")
    for datum, color in zip(attribute.data, colors):
        datum.color = color
    mesh.color_attributes.active_color = attribute
    obj = bpy.data.objects.new(output_name, mesh)
    bpy.context.collection.objects.link(obj)
    material = bpy.data.materials.new(f"{output_name}_vertex_color")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    vertex_color = material.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name = attribute.name
    material.node_tree.links.new(vertex_color.outputs["Color"], shader.inputs["Base Color"])
    shader.inputs["Roughness"].default_value = 0.92
    obj.data.materials.append(material)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    output = OUTPUT / f"{output_name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True, export_yup=True, export_animations=False, export_materials="EXPORT", export_cameras=False, export_lights=False)
    return {"file": output.name, "source": f"blender/source/{source_name}.blend", "pose_frame": 1, "animations": [], "vertices": len(vertices), "triangles": triangles, "source_objects": source_objects, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}


def create_unarmed_source():
    namespace = {"__name__": "battle_asset_source", "__file__": str(ROOT / "blender/build_assets.py")}
    exec(compile((ROOT / "blender/build_assets.py").read_text(), namespace["__file__"], "exec"), namespace)
    namespace["reset"]()
    namespace["soldier"](prefix="UnarmedAdult", weapon=None, coat="linen")
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "battle_unarmed_adult.blend"))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    create_unarmed_source()
    manifest = {
        "war_wagon_crewless": flatten("war_wagon", "war_wagon_crewless", ("Wagon_pikeman", "Wagon_gunner")),
        "unarmed_adult_static": flatten("battle_unarmed_adult", "unarmed_adult_static"),
        "horse_rider_static": flatten("cavalry", "horse_rider_static"),
    }
    manifest["war_wagon_crewless"]["accounting_note"] = "All baked Wagon_pikeman and Wagon_gunner objects excluded; crew are separate Person records."
    manifest["horse_rider_static"]["pose_note"] = "Existing cavalry evaluated at frame 1 and baked; no animation clips exported."
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("BATTLE_ASSETS_COMPLETE", json.dumps(manifest), flush=True)


if __name__ == "__main__":
    main()
