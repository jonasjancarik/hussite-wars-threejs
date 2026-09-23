"""Static light cavalry, scouts and heavy riders built on the existing horse.

The animated original is retained unchanged. These exports use a standing pose.
See cavalry-references.md for evidence and intentional simplifications.
"""
import math
from types import SimpleNamespace
import bpy
from mathutils import Vector
from infantry_batch import InfantryBatch


class CavalryBatch:
    def __init__(self, kit):
        self.k=kit
        self.infantry=InfantryBatch(kit)

    def standing_horse(self, style):
        k=self.k
        k.horse()
        # Reuse the authored horse, stripping the generic rider and walk action.
        for obj in list(bpy.context.scene.objects):
            if obj.name.startswith(('Mounted_rider','Rein')):
                bpy.data.objects.remove(obj,do_unlink=True)
        for obj in bpy.context.scene.objects:
            obj.animation_data_clear()
            if obj.type=='EMPTY': obj.rotation_euler=(0,0,0)
        bpy.context.view_layer.update()
        for obj in list(bpy.context.scene.objects):
            if obj.type=='MESH':
                matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=matrix
        for obj in list(bpy.context.scene.objects):
            if obj.type=='EMPTY': bpy.data.objects.remove(obj,do_unlink=True)
        colour={'light':(.30,.145,.064),'scout':(.32,.30,.24),'heavy':(.14,.09,.065)}[style]
        k.M['horse'].diffuse_color=(*colour,1)
        k.M['horse'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*colour,1)

    def rider(self, style):
        k=self.k
        before=set(bpy.context.scene.objects)
        hands=({-1:(.40,-.16,1.10),1:(.40,.16,1.10)} if style=='scout'
               else {-1:(.395,-.32,1.13),1:(.40,.16,1.10)})
        self.infantry.body('Rider',hands,{-1:(.14,-.35,1.05),1:(.17,.31,1.02)},helmet=style=='light')
        for obj in set(bpy.context.scene.objects)-before:
            if obj.name.startswith(('Rider_hose_','Rider_ankle_shoe')):
                bpy.data.objects.remove(obj,do_unlink=True)
            else: obj.location+=Vector((-.18,0,1.20))
        k.material('mail',(.19,.21,.205),.25)
        for side in (-1,1):
            hip=(-.18,side*.16,1.91);knee=(.06,side*.435,1.60);ankle=(-.055,side*.46,1.24)
            k.beam('Rider_mounted_thigh',hip,knee,.105,'steel' if style=='heavy' else 'hose',7,radius2=.086)
            k.beam('Rider_mounted_shin',knee,ankle,.080,'steel' if style=='heavy' else 'leather',7,radius2=.068)
            k.box('Rider_riding_boot',(.005,side*.465,1.18),(.25,.145,.14),'leather',.03)
            if style=='heavy': k.ico('Rider_knee_plate',(.10,side*.45,1.61),(.11,.105,.11),'steel',1)
            k.beam('Stirrup_leather',(-.13,side*.36,1.82),(-.055,side*.52,1.19),.018,'leather',5)
            # Simple iron stirrup around the shoe, open at the top.
            points=[(-.12,side*.50,1.30),(-.14,side*.53,1.12),(.10,side*.53,1.12),(.105,side*.50,1.28)]
            for a,b in zip(points,points[1:]): k.beam('Iron_stirrup',a,b,.014,'iron',5)
            hand=(.22,side*.16,2.30) if style=='scout' else (.22,.16,2.30)
            k.beam('Held_rein',hand,(1.45,side*.111,2.15),.013,'leather',5)
        for obj in bpy.context.scene.objects:
            if obj.name.startswith('Saddle_blanket'):
                obj.data.materials.clear();obj.data.materials.append(k.M['team_cloth'])
        # Rounded saddle pommel/cantle give the rider a visible seat.
        k.box('Saddle_pommel',(.16,0,1.92),(.14,.47,.16),'leather',.03)
        k.box('Saddle_cantle',(-.40,0,1.94),(.11,.48,.20),'leather',.035)

    def lance(self, heavy=False):
        k=self.k
        a=Vector((.10,-.32,1.28));b=Vector((.42,-.32,3.78 if not heavy else 3.94))
        direction=(b-a).normalized()
        k.beam('Rider_lance_shaft',a,b,.031 if not heavy else .038,'oak',8,radius2=.025)
        k.beam('Rider_lance_socket',b-direction*.08,b+direction*.03,.038,'steel',8)
        k.beam('Rider_lance_point',b,b+direction*.23,.062,'steel',4,radius2=0)
        if heavy:
            k.mesh('Knight_lance_pennant',[(.40,-.31,3.69),(.40,.22,3.61),(.40,-.31,3.45)],[(0,1,2)],'team_cloth')
            k.beam('Knight_pennant_tie',(.40,-.32,3.67),(.40,-.32,3.48),.036,'linen',6)

    def shield(self, heavy=False):
        k=self.k
        x=-.03;y=.465;z=2.28
        width=.33 if heavy else .27;height=.56 if heavy else .43
        outline=[(x-width/2,y,z+height/2),(x+width/2,y,z+height/2),
                 (x+width*.46,y,z-height*.12),(x,y+.035,z-height/2),
                 (x-width*.46,y,z-height*.12)]
        obj=k.mesh('Rider_plain_shield',outline,[(0,1,2,3,4)],'team_paint')
        modifier=obj.modifiers.new('Wooden shield thickness','SOLIDIFY');modifier.thickness=.04
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
        for a,b in zip(outline,outline[1:]+outline[:1]): k.beam('Shield_bound_edge',a,b,.013,'linen',5)
        # No cross, chalice or invented family arms on this reusable shield.

    def heavy_armour(self):
        k=self.k
        for obj in list(bpy.context.scene.objects):
            if obj.name=='Rider_cloth_cap': bpy.data.objects.remove(obj,do_unlink=True)
            elif obj.name.startswith(('Rider_coif','Rider_upper_sleeve')):
                obj.data.materials.clear();obj.data.materials.append(k.M['mail'])
            elif obj.name.startswith(('Rider_lower_sleeve','Rider_hand')):
                obj.data.materials.clear();obj.data.materials.append(k.M['steel'])
        self.infantry.ring_mesh('Knight_bascinet',[
            (-.195,0,2.78,.162,.151),(-.205,0,2.93,.147,.138),
            (-.22,0,3.06,.079,.079),(-.23,0,3.105,.014,.015)],'steel',12)
        # Compact pointed visor, with a readable dark eye slit and mail below.
        k.mesh('Knight_pointed_visor',[
            (-.06,-.125,2.87),(-.06,.125,2.87),(.17,0,2.78),
            (-.08,.115,2.66),(-.08,-.115,2.66)],
            [(1,0,2),(3,1,2),(4,3,2),(0,4,2)],'steel')
        k.box('Knight_visor_sight',(-.045,0,2.865),(.016,.20,.017),'black')
        k.mesh('Knight_breastplate',[
            (.045,-.19,2.49),(.045,.19,2.49),(.035,.14,2.16),(.035,-.14,2.16),
            (.155,0,2.34)],[(1,0,4),(2,1,4),(3,2,4),(0,3,4)],'steel')
        for side in (-1,1):
            k.ico('Knight_shoulder_plate',(-.18,side*.235,2.475),(.155,.15,.105),'steel',1)
            k.box('Knight_hip_plate',(-.10,side*.26,2.04),(.27,.04,.20),'steel',.02)
            # Cloth caparison leaves the horse's legs free and visible.
            xs=[-.89,-.55,-.10,.45,.54]
            tops=[1.70,1.82,1.79,1.77,1.67]
            hems=[1.10,1.02,.97,1.03,1.12]
            vertices=[(x,side*.29,z) for x,z in zip(xs,tops)]
            vertices.extend((x,side*.38,1.40) for x in xs)
            vertices.extend((x,side*.35,z) for x,z in zip(xs,hems))
            faces=[]
            for row in range(2):
                for col in range(4):
                    a=row*5+col
                    face=(a,a+1,a+6,a+5)
                    faces.append(face if side==1 else tuple(reversed(face)))
            cloth=k.mesh('Horse_caparison',vertices,faces,'team_cloth')
            solid=cloth.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.012
            bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=solid.name)
            for a,b in zip(vertices[10:],vertices[11:]):
                k.beam('Caparison_hem',a,b,.015,'linen',5)
        # Restrained forehead protection, not a complete later plate horse bard.
        # Ridged plate following the top of the faceted head to the nose.
        guard=k.mesh('Horse_forehead_guard',[
            (1.10,-.115,2.555),(1.12,0,2.615),(1.10,.115,2.555),
            (1.46,-.085,2.285),(1.47,0,2.345),(1.46,.085,2.285),(1.575,0,2.225)],
            [(0,1,4,3),(1,2,5,4),(3,4,6),(4,5,6)],'steel')
        solid=guard.modifiers.new('Plate thickness','SOLIDIFY');solid.thickness=.014
        bpy.context.view_layer.objects.active=guard;bpy.ops.object.modifier_apply(modifier=solid.name)

    def scout_gear(self):
        k=self.k
        for side in (-1,1):
            k.box('Scout_saddlebag',(-.64,side*.375,1.39),(.30,.18,.36),'leather',.045)
            k.box('Scout_bag_flap',(-.64,side*.385,1.58),(.33,.21,.075),'oak_dark',.025)
        k.beam('Scout_bedroll',(-.65,-.33,1.87),(-.65,.33,1.87),.115,'padded_linen',10)
        for y in (-.20,.20):
            k.box('Scout_bedroll_tie',(-.65,y,1.875),(.24,.035,.24),'leather',.025)
        cape=k.mesh('Scout_short_cape',[
            (-.41,-.18,2.51),(-.41,.18,2.51),(-.70,.255,1.98),(-.70,-.255,1.98)],
            [(0,1,2,3)],'padded_linen')
        solid=cape.modifiers.new('Cape thickness','SOLIDIFY');solid.thickness=.018
        bpy.context.view_layer.objects.active=cape;bpy.ops.object.modifier_apply(modifier=solid.name)
        k.beam('Scout_sheathed_sword',(-.24,-.40,1.96),(-.52,-.40,1.23),.030,'leather',5)
        k.beam('Scout_sword_grip',(-.18,-.40,2.10),(-.24,-.40,1.96),.025,'oak_dark',6)

    def build(self, style):
        self.standing_horse(style)
        self.rider(style)
        if style=='scout': self.scout_gear()
        else:
            self.lance(style=='heavy');self.shield(style=='heavy')
            if style=='heavy': self.heavy_armour()
        bpy.context.view_layer.update()
        low=min((obj.matrix_world@Vector(v)).z for obj in bpy.context.scene.objects
                if obj.type=='MESH' for v in obj.bound_box)
        for obj in bpy.context.scene.objects:
            if obj.type=='MESH': obj.location.z-=low
        bpy.context.view_layer.update()


def builders(namespace):
    batch=CavalryBatch(SimpleNamespace(**namespace))
    return {f'cavalry_{style}':lambda style=style:batch.build(style) for style in ('light','scout','heavy')}
