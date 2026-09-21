"""Civilian, commander and dismounted figures for complete roster coverage.

Original static miniature geometry; shared roles, not individual portraits.
"""
from types import SimpleNamespace
import math
import bpy
from mathutils import Vector
from infantry_batch import InfantryBatch


class PeopleBatch:
    def __init__(self, kit):
        self.k=kit
        self.infantry=InfantryBatch(kit)

    def palette(self):
        self.infantry.palette()
        for name,colour,metal in [
            ('civilian_wool',(.25,.27,.17),0),('civilian_dress',(.24,.17,.12),0),
            ('cleric_robe',(.075,.085,.075),0),('mail',(.19,.21,.205),.25),
            ('chalice_metal',(.49,.40,.19),.40)]:
            if name not in self.k.M:self.k.material(name,colour,metal)

    def remove(self, prefixes):
        for obj in list(bpy.context.scene.objects):
            if obj.name.startswith(prefixes):bpy.data.objects.remove(obj,do_unlink=True)

    def material_on(self, prefixes, material):
        for obj in bpy.context.scene.objects:
            if obj.type=='MESH' and obj.name.startswith(prefixes):
                obj.data.materials.clear();obj.data.materials.append(self.k.M[material])

    def civilian_adult(self, child=False):
        k=self.k;self.palette()
        # Same body construction as the retained unarmed-adult experiment.
        k.soldier('Pilgrim',weapon=None,coat='civilian_wool' if child else 'linen')
        self.remove(('Pilgrim_helmet',))
        k.cone('Pilgrim_neck',(0,0,1.335),.080,.078,.15,'skin',8)
        self.infantry.ring_mesh('Pilgrim_soft_cap',[
            (0,0,1.60,.142,.132),(-.035,0,1.71,.105,.104),(-.06,0,1.75,.04,.04)],'padded_linen',10)
        k.beam('Pilgrim_shoulder_cord',(.23,-.13,1.26),(.23,.13,.92),.020,'team_cloth',5)
        if not child:
            k.beam('Pilgrim_walking_staff',(.37,-.22,0),(.43,-.22,1.72),.027,'oak',7)
            k.ico('Pilgrim_bundle',(.42,.22,.98),(.18,.17,.20),'padded_linen',1)
            k.beam('Pilgrim_bundle_tie',(.43,.08,1.10),(.43,.36,1.10),.016,'leather',5)
        else:
            k.ico('Child_small_bundle',(.40,0,1.08),(.19,.24,.14),'padded_linen',1)
            for obj in bpy.context.scene.objects:
                if obj.type=='MESH':
                    if obj.name.startswith(('Pilgrim_face','Pilgrim_nose','Pilgrim_soft_cap')):
                        pivot=Vector((0,0,1.50))
                        obj.location=pivot+(obj.location-pivot)*1.08
                        obj.scale*=1.08
                    obj.location*=.67;obj.scale*=.67

    def civilian_woman(self):
        k=self.k;self.palette()
        self.infantry.ring_mesh('Civilian_long_dress',[
            (0,0,.115,.29,.26),(0,0,.66,.25,.225),(0,0,1.00,.19,.175)],'civilian_dress',10)
        k.box('Civilian_bodice',(0,0,1.08),(.36,.31,.40),'civilian_dress',.055)
        k.box('Civilian_waist_tie',(0,0,.93),(.40,.34,.040),'team_cloth',.012)
        for side in (-1,1):
            k.box('Civilian_shoe',(.07,side*.12,.065),(.235,.135,.13),'leather',.025)
            elbow=(.15,side*.28,1.00);hand=(.36,side*.16,1.10)
            k.beam('Civilian_dress_sleeve',(0,side*.205,1.24),elbow,.10,'civilian_dress',7,radius2=.085)
            k.beam('Civilian_linen_cuff',elbow,hand,.078,'linen',7,radius2=.062)
            k.ico('Civilian_hand',hand,(.07,.06,.067),'skin',1)
        k.ico('Civilian_head',(.025,0,1.485),(.128,.124,.153),'skin',2)
        k.cone('Civilian_neck',(0,0,1.32),.078,.078,.15,'skin',8)
        k.ico('Civilian_nose',(.15,0,1.50),(.04,.04,.038),'skin',1)
        self.infantry.ring_mesh('Civilian_head_wrap',[
            (-.018,0,1.58,.147,.143),(-.035,0,1.685,.105,.11),(-.055,0,1.72,.04,.04)],'linen',10)
        veil=k.mesh('Civilian_linen_veil',[
            (-.13,-.13,1.63),(-.13,.13,1.63),(-.20,.22,1.26),(-.20,-.22,1.26)],[(0,1,2,3)],'linen')
        self.thicken(veil,.015)
        apron_vertices=[]
        for z,rx,ry,width in [(.18,.285,.257,.17),(.50,.264,.235,.155),(.94,.20,.182,.13)]:
            for fraction in (-1,-.5,0,.5,1):
                y=width*fraction
                apron_vertices.append((rx*math.sqrt(1-(y/ry)**2)+.015,y,z))
        apron_faces=[]
        for row in range(2):
            for column in range(4):
                a=row*5+column;apron_faces.append((a,a+1,a+6,a+5))
        apron=k.mesh('Civilian_apron',apron_vertices,apron_faces,'linen')
        self.thicken(apron,.012)
        k.ico('Civilian_folded_bundle',(.43,0,1.09),(.22,.19,.135),'padded_linen',1)

    def thicken(self, obj, thickness):
        modifier=obj.modifiers.new('Cloth thickness','SOLIDIFY');modifier.thickness=thickness
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)

    def foot_body(self, prefix, armoured=False, visor=False):
        k=self.k;self.palette()
        self.infantry.body(prefix,{-1:(.38,-.24,1.13),1:(.28,.28,1.14)},
                            {-1:(.15,-.34,1.02),1:(.08,.34,1.06)},helmet=not armoured)
        if not armoured:return
        self.remove((prefix+'_cloth_cap',))
        self.material_on((prefix+'_coif',prefix+'_upper_sleeve'),'mail')
        self.material_on((prefix+'_lower_sleeve',prefix+'_hand',prefix+'_hose'),'steel')
        self.infantry.ring_mesh(prefix+'_bascinet',[
            (-.015,0,1.615,.166,.154),(-.025,0,1.76,.14,.135),
            (-.045,0,1.87,.065,.065),(-.06,0,1.90,.018,.018)],'steel',12)
        if visor:
            k.mesh(prefix+'_visor',[(.135,-.12,1.66),(.135,.12,1.66),(.345,0,1.565),
                   (.12,.11,1.435),(.12,-.11,1.435)],[(1,0,2),(3,1,2),(4,3,2),(0,4,2)],'steel')
            k.box(prefix+'_visor_sight',(.15,0,1.65),(.015,.19,.018),'black')
        k.mesh(prefix+'_breastplate',[(.21,-.18,1.30),(.21,.18,1.30),(.22,.145,.97),(.22,-.145,.97),
            (.31,0,1.15)],[(1,0,4),(2,1,4),(3,2,4),(0,3,4)],'steel')
        for side in (-1,1):
            k.ico(prefix+'_shoulder_plate',(0,side*.245,1.29),(.14,.14,.09),'steel',1)
            k.ico(prefix+'_knee_plate',(.065,side*.16,.44),(.092,.095,.105),'steel',1)

    def sword(self, prefix):
        k=self.k
        k.beam(prefix+'_sword_grip',(.38,-.24,1.08),(.40,-.24,1.25),.027,'leather',6)
        k.beam(prefix+'_sword_guard',(.29,-.24,1.24),(.53,-.24,1.24),.027,'iron',6)
        k.beam(prefix+'_sword_blade',(.41,-.24,1.26),(.52,-.24,2.06),.04,'steel',4,radius2=.004)
        k.ico(prefix+'_pommel',(.375,-.24,1.045),(.043,.038,.04),'iron',1)

    def shield(self,prefix):
        k=self.k
        vertices=[(.34,.04,1.40),(.34,.51,1.40),(.38,.48,.93),(.43,.275,.76),(.38,.07,.93)]
        obj=k.mesh(prefix+'_plain_shield',vertices,[(4,3,2,1,0)],'team_paint');self.thicken(obj,.035)
        for a,b in zip(vertices,vertices[1:]+vertices[:1]): k.beam(prefix+'_shield_rim',a,b,.014,'linen',5)

    def captain(self):
        k=self.k;self.foot_body('Captain')
        k.beam('Captain_mace_haft',(.36,-.24,1.05),(.47,-.24,1.64),.029,'oak_dark',7)
        k.ico('Captain_mace_head',(.47,-.24,1.64),(.11,.105,.14),'iron',1)
        for z in (1.57,1.66):k.cone('Captain_mace_band',(.47,-.24,z),.105,.105,.025,'steel',8)
        k.ico('Captain_shoulder_plate',(0,-.24,1.30),(.14,.14,.10),'steel',1)
        k.beam('Captain_sash',(.225,-.15,1.27),(.225,.15,.94),.027,'linen',5)
        k.beam('Captain_sheathed_sword',(-.12,.27,.91),(-.21,.27,.32),.03,'leather',5)

    def noble(self,dismounted=False):
        prefix='Dismounted' if dismounted else 'Noble'
        self.foot_body(prefix,armoured=True,visor=dismounted)
        self.sword(prefix);self.shield(prefix)
        if not dismounted:
            cape=self.k.mesh('Noble_short_mantle',[(-.22,-.19,1.31),(-.22,.19,1.31),
                 (-.43,.25,.68),(-.43,-.25,.68)],[(0,1,2,3)],'team_cloth')
            self.thicken(cape,.018)

    def cleric(self):
        k=self.k;self.palette()
        self.infantry.ring_mesh('Cleric_robe',[(0,0,.13,.29,.26),(0,0,.9,.22,.19),(0,0,1.28,.235,.21)],'cleric_robe',10)
        for side in (-1,1):
            k.box('Cleric_shoe',(.065,side*.12,.065),(.235,.14,.13),'leather',.025)
            elbow=(.16,side*.30,1.0);hand=(.36,side*.21,1.15)
            k.beam('Cleric_robe_sleeve',(0,side*.22,1.22),elbow,.112,'cleric_robe',8,radius2=.105)
            k.beam('Cleric_wide_cuff',elbow,hand,.105,'cleric_robe',8,radius2=.092)
            k.ico('Cleric_hand',hand,(.074,.065,.071),'skin',1)
            k.beam('Cleric_stole',(.245,side*.10,1.27),(.245,side*.105,.91),.030,'team_cloth',4)
        k.cone('Cleric_linen_collar',(0,0,1.34),.115,.095,.06,'linen',10)
        k.cone('Cleric_neck',(0,0,1.34),.078,.078,.20,'skin',8)
        k.ico('Cleric_head',(.025,0,1.50),(.13,.125,.16),'skin',2)
        k.ico('Cleric_nose',(.16,0,1.51),(.041,.042,.038),'skin',1)
        self.infantry.ring_mesh('Cleric_hair',[(0,0,1.58,.133,.13),(-.025,0,1.67,.095,.095)],'oak_dark',12)
        k.cone('Cleric_tonsure',(-.025,0,1.675),.065,.065,.016,'skin',12)
        k.box('Cleric_book_cover',(.42,.22,1.15),(.26,.29,.055),'oak_dark',.012)
        k.box('Cleric_book_pages',(.42,.22,1.183),(.235,.265,.035),'linen',.007)
        k.beam('Cleric_book_fold',(.30,.22,1.205),(.54,.22,1.205),.012,'oak_dark',4)
        k.cone('Cleric_chalice_foot',(.38,-.21,1.18),.075,.065,.025,'chalice_metal',10)
        k.cone('Cleric_chalice_stem',(.38,-.21,1.255),.023,.023,.14,'chalice_metal',8)
        cup=self.infantry.ring_mesh('Cleric_chalice_cup',[
            (.38,-.21,1.29,.035,.035),(.38,-.21,1.45,.105,.105),
            (.38,-.21,1.45,.085,.085),(.38,-.21,1.335,.035,.035)],'chalice_metal',12)


def builders(namespace):
    batch=PeopleBatch(SimpleNamespace(**namespace))
    return {'civilian_adult':batch.civilian_adult,'civilian_woman':batch.civilian_woman,
            'civilian_child':lambda:batch.civilian_adult(child=True),
            'commander_captain':batch.captain,'commander_noble':batch.noble,
            'commander_cleric':batch.cleric,'infantry_dismounted':lambda:batch.noble(dismounted=True)}
