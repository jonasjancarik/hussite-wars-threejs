"""Static medieval artillery for the miniature battlefield.

Illustrative early gun silhouettes, not working weapon plans. +X is forward.
Reference dates and reconstruction limits are recorded in artillery-references.md.
"""
import math
from types import SimpleNamespace

import bpy
from mathutils import Vector
from infantry_batch import InfantryBatch


class ArtilleryBatch:
    def __init__(self, kit):
        self.k = kit

    def palette(self):
        self.k.material('gun_iron', (.095, .11, .105), .35)
        self.k.material('gun_bands', (.155, .17, .155), .40)

    def tube(self, name, profiles, height, bore, slope=0, material='gun_iron', segments=16, through=False):
        """Closed faceted shell with a real recessed muzzle and interior wall."""
        rings = list(profiles)
        # Continue inward around the open muzzle, then back to a recessed end.
        rings.extend([(profiles[-1][0], bore),
                      (profiles[0][0] if through else profiles[0][0]+.08,
                       bore if through else min(bore*.88, profiles[0][1]*.65))])
        vertices = [(x, radius*math.cos(i*math.tau/segments),
                     height+slope*x+radius*math.sin(i*math.tau/segments))
                    for x, radius in rings for i in range(segments)]
        faces = [] if through else [tuple(reversed(range(segments)))]
        for row in range(len(rings)-1):
            for i in range(segments):
                a=row*segments+i; b=row*segments+(i+1)%segments
                faces.append((a,b,b+segments,a+segments))
        if through:
            for i in range(segments):
                a=(len(rings)-1)*segments+i
                b=(len(rings)-1)*segments+(i+1)%segments
                faces.append((a,b,(i+1)%segments,i))
        else:
            faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
        return self.k.mesh(name, vertices, faces, material)

    def band(self, name, x, radius, height, slope=0, width=.055):
        return self.tube(name, [(x-width/2, radius), (x+width/2, radius)],
                         height, radius-.025, slope, 'gun_bands', through=True)

    def wheel(self, x, y, radius):
        k=self.k
        # Polygonal felloes, ten spokes and iron tyres; no suspension or modern hub.
        for name, r, thickness, mat in [
            ('Wheel_wood_felloe',radius-.042,.038,'oak_light'),
            ('Wheel_iron_tyre',radius-.009,.009,'gun_bands')]:
            bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=4,
                location=(x,y,radius),major_radius=r,minor_radius=thickness,
                rotation=(math.pi/2,0,0))
            k.finish(bpy.context.object,name,mat)
        k.beam('Wheel_hub',(x,y-.095,radius),(x,y+.095,radius),.091,'oak_dark',10)
        for i in range(10):
            angle=i*math.tau/10
            k.beam('Wheel_spoke',(x,y,radius),
                   (x+math.sin(angle)*(radius-.06),y,radius+math.cos(angle)*(radius-.06)),
                   .027,'oak_light',4)
        for side in (-1,1):
            k.beam('Wheel_axle_pin',(x-.07,y+side*.10,radius),(x+.07,y+side*.10,radius),.016,'iron',5)

    def iron_strap(self, x, y, z, length):
        k=self.k
        k.box('Carriage_iron_strap',(x,y,z),(.065,.020,length),'iron',.004)
        for sign in (-1,1):
            k.ico('Carriage_rivet',(x,y*1.03,z+sign*(length*.37)),(.022,.012,.022),'gun_bands',1)

    def houfnice(self):
        k=self.k;self.palette()
        # The short, broad mouth and smaller rear chamber are its defining shape.
        height=.97; slope=.055
        self.tube('Houfnice_barrel',[(-.77,.145),(-.37,.165),(-.23,.255),(.57,.275),(.69,.285)],height,.175,slope)
        for x,r in [(-.69,.17),(-.42,.19),(-.19,.28),(.12,.29),(.46,.305),(.67,.31)]:
            self.band('Houfnice_hoop',x,r,height,slope,width=.058)
        for side in (-1,1):
            y=side*.325
            k.box('Houfnice_timber_bed',(-.13,y,.67),(1.52,.18,.34),'oak',.025)
            # The trailing timber is a simple support/handle, not a later split trail.
            k.beam('Houfnice_rear_trail',(-.66,y,.60),(-1.40,y*.68,.18),.102,'oak_dark',4)
            k.box('Houfnice_trail_foot',(-1.40,y*.68,.085),(.28,.18,.17),'oak_dark',.015)
            self.wheel(.13,side*.66,.46)
            self.iron_strap(-.53,side*.425,.68,.29)
            self.iron_strap(.30,side*.425,.68,.29)
        k.beam('Houfnice_axle',(.13,-.84,.46),(.13,.84,.46),.085,'iron',8)
        k.box('Houfnice_front_crossbar',(.50,0,.57),(.16,.86,.16),'oak_dark',.01)
        k.box('Houfnice_rear_crossbar',(-.63,0,.53),(.16,.81,.16),'oak_dark',.01)
        k.box('Houfnice_elevation_wedge',(-.53,0,.77),(.30,.25,.13),'oak_light',.015)
        # Quiet supporting detail, all within the carriage footprint.
        k.box('Houfnice_shot_tray',(-.99,0,.295),(.34,.33,.08),'oak',.01)
        for y in (-.08,.08): k.ico('Houfnice_stone_shot',(-.98,y,.39),(.085,.085,.085),'stone',2)

    def tarasnice(self):
        k=self.k;self.palette()
        height=.70; slope=.023
        self.tube('Tarasnice_long_barrel',[(-.96,.137),(-.67,.143),(.94,.098),(1.18,.12)],height,.065,slope)
        for x,r in [(-.88,.16),(-.58,.161),(-.20,.145),(.22,.132),(.67,.12),(1.13,.14)]:
            self.band('Tarasnice_hoop',x,r,height,slope,width=.042)
        for side in (-1,1):
            y=side*.21
            k.box('Tarasnice_bed_rail',(-.32,y,.48),(1.74,.15,.25),'oak',.02)
            k.beam('Tarasnice_rear_handle',(-1.03,y,.48),(-1.51,y,.34),.055,'oak_dark',6)
            k.box('Tarasnice_rear_foot',(-1.03,y,.18),(.19,.16,.36),'oak_dark',.012)
            self.wheel(.23,side*.49,.33)
            self.iron_strap(-.68,side*.297,.49,.21)
            self.iron_strap(.36,side*.297,.49,.21)
        k.beam('Tarasnice_axle',(.23,-.67,.33),(.23,.67,.33),.070,'iron',8)
        for x in (-.72,.38):
            k.box('Tarasnice_crosspiece',(x,0,.405),(.13,.56,.14),'oak_dark',.012)
            # Bands sit on a slotted bed, not on nineteenth-century trunnions.
            k.beam('Tarasnice_barrel_tie',(x,-.15,.62),(x,.15,.62),.035,'iron',6)
        k.box('Tarasnice_breech_wedge',(-.76,0,.555),(.25,.21,.10),'oak_light',.012)

    def bombard(self):
        k=self.k;self.palette()
        height=.87; slope=.075
        self.tube('Bombard_wrought_barrel',[(-1.18,.205),(-.54,.215),(-.28,.395),(.08,.435),(1.16,.445),(1.33,.455)],height,.315,slope,segments=20)
        for x,r in [(-1.09,.23),(-.82,.24),(-.56,.245),(-.26,.425),(.02,.463),(.31,.474),(.61,.48),(.91,.48),(1.27,.495)]:
            self.band('Bombard_iron_hoop',x,r,height,slope,width=.085)
        # Longitudinal staves are suggested with broad ridges, avoiding tiny texture detail.
        for i in range(10):
            angle=i*math.tau/10
            for start,end,radius in [(-1.10,-.56,.213),(-.19,1.23,.446)]:
                a=(start,radius*math.cos(angle),height+slope*start+radius*math.sin(angle))
                b=(end,radius*math.cos(angle),height+slope*end+radius*math.sin(angle))
                k.beam('Bombard_stave_seam',a,b,.012,'gun_bands',4)
        for y in (-.54,.54):
            k.box('Bombard_ground_sleeper',(-.03,y,.14),(3.08,.25,.28),'oak_dark',.03)
            k.box('Bombard_bed_rail',(-.06,y,.40),(2.76,.18,.25),'oak',.018)
            for x in (-1.15,-.26,.63,1.16): self.iron_strap(x,y*1.2,.35,.30)
        for x in (-1.25,-.46,.30,1.16):
            k.box('Bombard_cross_timber',(x,0,.29),(.25,1.28,.22),'oak',.018)
        for side in (-1,1):
            k.box('Bombard_cradle_block',(.30,side*.36,.63),(1.95,.18,.25),'oak_dark',.018)
        k.box('Bombard_breech_stop',(-1.36,0,.61),(.18,1.08,.56),'oak_dark',.025)
        k.box('Bombard_rear_wedge',(-.85,0,.57),(.44,.36,.24),'oak_light',.02)
        for y in (-.42,.42):
            k.ico('Bombard_stone_shot',(-.89,y,.54),(.16,.16,.16),'stone',2)

    def gunner(self):
        k=self.k
        InfantryBatch(k).body('Gunner',
            {-1:(.37,-.23,1.03),1:(.405,-.23,1.33)},
            {-1:(.03,-.34,1.04),1:(.18,.28,1.25)},stance=.17)
        apron=k.mesh('Gunner_work_apron',[
            (.30,-.15,.64),(.30,.15,.64),(.24,.15,.945),(.24,-.15,.945)],
            [(0,1,2,3)],'padded_linen')
        thickness=apron.modifiers.new('Apron cloth thickness','SOLIDIFY')
        thickness.thickness=.012
        bpy.context.view_layer.objects.active=apron
        bpy.ops.object.modifier_apply(modifier=thickness.name)
        k.beam('Gunner_ramrod',(.28,-.23,.20),(.46,-.23,1.94),.027,'oak_light',8)
        k.beam('Gunner_ramrod_head',(.446,-.23,1.80),(.467,-.23,2.00),.061,'oak',8)
        k.box('Gunner_closed_tool_pouch',(-.17,-.225,.79),(.15,.12,.18),'leather',.025)


def builders(namespace):
    batch=ArtilleryBatch(SimpleNamespace(**namespace))
    return {'artillery_houfnice':batch.houfnice,'artillery_tarasnice':batch.tarasnice,
            'artillery_bombard':batch.bombard,'artillery_gunner':batch.gunner}
