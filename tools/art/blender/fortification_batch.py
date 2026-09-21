"""Original static medieval fortifications for the shared miniature kit.

Metres, Z up. Walls run along X; the gate passage runs through Y. Geometry,
modular sockets and historical limits are documented in fortification-references.md.
"""
import math
import random
from types import SimpleNamespace

import bmesh
import bpy
from mathutils import Matrix, Vector


class Fortifications:
    WALK = 3.30
    WALL_TOP = 4.40

    def __init__(self, kit):
        self.k = kit

    def palette(self):
        for name, colour in {
            'fort_masonry': (.355, .350, .295),
            'fort_stone_light': (.430, .415, .350),
            'fort_stone_dark': (.295, .292, .251),
            'fort_plaster': (.560, .525, .440),
            'fort_roof': (.285, .145, .087),
            'fort_roof_light': (.340, .180, .110),
            'fort_shingle': (.245, .222, .178),
        }.items():
            if name not in self.k.M:
                self.k.material(name, colour)

    def solid(self, name, vertices, faces, mat):
        obj = self.k.mesh(name, vertices, faces, mat)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def prism(self, name, outline, lower, upper, mat):
        """Closed horizontal polygon, including the concave L wall plan."""
        count = len(outline)
        vertices = [(x, y, z) for z in (lower, upper) for x, y in outline]
        faces = [tuple(reversed(range(count))), tuple(range(count, count*2))]
        faces += [(i, (i+1) % count, (i+1) % count + count, i+count)
                  for i in range(count)]
        return self.solid(name, vertices, faces, mat)

    def profile(self, name, outline, y_front, y_back, mat):
        """Closed X/Z profile extruded through Y; used for the open arch."""
        count = len(outline)
        vertices = [(x, y, z) for y in (y_front, y_back) for x, z in outline]
        faces = [tuple(range(count)), tuple(reversed(range(count, count*2)))]
        faces += [(i, (i+1) % count, (i+1) % count + count, i+count)
                  for i in range(count)]
        return self.solid(name, vertices, faces, mat)

    def face_box(self, name, normal, distance, along, z, width, height,
                 mat, depth=.055, bevel=.008):
        nx, ny = normal
        tx, ty = -ny, nx
        obj = self.k.box(name, (nx*distance + tx*along, ny*distance + ty*along, z),
                         (width, depth, height), mat, bevel)
        obj.rotation_euler.z = math.atan2(ty, tx)
        return obj

    def stone_patches(self, prefix, normal, distance, width, height, seed,
                      base=0, centre=0, sparse=False):
        """A few shallow rubble faces, embedded in a continuous solid wall."""
        rng = random.Random(seed)
        columns = max(1, round(width/.74))
        rows = max(1, round(height/.65))
        for row in range(rows):
            for column in range(columns):
                if rng.random() < (.61 if sparse else .39):
                    continue
                u = centre-width/2 + (column+.5)*width/columns
                u += rng.uniform(-.065, .065)
                z = base + (row+.5)*height/rows + rng.uniform(-.05, .05)
                w = min(width/columns*.79, rng.uniform(.34, .62))
                h = rng.uniform(.18, .32)
                self.face_box(prefix+'_rubble_face', normal, distance+.009,
                              u, z, w, h,
                              'fort_stone_light' if rng.random() > .48 else 'fort_stone_dark',
                              .043, .009)

    def window(self, prefix, normal, distance, along, z, width=.43, height=.80,
               timber=False, slit=False):
        # Closed dark recess surrogate and projecting reveals; no interior mesh
        # is implied. The gate passage is the kit's actual traversable opening.
        frame = 'oak_dark' if timber else 'fort_stone_light'
        self.face_box(prefix+'_shadow', normal, distance+.031, along, z,
                      width, height, 'black', .065, 0)
        edge = .055 if timber else .085
        # One closed frame gives real reveals with fewer faces than bevelled
        # individual jamb/sill boxes. The separate dark inset sits behind it.
        outer = [(-width/2-edge, -height/2-.09),
                 (width/2+edge, -height/2-.09),
                 (width/2+edge, height/2+.09),
                 (-width/2-edge, height/2+.09)]
        inner = [(-width/2, -height/2), (width/2, -height/2),
                 (width/2, height/2), (-width/2, height/2)]
        nx, ny = normal
        vertices = [(nx*d-ny*(along+u), ny*d+nx*(along+u), z+v)
                    for d in (distance-.005, distance+.135) for u, v in outer+inner]
        faces = []
        for i in range(4):
            j = (i+1) % 4
            faces += [(i, j, j+4, i+4), (i+8, i+12, j+12, j+8),
                      (i, i+8, j+8, j), (i+4, j+4, j+12, i+12)]
        self.solid(prefix+'_closed_frame', vertices, faces, frame)
        if not slit:
            self.face_box(prefix+'_oak_mullion', normal, distance+.070,
                          along, z, .040, height, 'oak_dark', .075, 0)

    def door(self, prefix, normal, distance, along, bottom, width=.80, height=1.65):
        self.face_box(prefix+'_timber_door', normal, distance+.025,
                      along, bottom+height/2, width, height, 'oak', .065, .012)
        for fraction in (-.28, 0, .28):
            self.face_box(prefix+'_door_plank_seam', normal, distance+.061,
                          along+width*fraction, bottom+height/2,
                          .014, height-.10, 'oak_dark', .018, 0)
        for z in (bottom+.30, bottom+height-.30):
            self.face_box(prefix+'_door_hinge', normal, distance+.078,
                          along, z, width*.73, .045, 'iron', .026, .004)
        self.face_box(prefix+'_door_lintel', normal, distance+.06,
                      along, bottom+height+.09, width+.28, .18,
                      'fort_stone_light', .18, .018)

    def quoins(self, prefix, half_x, half_y, height, step=.65, base=.28):
        for row in range(max(1, int(height/step))):
            z = base + row*step
            for sx in (-1, 1):
                for sy in (-1, 1):
                    self.k.box(prefix+'_corner_quoin',
                               (sx*(half_x-.14), sy*(half_y-.11), z),
                               (.39 if row % 2 else .48,
                                .42 if row % 2 else .35, .31),
                               'fort_stone_light', .027)

    def gable_roof(self, prefix, length, width, eave, ridge, mat='fort_roof'):
        vertices = [(-length/2, -width/2, eave), (length/2, -width/2, eave),
                    (length/2, width/2, eave), (-length/2, width/2, eave),
                    (-length/2, 0, ridge), (length/2, 0, ridge)]
        self.solid(prefix+'_closed_roof', vertices,
                   [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3),
                    (1, 2, 5), (3, 2, 1, 0)], mat)
        # Broad restrained courses, not individual noisy roof tiles.
        for side in (-1, 1):
            for row in range(1, 5):
                t = row/5
                y = side*width/2*t
                z = ridge-(ridge-eave)*t+.016
                self.k.beam(prefix+'_roof_course', (-length/2+.035, y, z),
                            (length/2-.035, y, z), .026,
                            'fort_roof_light' if mat == 'fort_roof' else 'oak_dark', 4)
            self.k.beam(prefix+'_eave_beam', (-length/2, side*width/2, eave),
                        (length/2, side*width/2, eave), .063, 'oak_dark', 5)
        self.k.beam(prefix+'_ridge_cap', (-length/2, 0, ridge),
                    (length/2, 0, ridge), .050,
                    'fort_roof_light' if mat == 'fort_roof' else 'oak_dark', 5)

    def hipped_roof(self, prefix, width, eave, ridge):
        r = width/2
        self.solid(prefix+'_pyramidal_roof',
                   [(-r, -r, eave), (r, -r, eave), (r, r, eave),
                    (-r, r, eave), (0, 0, ridge)],
                   [(3, 2, 1, 0), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)],
                   'fort_roof')
        for t in (.28, .55, .80):
            radius = r*t
            z = ridge-(ridge-eave)*t+.016
            corners = [(-radius, -radius, z), (radius, -radius, z),
                       (radius, radius, z), (-radius, radius, z)]
            for a, b in zip(corners, corners[1:]+corners[:1]):
                self.k.beam(prefix+'_hip_roof_course', a, b, .024, 'fort_roof_light', 4)

    def wall_details(self, prefix, origin=(0, 0), turn=0):
        """Six-metre straight detail run; local centre transformed into a corner leg."""
        before = set(bpy.context.scene.objects)
        k = self.k
        # Outside is -Y. Inner side has a low safety upstand, leaving a legible walk.
        k.box(prefix+'_outer_parapet', (0, -.445, 3.55), (6, .21, .50),
              'fort_masonry', .024)
        k.box(prefix+'_inner_upstand', (0, .475, 3.425), (6, .15, .25),
              'fort_masonry', .020)
        for x in (-2.5, -1.5, -.5, .5, 1.5, 2.5):
            k.box(prefix+'_plain_merlon', (x, -.445, 4.10), (.72, .23, .60),
                  'fort_masonry', .028)
            k.box(prefix+'_merlon_coping', (x, -.445, 4.405), (.76, .285, .09),
                  'fort_stone_light', .017)
        for normal, seed in (((0, -1), 420), ((0, 1), 421)):
            self.stone_patches(prefix, normal, .55, 5.85, 3.10, seed)
        objects = set(bpy.context.scene.objects)-before
        for obj in objects:
            x, y = obj.location.x, obj.location.y
            obj.location.x = origin[0]+x*math.cos(turn)-y*math.sin(turn)
            obj.location.y = origin[1]+x*math.sin(turn)+y*math.cos(turn)
            obj.rotation_euler.z += turn

    def wall(self):
        self.palette()
        self.k.box('Wall_continuous_masonry', (0, 0, 1.61),
                   (6, 1.10, 3.22), 'fort_masonry')
        self.k.box('Wall_walk_cap', (0, 0, 3.26),
                   (6, 1.18, .08), 'fort_stone_light')
        self.wall_details('Wall')

    def wall_corner(self):
        self.palette()
        outline = [(-.55, -.55), (6, -.55), (6, .55),
                   (.55, .55), (.55, 6), (-.55, 6)]
        self.prism('Corner_continuous_L_masonry', outline, 0, 3.22, 'fort_masonry')
        cap = [(-.59, -.59), (6, -.59), (6, .59),
               (.59, .59), (.59, 6), (-.59, 6)]
        self.prism('Corner_continuous_L_walk', cap, 3.22, self.WALK, 'fort_stone_light')
        self.wall_details('Corner_X', (3, 0))
        # The second leg's exterior faces -X; its last socket points +Y.
        self.wall_details('Corner_Y', (0, 3), -math.pi/2)
        # Short corner infill joins parapets without obstructing the elbow's walk.
        self.prism('Corner_continuous_parapet_turn',
                   [(-.55, -.55), (0, -.55), (0, -.34),
                    (-.34, -.34), (-.34, 0), (-.55, 0)],
                   self.WALK, 3.80, 'fort_masonry')
        self.k.box('Corner_turn_merlon', (-.445, -.445, 4.10),
                   (.23, .23, .60), 'fort_masonry')
        self.k.box('Corner_turn_coping', (-.445, -.445, 4.405),
                   (.285, .285, .09), 'fort_stone_light')

    def gatehouse(self):
        self.palette()
        k = self.k
        for side in (-1, 1):
            k.box('Gate_stone_pier', (side*2.10, 0, 1.35),
                  (1.80, 3.0, 2.70), 'fort_masonry')
        opening = [(-1.20, 2.70), (-.90, 3.02), (-.55, 3.26),
                   (0, 3.45), (.55, 3.26), (.90, 3.02), (1.20, 2.70)]
        arch_mass = [(-3, 2.70)] + opening + [(3, 2.70), (3, 3.78), (-3, 3.78)]
        self.profile('Gate_true_open_arch', arch_mass, -1.50, 1.50, 'fort_masonry')
        # Real opening continues through the whole depth; no hidden box blocks it.
        for side in (-1, 1):
            for index, (a, b) in enumerate(zip(opening, opening[1:])):
                def outer(point):
                    x, z = point
                    return (x*1.17, z+.21*(1-abs(x)/1.2))
                self.profile('Gate_arch_voussoir', [a, b, outer(b), outer(a)],
                             side*1.50-.065, side*1.50+.065, 'fort_stone_light')
            for x in (-1.31, 1.31):
                for row in range(6):
                    k.box('Gate_opening_jamb', (x, side*1.50, .225+row*.45),
                          (.22, .14, .435), 'fort_stone_light', .016)
            normal = (0, side)
            for along in (-2.12, 2.12):
                self.stone_patches('Gate_pier', normal, 1.50, 1.45, 2.5,
                                   int(551+side+along*10), centre=along)
        self.quoins('Gate', 3, 1.5, 3.70)
        k.box('Gate_upper_plaster_storey', (0, 0, 4.63),
              (6, 3, 1.70), 'fort_plaster', .025)
        for side in (-1, 1):
            for z in (3.80, 5.43):
                k.box('Gate_timber_rail', (0, side*1.515, z),
                      (6.05, .14, .14), 'oak_dark', .012)
            for x in (-2.88, -1.25, 0, 1.25, 2.88):
                k.box('Gate_timber_post', (x, side*1.515, 4.62),
                      (.13, .14, 1.71), 'oak_dark', .012)
            for x in (-2.1, 2.1):
                self.window('Gate_upper_window', (0, side), 1.5, x,
                            4.67, .45, .70, timber=True)
            for sx in (-1, 1):
                k.beam('Gate_storey_brace', (sx*.12, side*1.54, 3.87),
                       (sx*1.12, side*1.54, 5.35), .047, 'oak_dark', 4)
            self.door('Gate_wallwalk_access', (side, 0), 3.0, 0, self.WALK,
                      .78, 1.65)
        self.gable_roof('Gate', 6.44, 3.50, 5.53, 7.45)

    def square_tower(self):
        self.palette()
        k = self.k
        k.box('Square_tower_plinth', (0, 0, .18), (3.80, 3.80, .36),
              'fort_stone_dark', .030)
        k.box('Square_tower_masonry', (0, 0, 2.47), (3.60, 3.60, 4.94),
              'fort_masonry', .027)
        # Begin above the plinth: its ±1.90 faces otherwise coincide exactly
        # with the projecting bottom quoins and flicker after export.
        self.quoins('Square_tower', 1.8, 1.8, 4.80, base=.62)
        for index, normal in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
            self.stone_patches('Square_tower', normal, 1.8, 3.3, 4.7, 610+index, sparse=True)
            self.window('Square_tower_lower_loop', normal, 1.8, 0, 1.65,
                        .13, .64, slit=True)
            if normal[0]:
                self.door('Square_tower_wallwalk_access', normal, 1.8, 0, self.WALK,
                          .76, 1.50)
        k.box('Square_tower_watch_floor', (0, 0, 4.92), (4.02, 4.02, .20),
              'oak_dark', .018)
        k.box('Square_tower_watch_plaster', (0, 0, 5.47), (3.88, 3.88, 1.0),
              'fort_plaster', .018)
        for side in (-1, 1):
            for z in (5.0, 5.99):
                for turn in (0, math.pi/2):
                    rail = k.box('Square_tower_watch_rail', (0, side*1.97, z),
                                 (4.03, .14, .13), 'oak_dark', .012)
                    if turn:
                        rail.location = (side*1.97, 0, z)
                        rail.rotation_euler.z = turn
            for x in (-1.88, 0, 1.88):
                k.box('Square_tower_watch_post', (x, side*1.965, 5.48),
                      (.12, .14, 1.04), 'oak_dark', .010)
                k.box('Square_tower_watch_post', (side*1.965, x, 5.48),
                      (.14, .12, 1.04), 'oak_dark', .010)
            for x in (-1.32, 1.32):
                k.beam('Square_tower_watch_corbel', (x, side*1.74, 4.40),
                       (x, side*2.0, 4.91), .075, 'oak_dark', 5)
        for normal in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            for along in (-.91, .91):
                self.window('Square_tower_watch_window', normal, 1.94,
                            along, 5.48, .49, .49, timber=True)
        self.hipped_roof('Square_tower', 4.40, 6.04, 8.10)

    def round_tower(self):
        self.palette()
        k = self.k
        sides = 16
        for name, radius, low, high, mat in (
                ('Round_tower_plinth', 1.99, 0, .38, 'fort_stone_dark'),
                ('Round_tower_masonry', 1.85, .32, 5.91, 'fort_masonry'),
                ('Round_tower_eave_stone', 1.94, 5.73, 5.94, 'fort_stone_light')):
            obj = k.cone(name, (0, 0, (low+high)/2), radius, radius,
                         high-low, mat, sides)
            obj.data.transform(Matrix.Rotation(math.pi/sides, 4, 'Z'))
            obj.data.update()
        apothem = 1.85*math.cos(math.pi/sides)
        for index in range(sides):
            angle = index*math.tau/sides
            normal = (math.cos(angle), math.sin(angle))
            self.stone_patches('Round_tower', normal, apothem, .61, 5.36,
                               710+index, base=.39, sparse=True)
            if index % 4 == 0:
                self.window('Round_tower_upper_loop', normal, apothem,
                            0, 5.10, .19, .66, slit=True)
            if index in (0, 8):
                self.door('Round_tower_wallwalk_access', normal, apothem,
                          0, self.WALK, .61, 1.47)
            elif index in (4, 12):
                self.window('Round_tower_lower_loop', normal, apothem,
                            0, 1.85, .13, .67, slit=True)
        roof = k.cone('Round_tower_closed_conical_roof', (0, 0, 7.04),
                      2.18, .035, 2.26, 'fort_roof', sides)
        roof.data.transform(Matrix.Rotation(math.pi/sides, 4, 'Z'))
        roof.data.update()
        roof.data.materials.append(k.M['fort_roof_light'])
        for face in roof.data.polygons:
            if len(face.vertices) == 4 and face.index % 4 == 0:
                face.material_index = 1
        for t in (.30, .57, .80):
            radius = .035+(2.18-.035)*t
            z = 8.17-2.26*t+.013
            points = [(radius*math.cos((i+.5)*math.tau/sides),
                       radius*math.sin((i+.5)*math.tau/sides), z) for i in range(sides)]
            for a, b in zip(points, points[1:]+points[:1]):
                k.beam('Round_tower_roof_course', a, b, .020, 'fort_roof_light', 4)

    def manor(self):
        self.palette()
        k = self.k
        before = set(bpy.context.scene.objects)
        k.box('Manor_stone_plinth', (0, 0, .20), (6.12, 4.92, .40),
              'fort_stone_dark', .040)
        k.box('Manor_residential_tower', (0, 0, 3.54), (6, 4.8, 7.08),
              'fort_plaster', .035)
        self.quoins('Manor', 3, 2.4, 7.0, .60)
        for index, normal in enumerate(((0, -1), (0, 1), (1, 0), (-1, 0))):
            distance = 2.4 if normal[1] else 3.0
            width = 5.6 if normal[1] else 4.4
            self.stone_patches('Manor_weathered_plaster', normal, distance,
                               width, 6.9, 810+index, sparse=True)
            for z in (4.18, 6.03):
                for along in (-1.53, 1.53) if normal[1] else (-1.16, 1.16):
                    self.window('Manor_small_window', normal, distance,
                                along, z, .48, .85)
            for along in (-1.70, 1.70) if normal[1] else (0,):
                self.window('Manor_ground_loop', normal, distance,
                            along, 1.06, .12, .57, slit=True)
        self.door('Manor_raised_entrance', (0, -1), 2.40, -.55,
                  1.80, .84, 1.72)
        # Compact removable timber stair parallel to the front wall.
        for x in (-.94, -.10):
            for y in (-3.18, -2.48):
                k.box('Manor_landing_post', (x, y, .90), (.13, .13, 1.80),
                      'oak_dark', .015)
        k.box('Manor_landing', (-.52, -2.82, 1.75), (.99, .85, .10),
              'oak', .014)
        for x in (-.89, -.15):
            k.beam('Manor_landing_brace', (x, -3.17, .78),
                   (x, -2.46, 1.72), .058, 'oak_dark', 5)
        for index in range(10):
            x = 2.56-index*.28
            top = .18*(index+1)
            k.box('Manor_stair_tread', (x, -2.82, top-.045),
                  (.30, .78, .09), 'oak', .010)
        for y in (-3.10, -2.54):
            k.beam('Manor_stair_stringer', (2.71, y, .055),
                       (-.10, y, 1.75), .063, 'oak_dark', 5)
        for index in (0, 4, 9):
            x = 2.56-index*.28
            top = .18*(index+1)
            k.box('Manor_stair_rail_post', (x, -3.22, top+.39),
                  (.09, .09, .90), 'oak_dark', .010)
        k.beam('Manor_stair_handrail', (2.61, -3.22, .99),
                   (-.02, -3.22, 2.69), .045, 'oak_dark', 5)
        for x in (-.94, -.10):
            k.box('Manor_landing_rail_post', (x, -3.22, 2.22),
                  (.09, .09, .91), 'oak_dark', .010)
        k.beam('Manor_landing_handrail', (-.99, -3.22, 2.68),
                   (-.02, -3.22, 2.68), .045, 'oak_dark', 5)
        self.gable_roof('Manor', 6.45, 5.20, 7.10, 9.95)
        # Centre the complete footprint, including the front stair and eaves.
        bpy.context.view_layer.update()
        objects = [obj for obj in set(bpy.context.scene.objects)-before if obj.type == 'MESH']
        points = [obj.matrix_world @ Vector(v) for obj in objects for v in obj.bound_box]
        mid_x = (min(p.x for p in points)+max(p.x for p in points))/2
        mid_y = (min(p.y for p in points)+max(p.y for p in points))/2
        for obj in objects:
            obj.location.x -= mid_x
            obj.location.y -= mid_y

    def palisade(self):
        self.palette()
        k = self.k
        before = set(bpy.context.scene.objects)
        rng = random.Random(1421)
        for index in range(23):
            x = -2.86+index*.26
            height = 2.35+rng.uniform(-.075, .075)
            shoulder = height-.29
            k.cone('Palisade_hewn_stake', (x, 0, shoulder/2), .14, .125,
                   shoulder, 'oak' if index % 3 else 'oak_light', 7)
            k.cone('Palisade_cut_point', (x, 0, (shoulder+height)/2), .125, 0,
                   height-shoulder, 'oak_light', 7)
        for z in (.58, 1.53):
            k.box('Palisade_inner_rail', (0, .17, z), (6, .15, .17),
                  'oak_dark', .020)
        for side in (-1, 1):
            k.beam('Palisade_inner_diagonal', (side*2.62, .275, .48),
                       (side*.18, .275, 1.64), .075, 'oak_dark', 5)
            k.beam('Palisade_ground_brace', (side*2.28, .64, .035),
                       (side*2.28, .18, 1.49), .065, 'oak_dark', 5)
        # Keep full footprint centred, including the internal braces.
        bpy.context.view_layer.update()
        objects = [obj for obj in set(bpy.context.scene.objects)-before if obj.type == 'MESH']
        points = [obj.matrix_world @ Vector(v) for obj in objects for v in obj.bound_box]
        mid_y = (min(p.y for p in points)+max(p.y for p in points))/2
        for obj in objects:
            obj.location.y -= mid_y


def builders(namespace):
    batch = Fortifications(SimpleNamespace(**namespace))
    return {
        'fort_wall': batch.wall,
        'fort_wall_corner': batch.wall_corner,
        'fort_gatehouse': batch.gatehouse,
        'fort_tower_square': batch.square_tower,
        'fort_tower_round': batch.round_tower,
        'fort_manor': batch.manor,
        'timber_palisade': batch.palisade,
    }
