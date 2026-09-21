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
from mathutils import Vector

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
            {-1: 1.07, 1: 1.48},
            {-1: (.04, -.36, 1.05), 1: (.20, .25, 1.38)},
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
            {-1: 1.08, 1: 1.45},
            {-1: (.03, -.36, 1.05), 1: (.19, .25, 1.34)},
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
        """Keep the established handgonne body and equipment silhouette."""
        self.palette()
        self.k.soldier('Handgunner', weapon='handgun', coat='team_cloth')
        # The powder flask stays ochre. Only the coat parameter controls cloth.

    def shield(self):
        """Plain mercenary sword-and-shield bearer with colourable paint slots."""
        self.palette()
        before = set(bpy.context.scene.objects)
        self.k.soldier('Mercenary', weapon='shield', coat='team_cloth')
        created = self._objects_created(before)
        for obj in created:
            if obj.name.startswith('Mercenary_shield'):
                bpy.data.objects.remove(obj, do_unlink=True)
        # Retain the old board's size, with a smaller bevel that
        # cannot collapse its thin edge into zero-area faces. No painted cross.
        self.k.box('Mercenary_shield', (.49, -.35, 1.02),
                   (.08, .45, .62), 'team_paint', .025)
        stripe = self.k.box('Mercenary_shield_pale_stripe', (.532, -.35, 1.02),
                            (.008, .29, .070), 'linen', .002)
        stripe.rotation_euler.x = math.radians(35)
        # The original left hand sat through the painted face. Bring the
        # shield ahead of it and join the grip to its wooden back.
        self.k.beam('Mercenary_shield_back_grip', (.395, -.34, 1.12),
                    (.395, -.16, 1.12), .025, 'leather', 6)
        for y in (-.34, -.16):
            self.k.box('Mercenary_shield_grip_block', (.435, y, 1.12),
                       (.08, .045, .055), 'oak_dark', .009)

    def war_wagon(self):
        """Reuse the original wagon, adding only shared faction colour slots."""
        self.palette()
        before = set(bpy.context.scene.objects)
        self.k.wagon()
        created = self._objects_created(before)
        crew_prefixes = ('Wagon_pikeman_', 'Wagon_gunner_')
        for obj in created:
            if obj.type != 'MESH' or not obj.name.startswith(crew_prefixes):
                continue
            base_name = obj.name.split('.')[0]
            if (base_name.endswith(('_tunic', '_skirt', '_sleeve'))
                    and obj.data.materials):
                obj.data.materials[0] = self.k.M['team_cloth']
        for obj in created:
            if obj.type == 'MESH' and obj.name.startswith('Chalice_banner_cloth'):
                obj.data.materials[0] = self.k.M['team_cloth']
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
