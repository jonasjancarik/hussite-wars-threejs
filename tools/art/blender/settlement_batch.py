"""Original static village and town architecture for the battlefield kit.

Metres, Z up, fronts -Y. All builders centre their complete footprint after
construction. See settlement-references.md for evidence and intentional limits.
"""
import math
from types import SimpleNamespace

import bpy
from mathutils import Matrix, Vector

from fortification_batch import Fortifications


class Settlement:
    def __init__(self, kit):
        self.k = kit
        self.f = Fortifications(kit)

    def begin(self):
        self.f.palette()
        for name, colour in {
            'settlement_lime': (.63, .585, .48),
            'settlement_wattle': (.44, .385, .27),
            'settlement_thatch': (.39, .335, .215),
            'settlement_thatch_light': (.45, .395, .26),
            'settlement_earth': (.22, .19, .13),
            'settlement_glass': (.14, .175, .155),
        }.items():
            if name not in self.k.M:
                self.k.material(name, colour)
        return set(bpy.context.scene.objects)

    def centre(self, before):
        objects = [obj for obj in set(bpy.context.scene.objects)-before if obj.type == 'MESH']
        bpy.context.view_layer.update()
        points = [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]
        mid = Vector(((min(p.x for p in points)+max(p.x for p in points))/2,
                      (min(p.y for p in points)+max(p.y for p in points))/2, 0))
        for obj in objects:
            obj.location -= mid

    def roof(self, prefix, length, width, eave, ridge, mat='fort_roof',
             gable='settlement_lime', turn=0):
        before = set(bpy.context.scene.objects)
        self.f.gable_roof(prefix, length, width, eave, ridge, mat)
        for obj in set(bpy.context.scene.objects)-before:
            if '_closed_roof' in obj.name:
                obj.data.materials.append(self.k.M[gable])
                # Gable triangles are distinct from the sloped roof surface.
                for polygon in obj.data.polygons:
                    if len(polygon.vertices) == 3:
                        polygon.material_index = 1
            if turn:
                x, y = obj.location.x, obj.location.y
                obj.location.x = x*math.cos(turn)-y*math.sin(turn)
                obj.location.y = x*math.sin(turn)+y*math.cos(turn)
                obj.rotation_euler.z += turn

    def plinth(self, prefix, width, depth, height=.20):
        self.k.box(prefix+'_stone_footing', (0, 0, height/2),
                   (width, depth, height), 'fort_stone_dark', min(.025, height/5))

    def wall_boards(self, prefix, normal, distance, along, width, bottom, top):
        for row in range(int((top-bottom)/.28)):
            self.f.face_box(prefix+'_horizontal_board', normal, distance+.013,
                            along, bottom+.14+row*.28, width, .245,
                            'oak' if row % 3 else 'oak_light', .055, .008)

    def timber_frame(self, prefix, width, depth, bottom, top, posts=3):
        k = self.k
        for side in (-1, 1):
            for z in (bottom+.05, top-.04):
                k.box(prefix+'_front_rear_rail', (0, side*(depth/2+.012), z),
                      (width+.08, .14, .13), 'oak_dark', .010)
            for index in range(posts):
                x = -width/2+.07 + (width-.14)*index/(posts-1)
                k.box(prefix+'_front_rear_post', (x, side*(depth/2+.012), (top+bottom)/2),
                      (.13, .18, top-bottom), 'oak_dark', .010)
            for y in (-depth/2+.07, depth/2-.07):
                k.box(prefix+'_side_post', (side*(width/2+.014), y, (top+bottom)/2),
                      (.14, .13, top-bottom), 'oak_dark', .010)

    def shutters(self, prefix, normal, distance, along, z, width=.58, height=.69):
        self.f.window(prefix, normal, distance, along, z, width, height, timber=True)
        for side in (-1, 1):
            self.f.face_box(prefix+'_open_shutter', normal, distance+.054,
                            along+side*(width*.75+.055), z, width*.43,
                            height+.02, 'oak', .070, .010)
            for level in (z-height*.29, z+height*.29):
                self.f.face_box(prefix+'_shutter_batten', normal, distance+.096,
                                along+side*(width*.75+.055), level,
                                width*.40, .055, 'oak_dark', .030, .005)

    def step(self, prefix, along, face, width=1.0, height=.13):
        self.k.box(prefix+'_threshold_step', (along, face-.17, height/2),
                   (width, .42, height), 'fort_stone_light', .018)

    def house_timber(self):
        before = self.begin()
        k = self.k
        self.plinth('Timber_house', 5.08, 3.58)
        k.box('Timber_house_wall_core', (0, 0, 1.33), (5, 3.5, 2.30), 'oak_dark')
        for side in (-1, 1):
            self.wall_boards('Timber_house', (0, side), 1.75, 0, 5.0, .23, 2.48)
            self.wall_boards('Timber_house', (side, 0), 2.50, 0, 3.5, .23, 2.48)
        for x in (-2.42, 2.42):
            for y in (-1.76, 1.76):
                k.box('Timber_house_corner_post', (x, y, 1.33),
                      (.16, .16, 2.30), 'oak_dark', .012)
        self.f.door('Timber_house', (0, -1), 1.79, -.68, .13, .86, 1.85)
        self.step('Timber_house', -.68, -1.79, 1.05)
        self.shutters('Timber_house_front_window', (0, -1), 1.79, 1.17, 1.54, .52, .65)
        self.shutters('Timber_house_rear_window', (0, 1), 1.79, 0, 1.50, .47, .60)
        self.roof('Timber_house', 5.48, 4.10, 2.47, 4.15, 'fort_shingle', 'oak')
        self.centre(before)

    def house_plaster(self):
        before = self.begin()
        k = self.k
        self.plinth('Plaster_house', 5.10, 4.10)
        k.box('Plaster_house_lime_walls', (0, 0, 1.40),
              (5, 4, 2.52), 'settlement_lime', .025)
        self.timber_frame('Plaster_house', 5, 4, .20, 2.67, 3)
        self.f.door('Plaster_house', (0, -1), 2.03, -.58, .13, .88, 1.88)
        self.step('Plaster_house', -.58, -2.03, 1.08)
        self.shutters('Plaster_house_window', (0, -1), 2.03, 1.30, 1.58, .56, .74)
        self.shutters('Plaster_house_window', (1, 0), 2.50, .2, 1.62, .56, .74)
        self.f.stone_patches('Plaster_house_weathering', (0, -1), 2.0, 4.5, .58, 1141, base=.28, sparse=True)
        self.roof('Plaster_house', 5.46, 4.52, 2.66, 4.37)
        k.box('Plaster_house_simple_chimney', (1.34, .37, 4.30),
              (.43, .43, 1.13), 'fort_masonry', .023)
        k.box('Plaster_house_chimney_cap', (1.34, .37, 4.85),
              (.53, .53, .12), 'fort_stone_dark', .017)
        self.centre(before)

    def townhouse(self):
        before = self.begin()
        k = self.k
        self.plinth('Townhouse', 3.92, 5.10, .26)
        k.box('Townhouse_masonry_ground_floor', (0, 0, 1.38),
              (3.8, 5.0, 2.50), 'fort_plaster', .020)
        k.box('Townhouse_timber_upper_floor', (0, 0, 3.88),
              (4.06, 5.12, 2.50), 'settlement_lime', .020)
        self.timber_frame('Townhouse_upper', 4.06, 5.12, 2.63, 5.13, 3)
        for side in (-1, 1):
            for x in (-1.48, 1.48):
                k.beam('Townhouse_jetty_bracket', (x, side*2.45, 2.25),
                       (x, side*2.60, 2.63), .065, 'oak_dark', 5)
                k.beam('Townhouse_upper_brace', (x, side*2.575, 2.75),
                       (x*.48, side*2.575, 3.32), .044, 'oak_dark', 4)
            for along in (-.94, .94):
                self.shutters('Townhouse_upper_window', (0, side), 2.575,
                              along, 4.08, .54, .80)
        self.f.door('Townhouse', (0, -1), 2.52, -.90, .13, .86, 1.98)
        self.step('Townhouse', -.90, -2.52, 1.02)
        self.shutters('Townhouse_shop_window', (0, -1), 2.52, .83, 1.47, .63, .93)
        for normal in ((1, 0), (-1, 0)):
            for along in (-1.35, 1.35):
                self.f.window('Townhouse_side_window', normal, 2.03, along,
                              4.03, .45, .75, timber=True)
        self.roof('Townhouse', 5.58, 4.52, 5.10, 7.36,
                  'fort_roof', 'oak', math.pi/2)
        for side in (-1, 1):
            k.beam('Townhouse_gable_king_post', (0, side*2.797, 5.12),
                   (0, side*2.797, 7.30), .06, 'oak_dark', 5)
            self.f.window('Townhouse_attic_vent', (0, side), 2.80, 0,
                          5.87, .33, .54, timber=True)
        self.centre(before)

    def barn(self):
        before = self.begin()
        k = self.k
        k.box('Barn_earthen_floor', (0, 0, .05), (6, 4, .10), 'settlement_earth')
        for side in (-1, 1):
            k.box('Barn_side_wall', (side*2.92, 0, 1.48),
                  (.16, 4.0, 2.76), 'oak_dark')
            k.box('Barn_front_wall', (side*2.04, -1.92, 1.48),
                  (1.92, .16, 2.76), 'oak_dark')
            self.wall_boards('Barn_front', (0, -1), 2.0, side*2.04, 1.91, .13, 2.86)
            self.wall_boards('Barn_side', (side, 0), 3.0, 0, 4.0, .13, 2.86)
            k.box('Barn_door_post', (side*1.08, -1.98, 1.48),
                  (.15, .20, 2.78), 'oak_dark', .012)
            # Both leaves are folded flat against the front walls; the centre
            # remains a real open doorway into the shallow, closed-back barn.
            k.box('Barn_folded_door_leaf', (side*1.665, -2.09, 1.30),
                  (1.08, .09, 2.36), 'oak', .012)
            for z in (.46, 2.10):
                k.box('Barn_door_batten', (side*1.665, -2.145, z),
                      (1.04, .05, .105), 'oak_dark', .010)
            k.beam('Barn_door_diagonal', (side*1.16, -2.15, .48),
                   (side*2.17, -2.15, 2.07), .04, 'oak_dark', 4)
            for z in (.40, 2.10):
                k.beam('Barn_door_hinge', (side*1.11, -1.98, z),
                       (side*1.15, -2.10, z), .035, 'iron', 6)
        k.box('Barn_back_wall', (0, 1.92, 1.48), (5.84, .16, 2.76), 'oak_dark')
        self.wall_boards('Barn_back', (0, 1), 2.0, 0, 6.0, .13, 2.86)
        k.box('Barn_door_header', (0, -1.96, 2.72), (2.32, .22, .28), 'oak_dark', .012)
        k.beam('Barn_interior_tie', (-2.89, 0, 2.62), (2.89, 0, 2.62), .09, 'oak_dark', 5)
        self.roof('Barn', 6.48, 4.54, 2.85, 4.85,
                  'settlement_thatch', 'oak')
        self.centre(before)

    def shed(self):
        before = self.begin()
        k = self.k
        for x in (-1.40, 1.40):
            for y, top in ((-.90, 2.05), (.90, 2.49)):
                k.box('Shed_grounded_post', (x, y, top/2),
                      (.14, .14, top), 'oak_dark', .012)
            k.box('Shed_low_side_wall', (x, 0, .86), (.13, 1.93, 1.72), 'oak', .008)
            self.wall_boards('Shed_side', (1 if x > 0 else -1, 0),
                             1.48, 0, 1.92, .05, 1.76)
        k.box('Shed_back_wall', (0, .95, 1.20), (2.8, .14, 2.4), 'oak_dark')
        self.wall_boards('Shed_back', (0, 1), 1.02, 0, 2.90, .07, 2.45)
        for y, z in ((-.9, 2.01), (.9, 2.45)):
            k.box('Shed_header', (0, y, z), (2.94, .15, .15), 'oak_dark', .011)
        tops = [(-1.66, -1.21, 2.09), (1.66, -1.21, 2.09),
                (1.66, 1.21, 2.68), (-1.66, 1.21, 2.68)]
        vertices = tops+[(x, y, z-.09) for x, y, z in tops]
        self.f.solid('Shed_closed_lean_roof', vertices,
                     [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
                      (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], 'fort_shingle')
        for y in (-.75, -.15, .45, 1.05):
            z = 2.09+(y+1.21)*(.59/2.42)+.012
            k.beam('Shed_roof_course', (-1.64, y, z), (1.64, y, z), .022, 'oak_dark', 4)
        self.centre(before)

    def fence_gate(self):
        before = self.begin()
        k = self.k
        for side in (-1, 1):
            for x in (side*1.075, side*2.01, side*2.925):
                k.box('Fence_grounded_post', (x, 0, .69), (.15, .15, 1.38), 'oak_dark', .012)
            for z in (.48, 1.04):
                k.box('Fence_split_rail', (side*2.06, .015, z),
                      (1.83, .11, .12), 'oak', .009)
            for index in range(6):
                x = side*(1.22+index*.33)
                k.box('Fence_upright_pale', (x, -.045, .70),
                      (.075, .080, 1.26+(index % 2)*.045), 'oak_light', .008)
            k.beam('Fence_diagonal_brace', (side*1.15, .10, .39),
                   (side*2.88, .10, 1.08), .036, 'oak_dark', 4)
        # Open leaf runs rearwards beside the right post, never across the gap.
        for z in (.43, 1.05):
            k.box('Fence_open_gate_rail', (1.075, .88, z),
                      (.10, 1.70, .12), 'oak', .009)
        for index in range(6):
            k.box('Fence_open_gate_pale', (1.05, .18+index*.285, .69),
                      (.08, .075, 1.26), 'oak_light', .008)
        k.beam('Fence_open_gate_diagonal', (1.135, .07, .37),
                   (1.135, 1.71, 1.10), .035, 'oak_dark', 4)
        for z in (.40, 1.06):
            k.cone('Fence_gate_hinge_pin', (1.075, .075, z), .028, .028, .17, 'iron', 6)
        self.centre(before)

    def pointed(self, prefix, normal, distance, along, bottom, width, height,
                material='settlement_glass', mullion=True):
        nx, ny = normal
        inner = [(-width/2, 0), (width/2, 0), (width/2, height*.66),
                 (width*.25, height*.86), (0, height),
                 (-width*.25, height*.86), (-width/2, height*.66)]
        outer = [(u*(width+.20)/width, v*(height+.20)/height-.085) for u, v in inner]
        def point(u, v, d):
            return (nx*d-ny*(along+u), ny*d+nx*(along+u), bottom+v)
        count = len(inner)
        vertices = [point(u, v, d) for d in (distance-.007, distance+.12) for u, v in outer+inner]
        faces = []
        for i in range(count):
            j = (i+1) % count
            faces += [(i, j, j+count, i+count),
                      (i+2*count, i+3*count, j+3*count, j+2*count),
                      (i, i+2*count, j+2*count, j),
                      (i+count, j+count, j+3*count, i+3*count)]
        self.f.solid(prefix+'_pointed_stone_frame', vertices, faces, 'fort_stone_light')
        vertices = [point(u, v, d) for d in (distance-.004, distance+.044) for u, v in inner]
        faces = [tuple(range(count)), tuple(reversed(range(count, 2*count)))]
        faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
        self.f.solid(prefix+'_closed_recess', vertices, faces, material)
        if mullion:
            self.f.face_box(prefix+'_stone_mullion', normal, distance+.077, along,
                            bottom+height*.37, .052, height*.73,
                            'fort_stone_light', .080, 0)

    def buttress(self, prefix, normal, distance, along, top, width=.35, depth=.50):
        nx, ny = normal
        vertices = [(nx*(distance+d)-ny*(along+u), ny*(distance+d)+nx*(along+u), z)
                    for z, upper in ((0, False), (top, True))
                    for u, d in ((-width/2, -.05), (width/2, -.05),
                                 (width/2, depth), (-width/2, depth))]
        vertices[6] = (*vertices[6][:2], top-.25)
        vertices[7] = (*vertices[7][:2], top-.25)
        self.f.solid(prefix+'_sloped_buttress', vertices,
                     [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4),
                      (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 'fort_masonry')

    def monastery_wing(self):
        before = self.begin()
        k = self.k
        self.plinth('Monastery', 8.12, 3.62, .25)
        k.box('Monastery_lime_wall', (0, 0, 1.82), (8, 3.5, 3.64), 'settlement_lime', .025)
        for side in (-1, 1):
            for x in (-2.85, -1.35, 1.35, 2.85):
                self.pointed('Monastery_window', (0, side), 1.75,
                             x, 1.49, .49, 1.26)
            for x in (-3.72, -2.12, 2.12, 3.72):
                self.buttress('Monastery', (0, side), 1.75, x, 2.92, .26, .32)
        self.pointed('Monastery_door', (0, -1), 1.75, 0, .13, 1.02, 2.13, 'oak', False)
        for z in (.55, 1.53):
            self.f.face_box('Monastery_door_strap', (0, -1), 1.81,
                            0, z, .83, .055, 'iron', .04, .004)
        self.step('Monastery', 0, -1.75, 1.20)
        self.roof('Monastery', 8.42, 4.05, 3.63, 5.52)
        self.centre(before)

    def church_gothic(self):
        before = self.begin()
        k = self.k
        self.plinth('Gothic_church_nave', 6.72, 7.32, .28)
        k.box('Gothic_church_broad_hall', (0, 0, 2.46),
              (6.6, 7.2, 4.92), 'fort_plaster', .028)
        for side in (-1, 1):
            for along in (-2.26, 0, 2.26):
                self.pointed('Gothic_church_nave_window', (side, 0), 3.3,
                             along, 1.39, .72, 2.70)
            for along in (-3.34, -1.12, 1.12, 3.34):
                self.buttress('Gothic_church_nave', (side, 0), 3.30,
                              along, 4.30, .34, .46)
        # High tent-like hall roof is a restrained period cue. It deliberately
        # omits the modern 102 m Plzeň spire and later side chapels.
        r, d = 3.60, 3.89
        verts = [(-r, -d, 4.90), (r, -d, 4.90), (r, d, 4.90),
                 (-r, d, 4.90), (0, -1.36, 9.10), (0, 1.36, 9.10)]
        self.f.solid('Gothic_church_tent_roof', verts,
                     [(3, 2, 1, 0), (0, 1, 4), (1, 2, 5, 4),
                      (2, 3, 5), (3, 0, 4, 5)], 'fort_shingle')
        k.beam('Gothic_church_tent_ridge', (0, -1.38, 9.10),
                   (0, 1.38, 9.10), .055, 'oak_dark', 5)
        for side in (-1, 1):
            for fraction in (.25, .5, .75):
                x = side*r*fraction
                near_y = 1.36+(d-1.36)*fraction
                z = 9.10-(9.10-4.90)*fraction+.015
                k.beam('Gothic_church_roof_course', (x, -near_y, z),
                       (x, near_y, z), .025, 'oak_dark', 4)
        apse = [(-2.2, 3.2), (2.2, 3.2), (2.2, 4.74),
                (1.33, 5.76), (-1.33, 5.76), (-2.2, 4.74)]
        self.f.prism('Gothic_church_polygonal_choir', apse, 0, 4.40, 'fort_plaster')
        verts = [(x*1.035, 4.48+(y-4.48)*1.04, 4.40) for x, y in apse]
        verts += [(0, 4.06, 6.91)]
        self.f.solid('Gothic_church_choir_roof', verts,
                     [tuple(reversed(range(6)))]+[(i, (i+1) % 6, 6) for i in range(6)],
                     'fort_roof')
        self.pointed('Gothic_church_choir_window', (0, 1), 5.76, 0, 1.3, .62, 2.30)
        for side in (-1, 1):
            self.pointed('Gothic_church_choir_window', (side, 0), 2.20,
                         side*4.12, 1.30, .56, 2.20)
        # Modest square west tower, lower than the hall roof, not a site portrait.
        tower_before = set(bpy.context.scene.objects)
        k.box('Gothic_church_west_tower', (0, 0, 3.12), (2.46, 2.52, 6.24), 'fort_masonry', .025)
        for normal in ((0, -1), (1, 0), (-1, 0)):
            distance = 1.26 if normal[1] else 1.23
            self.pointed('Gothic_church_bell_opening', normal, distance,
                         0, 4.73, .48, 1.05, 'black')
        self.f.hipped_roof('Gothic_church_tower', 2.96, 6.24, 8.05)
        for obj in set(bpy.context.scene.objects)-tower_before:
            obj.location += Vector((-1.91, -4.31, 0))
        self.pointed('Gothic_church_west_door', (0, -1), 3.60,
                     .78, .15, 1.25, 2.45, 'oak', False)
        self.step('Gothic_church', .78, -3.60, 1.46, .15)
        k.beam('Gothic_church_ridge_cross_upright', (0, 0, 9.09), (0, 0, 9.80), .033, 'iron', 6)
        k.beam('Gothic_church_ridge_cross_arm', (-.22, 0, 9.58), (.22, 0, 9.58), .033, 'iron', 6)
        self.centre(before)

    def church_village(self):
        """Plain Gothic village church: west tower, nave, polygonal choir.

        Tower at -X, south portal on -Y. The finished model is fitted to the
        original kit church's measured envelope, which settlement placement uses.
        """
        before = self.begin()
        k = self.k
        # Nave: plastered rubble walls on a low stone plinth, steep tiled roof.
        k.box('Village_church_nave_plinth', (-.90, 0, .12), (4.50, 4.72, .24), 'fort_stone_dark', .03)
        k.box('Village_church_nave_walls', (-.90, 0, 2.20), (4.40, 4.60, 4.40), 'settlement_lime', .03)
        roof_before = set(bpy.context.scene.objects)
        self.roof('Village_church_nave', 4.62, 5.30, 4.38, 7.55, 'fort_roof', 'settlement_lime')
        for obj in set(bpy.context.scene.objects)-roof_before:
            obj.location.x -= .90
        # Wall helpers measure `along` leftwards from the outside, so on the
        # north (+Y) face a world X position is passed negated.
        for side in (-1, 1):
            for x in (-.20, 1.12):
                self.buttress('Village_church_nave', (0, side), 2.30, -side*x, 3.10, .34, .42)
            for x in ((-.85, .45) if side < 0 else (-1.60, .45)):
                self.pointed('Village_church_nave_window', (0, side), 2.30, -side*x,
                             1.75, .50, 1.85, mullion=False)
        # South portal with a pointed stone surround.
        self.pointed('Village_church_south_portal', (0, -1), 2.30, -2.15, .20, 1.05, 2.25, 'oak', False)
        self.step('Village_church', -2.15, -2.30, 1.30, .18)
        # Lower, narrower choir with a three-sided east end.
        apse = [(1.30, -1.70), (2.90, -1.70), (3.62, -.70), (3.62, .70), (2.90, 1.70), (1.30, 1.70)]
        self.f.prism('Village_church_choir_walls', apse, .0, 4.00, 'settlement_lime')
        self.f.prism('Village_church_choir_plinth', [(x+(.05 if x > 2 else 0), y*1.03) for x, y in apse],
                     .0, .24, 'fort_stone_dark')
        eave = [(1.30, -1.92), (3.00, -1.92), (3.85, -.78), (3.85, .78), (3.00, 1.92), (1.30, 1.92)]
        ridge_west, ridge_east = (1.10, 0, 6.35), (2.78, 0, 6.35)
        vertices = [(x, y, 3.96) for x, y in eave] + [ridge_west, ridge_east]
        self.f.solid('Village_church_choir_roof', vertices,
                     [tuple(reversed(range(6))), (0, 1, 7, 6), (1, 2, 7), (2, 3, 7),
                      (3, 4, 7), (4, 5, 6, 7), (5, 0, 6)], 'fort_roof')
        k.beam('Village_church_choir_ridge', ridge_west, ridge_east, .05, 'fort_roof_light', 5)
        # Two-stage buttresses brace the choir corners and its angled faces.
        slope = Vector((1.0, .72, 0)).normalized()
        for y in (-1, 1):
            for base, normal in (((2.85, y*1.70), (0, y)),
                                 ((3.26, y*1.20), (slope.x, y*slope.y))):
                normal = Vector((*normal, 0))
                turn = math.atan2(normal.y, normal.x)-math.pi/2
                for depth, width, low, high in ((.46, .32, 0, 1.85), (.30, .28, 1.85, 2.90)):
                    part = k.box('Village_church_choir_buttress', (0, 0, (low+high)/2),
                                 (width, depth, high-low), 'fort_masonry', .02)
                    part.rotation_euler.z = turn
                    part.location += Vector((*base, 0))+normal*(depth/2-.03)
        for side in (-1, 1):
            self.pointed('Village_church_choir_window', (0, side), 1.70, -side*2.10,
                         1.55, .44, 1.75, mullion=False)
        self.pointed('Village_church_east_window', (1, 0), 3.62, 0, 1.55, .44, 1.75, mullion=False)
        k.beam('Village_church_choir_cross_upright', (2.80, 0, 6.30), (2.80, 0, 6.95), .03, 'iron', 6)
        k.beam('Village_church_choir_cross_arm', (2.80, -.17, 6.74), (2.80, .17, 6.74), .03, 'iron', 6)
        # Plain square west tower with quoins, small bell openings and a tent roof.
        tower_before = set(bpy.context.scene.objects)
        k.box('Village_church_tower_plinth', (0, 0, .14), (2.66, 2.66, .28), 'fort_stone_dark', .03)
        k.box('Village_church_tower', (0, 0, 3.55), (2.50, 2.50, 7.10), 'settlement_lime', .03)
        self.f.quoins('Village_church_tower', 1.27, 1.27, 6.9)
        for normal in ((0, -1), (0, 1), (-1, 0)):
            self.pointed('Village_church_bell_opening', normal, 1.25, 0, 5.55, .42, .95, 'black', False)
        self.f.window('Village_church_tower_slit', (-1, 0), 1.25, 0, 2.60, .14, .60, slit=True)
        r = 1.46
        self.f.solid('Village_church_tower_tent_roof',
                     [(-r, -r, 7.05), (r, -r, 7.05), (r, r, 7.05), (-r, r, 7.05), (0, 0, 10.55)],
                     [(3, 2, 1, 0), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], 'slate')
        for a, b in (((-r, -r), (r, -r)), ((r, -r), (r, r)), ((r, r), (-r, r)), ((-r, r), (-r, -r))):
            k.beam('Village_church_tower_eave', (*a, 7.05), (*b, 7.05), .05, 'oak_dark', 5)
        k.beam('Village_church_cross_upright', (0, 0, 10.45), (0, 0, 11.25), .038, 'iron', 6)
        k.beam('Village_church_cross_arm', (0, -.24, 10.98), (0, .24, 10.98), .036, 'iron', 6)
        for obj in set(bpy.context.scene.objects)-tower_before:
            obj.location.x -= 4.35
        self.fit(before, (-5.6205, -2.871, 0), (3.8505, 2.871, 11.25))

    def fit(self, before, low, high):
        """Bake transforms and map the model exactly onto a measured envelope."""
        objects = [obj for obj in set(bpy.context.scene.objects)-before if obj.type == 'MESH']
        bpy.context.view_layer.update()
        for obj in objects:
            obj.data.transform(obj.matrix_world)
            obj.parent = None
            obj.matrix_world = Matrix.Identity(4)
        points = [v.co for obj in objects for v in obj.data.vertices]
        lo = [min(p[i] for p in points) for i in range(3)]
        hi = [max(p[i] for p in points) for i in range(3)]
        for obj in objects:
            for v in obj.data.vertices:
                v.co = Vector(tuple(low[i]+(v.co[i]-lo[i])*(high[i]-low[i])/(hi[i]-lo[i])
                                    for i in range(3)))
            obj.data.update()

    def ring(self, prefix, outside, inside, low, high, material, count=12):
        verts = [(radius*math.cos(i*math.tau/count), radius*math.sin(i*math.tau/count), z)
                 for z, radius in ((low, outside), (high, outside),
                                   (high, inside), (low, inside)) for i in range(count)]
        faces = []
        for row in range(4):
            other = (row+1) % 4
            for i in range(count):
                j = (i+1) % count
                faces.append((row*count+i, row*count+j, other*count+j, other*count+i))
        return self.f.solid(prefix, verts, faces, material)

    def well(self):
        before = self.begin()
        k = self.k
        for row in range(3):
            obj = self.ring('Well_hollow_stone_course', .83, .57,
                            row*.285, (row+1)*.285, 'fort_masonry')
            obj.data.materials.append(k.M['fort_stone_light'])
            for poly in obj.data.polygons[:12]:
                poly.material_index = int((poly.index+row) % 4 == 0)
        self.ring('Well_stone_coping', .91, .55, .845, .97, 'fort_stone_light')
        k.cone('Well_dark_recess_bottom', (0, 0, .055), .569, .569, .05,
               'black', 12)
        for side in (-1, 1):
            k.box('Well_grounded_roof_post', (side*1.00, 0, 1.10),
                      (.15, .17, 2.20), 'oak_dark', .013)
            k.beam('Well_roof_brace', (side*1.00, 0, 1.76),
                       (side*.62, 0, 2.20), .049, 'oak_dark', 5)
        k.box('Well_roof_tie', (0, 0, 2.18), (2.21, .15, .15), 'oak_dark', .012)
        k.beam('Well_windlass_drum', (-1.14, 0, 1.51), (1.14, 0, 1.51), .11, 'oak', 10)
        k.beam('Well_rope', (0, -.025, 1.52), (0, -.025, .10), .017, 'linen', 6)
        k.beam('Well_crank_arm', (1.15, 0, 1.51), (1.15, 0, 1.15), .029, 'iron', 6)
        k.beam('Well_crank_grip', (1.14, 0, 1.15), (1.38, 0, 1.15), .039, 'oak_dark', 7)
        self.roof('Well', 2.43, 1.89, 2.23, 2.99, 'fort_shingle', 'oak')
        self.centre(before)


def builders(namespace):
    batch = Settlement(SimpleNamespace(**namespace))
    return {
        'house_timber': batch.house_timber,
        'house_plaster': batch.house_plaster,
        'townhouse': batch.townhouse,
        'barn': batch.barn,
        'shed': batch.shed,
        'fence_gate': batch.fence_gate,
        'monastery_wing': batch.monastery_wing,
        'church_gothic': batch.church_gothic,
        'church': batch.church_village,
        'well': batch.well,
    }
