"""Deterministic miniature battlefield kit. Run with Blender 5.2 --background --python."""
from pathlib import Path
import math
import random
import json
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / 'assets/3d/models'
PREVIEWS = ROOT / 'tools/art/blender/previews'
SOURCE = ROOT / 'tools/art/blender/source'
MODEL_DIRECTORIES = {
    'war_wagon': 'units', 'cavalry': 'units',
    'infantry_polearm': 'units', 'infantry_handgun': 'units',
    'infantry_shield': 'units',
    'infantry_flail': 'units', 'infantry_crossbow': 'units', 'infantry_pavise': 'units',
    'infantry_spear': 'units', 'infantry_archer': 'units',
    'artillery_houfnice': 'units', 'artillery_tarasnice': 'units',
    'artillery_bombard': 'units', 'artillery_gunner': 'units',
    'cavalry_light': 'units', 'cavalry_scout': 'units', 'cavalry_heavy': 'units',
    'church': 'buildings', 'farmhouse': 'buildings',
    'broadleaf_olive': 'vegetation', 'broadleaf_gold': 'vegetation',
    'cypress': 'vegetation',
    'stakes': 'props', 'banner': 'props', 'bridge': 'props',
}
for path in (MODELS, PREVIEWS, SOURCE):
    path.mkdir(parents=True, exist_ok=True)
random.seed(1419)
M = {}


def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .92
    p.inputs['Metallic'].default_value = metallic
    M[name] = mat


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for data in (bpy.data.materials, bpy.data.actions):
        for block in list(data):
            data.remove(block)
    M.clear()
    for name, color in {
        'oak': (.29,.20,.11), 'oak_light': (.43,.32,.19), 'oak_dark': (.19,.13,.07),
        'iron': (.115,.125,.12), 'steel': (.39,.41,.38), 'red': (.36,.075,.055),
        'ochre': (.49,.34,.12), 'linen': (.67,.60,.44), 'skin': (.57,.37,.22),
        'leather': (.17,.105,.057), 'plaster': (.65,.58,.43), 'stone': (.34,.34,.27),
        'roof': (.37,.16,.085), 'roof_light': (.46,.21,.105), 'slate': (.13,.17,.15),
        'olive': (.095,.145,.055), 'olive_light': (.18,.22,.075), 'gold': (.34,.27,.075),
        'cypress': (.15,.24,.16), 'horse': (.30,.145,.064), 'mane': (.085,.062,.045),
        'black': (.055,.050,.035), 'white': (.81,.77,.62), 'grass': (.30,.30,.17),
    }.items():
        material(name, color, .55 if name in ('iron','steel') else 0)


def finish(obj, name, mat, parent=None):
    obj.name = name
    obj.data.materials.append(M[mat])
    if parent:
        obj.parent = parent
    return obj


def box(name, pos, scale, mat, bevel=0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = finish(bpy.context.object, name, mat, parent)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Small worn edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def ico(name, pos, scale, mat, subdivisions=1, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=pos)
    obj = finish(bpy.context.object, name, mat, parent)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def cone(name, pos, r1, r2, depth, mat, vertices=8, parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=pos)
    return finish(bpy.context.object, name, mat, parent)


def beam(name, a, b, radius, mat, vertices=6, parent=None, radius2=None):
    a, b = Vector(a), Vector(b)
    obj = cone(name, (a+b)/2, radius, radius if radius2 is None else radius2, (b-a).length, mat, vertices, parent)
    obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return obj


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)


