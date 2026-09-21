"""Inspect GLB containers, referenced buffers, mesh counts and loop animation samples."""
import json
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def read_glb(path):
    data=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data),path
    json_length,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4E4F534A,path
    doc=json.loads(data[20:20+json_length])
    offset=20+json_length
    bin_length,kind=struct.unpack_from('<II',data,offset)
    assert kind==0x004E4942,path
    binary=data[offset+8:offset+8+bin_length]
    assert not any('uri' in buffer for buffer in doc['buffers']),path
    return doc,binary

def values(doc,binary,index):
    accessor=doc['accessors'][index]
    view=doc['bufferViews'][accessor['bufferView']]
    count={'SCALAR':1,'VEC3':3,'VEC4':4}[accessor['type']]
    assert accessor['componentType']==5126
    offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
    stride=view.get('byteStride',count*4)
    return [struct.unpack_from('<'+'f'*count,binary,offset+i*stride) for i in range(accessor['count'])]

for path in sorted((ROOT/'assets/models').glob('*.glb')):
    doc,binary=read_glb(path)
    assert doc.get('meshes') and doc.get('materials'),path
    for view in doc.get('bufferViews',[]):
        assert view.get('byteOffset',0)+view['byteLength']<=len(binary),path
    print(path.name,'meshes',len(doc['meshes']),'materials',len(doc['materials']), 'animations',[a.get('name') for a in doc.get('animations',[])])
    if path.stem=='cavalry':
        assert len(doc.get('animations',[]))==1,'Expected one consolidated gait clip'
        animation=doc['animations'][0]
        assert animation['name']=='HorseWalk',animation['name']
        varying=0
        for sampler in animation['samplers']:
            times=values(doc,binary,sampler['input'])
            samples=values(doc,binary,sampler['output'])
            assert abs(times[-1][0]-times[0][0]-2)<.001
            assert max(abs(a-b) for a,b in zip(samples[0],samples[-1]))<.0001,'Loop seam'
            varying+=any(max(abs(a-b) for a,b in zip(samples[0],sample))>.001 for sample in samples[1:])
        assert varying>=9,('Gait channels missing',varying)
        print('  Verified 2-second seamless loop with',varying,'varying transform channels')
