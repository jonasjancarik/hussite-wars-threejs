"""Static support units for the miniature battlefield kit.

The builders intentionally reuse the original wagon and soldier functions where
their silhouette is already useful.  New parts remain separate and named in
the saved Blender source. Figures face +X and each new asset is grounded at Z=0.
Historical choices and their limits are recorded in support-unit-references.md.
"""
import math
from types import SimpleNamespace

import bpy
import bmesh
from mathutils import Matrix, Vector

from infantry_batch import InfantryBatch


class SupportUnits:
    def __init__(self, kit):
        self.k = kit

    def palette(self):
        # The infantry batch owns these slots too.  Reuse them rather than
        # creating Blender's automatic .001 material variants.
        for name, color in (
            ('team_cloth', (.36, .075, .055)),
            ('team_paint', (.29, .055, .035)),
        ):
            if name not in self.k.M:
                self.k.material(name, color)

    def _objects_created(self, before):
        return [obj for obj in bpy.context.scene.objects if obj not in before]

    def _extruded_profile(self, name, outline, material, thickness=.028):
        """A small two-sided weapon plate, deliberately faceted and opaque."""
        side = Vector((0, thickness / 2, 0))
        vertices = [tuple(point - side) for point in outline]
        vertices.extend(tuple(point + side) for point in outline)
        count = len(outline)
        faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
        for index in range(count):
            following = (index + 1) % count
            faces.append((index, following, following + count, index + count))
        obj = self.k.mesh(name, vertices, faces, material)
        # Profiles may be drawn clockwise or counterclockwise. Both caps and
        # the connecting edge must face outwards after glTF triangulation.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def _pole(self, prefix, grip_heights, elbows, socket_height):
        butt = Vector((.27, -.23, .11))
        socket = Vector((.73, -.23, socket_height))
        axis = (socket - butt).normalized()
        hands = {side: tuple(butt + axis * ((z - butt.z) / axis.z))
                 for side, z in grip_heights.items()}
        InfantryBatch(self.k).body(prefix, hands, elbows, stance=.18)
        self.k.beam(prefix + '_ash_shaft', butt, socket, .032, 'oak_dark', 8,
                    radius2=.026)
        self.k.beam(prefix + '_iron_butt', butt, butt + axis * .14, .036, 'iron', 8)
        self.k.beam(prefix + '_socket', socket - axis * .13, socket + axis * .07,
                    .045, 'iron', 8, radius2=.032)
        return socket, axis, Vector((0, 1, 0)).cross(axis).normalized()

    def polearm(self):
        """Sudlice-like long pole with a narrow glaive blade and forward hook."""
        socket, axis, forward = self._pole(
            'Sudlice',
            {-1: 1.07, 1: 1.33},
            {-1: (.04, -.36, 1.05), 1: (.13, .33, 1.12)},
            socket_height=2.40,
        )
        base = socket - axis * .02
        blade = [base + forward * width + axis * height
                 for width, height in ((-.045, 0), (.065, .08), (.09, .36),
                                       (.012, .59), (-.085, .25), (-.07, .07))]
        self._extruded_profile('Sudlice_glaive_blade', blade, 'steel', .034)
        # The separate inward-curved hook makes this read as a sudlice rather
        # than a plain spear without turning it into a fantasy trident.
        hook = [base + forward * width + axis * height
                for width, height in ((.04, .14), (.08, .29), (.23, .33),
                                      (.28, .23), (.23, .15), (.19, .24),
                                      (.105, .22))]
        self._extruded_profile('Sudlice_forward_hook', hook, 'steel', .031)

    def halberd(self):
        """Distinct axe-led halberd; its broad blade is unlike the sudlice."""
        socket, axis, forward = self._pole(
            'Halberdier',
            {-1: 1.08, 1: 1.32},
            {-1: (.03, -.36, 1.05), 1: (.13, .33, 1.12)},
            socket_height=2.08,
        )
        base = socket - axis * .04
        # Simple elongated early axe blade; avoid the elaborate pierced,
        # crescent-edged parade heads of the sixteenth century.
        axe = [base + forward * width + axis * height
               for width, height in ((-.025, 0), (.17, .04), (.29, .13),
                                     (.30, .39), (.22, .48), (.035, .35))]
        self._extruded_profile('Halberd_broad_axe_blade', axe, 'steel', .038)
        hook = [base + forward * width + axis * height
                for width, height in ((.01, .18), (-.045, .31), (-.23, .30),
                                      (-.28, .19), (-.10, .22), (-.025, .14))]
        self._extruded_profile('Halberd_rear_hook', hook, 'iron', .033)
        self.k.beam('Halberd_top_spike', socket + axis * .25, socket + axis * .53,
                    .039, 'steel', 5, radius2=0)

    def handgun(self):
        """Handgonne on a long tiller, braced under the arm, on the shared body."""
        self.palette()
        k = self.k
        InfantryBatch(k).body('Handgunner',
            {-1: (.50, -.075, 1.155), 1: (.17, -.035, 1.12)},
            {-1: (.16, -.33, 1.03), 1: (-.06, .30, 1.04)}, stance=.18)
        # The tiller runs back under the right arm; the iron tube leads it.
        k.beam('Handgunner_gun_tiller', (-.16, -.055, 1.17), (.56, -.055, 1.235), .050, 'oak_dark', 6, radius2=.042)
        k.beam('Handgunner_gun_barrel', (.44, -.055, 1.225), (.98, -.055, 1.275), .056, 'iron', 8, radius2=.050)
        k.beam('Handgunner_barrel_muzzle', (.94, -.055, 1.271), (.99, -.055, 1.276), .066, 'iron', 8)
        for x in (.47, .62):
            k.beam('Handgunner_barrel_band', (x-.018, -.055, 1.223+(x-.44)*.09),
                   (x+.018, -.055, 1.226+(x-.44)*.09), .064, 'iron', 8)
        k.ico('Handgunner_touch_hole', (.50, -.055, 1.29), (.018, .018, .014), 'black', 1)
        # Smouldering match cord looped from the right hand.
        k.beam('Handgunner_match_cord', (.17, -.035, 1.12), (.25, .05, .98), .012, 'linen', 5)
        k.beam('Handgunner_match_cord', (.25, .05, .98), (.14, .12, .90), .012, 'linen', 5)
        k.cone('Handgunner_powder_flask', (-.11, -.25, .79), .085, .06, .20, 'ochre')
        k.box('Handgunner_shot_bag', (-.07, .25, .80), (.13, .11, .15), 'leather', .03)

    def shield(self):
        """Plain mercenary sword-and-shield bearer with colourable paint slots."""
        self.palette()
        k = self.k
        InfantryBatch(k).body('Mercenary',
            {-1: (.30, -.29, 1.07), 1: (.36, .24, 1.12)},
            {-1: (.08, -.37, 1.00), 1: (.08, .34, 1.02)}, stance=.19)
        # A slightly curved board shield with rounded lower corners, held ahead
        # of the left hand. Plain paint and one pale band, no false heraldry.
        outline = [(-.25, 1.36), (.25, 1.36), (.25, .87), (.19, .76), (0, .70),
                   (-.19, .76), (-.25, .87)]
        centre_y = -.30
        front = [(.43 - .06*(y/.25)**2, centre_y+y, z) for y, z in outline]
        back = [(x-.04, y, z) for x, y, z in front]
        count = len(front)
        faces = [tuple(range(count)), tuple(reversed(range(count, 2*count)))]
        faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
        board = self.k.mesh('Mercenary_shield', front+back, faces, 'team_paint')
        bm = bmesh.new(); bm.from_mesh(board.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(board.data); bm.free()
        for a, b in zip(front, front[1:]+front[:1]):
            k.beam('Mercenary_shield_rim', a, b, .020, 'shield_edge', 5)
        k.beam('Mercenary_shield_pale_stripe', (.44, centre_y-.21, 1.26), (.44, centre_y+.21, .93),
               .032, 'linen', 4)
        k.ico('Mercenary_shield_boss', (.445, centre_y, 1.08), (.05, .075, .075), 'iron', 1)
        k.beam('Mercenary_shield_back_grip', (.37, -.40, 1.07), (.37, -.20, 1.07), .025, 'leather', 6)
        # Arming sword raised at the ready in the right hand.
        k.ico('Mercenary_sword_pommel', (.33, .24, 1.03), (.04, .04, .04), 'iron', 1)
        k.beam('Mercenary_sword_grip', (.335, .24, 1.05), (.37, .24, 1.19), .026, 'leather', 6)
        k.beam('Mercenary_sword_guard', (.37, .12, 1.20), (.37, .36, 1.20), .024, 'iron', 6)
        k.beam('Mercenary_sword_blade', (.372, .24, 1.21), (.47, .24, 1.86), .036, 'steel', 4, radius2=.005)

    def _place(self, objects, location, yaw, prefix):
        """Bake a yaw and offset into freshly built parts, renaming them."""
        bpy.context.view_layer.update()
        matrix = Matrix.Translation(location) @ Matrix.Rotation(yaw, 4, 'Z')
        for obj in objects:
            if obj.parent is None:
                obj.matrix_world = matrix @ obj.matrix_world
            obj.name = prefix + obj.name

    def _wheel(self, x, y):
        k = self.k
        for major, minor, mat in ((.52, .066, 'oak_light'), (.572, .018, 'iron')):
            bpy.ops.mesh.primitive_torus_add(major_segments=20, minor_segments=4, location=(x, y, .60),
                                             major_radius=major, minor_radius=minor,
                                             rotation=(math.pi/2, 0, 0))
            k.finish(bpy.context.object, 'Wagon_wheel_felloe' if mat != 'iron' else 'Wagon_wheel_tyre', mat)
        k.beam('Wagon_wheel_hub', (x, y-.15, .60), (x, y+.15, .60), .13, 'oak_dark', 10)
        k.beam('Wagon_hub_band', (x, y-.018, .60), (x, y+.018, .60), .138, 'iron', 10)
        for i in range(10):
            angle = i*math.tau/10
            k.beam('Wagon_wheel_spoke', (x, y, .60),
                   (x+math.sin(angle)*.50, y, .60+math.cos(angle)*.50), .032, 'oak_light', 4)

    def _wall(self, side, rows):
        """Heavy horizontal side planking with a top rail, straps and loopholes."""
        k = self.k
        y = side*.94
        for row in range(rows):
            for col in range(3):
                k.box('Wagon_side_board', (-1.37+col*1.36, y, 1.05+row*.19),
                      (1.335, .09, .178), 'oak_light' if (row+col) % 2 else 'oak', .012)
        top = 1.05+(rows-1)*.19+.09
        k.box('Wagon_top_rail', (0, y, top+.04), (4.12, .14, .08), 'oak_dark', .012)
        for x in (-2.02, -.69, .69, 2.02):
            k.box('Wagon_stanchion', (x, y, (.90+top+.22)/2), (.115, .15, top+.22-.90), 'oak_dark', .012)
            k.cone('Wagon_stanchion_point', (x, y, top+.29), .055, 0, .14, 'oak_dark', 4)
            k.box('Wagon_iron_strap', (x, y*1.067, 1.42), (.09, .025, .86), 'iron')
            for z in (1.06, 1.70):
                k.ico('Wagon_iron_rivet', (x, y*1.088, z), (.032, .022, .032), 'steel')
        # Plain horizontal shooting slots, two per bay, in the upper boards.
        for x in (-1.36, 0, 1.36):
            for offset in (-.28, .28):
                k.box('Wagon_loophole', (x+offset, y*1.052, 1.62), (.30, .02, .075), 'black')

    def war_wagon(self):
        """Hussite battle wagon: planked walls, lower shield board and crew."""
        self.palette()
        k = self.k
        for i in range(11):
            k.box('Wagon_deck_plank', (-1.90+i*.38, 0, .89), (.365, 1.86, .13), 'oak_light', .012)
        for y in (-.67, .67):
            k.box('Wagon_underframe', (0, y, .72), (4.35, .17, .22), 'oak_dark', .012)
        for x in (-1.45, 1.45):
            k.beam('Wagon_axle', (x, -1.27, .60), (x, 1.27, .60), .09, 'iron', 8)
            for y in (-1.10, 1.10):
                self._wheel(x, y)
        self._wall(-1, 5)
        self._wall(1, 5)
        # Full front board and a lower rear board where the crew climbs in.
        for x, rows in ((2.03, 5), (-2.03, 3)):
            for row in range(rows):
                k.box('Wagon_end_board', (x, 0, 1.05+row*.19), (.09, 1.87, .178),
                      'oak' if row % 2 else 'oak_light', .01)
        # Hinged lower board, let down on the outer (-Y) side to close the gap
        # beneath the wagon between the wheels.
        # Three planks hang almost vertically from hinges under the wall.
        lean = math.atan2(.10, .74)
        for row, z in enumerate((.68, .44, .20)):
            plank = k.box('Wagon_lower_shield_board', (0, 0, 0), (1.62, .06, .235),
                          'oak_light' if row % 2 else 'oak', .01)
            plank.rotation_euler.x = lean
            plank.location = (0, -1.00-(.80-z)*.135, z)
        for x in (-.60, 0, .60):
            batten = k.box('Wagon_lower_board_batten', (0, 0, 0), (.09, .05, .72), 'oak_dark', .008)
            batten.rotation_euler.x = lean
            batten.location = (x, -1.10, .44)
        for x in (-.60, .60):
            k.box('Wagon_lower_board_hinge', (x, -1.00, .82), (.16, .06, .06), 'iron')
        for y in (-.60, .60):
            k.beam('Wagon_tow_pole', (1.85, y, .70), (3.10, y, .52), .07, 'oak_dark')
        k.beam('Wagon_pole_crossbar', (2.98, -.62, .545), (2.98, .62, .545), .045, 'oak_dark', 6)
        k.beam('Wagon_keg', (1.55, .52, .96), (1.55, .52, 1.42), .19, 'oak', 10)
        for z in (1.02, 1.36):
            k.beam('Wagon_keg_hoop', (1.55, .52, z-.02), (1.55, .52, z+.02), .197, 'iron', 10)
        # Crew fire over the outer wall: handgunner, crossbowman, flailman.
        deck = .955
        infantry = InfantryBatch(k)
        for build, where, prefix in ((self.handgun, (.70, -.12), 'Wagon_crew_'),
                                     (infantry.crossbow, (-.45, .08), 'Wagon_crew_'),
                                     (infantry.flail, (-1.30, .25), 'Wagon_crew_')):
            before = set(bpy.context.scene.objects)
            build()
            self._place(self._objects_created(before), (*where, deck), -math.pi/2, prefix)
        before = set(bpy.context.scene.objects)
        # The standard reaches the old wagon's 3.94 m top, which sets the
        # renderer's measured formation height.
        k.banner((-1.66, .72, .95), 2.9901)
        for obj in self._objects_created(before):
            if obj.type == 'MESH' and obj.name.startswith('Chalice_banner_cloth'):
                obj.data.materials[0] = k.M['team_cloth']
        # White_chalice_* parts intentionally remain linen: this is the
        # documented existing Hussite/Prague wagon signal, not a new emblem.

    def commander_standard(self):
        self.palette()
        k = self.k
        height = 3.5
        k.beam('Commander_standard_pole', (0, 0, 0), (0, 0, height), .045,
               'oak_dark', 7)
        k.beam('Commander_standard_crossbar', (0, -.05, height - .15),
               (0, .94, height - .15), .035, 'oak_dark', 6)
        # Closed, gently folded cloth. Pale stripes are material regions in
        # both faces, not floating decals that vanish from the opposite side.
        columns, rows = 4, 10
        layer_size = (columns + 1) * (rows + 1)
        cloth = []
        for face in (-1, 1):
            for u in range(columns + 1):
                fraction = u / columns
                for v in range(rows + 1):
                    drop = v / rows
                    cloth.append((.035 * math.sin(fraction * math.pi) + face*.006,
                                  .06 + fraction*.86,
                                  height - .20 - .045*fraction
                                  - drop*(1.10 + .065*fraction)))
        faces = []
        stripes = []
        for layer in range(2):
            for column in range(columns):
                for row in range(rows):
                    a = layer*layer_size + column*(rows + 1) + row
                    face = (a, a + rows + 1, a + rows + 2, a + 1)
                    faces.append(face if layer == 0 else tuple(reversed(face)))
                    stripes.append(row in (2, 6))
        perimeter = (list(range(rows + 1))
                     + [c*(rows + 1) + rows for c in range(1, columns + 1)]
                     + [columns*(rows + 1) + r for r in range(rows - 1, -1, -1)]
                     + [c*(rows + 1) for c in range(columns - 1, 0, -1)])
        for a, b in zip(perimeter, perimeter[1:] + perimeter[:1]):
            faces.append((a, b, b + layer_size, a + layer_size))
            stripes.append(False)
        obj = k.mesh('Commander_standard_team_cloth', cloth, faces, 'team_cloth')
        obj.data.materials.append(k.M['linen'])
        for polygon, stripe in zip(obj.data.polygons, stripes):
            polygon.material_index = int(stripe)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        for y in (.075, .89):
            k.beam('Commander_standard_cloth_tie', (0, y, height - .15),
                   (.004, y, height - .26), .011, 'linen', 5)

    def _garrison(self, label, offset):
        """Make a visible, static crossbow defender in a source-level group."""
        before = set(bpy.context.scene.objects)
        InfantryBatch(self.k).crossbow()
        root = self.k.empty('Fieldwork_' + label + '_garrison_root', offset)
        for obj in self._objects_created(before):
            if obj is root:
                continue
            old_name = obj.name
            obj.name = 'Fieldwork_' + label + '_' + old_name
            obj.parent = root

    def field_blockhouse(self):
        """Compact Vítkov-inspired fieldwork: fixed cover, never a wagon."""
        self.palette()
        k = self.k
        # Two continuous courses of rough stone, capped by chest-high timber.
        # The crossbows clear the cover; the roof only shelters the rear bay.
        for row in range(2):
            for index, y in enumerate((-1.08, -.54, 0, .54, 1.08)):
                k.box('Fieldwork_low_stone_wall',
                      (1.36 + .014*((index + row) % 2), y, .125 + row*.25),
                      (.30, .55, .25), 'stone', .022)
        for z in (.58, .78, .98):
            k.box('Fieldwork_front_hewn_timber', (1.30, 0, z),
                  (.23, 2.94, .18), 'oak', .022)
        for y in (-1.39, 1.39):
            for z in (.12, .36, .60, .84):
                k.box('Fieldwork_side_hewn_timber', (.05, y, z),
                      (2.85, .18, .24), 'oak', .024)
            # Short projecting ends suggest corner-notched logs without adding
            # noisy joinery too small to read in the diorama.
            for x in (-1.31, 1.31):
                k.box('Fieldwork_corner_timber_end', (x, y, .60),
                      (.22, .25, .20), 'oak_dark', .022)
        for y in (-1.36, 1.36):
            k.box('Fieldwork_front_post', (1.26, y, .66), (.16, .16, 1.32),
                  'oak_dark', .022)
            for x in (-1.30, -.45):
                k.box('Fieldwork_shelter_post', (x, y, 1.065),
                      (.16, .16, 2.13), 'oak_dark', .022)
                k.beam('Fieldwork_corner_brace', (x, y, 1.58),
                       (x, y*.69, 2.075), .050, 'oak_dark', 5)
        for x in (-1.30, -.45):
            k.box('Fieldwork_shelter_tie_beam', (x, 0, 2.075),
                  (.18, 2.94, .15), 'oak_dark', .020)
            k.beam('Fieldwork_roof_king_post', (x, 0, 2.075),
                   (x, 0, 2.665), .050, 'oak_dark', 6)
            for side in (-1, 1):
                k.beam('Fieldwork_roof_rafter', (x, side*1.46, 2.075),
                       (x, 0, 2.665), .050, 'oak_dark', 5)
        k.box('Fieldwork_roof_ridge', (-.91, 0, 2.665),
              (1.14, .10, .10), 'oak_dark', .014)
        # Closed plank prisms instead of a one-sided terracotta sheet. This
        # abbreviated rear roof is an explicit diorama visibility choice,
        # not a claim about the original Vítkov building's plan or roofing.
        for side in (-1, 1):
            for strip in range(4):
                near = strip*.385
                far = near + .390
                top_near = 2.72 - near*(.63/1.54)
                top_far = 2.72 - far*(.63/1.54)
                outline = [(-1.47, side*near, top_near),
                           (-.35, side*near, top_near),
                           (-.35, side*far, top_far),
                           (-1.47, side*far, top_far)]
                vertices = outline + [(x, y, z - .055) for x, y, z in outline]
                faces = [(0, 1, 2, 3), (7, 6, 5, 4),
                         (0, 4, 5, 1), (1, 5, 6, 2),
                         (2, 6, 7, 3), (3, 7, 4, 0)]
                if side == -1:
                    faces = [tuple(reversed(face)) for face in faces]
                k.mesh('Fieldwork_shelter_roof_plank', vertices, faces,
                       'oak_light' if strip % 2 == 0 else 'oak')
        self._garrison('left', (.20, -.55, 0))
        self._garrison('right', (.20, .55, 0))


def builders(namespace):
    support = SupportUnits(SimpleNamespace(**namespace))
    return {
        'infantry_polearm': support.polearm,
        'infantry_halberd': support.halberd,
        'infantry_handgun': support.handgun,
        'infantry_shield': support.shield,
        'war_wagon': support.war_wagon,
        'commander_standard': support.commander_standard,
        'field_blockhouse': support.field_blockhouse,
    }