def empty(name, pos=(0,0,0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.parent = parent
    return obj


def soldier(prefix='Infantry', origin=(0,0,0), weapon='polearm', coat='red', mounted=False):
    x,y,z = origin
    def p(a,b,c): return (x+a,y+b,z+c)
    box(prefix+'_tunic', p(0,0,1.05), (.40,.30,.49), coat, .06)
    cone(prefix+'_skirt', p(0,0,.78), .29,.20,.33,coat)
    box(prefix+'_belt', p(0,0,.89), (.43,.32,.075),'leather', .01)
    for side in (-1,1):
        hip=p(.01,side*.12,.74)
        knee=p(.13 if mounted else .025,side*(.32 if mounted else .13),.44)
        foot=p(.04,side*(.40 if mounted else .14),.13)
        beam(prefix+'_thigh',hip,knee,.105,'linen')
        beam(prefix+'_boot',knee,foot,.079,'leather')
        box(prefix+'_foot',p(.10,side*(.40 if mounted else .14),.075),(.27,.14,.15),'leather',.025)
        shoulder=p(0,side*.23,1.23)
        elbow=p(.17,side*.31,1.01)
        hand=p(.38,side*.22,1.12)
        beam(prefix+'_sleeve',shoulder,elbow,.105,coat)
        beam(prefix+'_forearm',elbow,hand,.080,'linen')
        ico(prefix+'_hand',hand,(.075,.065,.07),'skin')
    ico(prefix+'_face',p(.045,0,1.49),(.125,.12,.15),'skin',2)
    ico(prefix+'_nose',p(.17,0,1.50),(.045,.048,.047),'skin')
    cone(prefix+'_helmet',p(0,0,1.64),.17,.075,.22,'steel',10)
    cone(prefix+'_helmet_brim',p(0,0,1.55),.22,.20,.045,'steel',10)
    if weapon == 'polearm':
        beam(prefix+'_pole',p(.38,-.23,.10),p(.66,-.23,2.63),.031,'oak_dark')
        beam(prefix+'_spear',p(.66,-.23,2.59),p(.71,-.23,2.98),.083,'steel',4,radius2=0)
        box(prefix+'_halberd_blade',p(.69,-.23,2.60),(.23,.034,.27),'steel',.03)
    elif weapon == 'handgun':
        beam(prefix+'_gun_stock',p(.03,-.20,1.08),p(.65,-.20,1.17),.067,'oak_dark')
        beam(prefix+'_gun_barrel',p(.40,-.20,1.14),p(.97,-.20,1.23),.055,'iron',8)
        cone(prefix+'_powder_flask',p(-.11,-.21,.79),.085,.06,.20,'ochre')
    elif weapon == 'shield':
        shield=box(prefix+'_shield',p(.29,-.35,1.02),(.08,.45,.62),'red',.08)
        box(prefix+'_shield_cross_vertical',p(.34,-.35,1.03),(.014,.06,.44),'linen')
        box(prefix+'_shield_cross_horizontal',p(.34,-.35,1.08),(.014,.30,.06),'linen')
        beam(prefix+'_sword',p(.38,.22,1.10),p(.66,.22,1.84),.033,'steel',4,radius2=.01)
        beam(prefix+'_sword_guard',p(.32,.22,1.19),p(.53,.22,1.11),.035,'iron')


def banner(origin=(0,0,0), height=3.5):
    x,y,z=origin
    beam('Banner_pole',(x,y,z),(x,y,z+height),.045,'oak_dark')
    beam('Banner_crossbar',(x,y-.06,z+height-.15),(x,y+.95,z+height-.15),.036,'oak_dark')
    verts=[]
    for i in range(5):
        u=i/4
        for v in (0,1):
            verts.append((x+.08*math.sin(u*5),y+u*.88,z+height-.22-v*1.13-.07*u))
    mesh('Chalice_banner_cloth',verts,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(4)],'red')
    # Chalice sits on both faces of the cloth and reads at a distance.
    for face in (-1,1):
        offset=face*.08
        mesh('White_chalice_cup',[(x+offset,y+.24,z+height-.43),(x+offset,y+.66,z+height-.43),(x+offset,y+.58,z+height-.73),(x+offset,y+.45,z+height-.83),(x+offset,y+.32,z+height-.73)],[(0,1,2,3,4)],'linen')
        box('Chalice_stem',(x+offset,y+.45,z+height-.90),(.013,.06,.20),'linen')
        box('Chalice_foot',(x+offset,y+.45,z+height-1.015),(.013,.32,.065),'linen')


def wagon():
    for i in range(11):
        box('Deck_plank_%02d'%i,(-1.90+i*.38,0,.89),(.365,1.86,.13),'oak_light',.012)
    for y in (-.67,.67):
        box('Underframe',(0,y,.72),(4.35,.17,.22),'oak_dark',.012)
    for x in (-1.45,1.45):
        beam('Axle',(x,-1.29,.58),(x,1.29,.58),.095,'iron',8)
        for y in (-1.10,1.10):
            # Wheels lie in XZ, axle parallel to Y.
            bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=4,location=(x,y,.60),major_radius=.52,minor_radius=.066,rotation=(math.pi/2,0,0))
            finish(bpy.context.object,'Wooden_wheel_felloe','oak_light')
            bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=4,location=(x,y,.60),major_radius=.572,minor_radius=.018,rotation=(math.pi/2,0,0))
            finish(bpy.context.object,'Iron_wheel_tyre','iron')
            beam('Wheel_hub',(x,y-.14,.60),(x,y+.14,.60),.13,'oak_dark',10)
            for i in range(10):
                a=i*math.tau/10
                beam('Wheel_spoke',(x,y,.60),(x+math.sin(a)*.515,y,.60+math.cos(a)*.515),.030,'oak_light',4)
    for y in (-.94,.94):
        for row in range(4):
            for col in range(3):
                box('Side_board',(-1.37+col*1.36,y,1.075+row*.205),(1.335,.09,.187),'oak_light' if row%2 else 'oak',.012)
        for x in (-2.02,-.69,.69,2.02):
            box('Defensive_upright',(x,y,1.44),(.115,.15,1.23),'oak_dark',.012)
            box('Iron_strap',(x,y*1.065,1.40),(.09,.025,.91),'iron')
            for z in (1.06,1.71):
                ico('Iron_rivet',(x,y*1.087,z),(.034,.024,.034),'steel')
        for x in (-1.6,-.3,1.0):
            beam('Side_stake',(x,y,1.68),(x+.14,y*1.05,2.08),.053,'oak_dark',5,radius2=.007)
    for x in (-2.03,2.03):
        for row in range(3):
            box('End_board',(x,0,1.065+row*.205),(.09,1.87,.18),'oak',.01)
    for y in (-.60,.60):
        beam('Tow_pole',(1.85,y,.70),(3.12,y,.52),.071,'oak_dark')
    soldier('Wagon_pikeman',(-.82,.10,.96),'polearm')
    soldier('Wagon_gunner',(.62,.06,.96),'handgun','ochre')
    banner((-1.66,.72,.95),2.70)


