"""Build lightweight, irregular decididuous vegetation for the Sudomer terrain.

Run with:
  /opt/homebrew/bin/blender --background --python tools/art/blender/build_sudomer_trees.py

The exported GLBs keep Blender Z as the source ground plane, which becomes
glTF Y=0 when exported with ``export_yup=True``.
"""
from pathlib import Path
import json
import math
import random

try:
    import bpy
    from mathutils import Vector
except ImportError:  # Lets the deterministic GLB fallback run where Blender cannot start.
    bpy = None
    Vector = None


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets" / "3d" / "models" / "vegetation" / "sudomer"
SOURCE = ROOT / "tools" / "art" / "blender" / "source" / "sudomer"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

MATS = {}


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in bpy.data.materials:
        bpy.data.materials.remove(data)
    MATS.clear()


def mat(name, color):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = .94
    MATS[name] = value


def materials():
    # Kept restrained to sit with the painted olive/sage terrain study.
    mat("bark", (.25, .18, .09))
    mat("leaf_olive", (.205, .275, .105))
    mat("leaf_sage", (.315, .365, .165))


def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(MATS[material])
    return obj


def limb(name, start, end, radius, material="bark", radius_end=None, sides=7):
    start, end = Vector(start), Vector(end)
    bpy.ops.mesh.primitive_cone_add(
        vertices=sides,
        radius1=radius,
        radius2=radius if radius_end is None else radius_end,
        depth=(end - start).length,
        location=(start + end) / 2,
    )
    obj = finish(bpy.context.object, name, material)
    obj.rotation_euler = (end - start).to_track_quat("Z", "Y").to_euler()
    return obj


