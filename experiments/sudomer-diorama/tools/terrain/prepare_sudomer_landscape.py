# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy>=2.1,<3", "pillow>=11,<12", "pyproj>=3.7,<4", "shapely>=2,<3"]
# ///
"""Compile the retained OSM extract into the exact DMR 5G projected crop.

No network is needed. Modern field envelopes are subdivided artistically; only
Skaredy's drained condition is an explicit battle-period override. Raster IDs
keep placement reproducible and separate from generated concept artwork.
"""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pyproj import Transformer
from shapely.geometry import Polygon, box
from shapely.ops import triangulate, unary_union

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/terrain/sudomer'
N = 769
meta = json.loads((ROOT / 'assets/terrain/sudomer_dmr5g.json').read_text())
extent = meta['output_extent']
SIZE = extent['xmax'] - extent['xmin']  # one scene unit per projected metre
project = Transformer.from_crs(4326, 5514, always_xy=True)

def uv(lon, lat):
    x, y = project.transform(lon, lat)
    return ((x-extent['xmin'])/(extent['xmax']-extent['xmin']),
            (extent['ymax']-y)/(extent['ymax']-extent['ymin']))

def pixels(points):
    return [(u*(N-1), v*(N-1)) for u,v in points]

root = ET.parse(OUT/'osm-source.xml').getroot()
nodes = {e.get('id'): uv(float(e.get('lon')),float(e.get('lat'))) for e in root.findall('node')}
ways = {e.get('id'): e for e in root.findall('way')}
tags = lambda e: {t.get('k'):t.get('v') for t in e.findall('tag')}

def stitch(parts):
    rings=[]
    while parts:
        chain=parts.pop(0)[:]
        while chain[0] != chain[-1]:
            for i,p in enumerate(parts):
                if chain[-1]==p[0]: chain += p[1:]; parts.pop(i); break
                if chain[-1]==p[-1]: chain += p[-2::-1]; parts.pop(i); break
                if chain[0]==p[-1]: chain = p[:-1]+chain; parts.pop(i); break
                if chain[0]==p[0]: chain = p[:0:-1]+chain; parts.pop(i); break
            else: break
        if len(chain)>3 and chain[0]==chain[-1] and all(n in nodes for n in chain):
            rings.append([nodes[n] for n in chain])
    return rings

def geometry(e):
    if e.tag=='way':
        return stitch([[n.get('ref') for n in e.findall('nd')]]), []
    outer=[]; inner=[]
    for m in e.findall('member'):
        if m.get('type')=='way' and m.get('ref') in ways:
            (inner if m.get('role')=='inner' else outer).append([n.get('ref') for n in ways[m.get('ref')].findall('nd')])
    return stitch(outer),stitch(inner)

features=[]; roads=[]
for e in [*root.findall('way'),*root.findall('relation')]:
    t=tags(e); land=t.get('landuse'); natural=t.get('natural')
    kind = 1 if natural=='water' else 3 if land=='forest' or natural=='wood' else 4 if land=='farmland' else 5 if land in ('meadow','grass','orchard') else 6 if land in ('residential','farmyard') else 0
    if t.get('name')=='Škaredý': kind=2
    if kind:
        outer,inner=geometry(e)
        if outer: features.append(dict(kind=kind,name=t.get('name',''),osm=f"{e.tag}/{e.get('id')}",outer=outer,inner=inner))
    if e.tag=='way' and t.get('highway') in ('unclassified','residential','track','path','service','tertiary'):
        points=[nodes[n.get('ref')] for n in e.findall('nd') if n.get('ref') in nodes]
        if len(points)>1: roads.append(points)