def horse():
    root=empty('Horse_gait_root')
    body=ico('Horse_barrel',(0,0,1.37),(.90,.32,.45),'horse',2,parent=root)
    ico('Horse_chest',(.65,0,1.46),(.35,.32,.46),'horse',2,parent=root)
    ico('Horse_haunch',(-.68,0,1.43),(.38,.34,.41),'horse',2,parent=root)
    neck=ico('Horse_neck',(.76,0,1.94),(.27,.235,.67),'horse',2,parent=root)
    neck.rotation_euler.y=.40
    ico('Horse_head',(1.06,0,2.37),(.33,.205,.23),'horse',2,parent=root)
    muzzle=ico('Horse_muzzle',(1.36,0,2.20),(.29,.17,.19),'horse',2,parent=root)
    muzzle.rotation_euler.y=.38
    ico('Horse_nose',(1.56,0,2.12),(.125,.155,.14),'mane',1,parent=root)
    for y in (-.125,.125):
        cone('Horse_ear',(1.02,y,2.62),.065,.014,.18,'horse',5,parent=root)
        ico('Horse_eye',(1.13,y*1.57,2.41),(.040,.015,.039),'black',2,parent=root)
    for i in range(7):
        ico('Mane_lock',(.86-i*.071,0,2.47-i*.105),(.12,.16,.16),'mane',1,parent=root)
    tail=beam('Horse_tail',(-.87,0,1.60),(-1.27,.02,.84),.14,'mane',6,parent=root,radius2=.035)
    box('Saddle_blanket',(-.10,0,1.78),(.79,.71,.09),'red',.04,parent=root)
    box('Leather_saddle',(-.12,0,1.84),(.49,.47,.13),'leather',.05,parent=root)
    for y in (-.337,.337):
        beam('Saddle_girth',(-.10,y,1.77),(-.10,y,1.05),.025,'leather',5,parent=root)
        beam('Bridle_cheek',(1.13,y*.61,2.43),(1.40,y*.48,2.15),.021,'leather',5,parent=root)
        beam('Rein',(.22,y,2.29),(1.43,y*.48,2.20),.012,'leather',4,parent=root)
    leg_roots=[]
    for front,x in ((True,.62),(False,-.64)):
        for side,y in enumerate((-.22,.22)):
            hip=empty(('Fore' if front else 'Hind')+('_near' if side==0 else '_far'),(x,y,1.40),root)
            beam('Upper_leg',(0,0,0),(.03 if front else .18,0,-.57),.103,'horse',6,parent=hip,radius2=.06)
            knee=empty('Knee',(.03 if front else .18,0,-.57),hip)
            beam('Lower_leg',(0,0,0),(-.025,0,-.66),.049,'horse',6,parent=knee,radius2=.034)
            box('Hoof',(.025,0,-.715),(.19,.125,.14),'mane',.025,parent=knee)
            leg_roots.append((hip,knee,(0 if front else .5)+(side*.5 if front else side*.5+.25)))
    before=set(bpy.data.objects)
    soldier('Mounted_rider',(-.20,0,1.33),'polearm','ochre',True)
    for obj in set(bpy.data.objects)-before:
        obj.parent=root
    scene=bpy.context.scene
    scene.frame_start=1
    scene.frame_end=49
    scene.render.fps=24
    for frame in range(1,50,3):
        phase=(frame-1)/48*math.tau
        root.location.z=.035*math.sin(phase*2)
        root.rotation_euler.y=.016*math.sin(phase*2)
        root.keyframe_insert(data_path='location',frame=frame)
        root.keyframe_insert(data_path='rotation_euler',frame=frame)
        tail.rotation_euler.x=.12*math.sin(phase)
        tail.keyframe_insert(data_path='rotation_euler',frame=frame)
        for hip,knee,offset in leg_roots:
            a=phase+offset*math.tau
            hip.rotation_euler.y=.38*math.sin(a)
            knee.rotation_euler.y=-.48*max(0,math.cos(a))
            hip.keyframe_insert(data_path='rotation_euler',frame=frame)
            knee.keyframe_insert(data_path='rotation_euler',frame=frame)
    scene.frame_set(1)