def lobe(name, pos, scale, material, turn=0):
    """A small, softly shaded irregular crown lobe (32 triangles)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=1, location=pos)
    obj = finish(bpy.context.object, name, material)
    obj.scale = scale
    obj.rotation_euler = (.12 * math.sin(turn * 1.7), .16 * math.cos(turn * .9), turn)
    # Smooth normals remove the old visibly faceted/pointed crown treatment.
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def add_tree(name, seed, width, height, lobe_count, lean=0.0):
    rng = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    objects = [root]

    def add_limb(*args, **kwargs):
        obj = limb(*args, **kwargs)
        obj.parent = root
        objects.append(obj)
        return obj

    def add_lobe(*args, **kwargs):
        obj = lobe(*args, **kwargs)
        obj.parent = root
        objects.append(obj)
        return obj

    trunk_top = height * .77
    # Keep the first trunk segment vertical so the exported glTF has its root
    # exactly on Y=0 rather than a tilted cylinder cutting below the terrain.
    trunk_base = height * .18
    add_limb("visible trunk base", (0, 0, 0), (0, 0, trunk_base), width * .052, "bark", width * .044)
    add_limb("visible trunk", (0, 0, trunk_base), (lean, .03, trunk_top), width * .044, "bark", width * .020)
    # A low fork and long, visible limbs create a readable woody skeleton when
    # seen from both the terrain's high camera and near ground level.
    endpoints = []
    for i in range(7):
        angle = i * math.tau / 7 + rng.uniform(-.19, .19)
        start_z = height * (.31 + .055 * (i % 3))
        reach = width * rng.uniform(.31, .46)
        rise = height * rng.uniform(.16, .27)
        start = (lean * start_z / trunk_top, 0, start_z)
        end = (math.cos(angle) * reach + lean, math.sin(angle) * reach * .88, start_z + rise)
        add_limb("main limb", start, end, width * .030, "bark", width * .010)
        tip = (
            end[0] + math.cos(angle + rng.uniform(-.45, .45)) * width * .12,
            end[1] + math.sin(angle + rng.uniform(-.45, .45)) * width * .11,
            end[2] + height * rng.uniform(.035, .10),
        )
        add_limb("twig", end, tip, width * .012, "bark", width * .004, sides=6)
        endpoints.append((end, tip))
    # Overlapping individual rounded lobes retain sky gaps and a broken canopy
    # outline instead of joining into a cone or a single solid blob.
    leaf_mats = ("leaf_olive", "leaf_sage")
    for i in range(lobe_count):
        base, tip = endpoints[i % len(endpoints)]
        angle = math.atan2(tip[1] - base[1], tip[0] - base[0])
        band = i // len(endpoints)
        radial = width * (.12 + .070 * band + rng.uniform(-.045, .055))
        center_angle = angle + rng.uniform(-.40, .40)
        pos = (
            tip[0] + math.cos(center_angle) * radial,
            tip[1] + math.sin(center_angle) * radial * .88,
            tip[2] + height * (.035 * band + rng.uniform(-.055, .095)),
        )
        # A few central lobes bridge the crown, but no lobe is large enough to
        # conceal the limbs as one simple ball would.
        sx = width * rng.uniform(.115, .165) * 1.6
        sy = sx * rng.uniform(.78, 1.05)
        sz = height * rng.uniform(.075, .115) * 1.3
        add_lobe("leaf lobe", pos, (sx, sy, sz), leaf_mats[(i + (1 if band == 0 else 0)) % len(leaf_mats)], rng.random() * math.tau)
    # These interior lobes close the airy centre without hiding the lower fork.
    for i, (offset_x, offset_y, z_factor) in enumerate(((-.075, .045, .68), (.095, -.060, .78))):
        add_lobe("central leaf lobe", (lean * z_factor / .77 + width * offset_x, width * offset_y, height * z_factor),
                 (width * .205, width * .178, height * .125), leaf_mats[i], .62 + i * 1.8)
    # A small high lobe gives each silhouette a rounded, asymmetrical crown.
    add_lobe("high leaf lobe", (lean + rng.uniform(-.12, .12), rng.uniform(-.12, .12), height * .91),
             (width * .208, width * .184, height * .117), "leaf_sage", rng.random() * math.tau)
    return objects


def add_shrub():
    rng = random.Random(414)
    root = bpy.data.objects.new("Sudomer shrub", None)
    bpy.context.collection.objects.link(root)
    objects = [root]
    obj = limb("shrub base", (0, 0, 0), (0, 0, .24), .035, "bark", .026, sides=6)
    obj.parent = root
    objects.append(obj)
    for i in range(4):
        angle = i * math.tau / 4 + .18
        end = (math.cos(angle) * .28, math.sin(angle) * .25, .55 + .10 * (i % 2))
        obj = limb("shrub twig", (0, 0, .05), end, .027, "bark", .009, sides=6)
        obj.parent = root
        objects.append(obj)
    for i in range(8):
        angle = i * math.tau / 8 + rng.uniform(-.3, .3)
        radius = rng.uniform(.10, .34)
        obj = lobe("shrub leaf lobe", (math.cos(angle) * radius, math.sin(angle) * radius * .82, .48 + rng.uniform(-.08, .23)),
                   (rng.uniform(.16, .23) * 1.25, rng.uniform(.13, .20) * 1.25, rng.uniform(.14, .21) * 1.25),
                   ("leaf_olive", "leaf_olive", "leaf_sage")[i % 3], angle)
        obj.parent = root
        objects.append(obj)
    return objects


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return low, high


def merge_by_material(objects):
    for material_name in MATS:
        parts = [obj for obj in objects if obj.type == "MESH" and obj.data.materials and obj.data.materials[0].name == material_name]
        if not parts:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for part in parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        parts[0].name = material_name
    return list(bpy.context.scene.objects)


def preview(name, objects):
    low, high = bounds(objects)
    center = (low + high) / 2
    size = max(high - low)
    bpy.ops.mesh.primitive_plane_add(size=size * 3, location=(center.x, center.y, 0))
    ground = finish(bpy.context.object, "preview ground", "leaf_shadow")
    bpy.ops.object.camera_add(location=center + Vector((1.35, -1.7, 1.08)) * size)
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = size * 1.32
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=center + Vector((-2, -3, 5)) * size)
    light = bpy.context.object
    light.data.energy = 900 * size * size
    light.data.shape = "DISK"
    light.data.size = size * 3
    light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(SOURCE / f"{name}-preview.png")
    scene.world.color = (.17, .17, .14)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(ground, do_unlink=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(light, do_unlink=True)


def export(name, builder):
    reset()
    materials()
    source_objects = builder()
    bpy.context.view_layer.update()
    low, high = bounds(source_objects)
    triangles = sum(len(poly.vertices) - 2 for obj in source_objects if obj.type == "MESH" for poly in obj.data.polygons)
    preview(name, source_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{name}.blend"))
    export_objects = merge_by_material(source_objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:
        if obj.type == "MESH":
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{name}.glb"), export_format="GLB", use_selection=True,
        export_yup=True, export_materials="EXPORT", export_cameras=False, export_lights=False,
    )
    dimensions = high - low
    return {
        "file": f"{name}.glb",
        "dimensions_blender_xyz_m": [round(value, 3) for value in dimensions],
        "dimensions_gltf_xyz_m": [round(dimensions[i], 3) for i in (0, 2, 1)],
        "ground_gltf_y_m": 0.0,
        "mesh_objects": sum(obj.type == "MESH" for obj in export_objects),
        "editable_source_mesh_objects": sum(obj.type == "MESH" for obj in source_objects),
        "triangles": triangles,
        "materials": [name for name in MATS if any(obj.type == "MESH" and obj.data.materials and obj.data.materials[0].name == name for obj in export_objects)],
    }


def main():
    builds = {
        "tree-a": lambda: add_tree("Sudomer deciduous a", 81, 2.60, 5.35, 15, .08),
        "tree-b": lambda: add_tree("Sudomer deciduous b", 207, 2.65, 4.55, 13, -.16),
        "tree-c": lambda: add_tree("Sudomer deciduous c", 509, 2.70, 5.75, 16, .14),
        "shrub": add_shrub,
    }
    manifest = {name: export(name, builder) for name, builder in builds.items()}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for name, data in manifest.items():
        print("ASSET_COMPLETE", name, data, flush=True)


def fallback_main():
    """Write the same low-poly kit without bpy when macOS Metal cannot boot.

    This is deliberately small and dependency-free: it is only an export
    fallback, while the editable Blender construction above remains the source
    of truth on a normal Blender installation.
    """
    import struct
    material_colors = {
        "bark": (.25, .18, .09, 1),
        "leaf_olive": (.205, .275, .105, 1),
        "leaf_sage": (.315, .365, .165, 1),
    }

    def group_store():
        return {key: {"positions": [], "normals": [], "indices": []} for key in material_colors}

    def unit(vec):
        length = math.sqrt(sum(v * v for v in vec)) or 1
        return tuple(v / length for v in vec)

    def add_vertex(group, position, normal):
        index = len(group["positions"])
        group["positions"].append(position)
        group["normals"].append(unit(normal))
        return index

    def add_limb(groups, start, end, radius, material, radius_end, sides=7):
        axis = unit(tuple(end[i] - start[i] for i in range(3)))
        cross = (0, 1, 0) if abs(axis[2]) > .92 else (0, 0, 1)
        right = unit((axis[1] * cross[2] - axis[2] * cross[1], axis[2] * cross[0] - axis[0] * cross[2], axis[0] * cross[1] - axis[1] * cross[0]))
        up = unit((right[1] * axis[2] - right[2] * axis[1], right[2] * axis[0] - right[0] * axis[2], right[0] * axis[1] - right[1] * axis[0]))
        group = groups[material]
        base, top = [], []
        for i in range(sides):
            angle = math.tau * i / sides
            radial = tuple(math.cos(angle) * right[j] + math.sin(angle) * up[j] for j in range(3))
            base.append(add_vertex(group, tuple(start[j] + radial[j] * radius for j in range(3)), radial))
            top.append(add_vertex(group, tuple(end[j] + radial[j] * radius_end for j in range(3)), radial))
        for i in range(sides):
            nxt = (i + 1) % sides
            group["indices"].extend((base[i], base[nxt], top[nxt], base[i], top[nxt], top[i]))
        base_center = add_vertex(group, start, tuple(-v for v in axis))
        top_center = add_vertex(group, end, axis)
        for i in range(sides):
            nxt = (i + 1) % sides
            group["indices"].extend((base_center, base[nxt], base[i], top_center, top[i], top[nxt]))

    def add_lobe(groups, position, scale, material, turn, wobble):
        group = groups[material]
        segments, rings = 7, 3
        vertex_start = len(group["positions"])
        index_start = len(group["indices"])
        vertices = []
        def point(theta, phi, variance=1):
            x = math.sin(theta) * math.cos(phi) * scale[0] * variance
            y = math.sin(theta) * math.sin(phi) * scale[1] * variance
            z = math.cos(theta) * scale[2]
            # Rotate only in plan; asymmetric ring radii make a hand-shaped lobe.
            xr, yr = x * math.cos(turn) - y * math.sin(turn), x * math.sin(turn) + y * math.cos(turn)
            # Rotate the ellipsoid normal with the lobe.  Dividing the already
            # rotated coordinates by the unrotated axes makes some faces point
            # inward when the lobe is elongated.
            nx, ny = x / (scale[0] * scale[0]), y / (scale[1] * scale[1])
            normal = (nx * math.cos(turn) - ny * math.sin(turn), nx * math.sin(turn) + ny * math.cos(turn), z / (scale[2] * scale[2]))
            return (position[0] + xr, position[1] + yr, position[2] + z), normal
        p, n = point(0, 0)
        vertices.append(add_vertex(group, p, n))
        for ring in range(1, rings):
            theta = math.pi * ring / rings
            for side in range(segments):
                phi = math.tau * side / segments
                variance = 1 + .10 * math.sin(side * 2.17 + wobble + ring * .6)
                p, n = point(theta, phi, variance)
                vertices.append(add_vertex(group, p, n))
        p, n = point(math.pi, 0)
        vertices.append(add_vertex(group, p, n))
        top = vertices[0]
        first_ring = 1
        for side in range(segments):
            group["indices"].extend((top, vertices[first_ring + side], vertices[first_ring + (side + 1) % segments]))
        for ring in range(rings - 2):
            row = 1 + ring * segments
            next_row = row + segments
            for side in range(segments):
                nxt = (side + 1) % segments
                group["indices"].extend((vertices[row + side], vertices[next_row + side], vertices[next_row + nxt], vertices[row + side], vertices[next_row + nxt], vertices[row + nxt]))
        last_row = 1 + (rings - 2) * segments
        bottom = vertices[-1]
        for side in range(segments):
            group["indices"].extend((vertices[last_row + side], bottom, vertices[last_row + (side + 1) % segments]))
        vertex_end = len(group["positions"])
        if any(index < vertex_start or index >= vertex_end for index in group["indices"][index_start:]):
            raise RuntimeError("leaf lobe contains a cross-lobe index")

    def build_tree(seed, width, height, lobe_count, lean):
        rng, groups = random.Random(seed), group_store()
        trunk_top, trunk_base = height * .77, height * .18
        add_limb(groups, (0, 0, 0), (0, 0, trunk_base), width * .052, "bark", width * .044)
        add_limb(groups, (0, 0, trunk_base), (lean, .03, trunk_top), width * .044, "bark", width * .020)
        endpoints = []
        for i in range(7):
            angle = i * math.tau / 7 + rng.uniform(-.19, .19)
            start_z, reach = height * (.31 + .055 * (i % 3)), width * rng.uniform(.31, .46)
            start = (lean * start_z / trunk_top, 0, start_z)
            end = (math.cos(angle) * reach + lean, math.sin(angle) * reach * .88, start_z + height * rng.uniform(.16, .27))
            add_limb(groups, start, end, width * .030, "bark", width * .010)
            tip = (end[0] + math.cos(angle + rng.uniform(-.45, .45)) * width * .12, end[1] + math.sin(angle + rng.uniform(-.45, .45)) * width * .11, end[2] + height * rng.uniform(.035, .10))
            add_limb(groups, end, tip, width * .012, "bark", width * .004, 6)
            endpoints.append((end, tip))
        for i in range(lobe_count):
            base, tip = endpoints[i % len(endpoints)]
            angle, band = math.atan2(tip[1] - base[1], tip[0] - base[0]), i // len(endpoints)
            radial, center_angle = width * (.12 + .070 * band + rng.uniform(-.045, .055)), angle + rng.uniform(-.40, .40)
            position = (tip[0] + math.cos(center_angle) * radial, tip[1] + math.sin(center_angle) * radial * .88, tip[2] + height * (.035 * band + rng.uniform(-.055, .095)))
            sx = width * rng.uniform(.115, .165) * 1.6
            add_lobe(groups, position, (sx, sx * rng.uniform(.78, 1.05), height * rng.uniform(.075, .115) * 1.3), ("leaf_olive", "leaf_sage")[(i + (1 if band == 0 else 0)) % 2], rng.random() * math.tau, rng.random() * math.tau)
        for i, (offset_x, offset_y, z_factor) in enumerate(((-.075, .045, .68), (.095, -.060, .78))):
            add_lobe(groups, (lean * z_factor / .77 + width * offset_x, width * offset_y, height * z_factor), (width * .205, width * .178, height * .125), ("leaf_olive", "leaf_sage")[i], .62 + i * 1.8, .47 + i * 1.1)
        add_lobe(groups, (lean + rng.uniform(-.12, .12), rng.uniform(-.12, .12), height * .91), (width * .208, width * .184, height * .117), "leaf_sage", rng.random() * math.tau, rng.random() * math.tau)
        return groups

    def build_shrub():
        rng, groups = random.Random(414), group_store()
        add_limb(groups, (0, 0, 0), (0, 0, .24), .035, "bark", .026, 6)
        for i in range(4):
            angle = i * math.tau / 4 + .18
            add_limb(groups, (0, 0, .05), (math.cos(angle) * .28, math.sin(angle) * .25, .55 + .10 * (i % 2)), .027, "bark", .009, 6)
        for i in range(8):
            angle, radius = i * math.tau / 8 + rng.uniform(-.3, .3), rng.uniform(.10, .34)
            add_lobe(groups, (math.cos(angle) * radius, math.sin(angle) * radius * .82, .48 + rng.uniform(-.08, .23)), (rng.uniform(.16, .23) * 1.25, rng.uniform(.13, .20) * 1.25, rng.uniform(.14, .21) * 1.25), ("leaf_olive", "leaf_olive", "leaf_sage")[i % 3], angle, rng.random() * math.tau)
        return groups

    def write_glb(path, groups):
        # The procedural points are expressed in Blender's X/Y/Z convention.
        # glTF is X/Y-up/Z; this is Blender's export_yup rotation and has a
        # positive determinant, so the corrected face winding remains outward.
        def gltf_axis(point):
            return (point[0], point[2], -point[1])
        for group in groups.values():
            group["positions"] = [gltf_axis(point) for point in group["positions"]]
            group["normals"] = [unit(gltf_axis(normal)) for normal in group["normals"]]
            for offset in range(0, len(group["indices"]), 3):
                a, b, c = group["indices"][offset:offset + 3]
                pa, pb, pc = (group["positions"][index] for index in (a, b, c))
                face = ((pb[1] - pa[1]) * (pc[2] - pa[2]) - (pb[2] - pa[2]) * (pc[1] - pa[1]),
                        (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]),
                        (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]))
                normal = tuple(sum(group["normals"][index][axis] for index in (a, b, c)) for axis in range(3))
                if sum(face[axis] * normal[axis] for axis in range(3)) < 0:
                    group["indices"][offset + 1], group["indices"][offset + 2] = c, b
        blob = bytearray()
        views, accessors, meshes = [], [], []
        def append(raw, target):
            while len(blob) % 4: blob.extend(b"\0")
            offset = len(blob); blob.extend(raw)
            views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target})
            return len(views) - 1
        for material_index, (material, group) in enumerate(groups.items()):
            if not group["indices"]:
                continue
            positions = group["positions"]
            pview = append(struct.pack("<%sf" % (len(positions) * 3), *(value for point in positions for value in point)), 34962)
            nview = append(struct.pack("<%sf" % (len(group["normals"]) * 3), *(value for normal in group["normals"] for value in normal)), 34962)
            index_type = 5123 if len(positions) <= 65535 else 5125
            fmt = "H" if index_type == 5123 else "I"
            iview = append(struct.pack("<%s%s" % (len(group["indices"]), fmt), *group["indices"]), 34963)
            p_accessor = len(accessors); accessors.append({"bufferView": pview, "componentType": 5126, "count": len(positions), "type": "VEC3", "min": [min(v[i] for v in positions) for i in range(3)], "max": [max(v[i] for v in positions) for i in range(3)]})
            n_accessor = len(accessors); accessors.append({"bufferView": nview, "componentType": 5126, "count": len(positions), "type": "VEC3"})
            i_accessor = len(accessors); accessors.append({"bufferView": iview, "componentType": index_type, "count": len(group["indices"]), "type": "SCALAR"})
            meshes.append({"primitives": [{"attributes": {"POSITION": p_accessor, "NORMAL": n_accessor}, "indices": i_accessor, "material": material_index}]})
        document = {"asset": {"version": "2.0", "generator": "build_sudomer_trees.py fallback"}, "scene": 0, "scenes": [{"nodes": list(range(len(meshes)))}], "nodes": [{"mesh": i, "name": list(groups)[i]} for i in range(len(meshes))], "meshes": meshes, "materials": [{"name": name, "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0, "roughnessFactor": .94}} for name, color in material_colors.items()], "buffers": [{"byteLength": len(blob)}], "bufferViews": views, "accessors": accessors}
        raw_json = json.dumps(document, separators=(",", ":")).encode("utf8")
        raw_json += b" " * ((4 - len(raw_json) % 4) % 4)
        blob += b"\0" * ((4 - len(blob) % 4) % 4)
        path.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(raw_json) + 8 + len(blob)) + struct.pack("<I4s", len(raw_json), b"JSON") + raw_json + struct.pack("<I4s", len(blob), b"BIN\0") + blob)

    specs = {"tree-a": (81, 2.60, 5.35, 15, .08), "tree-b": (207, 2.65, 4.55, 13, -.16), "tree-c": (509, 2.70, 5.75, 16, .14)}
    manifest = {}
    for name, spec in specs.items():
        groups = build_tree(*spec)
        write_glb(OUT / f"{name}.glb", groups)
        all_positions = [point for group in groups.values() for point in group["positions"]]
        low = [min(point[i] for point in all_positions) for i in range(3)]
        high = [max(point[i] for point in all_positions) for i in range(3)]
        dimensions = [high[i] - low[i] for i in range(3)]
        manifest[name] = {"file": f"{name}.glb", "dimensions_blender_xyz_m": [round(dimensions[i], 3) for i in (0, 2, 1)], "dimensions_gltf_xyz_m": [round(value, 3) for value in dimensions], "ground_gltf_y_m": 0.0, "mesh_objects": 3, "triangles": sum(len(group["indices"]) // 3 for group in groups.values()), "materials": list(material_colors)}
    groups = build_shrub()
    write_glb(OUT / "shrub.glb", groups)
    all_positions = [point for group in groups.values() for point in group["positions"]]
    low = [min(point[i] for point in all_positions) for i in range(3)]
    high = [max(point[i] for point in all_positions) for i in range(3)]
    dimensions = [high[i] - low[i] for i in range(3)]
    manifest["shrub"] = {"file": "shrub.glb", "dimensions_blender_xyz_m": [round(dimensions[i], 3) for i in (0, 2, 1)], "dimensions_gltf_xyz_m": [round(value, 3) for value in dimensions], "ground_gltf_y_m": 0.0, "mesh_objects": 3, "triangles": sum(len(group["indices"]) // 3 for group in groups.values()), "materials": list(material_colors)}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for name, data in manifest.items():
        print("ASSET_COMPLETE", name, data, flush=True)


if __name__ == "__main__":
    (main if bpy is not None else fallback_main)()
