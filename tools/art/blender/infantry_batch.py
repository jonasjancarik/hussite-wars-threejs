"""Infantry additions; original geometry using the shared miniature kit.

All figures face +X, stand at Z=0, and retain separate named editable parts.
Reference decisions and limitations: infantry-references.md in this directory.
"""
import math
from types import SimpleNamespace

import bpy
from mathutils import Vector


class InfantryBatch:
    def __init__(self, kit):
        self.k = kit

    def palette(self):
        for name, colour in {
            'team_cloth': (.36, .075, .055), 'team_paint': (.29, .055, .035),
            'hose': (.24, .235, .175), 'padded_linen': (.40, .36, .26),
            'shield_edge': (.31, .235, .13), 'bow_horn': (.12, .10, .075),
        }.items():
            if name not in self.k.M:
                self.k.material(name, colour)

    def ring_mesh(self, name, rings, mat, segments=12, phase=0):
        """Elliptical horizontal rings; flat-shaded faces keep the kit's facets."""
        vertices = [(x + rx*math.cos(2*math.pi*i/segments+phase),
                     y + ry*math.sin(2*math.pi*i/segments+phase), z)
                    for x, y, z, rx, ry in rings for i in range(segments)]
        faces = [tuple(reversed(range(segments)))]
        for ring in range(len(rings)-1):
            for i in range(segments):
                a = ring*segments+i
                b = ring*segments+(i+1)%segments
                faces.append((a, b, b+segments, a+segments))
        faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
        return self.k.mesh(name, vertices, faces, mat)

    def body(self, prefix, hands, elbows, stance=.16, helmet=True, coat='team_cloth', padded=True):
        """Shared figure. `padded=False` gives a plain civilian coat and cloth sleeves."""
        k = self.k
        self.palette()
        # Octagonal padded jack, tapered from broad shoulders to the belt. The
        # flat front face and V-shaped silhouette read at battlefield distance.
        facet = math.pi/8
        self.ring_mesh(prefix+'_padded_jack', [
            (0, 0, .84, .205, .19), (0, 0, .98, .215, .20),
            (.01, 0, 1.16, .225, .215), (0, 0, 1.28, .205, .245),
            (0, 0, 1.35, .13, .15)], coat, 8, facet)
        self.ring_mesh(prefix+'_coat_skirt', [
            (0, 0, .65, .265, .255), (0, 0, .84, .215, .20),
            (0, 0, .94, .21, .195)], coat, 8, facet)
        # A restrained seam and a few raised padded panels, visible in close-up.
        for y in ((-.07, 0, .07) if padded else ()):
            k.beam(prefix+'_quilt_channel', (.203, y, .97), (.212, y, 1.16), .012, coat, 4)
            k.beam(prefix+'_quilt_channel', (.212, y, 1.16), (.192, y, 1.27), .012, coat, 4)
        self.ring_mesh(prefix+'_belt', [
            (.005, 0, .865, .228, .212), (.005, 0, .93, .228, .212)], 'leather', 8, facet)
        k.box(prefix+'_belt_buckle', (.222, -.035, .898), (.025, .070, .066), 'iron', .005)
        k.cone(prefix+'_linen_collar', (0, 0, 1.365), .125, .105, .065, 'linen', 8)
        for side in (-1, 1):
            # Cloth hose down to short ankle shoes, not uniform tall riding boots.
            foot_x = .11 if side == -1 else -.055
            hip = (0, side*.135, .64)
            knee = (foot_x-.04, side*stance, .43)
            ankle = (foot_x, side*stance, .16)
            k.beam(prefix+'_hose_thigh', hip, knee, .102, 'hose', 6, radius2=.084)
            k.beam(prefix+'_hose_calf', knee, ankle, .080, 'hose', 6, radius2=.065)
            k.box(prefix+'_ankle_shoe', (foot_x+.055, side*stance, .080), (.255, .15, .16), 'leather', .035)
            shoulder = Vector((0, side*.225, 1.255))
            elbow, hand = Vector(elbows[side]), Vector(hands[side])
            # Rounded shoulder caps join the side-colour sleeve to the jack.
            k.ico(prefix+'_upper_sleeve_shoulder', shoulder, (.105, .10, .095), coat, 1)
            k.beam(prefix+'_upper_sleeve', shoulder, elbow, .092, coat, 7, radius2=.078)
            # Padded forearm defences with an elbow cop and quilted ridges.
            # Armoured variants turn every `_lower_sleeve` part to steel.
            reach = hand-elbow
            axis = reach.normalized()
            wrist = hand-axis*min(.06, reach.length*.3)
            if padded:
                k.ico(prefix+'_lower_sleeve_elbow', elbow, (.090, .088, .088), 'padded_linen', 1)
                k.beam(prefix+'_lower_sleeve', elbow, wrist, .084, 'padded_linen', 7, radius2=.066)
                for fraction, radius in ((.38, .083), (.72, .075)):
                    centre = elbow.lerp(wrist, fraction)
                    k.beam(prefix+'_lower_sleeve_quilt', centre-axis*.016, centre+axis*.016,
                           radius, 'padded_linen', 7)
            else:
                # A plain cloth sleeve with a turned-back linen cuff.
                k.ico(prefix+'_upper_sleeve_elbow', elbow, (.078, .076, .076), coat, 1)
                k.beam(prefix+'_lower_sleeve', elbow, wrist, .076, coat, 7, radius2=.064)
                k.beam(prefix+'_lower_sleeve_cuff', wrist-axis*.05, wrist, .070, 'linen', 7, radius2=.068)
            k.ico(prefix+'_hand', hand, (.078, .066, .070), 'skin', 1)
        # Visible coif beneath a kettle hat or cloth cap. No fine chainmail
        # texture. The head is slightly enlarged about the neck, in miniature
        # proportion, so faces and hats survive the battlefield camera.
        scale, neck = 1.08, 1.37
        def head(x, y, z): return (x*scale, y*scale, neck+(z-neck)*scale)
        def ring(x, y, z, rx, ry): return (*head(x, y, z), rx*scale, ry*scale)
        k.ico(prefix+'_coif', head(-.025, 0, 1.51), (.142*scale, .14*scale, .175*scale), 'padded_linen', 2)
        k.ico(prefix+'_face', head(.062, 0, 1.535), (.116*scale, .113*scale, .145*scale), 'skin', 2)
        k.ico(prefix+'_nose', head(.170, 0, 1.55), (.042*scale, .04*scale, .038*scale), 'skin', 1)
        if helmet:
            self.ring_mesh(prefix+'_kettle_crown', [
                ring(-.012, 0, 1.615, .169, .155), ring(-.020, 0, 1.72, .137, .125),
                ring(-.035, 0, 1.785, .072, .065), ring(-.04, 0, 1.80, .018, .016)], 'steel')
            self.ring_mesh(prefix+'_kettle_brim', [
                ring(-.008, 0, 1.60, .262, .238), ring(-.008, 0, 1.623, .256, .234),
                ring(-.012, 0, 1.654, .164, .153)], 'steel')
        else:
            self.ring_mesh(prefix+'_cloth_cap', [
                ring(-.015, 0, 1.61, .15, .14), ring(-.045, 0, 1.70, .125, .125),
                ring(-.065, 0, 1.755, .04, .04)], 'padded_linen')
        k.box(prefix+'_belt_pouch', (-.045, .235, .82), (.15, .13, .18), 'leather', .035)
        # Common sidearm in its sheath, kept behind the weapon silhouette.
        k.beam(prefix+'_knife_sheath', (-.10, -.24, .86), (-.17, -.24, .59), .030, 'leather', 5)
        k.beam(prefix+'_knife_grip', (-.075, -.24, .96), (-.10, -.24, .86), .024, 'oak_dark', 6)

    def spear(self):
        k=self.k
        self.body('Spearman',
            {-1:(.414,-.235,1.05),1:(.446,-.235,1.33)},
            {-1:(.055,-.37,1.03),1:(.13,.33,1.12)},stance=.18)
        foot=Vector((.305,-.235,.035));socket=Vector((.625,-.235,3.02))
        axis=(socket-foot).normalized()
        k.beam('Spear_long_ash_shaft',foot,socket,.029,'oak',8,radius2=.024)
        k.beam('Spear_iron_butt',foot,foot+axis*.15,.034,'iron',8)
        k.beam('Spear_socket',socket-axis*.14,socket+axis*.05,.041,'steel',8,radius2=.030)
        side=Vector((0,1,0));normal=axis.cross(side).normalized()
        # A slim leaf-shaped head with a faceted ridge; no halberd blade or hook.
        outline=[socket-axis*.015,socket+axis*.115+side*.086,
                 socket+axis*.43,socket+axis*.115-side*.086]
        vertices=[tuple(p) for p in outline]
        vertices.extend([tuple(socket+axis*.16+normal*.026),
                         tuple(socket+axis*.16-normal*.026)])
        faces=[((i+1)%4,i,4) for i in range(4)]
        faces.extend([(i,(i+1)%4,5) for i in range(4)])
        k.mesh('Spear_leaf_head',vertices,faces,'steel')

    def archer(self):
        k=self.k
        self.body('Archer',
            {-1:(.065,-.18,1.445),1:(.64,-.18,1.405)},
            {-1:(-.25,-.35,1.415),1:(.29,.08,1.35)},stance=.18,helmet=False)
        # Static drawn self-bow: a single curved stave with tapered tips.
        points=[(.36,-.18,.49),(.49,-.18,.70),(.59,-.18,.94),
                (.65,-.18,1.19),(.66,-.18,1.405),(.65,-.18,1.62),
                (.59,-.18,1.87),(.49,-.18,2.11),(.36,-.18,2.31)]
        radii=[.013,.019,.025,.029,.031,.029,.025,.019,.013]
        for i,(a,b) in enumerate(zip(points,points[1:])):
            k.beam('Archer_bow_stave',a,b,radii[i],'oak',8,radius2=radii[i+1])
        k.beam('Archer_bow_grip',(.66,-.18,1.34),(.66,-.18,1.46),.035,'leather',8)
        nock=(.065,-.18,1.46)
        for tip in (points[0],points[-1]):
            k.beam('Archer_drawn_string',tip,nock,.008,'linen',5)
        k.beam('Archer_nocked_arrow',nock,(1.04,-.18,1.41),.011,'oak_light',5)
        k.beam('Archer_arrowhead',(1.01,-.18,1.412),(1.095,-.18,1.407),.025,'steel',4,radius2=0)
        for side in (-1,1):
            k.mesh('Archer_arrow_fletching',[(.13,-.18,1.456),(.26,-.18,1.449),
                   (.16,-.18+side*.044,1.454)],[(0,1,2)],'linen')
        k.beam('Archer_leather_bracer',(.39,-.025,1.37),(.57,-.13,1.395),.077,'leather',7,radius2=.068)
        # Hip-carried arrows; neither a modern sight nor a shoulder-mounted quiver.
        k.beam('Archer_quiver',(-.17,.31,.48),(-.10,.31,1.05),.086,'leather',8)
        k.beam('Archer_quiver_rim',(-.105,.31,1.00),(-.095,.31,1.075),.092,'oak_dark',8)
        for i in range(4):
            y=.265+i*.029
            k.beam('Archer_spare_arrow',(-.12,y,.82),(-.04,y,1.28+(i%2)*.045),.010,'oak_light',5)
            k.box('Archer_spare_fletching',(-.048,y,1.23+(i%2)*.045),(.015,.05,.10),'linen')

    def flail(self):
        k = self.k
        self.body('Flailman',
                  {-1: (.385, -.225, 1.04), 1: (.428, -.225, 1.39)},
                  {-1: (.06, -.37, 1.06), 1: (.13, .33, 1.16)}, stance=.19)
        shaft_a = Vector((.30, -.225, .28))
        shaft_b = Vector((.53, -.225, 2.28))
        k.beam('Flail_ash_staff', shaft_a, shaft_b, .031, 'oak', 8, radius2=.026)
        k.beam('Flail_staff_top_ferrule', shaft_b-(shaft_b-shaft_a).normalized()*.10,
               shaft_b, .034, 'iron', 8)
        # A short articulated connection and an elongated wooden threshing head.
        for x, z, rotation in ((.54, 2.30, (math.pi/2, 0, 0)),
                                (.60, 2.29, (0, math.pi/2, 0))):
            bpy.ops.mesh.primitive_torus_add(major_segments=10, minor_segments=4,
                location=(x, -.225, z), major_radius=.043, minor_radius=.012, rotation=rotation)
            k.finish(bpy.context.object, 'Flail_hinge_link', 'iron')
        head_a, head_b = Vector((.64, -.225, 2.285)), Vector((1.045, -.225, 1.865))
        direction = (head_b-head_a).normalized()
        k.beam('Flail_wooden_striker', head_a, head_b, .071, 'oak', 8, radius2=.082)
        for fraction in (.08, .48, .88):
            center = head_a.lerp(head_b, fraction)
            radius = .074 + fraction*.011
            k.beam('Flail_iron_band', center-direction*.028, center+direction*.028, radius, 'iron', 8)
            # Squat iron studs rather than a fantasy spiked ball.
            for side in (-1, 1):
                normal = Vector((0, side, 0))
                k.beam('Flail_band_stud', center+normal*radius,
                       center+normal*(radius+.036), .021, 'iron', 4, radius2=.010)

    def crossbow(self):
        k = self.k
        self.body('Crossbowman',
                  {-1: (.15, -.10, 1.155), 1: (.49, .025, 1.19)},
                  {-1: (-.09, -.32, 1.07), 1: (.19, .31, 1.12)})
        # A straight medieval tiller, open transverse bow and simple nut/trigger.
        k.beam('Crossbow_wooden_tiller', (-.10, 0, 1.22), (.88, 0, 1.285), .060, 'oak', 6, radius2=.040)
        k.beam('Crossbow_bolt_groove', (.16, 0, 1.282), (.90, 0, 1.329), .014, 'oak_dark', 4)
        for side in (-1, 1):
            points = [(.74, 0, 1.295), (.71, side*.19, 1.295),
                      (.64, side*.36, 1.295), (.535, side*.49, 1.30)]
            for i, (a, b) in enumerate(zip(points, points[1:])):
                k.beam('Crossbow_composite_limb', a, b, .043-i*.009, 'bow_horn', 6, radius2=.035-i*.009)
            k.beam('Crossbow_string', points[-1], (.20, 0, 1.31), .009, 'linen', 5)
        for y in (-.055, -.028, 0, .028, .055):
            k.box('Crossbow_lashing', (.748, y, 1.298), (.105, .018, .105), 'linen', .007)
        k.cone('Crossbow_nut', (.19, 0, 1.31), .047, .047, .035, 'linen', 8)
        k.beam('Crossbow_trigger_lever', (.22, 0, 1.24), (.055, 0, 1.11), .017, 'iron', 5)
        k.beam('Crossbow_loaded_bolt', (.20, 0, 1.352), (.975, 0, 1.37), .013, 'oak_light', 5)
        k.beam('Crossbow_bolt_head', (.94, 0, 1.37), (1.015, 0, 1.372), .030, 'iron', 4, radius2=0)
        for side in (-1, 1):
            k.box('Crossbow_bolt_fletching', (.29, side*.020, 1.356), (.115, .025, .012), 'linen')
        stirrup = [(.83, -.075, 1.25), (1.06, -.115, 1.245),
                   (1.145, -.055, 1.245), (1.145, .055, 1.245),
                   (1.06, .115, 1.245), (.83, .075, 1.25)]
        for a, b in zip(stirrup, stirrup[1:]):
            k.beam('Crossbow_foot_stirrup', a, b, .016, 'iron', 6)
        # Belt-carried bolt case with a few visibly separate shafts.
        k.beam('Crossbow_bolt_case', (-.16, .265, .51), (-.10, .265, .96), .075, 'leather', 8)
        for index in range(3):
            k.beam('Crossbow_spare_bolt', (-.12+index*.028, .265, .84),
                   (-.075+index*.028, .265, 1.105+index*.016), .011, 'oak_light', 5)
        k.beam('Crossbow_belt_hook', (.245, .085, .92), (.26, .085, .82), .018, 'iron', 5)

    def pavise(self):
        k = self.k
        self.body('Pavisier',
                  {-1: (.22, -.18, 1.13), 1: (.25, .27, 1.04)},
                  {-1: (.02, -.30, 1.01), 1: (.07, .37, 1.10)}, stance=.18)
        # An oblong, rounded-shoulder shield with a raised central rib. The
        # deliberately plain paint can serve either side without false heraldry.
        sections = [(.09, .35, .49), (.23, .405, .525),
                    (1.17, .405, .565), (1.34, .335, .57), (1.415, .235, .57)]
        vertices = []
        for z, width, front in sections:
            vertices.extend([(front-.125, -width-.17, z), (front, -.17, z),
                             (front-.125, width-.17, z)])
        faces = []
        for row in range(len(sections)-1):
            for col in range(2):
                a = row*3+col
                faces.append((a, a+1, a+4, a+3))
        # Front +X normals; back is a separate solid wood shell.
        front = k.mesh('Pavise_painted_front', vertices, faces, 'team_paint')
        front.data.materials.append(k.M['oak'])
        solid = front.modifiers.new('Wooden board thickness', 'SOLIDIFY')
        solid.thickness = .045
        solid.offset = -1
        solid.material_offset = 1
        solid.material_offset_rim = 1
        bpy.context.view_layer.objects.active = front
        bpy.ops.object.modifier_apply(modifier=solid.name)
        # Leather edge and central protective strip follow the actual contour.
        for side in (0, 2):
            for row in range(len(sections)-1):
                k.beam('Pavise_bound_edge', vertices[row*3+side], vertices[(row+1)*3+side], .019, 'shield_edge', 6)
        for row in (0, len(sections)-1):
            k.beam('Pavise_bound_edge', vertices[row*3], vertices[row*3+1], .019, 'shield_edge', 6)
            k.beam('Pavise_bound_edge', vertices[row*3+1], vertices[row*3+2], .019, 'shield_edge', 6)
        for row in range(len(sections)-1):
            a, b = Vector(vertices[row*3+1]), Vector(vertices[(row+1)*3+1])
            a.x += .012; b.x += .012
            k.beam('Pavise_central_rib', a, b, .026, 'linen', 5)
        for z in (.45, .96):
            k.beam('Pavise_back_batten', (.36, -.43, z), (.36, .10, z), .022, 'oak_dark', 6)
        k.beam('Pavise_leather_handle', (.325, -.32, .92), (.23, -.18, 1.13), .030, 'leather', 6)
        k.beam('Pavise_leather_handle', (.23, -.18, 1.13), (.35, -.02, 1.24), .030, 'leather', 6)
        # Short upright sword remains visible above the far shoulder.
        k.beam('Pavisier_sword_grip', (.25, .27, 1.01), (.285, .27, 1.16), .027, 'leather', 6)
        k.beam('Pavisier_sword_guard', (.17, .27, 1.17), (.41, .27, 1.17), .024, 'iron', 6)
        k.beam('Pavisier_sword_blade', (.29, .27, 1.19), (.39, .27, 1.89), .036, 'steel', 4, radius2=.005)
        k.ico('Pavisier_sword_pommel', (.245, .27, .99), (.04, .04, .04), 'iron', 1)


def builders(namespace):
    batch = InfantryBatch(SimpleNamespace(**namespace))
    return {'infantry_flail': batch.flail, 'infantry_crossbow': batch.crossbow,
            'infantry_pavise': batch.pavise, 'infantry_spear': batch.spear,
            'infantry_archer': batch.archer}