def roof(name, center, length, width, eave, ridge, mat='roof'):
    x,y,z=center
    obj=mesh(name,[(x+sx*length/2,y+sy*width/2,z+eave) for sx in (-1,1) for sy in (-1,1)]+[(x-length/2,y,z+ridge),(x+length/2,y,z+ridge)],[(0,2,5,4),(1,4,5,3),(0,4,1),(2,3,5),(0,1,3,2)],mat)
    # Rows give the red roofs visible texture without image dependencies.
    for side in (-1,1):
        for row in range(1,6):
            t=row/6
            beam(name+'_tile_course',(x-length/2,y+side*width/2*t,z+ridge-(ridge-eave)*t+.014),(x+length/2,y+side*width/2*t,z+ridge-(ridge-eave)*t+.014),.020,'roof_light',4)
    return obj


def window(name,pos,width=.45,height=1.10):
    x,y,z=pos
    box(name,(x,y,z),(width,.035,height),'oak_dark',.08)
    box(name+'_sill',(x,y-.035,z-height/2), (width+.15,.15,.09),'stone')


def church():
    box('Church_foundation',(0,0,.18),(7.4,4.6,.36),'stone',.08)
    box('Nave_plaster',(0,0,2.15),(7,4.2,4.1),'plaster',.04)
    roof('Nave_roof',(0,0,0),7.7,4.8,4.2,6.0)
    for y in (-2.12,2.12):
        for x in (-2.3,0,2.3):
            window('Nave_window',(x,y,2.65),.55,1.55)
            box('Buttress',(x+.6,y,1.40),(.32,.40,2.8),'plaster',.02)
    box('Tower',(-2.75,0,3.88),(2.65,2.65,7.7),'plaster',.05)
    box('Tower_stone_band',(-2.75,0,6.0),(2.8,2.8,.18),'stone',.025)
    for y in (-1.34,1.34):
        window('Belfry',(-2.75,y,6.88),.60,1.17)
    cone('Tower_spire',(-2.75,0,9.13),2.03,0,3.20,'slate',4).rotation_euler.z=math.pi/4
    beam('Church_cross_vertical',(-2.75,0,10.5),(-2.75,0,11.25),.041,'iron')
    beam('Church_cross_horizontal',(-3.00,0,11.02),(-2.50,0,11.02),.038,'iron')
    box('Door',(-2.75,-1.35,1.10),(1.08,.06,2.2),'oak_dark',.14)
    for x in (-2.97,-2.53):
        box('Door_iron_hinge',(x,-1.40,.75),(.35,.05,.055),'iron')
    box('Church_step',(-2.75,-1.73,.12),(1.5,.85,.24),'stone',.03)


