"""Flatten rigid infantry into one vertex-colored mesh for the benchmark.

Run with Blender 5.2:
  blender --background --python tools/art/blender/build_benchmark_assets.py
"""

from pathlib import Path
import json
import bpy


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "tools/art/blender/source"
OUTPUT = ROOT / "experiments/sudomer-diorama/assets/models/benchmark"
VARIANTS = ("infantry_shield", "infantry_polearm", "infantry_handgun")


def material_color(obj):
    material = obj.data.materials[0]
    if material.use_nodes:
        shader = material.node_tree.nodes.get("Principled BSDF")
        if shader is not None:
            return tuple(shader.inputs["Base Color"].default_value)
    return tuple(material.diffuse_color)


def flatten(name):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / f"{name}.blend"))
    bpy.context.view_layer.update()

    vertices = []
    colors = []
    faces = []
    smooth = []
    triangle_count = 0

    for obj in sorted(
        (
            item
            for item in bpy.context.scene.objects
            if item.type == "MESH" and not item.name.startswith("Preview_")
        ),
        key=lambda item: item.name,
    ):
        mesh = obj.data
        offset = len(vertices)
        color = material_color(obj)
        vertices.extend(obj.matrix_world @ vertex.co for vertex in mesh.vertices)
        colors.extend([color] * len(mesh.vertices))
        for polygon in mesh.polygons:
            faces.append(tuple(offset + index for index in polygon.vertices))
            smooth.append(polygon.use_smooth)
            triangle_count += len(polygon.vertices) - 2

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    flat_mesh = bpy.data.meshes.new(f"{name}_flat_mesh")
    flat_mesh.from_pydata(vertices, [], faces)
    flat_mesh.update()
    for polygon, use_smooth in zip(flat_mesh.polygons, smooth):
        polygon.use_smooth = use_smooth

    color_attribute = flat_mesh.color_attributes.new(
        name="Color", type="BYTE_COLOR", domain="POINT"
    )
    for datum, color in zip(color_attribute.data, colors):
        datum.color = color
    flat_mesh.color_attributes.active_color = color_attribute

    flat_object = bpy.data.objects.new(f"{name}_flat", flat_mesh)
    bpy.context.collection.objects.link(flat_object)
    flat_material = bpy.data.materials.new(f"{name}_vertex_color")
    flat_material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    flat_material.use_nodes = True
    shader = flat_material.node_tree.nodes.get("Principled BSDF")
    vertex_color = flat_material.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name = color_attribute.name
    flat_material.node_tree.links.new(
        vertex_color.outputs["Color"], shader.inputs["Base Color"]
    )
    shader.inputs["Roughness"].default_value = 0.92
    shader.inputs["Metallic"].default_value = 0.0
    flat_object.data.materials.append(flat_material)

    bpy.context.view_layer.objects.active = flat_object
    flat_object.select_set(True)
    output = OUTPUT / f"{name}_flat.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_animations=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    return {
        "file": output.name,
        "mesh_objects": 1,
        "materials": 1,
        "vertices": len(vertices),
        "triangles": triangle_count,
        "color_attribute": "COLOR_0",
        "fidelity_note": "Original geometry and base colors; metallic response flattened.",
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {name: flatten(name) for name in VARIANTS}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for name, details in manifest.items():
        print("BENCHMARK_ASSET_COMPLETE", name, details, flush=True)


if __name__ == "__main__":
    main()
