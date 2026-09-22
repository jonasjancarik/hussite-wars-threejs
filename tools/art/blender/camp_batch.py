"""Original static camp and rural props for the miniature battlefield kit.

One source unit is one metre. All assets have a centred complete footprint,
ground at Z=0 and Blender -Y / glTF +Z as the presentation front. Cart shafts
also point -Y. No figure, faction device, fire animation or texture is included.
See camp-references.md for visual sources and reconstruction limits.
"""
import math
from types import SimpleNamespace

import bmesh
import bpy
from mathutils import Matrix, Vector


class CampBatch:
    def __init__(self, kit):
        self.k = kit

    def palette(self):
        for name, colour in (
                ('camp_canvas', (.64, .575, .435)),
                ('camp_canvas_light', (.735, .68, .535)),
                ('camp_canvas_shadow', (.50, .435, .32)),
                ('camp_rope', (.40, .335, .215)),
                ('camp_iron', (.11, .12, .105)),
                ('camp_ash', (.13, .135, .115)),
                ('camp_hay', (.48, .385, .17)),
                ('camp_hay_light', (.57, .47, .23)),
                ('camp_sack', (.49, .435, .30)),
                ('camp_sack_light', (.61, .55, .39)),
                ('camp_stone', (.36, .355, .30))):
            self.k.material(name, colour)

    def closed_mesh(self, name, vertices, faces, material):
        obj = self.k.mesh(name, vertices, faces, material)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def panel(self, name, points, material, thickness=.022):
        """Finite, closed cloth or timber plate; never an alpha plane."""
        obj = self.k.mesh(name, points, [tuple(range(len(points)))], material)
        modifier = obj.modifiers.new('Material thickness', 'SOLIDIFY')
        modifier.thickness = thickness
        modifier.offset = 0
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def lathe(self, name, profiles, material, sides=12, position=(0, 0, 0)):
        """Closed radial profile with flat caps and faceted sides."""
        x, y, z = position
        points = [(x+r*math.cos(i*math.tau/sides),
                   y+r*math.sin(i*math.tau/sides), z+h)
                  for h, r in profiles for i in range(sides)]
        faces = [tuple(reversed(range(sides)))]
        for row in range(len(profiles)-1):
            for i in range(sides):
                a = row*sides+i
                b = row*sides+(i+1)%sides
                faces.append((a, b, b+sides, a+sides))
        faces.append(tuple((len(profiles)-1)*sides+i for i in range(sides)))
        return self.closed_mesh(name, points, faces, material)

    def hoop(self, name, centre, radius, thickness, material, turn=None, sides=12):
        bpy.ops.mesh.primitive_torus_add(
            major_segments=sides, minor_segments=4, location=centre,
            major_radius=radius, minor_radius=thickness)
        obj = self.k.finish(bpy.context.object, name, material)
        if turn is not None:
            obj.rotation_euler = turn
        return obj

    def rope(self, name, a, b, radius=.016):
        return self.k.beam(name, a, b, radius, 'camp_rope', 5)

    def peg(self, point):
        x, y = point
        self.k.beam('Tent_hewn_peg', (x, y, .018), (x+.025, y, .21),
                    .035, 'oak_dark', 5)

    def barrel(self, prefix, x, y, z=0, scale=1):
        k = self.k
        levels = [(0, .245), (.10, .28), (.37, .31), (.65, .28), (.75, .245)]
        body = self.lathe(prefix+'_staved_body', [(h*scale, r*scale) for h, r in levels],
                          'oak', position=(x, y, z))
        body.data.materials.append(k.M['oak_light'])
        for face in body.data.polygons:
            if len(face.vertices) == 4 and face.index % 3 == 0:
                face.material_index = 1
        # Four quiet hoops, no modern metal closures or synthetic straps.
        for h, r in ((.045, .263), (.18, .297), (.57, .298), (.705, .263)):
            self.hoop(prefix+'_wooden_hoop', (x, y, z+h*scale), r*scale,
                      .018*scale, 'oak_dark')
        for h in (.013, .75):
            k.cone(prefix+'_wooden_head', (x, y, z+h*scale), .231*scale,
                   .231*scale, .018*scale, 'oak_light', 12)
        for offset in (-.115, 0, .115):
            length = 2*math.sqrt(.23**2-offset**2)*scale
            k.box(prefix+'_head_plank_seam', (x+offset*scale, y, z+.761*scale),
                  (.007*scale, length, .005*scale), 'oak_dark')

    def crate(self, prefix, centre, size):
        k = self.k
        x, y, z = centre
        width, depth, height = size
        k.box(prefix+'_closed_box', centre, size, 'oak', .015)
        for side in (-1, 1):
            for offset in (-.33, .33):
                k.box(prefix+'_front_batten', (x+width*offset, y+side*(depth/2+.015), z),
                      (.07, .035, height*.98), 'oak_light', .004)
                k.box(prefix+'_side_batten', (x+side*(width/2+.016), y+depth*offset, z),
                      (.035, .06, height*.98), 'oak_light', .004)
        for offset in (-.28, .28):
            k.box(prefix+'_lid_batten', (x, y+depth*offset, z+height/2+.015),
                  (width*.97, .07, .03), 'oak_light', .004)

    def sack(self, prefix, position, scale=1, lean=0, material='camp_sack'):
        before = set(bpy.context.scene.objects)
        # Broad base and pinched neck make a tied cloth sack, not a barrel.
        body = self.lathe(prefix+'_cloth_body', [(.035, .20), (.13, .275),
                          (.43, .29), (.64, .225), (.73, .08), (.80, .095)],
                          material, sides=9)
        body.scale = (.90, .78, 1)
        self.hoop(prefix+'_neck_tie', (0, 0, .727), .077, .018, 'camp_rope', sides=9)
        for side in (-1, 1):
            self.rope(prefix+'_tie_end', (side*.04, -.061, .735),
                      (side*.12, -.07, .625), .011)
        bpy.context.view_layer.update()
        pivot = (Matrix.Translation(Vector(position)) @ Matrix.Rotation(lean, 4, 'Y')
                 @ Matrix.Scale(scale, 4))
        for obj in set(bpy.context.scene.objects)-before:
            obj.matrix_world = pivot @ obj.matrix_world

    def wheel(self, prefix, centre, radius=.47, broken=False):
        """Wheel in YZ with axle along X, so the cart faces Blender -Y."""
        k = self.k
        x, y, z = centre
        if not broken:
            self.hoop(prefix+'_felloe', centre, radius-.044, .040, 'oak_light',
                      (0, math.pi/2, 0), 16)
            self.hoop(prefix+'_iron_tyre', centre, radius-.010, .011, 'camp_iron',
                      (0, math.pi/2, 0), 16)
        else:
            # Six missing rim sectors and three missing spokes are deliberate damage.
            for i in range(10):
                a = i*math.tau/16+.25
                b = (i+1)*math.tau/16+.25
                k.beam(prefix+'_broken_rim', (x, y+radius*math.sin(a), z+radius*math.cos(a)),
                       (x, y+radius*math.sin(b), z+radius*math.cos(b)),
                       .038, 'oak_light', 5)
        k.beam(prefix+'_hub', (x-.10, y, z), (x+.10, y, z), .09, 'oak_dark', 8)
        for i in range(8 if not broken else 5):
            angle = i*math.tau/8+.25
            k.beam(prefix+'_spoke', centre,
                   (x, y+math.sin(angle)*(radius-.06), z+math.cos(angle)*(radius-.06)),
                   .026, 'oak_light', 4)

    def tent_small(self):
        k = self.k
        # Ridge runs front to back. Cloth panels have a narrow entry slit.
        for side in (-1, 1):
            for row in range(3):
                ya, yb = -1.16+row*.7733, -1.16+(row+1)*.7733
                self.panel('Ridge_tent_canvas_panel',
                           [(side*1.10, ya, .065), (side*1.10, yb, .065),
                            (0, yb, 1.90), (0, ya, 1.90)],
                           'camp_canvas' if row != 1 else 'camp_canvas_light')
            self.panel('Ridge_tent_entrance_flap',
                       [(side*1.10, -1.166, .065), (side*.22, -1.178, .065),
                        (side*.06, -1.172, 1.45), (0, -1.166, 1.90)],
                       'camp_canvas_light')
        self.panel('Ridge_tent_closed_rear', [(-1.1, 1.162, .065),
                   (1.1, 1.162, .065), (0, 1.162, 1.90)], 'camp_canvas')
        for y in (-1.145, 1.145):
            k.beam('Ridge_tent_upright', (0, y, .025), (0, y, 2.00),
                   .039, 'oak_dark', 7)
        k.beam('Ridge_tent_ridge_pole', (0, -1.22, 1.89), (0, 1.22, 1.89),
               .044, 'oak_dark', 7)
        for x in (-1.10, 1.10):
            for y in (-1.04, .99):
                ground = (x*1.36, y*1.23)
                self.peg(ground)
                self.rope('Ridge_tent_guy_rope', (x, y, .35), (*ground, .13))
        for y in (-1.43, 1.43):
            self.peg((0, y))
            self.rope('Ridge_tent_end_rope', (0, math.copysign(1.20, y), 1.84), (0, y, .13))
        k.box('Ridge_tent_bedroll', (.28, -.02, .14), (.62, 1.5, .17), 'camp_sack', .055)

    def tent_pavilion(self):
        k = self.k
        sides = 8
        ring = [(1.80*math.cos((i+.5)*math.tau/sides),
                 1.80*math.sin((i+.5)*math.tau/sides)) for i in range(sides)]
        for i, (x, y) in enumerate(ring):
            nx, ny = ring[(i+1)%sides]
            self.panel('Pavilion_roof_panel', [(x*1.055, y*1.055, 1.93),
                       (nx*1.055, ny*1.055, 1.93), (0, 0, 3.03)],
                       'camp_canvas_light' if i % 2 else 'camp_canvas')
            if i == 5:
                # Opening below a broad front lintel, with curtains at each side.
                for start, end in ((0, .25), (.75, 1)):
                    a = (x+(nx-x)*start, y+(ny-y)*start)
                    b = (x+(nx-x)*end, y+(ny-y)*end)
                    self.panel('Pavilion_entry_curtain', [(*a, .045), (*b, .045),
                               (*b, 1.88), (*a, 1.88)], 'camp_canvas_light')
            else:
                self.panel('Pavilion_wall_canvas', [(x, y, .045), (nx, ny, .045),
                           (nx, ny, 1.89), (x, y, 1.89)], 'camp_canvas')
            self.panel('Pavilion_neutral_eave_band', [(x*1.057, y*1.057, 1.85),
                       (nx*1.057, ny*1.057, 1.85),
                       (nx*1.057, ny*1.057, 1.945), (x*1.057, y*1.057, 1.945)],
                       'camp_canvas_shadow')
            k.beam('Pavilion_edge_pole', (x*.987, y*.987, .025),
                   (x*.987, y*.987, 1.94), .028, 'oak_dark', 6)
            ground = (x*1.265, y*1.265)
            self.peg(ground)
            self.rope('Pavilion_guy_rope', (x*1.045, y*1.045, 1.91), (*ground, .13))
        k.beam('Pavilion_centre_pole', (0, 0, .025), (0, 0, 3.18), .052, 'oak_dark', 8)
        k.cone('Pavilion_plain_finial', (0, 0, 3.17), .09, .025, .14, 'oak_light', 8)

    def baggage_cart(self):
        k = self.k
        for x in (-.44, .44):
            k.box('Cart_underframe', (x, .22, .51), (.12, 1.79, .17), 'oak_dark', .014)
            k.beam('Cart_draw_shaft', (x, -.44, .51), (x, -1.62, .32), .053, 'oak_dark', 6)
        k.beam('Cart_axle', (-.82, .17, .45), (.82, .17, .45), .076, 'oak_dark', 8)
        for side in (-1, 1):
            self.wheel('Cart_wheel', (side*.74, .17, .45), .45)
            for row in range(3):
                k.box('Cart_side_board', (side*.59, .27, .74+row*.18),
                      (.068, 1.68, .16), 'oak_light' if row % 2 else 'oak', .008)
            for y in (-.51, 1.04):
                k.box('Cart_corner_post', (side*.58, y, .87), (.10, .105, .85), 'oak_dark', .009)
        for i in range(7):
            k.box('Cart_floor_plank', (0, -.48+i*.25, .635), (1.18, .235, .10), 'oak_light', .008)
        for y in (-.58, 1.12):
            for row in range(3):
                k.box('Cart_end_board', (0, y, .74+row*.18), (1.21, .068, .16), 'oak', .008)
        self.crate('Cart_luggage', (-.24, .60, .90), (.51, .58, .43))
        self.sack('Cart_sack', (.23, -.02, .68), .72, -.15)
        self.sack('Cart_small_sack', (-.25, -.18, .68), .57, .12, 'camp_sack_light')
        self.rope('Cart_cargo_lashing', (-.62, .33, 1.20), (.62, .33, 1.20), .019)
        k.beam('Cart_parked_support', (0, -.42, .58), (0, -.79, .025), .045, 'oak_dark', 5)

    def camp_barrels(self):
        self.barrel('Large_camp_barrel', -.37, .16)
        self.barrel('Small_camp_barrel', .31, .25, scale=.78)
        self.crate('Camp_crate', (.23, -.38, .20), (.60, .48, .40))

    def camp_sacks(self):
        self.sack('Upright_sack', (-.27, .20, 0), .91, -.10)
        self.sack('Full_sack', (.27, .12, 0), .76, .14, 'camp_sack_light')
        bundle = self.k.box('Folded_supply_bundle', (.06, -.37, .175),
                            (.96, .41, .33), 'camp_canvas', .075)
        bundle.rotation_euler.z = -.13
        for x in (-.22, .29):
            self.k.box('Bundle_rope_over_top', (x, -.37, .344), (.022, .40, .018), 'camp_rope', .004)
            for y in (-.56, -.18):
                self.k.box('Bundle_rope_side', (x, y, .18), (.022, .018, .31), 'camp_rope', .004)

    def camp_fire(self):
        k = self.k
        k.cone('Cold_fire_ash', (0, 0, .025), .45, .45, .05, 'camp_ash', 12)
        for i in range(9):
            angle = i*math.tau/9
            stone = k.ico('Cold_fire_ring_stone', (.52*math.cos(angle), .52*math.sin(angle), .11),
                          (.16, .125, .115), 'camp_stone', 1)
            stone.rotation_euler.z = angle
        for i in (-1, 0, 1):
            k.beam('Cold_fire_charred_log', (-.29, -.18+i*.16, .08),
                   (.30, .09+i*.12, .085), .056, 'oak_dark', 7)
        for angle in (math.pi/2, math.pi*7/6, math.pi*11/6):
            k.beam('Cooking_tripod_leg', (.62*math.cos(angle), .62*math.sin(angle), .018),
                   (.025*math.cos(angle), .025*math.sin(angle), 1.36), .026, 'camp_iron', 6)
        k.beam('Cooking_pot_hanger', (0, 0, .80), (0, 0, 1.33), .012, 'camp_iron', 5)
        # A closed rim-and-interior radial profile gives the cauldron an open
        # mouth without leaving any non-manifold mesh edges.
        self.lathe('Cooking_cauldron', [(0, .13), (.05, .20), (.21, .22),
                   (.29, .17), (.29, .145), (.22, .184), (.06, .15)],
                   'camp_iron', 12, (0, 0, .43))
        for i in range(8):
            a, b = i*math.pi/8, (i+1)*math.pi/8
            k.beam('Cauldron_bail_handle', (-.19*math.cos(a), 0, .70+.17*math.sin(a)),
                   (-.19*math.cos(b), 0, .70+.17*math.sin(b)), .011, 'camp_iron', 5)

    def ammunition_pile(self):
        k = self.k
        self.crate('Shot_closed_supply_box', (.30, .19, .18), (.61, .48, .36))
        for x, y, z, r in ((-.39, -.24, .14, .14), (-.09, -.25, .13, .13),
                           (-.26, .02, .15, .15), (-.39, .29, .13, .13),
                           (-.26, -.13, .37, .125)):
            k.ico('Stone_shot', (x, y, z), (r, r, r), 'camp_stone', 2)
        k.beam('Shot_tool_shaft', (-.58, -.46, .057), (.57, -.38, .075), .025, 'oak_dark', 6)
        k.box('Shot_tool_iron_head', (.53, -.38, .077), (.13, .22, .105), 'camp_iron', .016)

    def haystack(self):
        k = self.k
        body = self.lathe('Loose_hay_stack', [(0, .89), (.23, .97), (.70, .83),
                          (1.16, .54), (1.53, .19), (1.62, .075)], 'camp_hay', 11)
        body.data.materials.append(k.M['camp_hay_light'])
        for face in body.data.polygons:
            if len(face.vertices) == 4 and face.index % 4 == 0:
                face.material_index = 1
        for i in range(14):
            angle = i*math.tau/14
            k.beam('Hay_loose_stem_ridge', (.91*math.cos(angle), .91*math.sin(angle), .16),
                   (.23*math.cos(angle+.05), .23*math.sin(angle+.05), 1.46),
                   .024, 'camp_hay_light' if i % 2 else 'camp_hay', 4)
        k.beam('Hay_centre_stake', (0, 0, .10), (0, 0, 1.87), .052, 'oak_dark', 6)

    def timber_pile(self):
        k = self.k
        # Six logs in touching staggered tiers, with cut end grain discs.
        for row, count in ((0, 3), (1, 2), (2, 1)):
            for i in range(count):
                x = (i-(count-1)/2)*.29
                z = .16+row*.255
                length = 1.98-(i % 2)*.13-row*.055
                k.beam('Stacked_bark_log', (x, -length/2, z), (x, length/2, z),
                       .162, 'oak_dark', 9)
                for side in (-1, 1):
                    k.beam('Log_cut_end', (x, side*(length/2-.010), z),
                           (x, side*(length/2+.003), z), .147, 'oak_light', 9)
                    k.beam('Log_heartwood', (x+.018, side*(length/2+.004), z-.010),
                           (x+.018, side*(length/2+.007), z-.010), .055, 'oak', 7)

    def discarded_equipment(self):
        k = self.k
        # Plain wooden shield, its underside grip hidden naturally against soil.
        outline = [(-.38, -.24, .10), (.28, -.24, .10), (.30, .22, .10),
                   (-.045, .47, .10), (-.40, .22, .10)]
        shield = self.panel('Dropped_plain_shield', outline, 'oak', .055)
        shield.rotation_euler = (.12, -.08, -.24)
        for x in (-.27, -.07, .13):
            k.box('Shield_plank_seam', (x, -.02, .134), (.008, .39, .006), 'oak_dark')
        k.beam('Dropped_spear_shaft', (-.89, -.39, .053), (.72, .41, .053), .027, 'oak_dark', 7)
        k.beam('Dropped_spear_point', (.69, .395, .053), (1.04, .57, .053), .065,
               'camp_iron', 4, radius2=0)
        cloth = k.box('Folded_plain_banner', (.50, -.24, .075), (.64, .37, .11),
                      'camp_canvas_shadow', .03)
        cloth.rotation_euler.z = .17
        k.box('Banner_fold', (.46, -.245, .132), (.51, .28, .016), 'camp_canvas', .007)
        k.beam('Broken_banner_staff', (.17, -.47, .052), (.89, -.33, .052), .034, 'oak', 7)

    def wagon_abandoned(self):
        k = self.k
        # Separate low civilian wagon construction: no inherited soldiers,
        # defensive stakes or chalice from the existing war-wagon builder.
        for x in (-.53, .53):
            k.box('Abandoned_wagon_frame', (x, .12, .59), (.17, 2.80, .22), 'oak_dark', .018)
        for y in (-.84, 1.06):
            k.beam('Abandoned_wagon_axle', (-1.03, y, .46), (1.03, y, .46),
                   .087, 'oak_dark', 8)
            for side in (-1, 1):
                self.wheel('Abandoned_wagon_wheel', (side*.94, y, .46), .46,
                           broken=side == 1 and y < 0)
        for i in range(11):
            if i == 2:
                self.panel('Wagon_splintered_deck', [(-.73, -1.10+i*.25, .76),
                           (.22, -1.10+i*.25, .76), (.33, -.97+i*.25, .76),
                           (.04, -.86+i*.25, .76), (-.73, -.86+i*.25, .76)], 'oak_light', .095)
            else:
                k.box('Abandoned_wagon_deck', (0, -1.0+i*.25, .76),
                      (1.55, .231, .095), 'oak_light', .008)
        for side in (-1, 1):
            for row in range(3):
                if side == 1 and row == 2:
                    for y, length in ((-.72, .60), (.99, .82)):
                        board = k.box('Broken_wagon_side_board', (side*.785, y, 1.30),
                                      (.073, length, .17), 'oak', .007)
                        board.rotation_euler.x = .08 if y < 0 else -.05
                else:
                    k.box('Abandoned_wagon_side_board', (side*.785, .21, .90+row*.195),
                          (.073, 2.63, .176), 'oak' if row % 2 else 'oak_light', .008)
            for y in (-1.04, .21, 1.43):
                k.box('Abandoned_wagon_upright', (side*.76, y, 1.055),
                      (.10, .12, .78), 'oak_dark', .010)
        for y in (-1.16, 1.57):
            for row in range(2):
                k.box('Abandoned_wagon_endboard', (0, y, .90+row*.195),
                      (1.59, .075, .176), 'oak', .008)
        for x, end in ((-.50, -2.35), (.50, -1.76)):
            k.beam('Wagon_broken_drawshaft', (x, -.80, .60), (x, end, .25),
                   .065, 'oak_dark', 6)
        plank = k.box('Wagon_fallen_plank', (.70, -.47, .058), (.20, 1.51, .095), 'oak_light', .01)
        plank.rotation_euler.z = -.32
        # A loose rim fragment lies flat, grounded with the rest of the debris.
        for i in range(4):
            a, b = i*.30, (i+1)*.30
            k.beam('Wagon_fallen_felloe', (1.0+.40*math.sin(a), -.69+.40*math.cos(a), .042),
                   (1.0+.40*math.sin(b), -.69+.40*math.cos(b), .042), .040, 'oak_light', 5)

    def build(self, method):
        self.palette()
        before = set(bpy.context.scene.objects)
        method()
        bpy.context.view_layer.update()
        objects = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == 'MESH']
        # True transformed vertices include all leaning sacks, wheel segments,
        # ropes and loose pieces. Apply matrices so manifest/runtime AABBs agree.
        points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
        low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
        high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
        shift = Vector((-(low.x+high.x)/2, -(low.y+high.y)/2, -low.z))
        for obj in objects:
            obj.data.transform(Matrix.Translation(shift) @ obj.matrix_world)
            obj.matrix_world = Matrix.Identity(4)
            obj.data.update()
        bpy.context.view_layer.update()


def builders(namespace):
    batch = CampBatch(SimpleNamespace(**namespace))
    return {name: (lambda method=getattr(batch, name): batch.build(method)) for name in (
        'tent_small', 'tent_pavilion', 'baggage_cart', 'camp_barrels', 'camp_sacks',
        'camp_fire', 'ammunition_pile', 'haystack', 'timber_pile',
        'discarded_equipment', 'wagon_abandoned')}