def farmhouse():
    box('Farm_foundation',(0,0,.15),(5.5,3.85,.30),'stone',.04)
    box('Farm_plaster',(0,0,1.50),(5.2,3.6,2.70),'plaster',.035)
    roof('Farm_roof',(0,0,0),5.8,4.15,2.88,4.36)
    for y in (-1.82,1.82):
        for x in (-2.3,0,2.3):
            box('Timber_post',(x,y,1.48),(.13,.10,2.77),'oak_dark')
        box('Timber_rail',(0,y,.53),(5.2,.11,.13),'oak_dark')
        for x in (-1.65,1.52):
            window('Farm_window',(x,y,1.66),.67,.86)
            box('Window_mullion',(x,y*1.02,1.66),(.055,.07,.83),'oak_light')
    box('Farm_door',(-.35,-1.85,1.03),(.86,.08,1.91),'oak',.04)
    box('Chimney',(1.68,.40,4.0),(.46,.52,1.5),'plaster',.025)
    box('Chimney_cap',(1.68,.40,4.76),(.57,.65,.13),'roof')
    for x in (-2.61,2.61):
        beam('Gable_beam',(x,-1.78,2.87),(x,0,4.20),.070,'oak_dark',4)
        beam('Gable_beam',(x,1.78,2.87),(x,0,4.20),.070,'oak_dark',4)


def tree(gold=False):
    beam('Tree_trunk',(0,0,0),(.12,.03,3.50),.24,'oak_dark',7,radius2=.11)
    for i in range(5):
        angle=i*math.tau/5
        a=(math.cos(angle)*.93,math.sin(angle)*.93,3.05+(i%2)*.67)
        beam('Tree_branch',(0,0,1.8),a,.11,'oak_dark',6,radius2=.035)
        crown=ico('Faceted_crown',a,(1.12,1.03,2.0),'gold' if gold else ('olive_light' if i%2 else 'olive'),1)
        crown.rotation_euler.z=angle
    ico('Faceted_top',(.05,.05,4.65),(1.14,1.09,1.8),'gold' if gold else 'olive',1)


def cypress():
    beam('Cypress_trunk',(0,0,0),(0,0,3.6),.12,'oak_dark',6,radius2=.045)
    for i,(z,r,h) in enumerate(((1.8,.60,1.15),(2.7,.61,1.36),(3.8,.45,1.34),(4.8,.22,.92))):
        ico('Cypress_crown_%s'%i,(.08*math.sin(i),0,z),(r,r*.82,h),'cypress',1)


def stakes():
    for x in (-1.25,0,1.25):
        for side in (-1,1):
            beam('Pointed_obstacle',(x,side*-.64,.05),(x,side*.62,1.65),.095,'oak',6,radius2=.005)
    beam('Obstacle_cross_rail',(-1.62,0,.82),(1.62,0,.82),.105,'oak_dark')
    for x in (-1.25,0,1.25):
        box('Lashing',(x,0,.85),(.20,.23,.13),'linen',.01)


def bridge():
    for i in range(20):
        x=-3.8+i*.4
        z=.65+.42*math.sin((i+.5)/20*math.pi)
        box('Bridge_deck_plank',(x,0,z),(.375,2.7,.17),'oak_light',.014)
    for y in (-1.12,1.12):
        for i in range(10):
            x=-3.8+i*.80
            z=.53+.42*math.sin((i+.5)/10*math.pi)
            box('Bridge_girder',(x,y,z),(.83,.19,.22),'oak_dark')
        for x in (-3.5,-1.75,0,1.75,3.5):
            deck=.65+.42*math.cos(x/8*math.pi)
            beam('Bridge_post',(x,y,.10),(x,y,deck+1.02),.075,'oak_dark')
        for x1,x2 in zip((-3.5,-1.75,0,1.75),(-1.75,0,1.75,3.5)):
            beam('Bridge_rail',(x1,y,1.64+.42*math.cos(x1/8*math.pi)),(x2,y,1.64+.42*math.cos(x2/8*math.pi)),.055,'oak')