classes=Image.new('L',(N,N),5); ids=Image.new('L',(N,N),0)
ponds=[]
for kind in (5,4,6,3,1,2):
    for f in [f for f in features if f['kind']==kind]:
        mask=Image.new('L',(N,N),0); d=ImageDraw.Draw(mask)
        for ring in f['outer']: d.polygon(pixels(ring),fill=255)
        for ring in f['inner']: d.polygon(pixels(ring),fill=0)
        if not mask.getbbox(): continue
        classes.paste(kind,mask=mask)
        if kind in (1,2):
            a=np.array(mask)>0
            heights=np.fromfile(ROOT/'assets/terrain/sudomer_dmr5g.f32le',dtype='<f4').reshape(385,385)
            ys,xs=np.nonzero(a)
            h=float(np.median(heights[(ys*384/(N-1)).astype(int),(xs*384/(N-1)).astype(int)]))
            pid=len(ponds)+1
            ponds.append(dict(id=pid,name=f['name'],source=f['osm'],height=h,drained=kind==2))
            ids.paste(pid,mask=mask)
roads_mask=Image.new('L',(N,N),0); d=ImageDraw.Draw(roads_mask)
for r in roads: d.line(pixels(r),fill=255,width=4,joint='curve')
c=np.array(classes); p=np.array(ids); r=np.array(roads_mask)
r[np.isin(c,[1,2])]=0
# Each parcel gets its own row direction from its longest geometric axis.
y,x=np.mgrid[0:N,0:N]
strips=np.zeros((N,N),dtype='uint8')
angles=np.zeros_like(strips); phases=np.zeros_like(strips); balks=np.zeros_like(strips)
for fi,f in enumerate(features):
    if f['kind']!=4: continue
    mask=Image.new('L',(N,N),0); d=ImageDraw.Draw(mask)
    for ring in f['outer']: d.polygon(pixels(ring),fill=255)
    for ring in f['inner']: d.polygon(pixels(ring),fill=0)
    active=(np.array(mask)>0)&(c==4)
    pts=np.array(f['outer'][0])
    _,vectors=np.linalg.eigh(np.cov(pts.T))
    dx,dy=vectors[:,-1]
    angle=float(np.arctan2(dy,dx)%(2*np.pi))
    across=-dy*x+dx*y+1.5*np.sin(x*.018+y*.021)
    strip_width=20+(fi%4)*4
    strips[active]=((np.floor(across/strip_width)+fi*7)%250).astype('uint8')[active]
    angles[active]=round(angle/(2*np.pi)*255)
    phases[active]=(((across%2.7)/2.7)*255).astype('uint8')[active]
    balks[active]=(((across%strip_width)/strip_width)*255).astype('uint8')[active]
# Signed shoreline distance, quarter-scene-unit steps capped at 6 units.
wet=Image.fromarray((np.isin(c,[1,2])*255).astype('uint8'))
dilated=wet; eroded=wet
outside=np.full((N,N),24,dtype='uint8'); inside=outside.copy()
for distance in range(1,25):
    dilated=dilated.filter(ImageFilter.MaxFilter(3))
    eroded=eroded.filter(ImageFilter.MinFilter(3))
    outside[(np.array(dilated)>0)&(outside==24)]=distance
    inside[(np.array(eroded)==0)&(inside==24)]=distance
signed=np.where(np.isin(c,[1,2]),128-inside.astype(int),128+outside.astype(int)).astype('uint8')
(OUT/'surface.rgba').write_bytes(np.stack([signed,angles,phases,balks],axis=-1).tobytes())
packed=np.stack([c,p,r,strips],axis=-1).astype('uint8')
(OUT/'landcover.rgba').write_bytes(packed.tobytes())
Image.fromarray(packed,'RGBA').save(OUT/'landcover-data.png')
# Flat, labelled GIS plan for image generation and source alignment inspection.
palette=np.array([[140,143,100],[87,125,126],[119,105,79],[64,86,60],[184,162,109],[135,149,102],[180,153,119]],dtype=np.uint8)
rgb=palette[c].astype(float)
field=c==4
for k,col in enumerate([(178,158,110),(148,149,94),(168,137,92),(193,172,124),(122,139,91)]):
 rgb[field & (strips%5==k)]=col
