"""Check that a rebuilt unit GLB stays inside its previous plan outline and height.

The renderer's formation envelope (views/3d/src/formation-envelope.ts) is the
convex hull of every unit recipe's vertices, and its height check expects the
current maximum to be reached. A remodelled unit that stays inside its old
plan hull and matches or stays below its old top changes neither.

    python3 tools/art/blender/check_outline.py /tmp/before/units/war_wagon.glb \
        assets/3d/models/units/war_wagon.glb

Plain Python; no Blender or third-party packages. Exits 1 when any vertex
escapes the old hull or rises above the old top.
"""
import json
import struct
import sys


def multiply(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def node_matrix(node):
    if 'matrix' in node:
        m = node['matrix']
        return [[m[j*4+i] for j in range(4)] for i in range(4)]
    tx, ty, tz = node.get('translation', (0, 0, 0))
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    sx, sy, sz = node.get('scale', (1, 1, 1))
    rotation = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    return [[rotation[i][0]*sx, rotation[i][1]*sy, rotation[i][2]*sz, (tx, ty, tz)[i]]
            for i in range(3)] + [[0, 0, 0, 1]]


def vertices(path):
    data = open(path, 'rb').read()
    length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20+length])
    binary = 20+length+8
    points = []

    def visit(index, parent):
        node = document['nodes'][index]
        world = multiply(parent, node_matrix(node))
        for primitive in document['meshes'][node['mesh']]['primitives'] if 'mesh' in node else ():
            accessor = document['accessors'][primitive['attributes']['POSITION']]
            view = document['bufferViews'][accessor['bufferView']]
            stride = view.get('byteStride', 12)
            base = binary+view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
            for i in range(accessor['count']):
                v = struct.unpack_from('<fff', data, base+i*stride)+(1,)
                points.append(tuple(sum(world[r][c]*v[c] for c in range(4)) for r in range(3)))
        for child in node.get('children', ()):
            visit(child, world)

    identity = [[float(i == j) for j in range(4)] for i in range(4)]
    for root in document['scenes'][document.get('scene', 0)]['nodes']:
        visit(root, identity)
    return points


def hull(points):
    points = sorted(set(points))

    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]


def main(old_path, new_path, epsilon=1e-5):
    old, new = vertices(old_path), vertices(new_path)
    outline = hull([(round(x, 6), round(z, 6)) for x, _, z in old])
    escaped = []
    for x, _, z in new:
        for a, b in zip(outline, outline[1:]+outline[:1]):
            if (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]) < -epsilon:
                escaped.append((x, z))
                break
    old_top = max(p[1] for p in old)-min(p[1] for p in old)
    new_top = max(p[1] for p in new)-min(p[1] for p in new)
    print(f'grounded height: old {old_top:.4f} m, new {new_top:.4f} m')
    print(f'plan outline: {len(escaped)} of {len(new)} new vertices outside')
    for x, z in sorted(escaped)[:3]+sorted(escaped)[-3:]:
        print(f'  outside at glTF x={x:.3f} z={z:.3f}')
    return 1 if escaped or new_top > old_top+1e-3 else 0


if __name__ == '__main__':
    sys.exit(main(*sys.argv[1:3]))