def bounds(objects):
    points=[o.matrix_world@Vector(v) for o in objects if o.type=='MESH' for v in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return lo,hi


def preview(name, objects):
    scene=bpy.context.scene
    lo,hi=bounds(objects)
    size=max(hi-lo)
    center=(lo+hi)/2
    ground=box('Preview_ground',(center.x,center.y,-.12),(size*200,size*200,.20),'grass')
    bpy.ops.object.camera_add(location=center+Vector((1.40,-1.90,1.13))*size)
    camera=bpy.context.object
    camera.name='Preview_camera'
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=size*1.30
    scene.camera=camera
    bpy.ops.object.light_add(type='AREA',location=center+Vector((-3,-4,7))*size)
    light=bpy.context.object
    light.name='Preview_softbox'
    light.data.energy=1400*size*size
    light.data.shape='DISK'
    light.data.size=size*4
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    scene.world.color=(.35,.35,.35)
    scene.render.engine='CYCLES'
    scene.cycles.samples=12
    scene.cycles.use_denoising=True
    scene.render.resolution_x=800
    scene.render.resolution_y=720
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(PREVIEWS/(name+'.png'))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')))
    bpy.ops.render.render(write_still=True)


BUILDERS={
    'war_wagon':wagon,'cavalry':horse,
    'infantry_polearm':lambda:soldier(weapon='polearm'),
    'infantry_handgun':lambda:soldier(weapon='handgun',coat='ochre'),
    'infantry_shield':lambda:soldier(weapon='shield'),
    'church':church,'farmhouse':farmhouse,
    'broadleaf_olive':tree,'broadleaf_gold':lambda:tree(True),'cypress':cypress,
    'stakes':stakes,'banner':banner,'bridge':bridge,
}

# The next infantry batch shares the original kit's primitives and exporter.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from infantry_batch import builders as infantry_builders
BUILDERS.update(infantry_builders(globals()))
from artillery_batch import builders as artillery_builders
BUILDERS.update(artillery_builders(globals()))
from cavalry_batch import builders as cavalry_builders
BUILDERS.update(cavalry_builders(globals()))


def main():
    selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(BUILDERS)
    manifest={}
    manifest_path=MODELS/'manifest.json'
    if manifest_path.exists():
        manifest=json.loads(manifest_path.read_text())
    for name in selected:
        reset()
        BUILDERS[name]()
        bpy.context.view_layer.update()
        objects=list(bpy.context.scene.objects)
        lo,hi=bounds(objects)
        source_mesh_count=sum(o.type=='MESH' for o in objects)
        triangle_count=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH')
        # Save the fully editable source first; consolidate only the export copy.
        preview(name,objects)
        for obj in list(bpy.context.scene.objects):
            if obj not in objects:
                bpy.data.objects.remove(obj,do_unlink=True)
        batches={}
        for obj in objects:
            if obj.type=='MESH' and not obj.animation_data:
                batches.setdefault((obj.parent,obj.data.materials[0].name),[]).append(obj)
        for (parent,mat_name),parts in batches.items():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in parts: obj.select_set(True)
            bpy.context.view_layer.objects.active=parts[0]
            if len(parts)>1: bpy.ops.object.join()
            parts[0].name=(parent.name+'_' if parent else name+'_')+mat_name
        objects=list(bpy.context.scene.objects)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if name in ('infantry_flail', 'infantry_crossbow', 'infantry_pavise', 'infantry_spear', 'infantry_archer') or name.startswith(('artillery_', 'cavalry_')):
            # Static exports use world-space vertices so runtime AABBs describe
            # the actual feet, not rotated material-batch bounding boxes.
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            bpy.context.view_layer.update()
            lo,hi=bounds(objects)
        bpy.context.scene.name='HorseWalk' if name=='cavalry' else name
        output = MODELS / MODEL_DIRECTORIES[name] / (name + '.glb')
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=name=='cavalry',export_animation_mode='SCENE',export_nla_strips_merged_animation_name='HorseWalk',export_anim_scene_split_object=False,export_frame_range=True,export_force_sampling=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
        manifest[name]={
            'file':str(output.relative_to(MODELS)),'dimensions_blender_xyz_m':[round(v,3) for v in hi-lo],
            'dimensions_gltf_xyz_m':[round((hi-lo)[i],3) for i in (0,2,1)],
            'mesh_objects':sum(o.type=='MESH' for o in objects),
            'editable_source_mesh_objects':source_mesh_count,
            'triangles':triangle_count,
            'forward_axis':'+X','up_axis':'Y','animations':['HorseWalk'] if name=='cavalry' else [],
            'animation_seconds':2.0 if name=='cavalry' else None,
        }
        print('ASSET_COMPLETE',name,manifest[name],flush=True)
        manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')


if __name__=='__main__':
    main()