rgb[r>0]=[208,190,144]
plan=Image.fromarray(rgb.astype('uint8')).resize((1538,1538))
d=ImageDraw.Draw(plan)
try: font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',23)
except OSError: font=ImageFont.load_default()
labels=[]
for e in root.findall('node'):
 t=tags(e)
 if t.get('place')=='village' and t.get('name')=='Sudoměř': labels.append(('Sudoměř',*nodes[e.get('id')]))
for f in features:
 if f['name'] in ('Škaredý','Markovec u Žižky','Prostřední rybník','Velký Markovec'):
  pts=f['outer'][0]; labels.append((f['name'],float(np.mean([q[0] for q in pts])),float(np.mean([q[1] for q in pts]))))
labels.append(('Battlefield',*uv(*meta['memorial_reference_wgs84'])))
for name,u,v in labels:
 if 0<u<1 and 0<v<1:
  d.text((u*1538,v*1538),name,fill='white',stroke_width=3,stroke_fill='#343b2d',font=font,anchor='mm')
plan.save(OUT/'geographic-plan.png')
(OUT/'layout.json').write_text(json.dumps(dict(extent=extent,size=SIZE,raster_size=N,ponds=ponds,labels=labels,features=features,roads=roads),ensure_ascii=False,indent=2)+'\n')
# Exact polygon water/bed surfaces avoid stair-step raster coastlines. Delaunay
# triangles are clipped back to each source polygon; area is checked afterwards.
triangles=[]
for pond in ponds:
    f=next(f for f in features if f['osm']==pond['source'])
    outer=unary_union([Polygon(r) for r in f['outer']])
    holes=unary_union([Polygon(r) for r in f['inner']])
    poly=outer.difference(holes).intersection(box(0,0,1,1)).buffer(0)
    covered=0.0
    for tri in triangulate(poly):
        cut=tri.intersection(poly)
        parts=list(cut.geoms) if hasattr(cut,'geoms') else [cut]
        for part in parts:
            if part.geom_type!='Polygon' or part.area<1e-12: continue
            for t in triangulate(part):
                if not part.covers(t): continue
                covered+=t.area
                coords=list(t.exterior.coords)[:3]
                # x-east,z-south: clockwise x/z winding faces upward in Bevy.
                aa,bb,cc=coords
                if (bb[0]-aa[0])*(cc[1]-aa[1])-(bb[1]-aa[1])*(cc[0]-aa[0])>0: coords.reverse()
                for u,v in coords: triangles.append([(u-.5)*SIZE,(v-.5)*SIZE,float(pond['id'])])
    assert abs(covered-poly.area)<1e-8,(pond['name'],covered,poly.area)
(OUT/'pond-triangles.f32le').write_bytes(np.array(triangles,dtype='<f4').tobytes())
rs='// Generated by tools/terrain/prepare_sudomer_landscape.py.\n'
rs+='pub const POND_TRIANGLES: &[u8] = include_bytes!("../../assets/terrain/sudomer/pond-triangles.f32le");\n'
rs+=f'pub const WORLD_SIZE_METRES: f32 = {SIZE:.6f};\n'
rs+=f'pub const MAP_N: usize = {N};\n'
rs+='pub const POND_DRAINED: &[bool] = &[false, '+', '.join(str(p['drained']).lower() for p in ponds)+'];\n'
rs+='pub const POND_HEIGHTS: &[f32] = &[0.0, '+', '.join(f'{p["height"]:.6f}' for p in ponds)+'];\n'
rs+='pub const SURFACE: &[u8] = include_bytes!("../../assets/terrain/sudomer/surface.rgba");\n'
rs+='pub const LAND: &[u8] = include_bytes!("../../assets/terrain/sudomer/landcover.rgba");\n'
(ROOT/'src/sudomer/data.rs').write_text(rs)
print(json.dumps(dict(ponds=ponds,labels=labels,features=len(features),roads=len(roads)),ensure_ascii=False,indent=2))
assert len(packed.tobytes())==N*N*4
assert any(p['name']=='Škaredý' and p['drained'] for p in ponds)
assert any(p['name']=='Markovec u Žižky' for p in ponds)
assert np.count_nonzero(c==3)>0
