"""Original low-poly landscape and fieldwork props for the miniature kit.

Metres, Z up. Every builder returns closed static parts, with the full footprint
centred on the origin and the lowest point at Z=0. See landscape-references.md.
"""
import math
import random
from types import SimpleNamespace

import bmesh
import bpy
from mathutils import Matrix, Vector


class Landscape:
    def __init__(self, kit):
        self.k = kit

    def palette(self):
        for name, colour in {
            'land_rock': (.355, .357, .310),
            'land_rock_light': (.410, .410, .354),
            'land_rock_dark': (.293, .302, .267),
            'land_mortar': (.295, .283, .230),
            'land_earth': (.265, .217, .143),
            'land_reed': (.250, .282, .105),
            'land_reed_light': (.338, .342, .161),
            'land_reed_dark': (.149, .219, .091),
            'land_seedhead': (.225, .156, .083),
        }.items():
            if name not in self.k.M:
                self.k.material(name, colour)

    def solid(self, name, vertices, faces, material):
        obj = self.k.mesh(name, vertices, faces, material)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def prism(self, name, outline, bottom, top, material):
        count = len(outline)
        return self.solid(name,
                          [(x, y, z) for z in (bottom, top) for x, y in outline],
                          [tuple(reversed(range(count))),
                           tuple(range(count, count*2))] +
                          [(i, (i+1) % count, (i+1) % count+count, i+count)
                           for i in range(count)], material)

    def slab(self, name, x1, x2, y1, y2, z1, z2, depth, material):
        """Closed plank with a top sloping along X, not a texture card."""
        top = [(x1, y1, z1), (x2, y1, z2),
               (x2, y2, z2), (x1, y2, z1)]
        return self.solid(name, top+[(x, y, z-depth) for x, y, z in top],
                          [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
                           (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
                          material)

    def boulder(self, name, position, size, seed, turn=0):
        """A weathered, flattened stone with a closed buried underside.

        Three unequal octagonal rings give broad facets rather than a faceted
        sphere or a regular hexagonal stepping stone. Each stone meets Z=0.
        """
        rng = random.Random(seed)
        outline = [(-.46, -.23), (-.22, -.50), (.25, -.46), (.50, -.16),
                   (.46, .29), (.17, .50), (-.30, .43), (-.50, .13)]
        vertices = []
        for ring, (radius, height) in enumerate(((.78, 0), (1, .36), (.73, .88))):
            for x, y in outline:
                stretch = rng.uniform(.92, 1.05)
                vx, vy = x*radius*stretch, y*radius*stretch
                vz = height + (rng.uniform(-.055, .055) if ring else 0)
                vertices.append((vx, vy, vz))
        vertices.append((-.06, .02, 1))
        faces = [tuple(reversed(range(8)))]
        for ring in range(2):
            for i in range(8):
                a, b = ring*8+i, ring*8+(i+1) % 8
                c, d = b+8, a+8
                # Explicit triangulation preserves intentional, uneven facets.
                faces.extend(((a, b, c), (a, c, d)))
        faces.extend((16+i, 16+(i+1) % 8, 24) for i in range(8))
        low = [min(v[i] for v in vertices) for i in range(3)]
        high = [max(v[i] for v in vertices) for i in range(3)]
        local = [((x-(low[0]+high[0])/2)*size[0]/(high[0]-low[0]),
                  (y-(low[1]+high[1])/2)*size[1]/(high[1]-low[1]),
                  (z-low[2])*size[2]/(high[2]-low[2])) for x, y, z in vertices]
        transformed = [(position[0]+x*math.cos(turn)-y*math.sin(turn),
                        position[1]+x*math.sin(turn)+y*math.cos(turn),
                        position[2]+z) for x, y, z in local]
        obj = self.solid(name, transformed, faces, 'land_rock')
        obj.data.materials.append(self.k.M['land_rock_light'])
        obj.data.materials.append(self.k.M['land_rock_dark'])
        for face in obj.data.polygons:
            if face.normal.z > .65:
                face.material_index = 1 if rng.random() < .34 else 0
            elif rng.random() < .20:
                face.material_index = 2
        return obj

    def rock_foundation(self):
        self.palette()
        # A broad, level summit with an irregular fractured apron. This is a
        # placement plinth, not a miniature of any named castle's topography.
        outline = [(-3, -.56), (-2.70, -1.38), (-1.70, -1.90), (-.56, -2),
                   (.75, -1.80), (2.08, -1.50), (3, -.60), (2.83, .64),
                   (2.01, 1.49), (.75, 2), (-.65, 1.83), (-1.88, 1.55),
                   (-2.61, .87), (-2.94, .19)]
        vertices = []
        shoulder_height = (.72, .84, .65, .71, .90, .71, .68,
                           .95, .88, .67, .89, .80, .66, .87)
        # Top X/Y ring deliberately stays planar at 1.5 for castle placement.
        for ring in range(3):
            for i, (x, y) in enumerate(outline):
                if ring == 0:
                    vertices.append((x, y, 0))
                elif ring == 1:
                    radius = .92 if i % 3 else .98
                    vertices.append((x*radius, y*radius, shoulder_height[i]))
                else:
                    vertices.append((x*.72, y*.70, 1.50))
        n = len(outline)
        faces = [tuple(reversed(range(n))), tuple(range(n*2, n*3))]
        for ring in range(2):
            for i in range(n):
                a, b = ring*n+i, ring*n+(i+1) % n
                c, d = b+n, a+n
                faces.extend(((a, b, d), (b, c, d)))
        obj = self.solid('Foundation_fractured_continuous_outcrop', vertices, faces,
                         'land_rock')
        obj.data.materials.append(self.k.M['land_rock_light'])
        obj.data.materials.append(self.k.M['land_rock_dark'])
        for face in obj.data.polygons:
            face.material_index = (1 if face.normal.z > .85 else
                                   (2 if face.index % 7 in (1, 3) else 0))

    def field_shelter(self):
        self.palette()
        k = self.k
        # Front is +X, as in field_blockhouse. The rear is open from ground
        # level; the front firing slit and side sightlines remain unobstructed.
        for x in (-1.27, .48):
            post_top = 1.78+(x+1.27)*(.23/2.18)
            for y in (-.82, .82):
                k.box('Shelter_grounded_hewn_post', (x, y, post_top/2),
                      (.14, .14, post_top),
                      'oak_dark', .012)
                k.beam('Shelter_eave_knee_brace', (x, y, post_top-.41),
                       (x, y*.60, post_top-.04), .042, 'oak_dark', 5)
        for side in (-1, 1):
            for row in range(3):
                k.box('Shelter_notched_side_log', (.035, side*.82, .13+row*.22),
                      (2.83, .18, .23), 'oak', .017)
            for x in (-1.26, 1.20):
                k.box('Shelter_log_joint_end', (x, side*.82, .35),
                      (.19, .23, .18), 'oak_dark', .014)
        k.box('Shelter_front_stone_footing', (1.23, 0, .12),
              (.28, 1.53, .24), 'stone', .028)
        for row in range(3):
            k.box('Shelter_front_cover_log', (1.23, 0, .326+row*.19),
                  (.21, 1.69, .18), 'oak', .016)
        for y in (-.755, .755):
            k.box('Shelter_front_cover_post', (1.22, y, .48),
                  (.13, .13, .94), 'oak_dark', .013)
        for x in (-1.27, .48):
            k.box('Shelter_roof_tie', (x, 0, 1.72+(x+1.27)*(.23/2.18)),
                  (.16, 1.82, .13),
                  'oak_dark', .012)
        # Lean-to roof falls rearward, leaving the firing edge open. Adjacent
        # planks have thin real seams and embed into the tie beams below.
        for index in range(8):
            y1 = -.97+index*.2425
            self.slab('Shelter_closed_roof_plank', -1.50, .68, y1, y1+.235,
                      1.83, 2.06, .065,
                      'oak_light' if index % 3 == 0 else 'oak')
        for y in (-.86, .86):
            k.beam('Shelter_sloping_roof_rail', (-1.43, y, 1.78),
                   (.61, y, 2.00), .044, 'oak_dark', 5)

    def low_stone_wall(self):
        self.palette()
        k = self.k
        # Continuous modest mortar body prevents holes through the masonry.
        # Independent irregular stones have inset backs and staggered courses.
        k.box('Low_wall_continuous_core', (0, 0, .475), (3.93, .55, .95),
              'land_mortar', .025)
        rng = random.Random(1437)
        for row in range(3):
            count = 7 if row % 2 else 6
            step = 4/count
            for i in range(count):
                width = step-.025
                x = -2+(i+.5)*step
                height = .30+rng.uniform(-.025, .025)
                # Irregular closed stones expose broad uneven facets rather
                # than regular bevelled brick faces. Their backs enter the core.
                for side in (-1, 1):
                    self.boulder('Low_wall_rubble_course',
                                 (x, side*(.242+rng.uniform(-.015, .015)),
                                  .006+row*.315),
                                 (width, .20, height), 1610+row*31+i*2+int(side),
                                 rng.uniform(-.023, .023))
        for i in range(8):
            k.box('Low_wall_worn_coping', (-1.75+i*.5, 0, 1.02),
                  (.48, .70, .16),
                  'land_rock_light' if i % 3 == 0 else 'land_rock', .039)

    def firing_platform(self):
        self.palette()
        k = self.k
        # Gun points +X. A shallow timber bed with continuous ramp access at
        # -X, and low earth supports outside the two side edges.
        for y in (-.68, .68):
            k.box('Gunbed_ground_sleeper', (.12, y, .09),
                  (2.48, .18, .18), 'oak_dark', .013)
        for index in range(8):
            x = -.95+index*.30
            k.box('Gunbed_hewn_cross_plank', (x, 0, .225),
                  (.287, 1.66, .13),
                  'oak_light' if index % 3 == 1 else 'oak', .008)
        for index in range(6):
            y = -.82+index*.275
            self.slab('Gunbed_open_rear_ramp_plank', -1.50, -1.08,
                      y, y+.266, .055, .287, .055, 'oak')
        for side in (-1, 1):
            outline = [(-.94, side*.79), (1.50, side*.79),
                       (1.43, side*1.10), (-.81, side*1.10)]
            # A closed bevelled soil wedge, wholly outside the planked bed.
            vertices = [(x, y, 0) for x, y in outline]
            vertices += [(-.87, side*.83, .27), (1.39, side*.83, .40),
                         (1.33, side*.98, .26), (-.77, side*.98, .16)]
            self.solid('Gunbed_low_earth_side_support', vertices,
                       [(3, 2, 1, 0), (4, 5, 6), (4, 6, 7),
                        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
                       'land_earth')
            k.box('Gunbed_side_revetment', (.21, side*.845, .19),
                  (2.55, .105, .22), 'oak_dark', .012)
        # Two separate rear shoulder stones leave the complete access open.
        for side in (-1, 1):
            self.boulder('Gunbed_rear_shoulder_stone', (-1.17, side*.98, 0),
                         (.45, .24, .23), 820+side)

    def bridge_approach(self):
        self.palette()
        k = self.k
        # X is travel direction. The high +X end is a level join across the
        # full 2.7 m bridge deck; no railing narrows the approach.
        for y in (-1.03, 1.03):
            self.slab('Approach_buried_timber_stringer', -1.48, 1.50,
                      y-.09, y+.09, .07, .49, .065, 'oak_dark')
        for index in range(10):
            x1 = -1.50+index*.30
            x2 = x1+.291
            height = lambda x: .09+(x+1.50)*(.47/3)
            self.slab('Approach_hewn_ramp_plank', x1, x2, -1.35, 1.35,
                      height(x1), height(x2), .080,
                      'oak_light' if index % 3 == 0 else 'oak')
        # Open-backed masonry abutment at the high end. Stone supports are
        # beneath the deck, so they cannot catch wheels along its edges.
        k.box('Approach_stone_abutment_core', (1.20, 0, .21),
              (.52, 2.52, .42), 'land_mortar', .017)
        for index in range(5):
            for row in range(2):
                k.box('Approach_front_rubble', (1.445, -1.035+index*.515, .11+row*.19),
                      (.105, .486, .184),
                      'land_rock_light' if (index+row) % 3 == 0 else 'land_rock', .022)
        for side in (-1, 1):
            self.boulder('Approach_bank_toe_stone', (.59, side*1.055, 0),
                         (.72, .47, .30), 515+side)

    def ford_stones(self):
        self.palette()
        # Irregular, separated stones belong at a ford's shallow edge. Avoid
        # equal spacing or a path-shaped chain across the whole river.
        for index, (x, y, sx, sy, h, turn) in enumerate([
                (-.97, -.20, .56, .48, .17, -.12),
                (-.46, .25, .63, .48, .21, .33),
                (.13, -.21, .70, .52, .18, -.20),
                (.62, .24, .50, .39, .14, .28),
                (1.01, -.13, .50, .46, .16, -.35)]):
            self.boulder('Ford_weathered_shallow_stone', (x, y, 0),
                         (sx, sy, h), 902+index, turn)

    def reed_leaf(self, origin, angle, height, reach, width, material):
        """Bent, keeled lance-shaped leaf with a closed diamond section."""
        root = Vector(origin)
        along = Vector((math.cos(angle), math.sin(angle), 0))
        across = Vector((-math.sin(angle), math.cos(angle), 0))
        centres = [root+along*reach*t+Vector((0, 0, height*z))
                   for t, z in ((0, 0), (.18, .45), (.62, .88), (1, 1))]
        vertices = [tuple(centres[0])]
        for index, span in ((1, width), (2, width*.65)):
            centre = centres[index]
            for offset in (across*span/2, Vector((0, 0, .010)),
                           -across*span/2, Vector((0, 0, -.010))):
                vertices.append(tuple(centre+offset))
        vertices.append(tuple(centres[3]))
        faces = [(0, 1+(i+1) % 4, 1+i) for i in range(4)]
        faces += [(1+i, 1+(i+1) % 4, 5+(i+1) % 4, 5+i) for i in range(4)]
        faces += [(5+i, 5+(i+1) % 4, 9) for i in range(4)]
        self.solid('Reeds_closed_keeled_leaf', vertices, faces, material)

    def reeds(self):
        self.palette()
        k = self.k
        rng = random.Random(141907)
        clumps = [(-.31, -.10), (.10, -.20), (.31, .08), (-.11, .17)]
        for index, (x, y) in enumerate(clumps):
            for blade in range(6):
                angle = blade*math.tau/6+index*.74
                self.reed_leaf((x, y, .012), angle,
                               rng.uniform(.57, .96), rng.uniform(.24, .38),
                               rng.uniform(.055, .09),
                               ('land_reed', 'land_reed_dark', 'land_reed_light')
                               [(index+blade) % 3])
            height = (1.27, 1.08, 1.15, .96)[index]
            lean_x, lean_y = rng.uniform(-.06, .06), rng.uniform(-.045, .045)
            base = (x, y, 0)
            top = (x+lean_x, y+lean_y, height)
            k.beam('Reeds_solid_stem', base, top, .013,
                   'land_reed_light', 5, radius2=.008)
            if index in (0, 2):
                # Two understated seedheads, not one thick cattail on every
                # stem. Rounded ends are tapered cones, with no flat cards.
                k.beam('Reeds_cattail_seedhead',
                       (top[0], top[1], height-.18),
                       (top[0], top[1], height-.035),
                       .033, 'land_seedhead', 7, radius2=.028)

    def bank_rocks(self):
        self.palette()
        for index, (x, y, sx, sy, h, turn) in enumerate([
                (-.48, -.20, .91, .68, .43, -.20),
                (.24, .10, .95, .83, .65, .27),
                (.72, -.29, .49, .41, .29, -.30),
                (-.43, .31, .54, .42, .28, .18)]):
            self.boulder('Bank_rounded_faceted_rock', (x, y, 0),
                         (sx, sy, h), 619+index, turn)

    def static_builder(self, method):
        def build():
            before = set(bpy.context.scene.objects)
            method()
            bpy.context.view_layer.update()
            objects = [o for o in set(bpy.context.scene.objects)-before if o.type == 'MESH']
            points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
            lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
            hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
            offset = Vector((-(lo.x+hi.x)/2, -(lo.y+hi.y)/2, -lo.z))
            # Baked transforms make source and exported vertex bounds agree.
            for obj in objects:
                transform = obj.matrix_world.copy()
                for vertex in obj.data.vertices:
                    vertex.co = transform @ vertex.co + offset
                obj.matrix_world = Matrix.Identity(4)
                obj.data.update()
        return build


def builders(namespace):
    landscape = Landscape(SimpleNamespace(**namespace))
    names = ('rock_foundation', 'field_shelter', 'low_stone_wall',
             'firing_platform', 'bridge_approach', 'ford_stones', 'reeds', 'bank_rocks')
    return {name: landscape.static_builder(getattr(landscape, name)) for name in names}
