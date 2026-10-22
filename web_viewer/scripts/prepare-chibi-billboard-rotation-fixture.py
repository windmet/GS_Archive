"""Read-only native billboard angle audit; does not change renderer/data conventions."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import runpy
import struct
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-engine',required=True)
parser.add_argument('--unicorn-path')
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
native=runpy.run_path(str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'))
uc,ptr,floats,execute=(native[k] for k in ['uc','ptr','floats','execute'])
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0,UC_ARM64_REG_X30,UC_ARM64_REG_PC

def free_null(uc,address,size,user):
    assert uc.reg_read(UC_ARM64_REG_X0)==0,'Audit would need a real allocator'
    uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_X30))

hook=uc.hook_add(UC_HOOK_CODE,free_null,begin=0x306258,end=0x306258)

def vertices(angles,rotation3d,chain=None,alignment=0,frame=None,position=None,particleSize=None,sizeBounds=None,viewHeight=10):
    context,params,modules,particles,scratch,out=0x20a0000,0x20a1000,0x20a2000,0x20a4000,0x20a6000,0x20b0000
    for address,size in [(context,0x1000),(params,0x1000),(modules,0x2000),(particles,0x1000),(scratch,0x1000),(out,0x10000)]:uc.mem_write(address,bytes(size))
    for offset in range(0,0x780,0x20):
        address=0x20c0000+offset*8
        ptr(particles+offset,address);floats(address,[0]*8)
    ptr(particles+0x10,4)
    ptr(scratch,0x20c9000);uc.mem_write(0x20c9000,bytes([255])*16)
    for offset in [0,0x40,0x80]:floats(context+offset,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
    floats(context+0x30,[0,0,-10,1]);floats(context+0x138,[1000,1,1])
    floats(context+0x120,[1,1,1]);floats(context+0xf0,[0,0,-10]);floats(context+0xfc,[0,0,-10])
    floats(params+8,[10000])
    def field(offset,value):floats(0x20c0000+offset*8,[value]*4)
    field(0x40,1)
    for offset in [0x2a0,0x2c0,0x2e0]:field(offset,2)
    for offset,value in zip([0x1e0,0x200,0x220],angles):field(offset,value)
    uc.mem_write(particles+0x7b3,bytes([int(rotation3d)]))
    if chain is not None:
        # Execute the native Transform hierarchy and renderer context builder;
        # do not independently guess its lossy scale or quaternion inputs.
        engine,main,state,modules,ref,data,trs,parents=0x2090000,0x2091000,0x2092000,0x2093000,0x2096000,0x2097000,0x2098000,0x2099000
        for address in [engine,main,state,modules,ref,data,trs,parents]:uc.mem_write(address,bytes(0x1000))
        ptr(engine+0x40,main);ptr(engine+0x48,state);ptr(engine+0x50,modules)
        ptr(ref,data);ptr(ref+8,0);ptr(data+0x18,trs);ptr(data+0x20,parents)
        for i,t in enumerate(chain):
            floats(trs+i*48,[*[t['position'][k] for k in 'xyz'],0,*[t['rotation'][k] for k in 'xyzw'],*[t['scale'][k] for k in 'xyz'],0])
            uc.mem_write(parents+i*4,struct.pack('<i',i+1 if i+1<len(chain) else -1))
        execute(0x6cf028,[engine,0,ref,ref])
        if frame is not None:
            matrix=struct.unpack('<16f',uc.mem_read(state+0x3c,64))
            frame.update(expectedMatrix=dict(zip(['a','b','c','d','tx','ty'],[matrix[i] for i in [0,1,4,5,12,13]])),expectedParticleScale=list(struct.unpack('<3f',uc.mem_read(state+0x154,12))),expectedRotation=list(struct.unpack('<4f',uc.mem_read(state+0x7c,16))))
            if position is not None:frame['expectedFullMatrix']=list(matrix)
        renderer,camera=0x20e0000,0x20e4000
        uc.mem_write(renderer,bytes(0x1000));uc.mem_write(camera,bytes(0x1000))
        floats(renderer+0x1cc,[*(sizeBounds or [0,100]),0,0,1,0,1,0])
        uc.mem_write(renderer+0x1ec,struct.pack('<I',alignment))
        default=struct.unpack('<Q',uc.mem_read(0x11d1178,8))[0]
        uc.mem_write(modules+0x8ac,bytes(uc.mem_read(default,8)))
        floats(camera+4,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-10,1])
        uc.mem_write(camera+0x44,bytes(uc.mem_read(camera+4,64)))
        floats(camera+0xd4,[0,0,1]);floats(camera+0xe0,[viewHeight,1,1]);uc.mem_write(camera+0xec,bytes([1]))
        execute(0x6c505c,[renderer,engine,camera,0,context,params,0])
        field(0x40,0)
    if position is not None:
        for offset,value in zip([0,0x20,0x40],position):field(offset,value)
    if particleSize is not None:
        assert not rotation3d,'Nonuniform 3D rotation needs independent native proof'
        uc.mem_write(particles+0x7b4,bytes([1]))
        for offset,value in zip([0x2a0,0x2c0,0x2e0],particleSize):field(offset,value)
    function=0x81beac if rotation3d else 0x81e2e0
    if particleSize is not None:function=0x815a1c
    execute(function,[out,context,params,modules,particles,scratch])
    result=[]
    for i in range(4):
        values=struct.unpack('<9f',uc.mem_read(out+i*36,36))
        result.append(dict(position=list(values[:3]),uv=list(values[7:])))
    assert all(math.isfinite(v) for row in result for values in row.values() for v in values)
    assert [row['uv'] for row in result]==[[0,1],[1,1],[1,0],[0,0]],'Native UV corner order changed'
    return result

cases=[]
for rotation3d,angles in [(False,[0,0,a]) for a in [0,.5,-.5,math.pi/2]]+[(True,a) for a in [[0,0,0],[.4,0,0],[0,.5,0],[0,0,.6],[.4,.5,.6]]]:
    expected=vertices(angles,rotation3d)
    dx=expected[1]['position'][0]-expected[0]['position'][0]
    dy=expected[1]['position'][1]-expected[0]['position'][1]
    cases.append(dict(rotation3d=rotation3d,angles=angles,expected=expected,screenRightAxisAngle=math.atan2(-dy,dx)))
parent_cases=[]
chains=[c['chain'] for c in native['proof']['scalingProof']['cases'] if c['scalingMode']==0]
def transform(angle,scale):
    return dict(position=dict(x=0,y=0,z=0),rotation=dict(x=0,y=0,z=math.sin(angle/2),w=math.cos(angle/2)),scale=dict(zip('xyz',scale)))
for scale in [(2,-3,1),(2,3,-1),(-2,-3,1)]:
    chains.append([transform(.5,(1,1,1)),transform(.3,scale)])
for chain in chains:
    for alignment in [0,2]:
        for rotation3d in [False,True]:
            angles=[.4,.5,.6] if rotation3d else [0,0,.5]
            case=dict(chain=chain,alignment=alignment,rotation3d=rotation3d,angles=angles)
            case['expected']=vertices(angles,rotation3d,chain,alignment,case)
            parent_cases.append(case)
models=json.loads((root/'public/data/stage-object-emitters.json').read_text(encoding='utf-8'))
for name,model in models['assets'].items():
    for system in model['systems']:
        if not system.get('rotationX'):continue
        case=dict(asset=name,source=system['source'],bundleSha256=model['bundleSha256'],chain=system['chain'],alignment=system['alignment'],rotation3d=True,angles=[.4,.5,.6])
        case['expected']=vertices(case['angles'],True,case['chain'],case['alignment'],case)
        parent_cases.append(case)
uc.hook_del(hook)
assert cases[1]['screenRightAxisAngle']>0 and cases[2]['screenRightAxisAngle']<0
windows=[]
for address in [0x809088,0x81e2e0,0x81beac,0x6cf028,0x6c505c]:
    payload=bytes(uc.mem_read(address,128))
    windows.append(dict(address=hex(address),bytes=payload.hex(),sha256=hashlib.sha256(payload).hexdigest()))
proof=dict(schemaVersion=1,binarySha256=native['identity'],functions=dict(dispatch='0x809088',billboard2d='0x81e2e0',billboard3d='0x81beac'),rotationOffsets=['0x1e0','0x200','0x220'],sourceWindows=windows,
    boundary='Identity camera, size2, no pivot/flip. Parent cases execute native hierarchy construction and renderer context packing for alignment0/2, including source-bound parents with controlled particle angles. Only free(NULL) is adapted. Does not replay initial-module conversion, angular integration, random births or scene frames. Screen Y is negated only when interpreting returned world-space vertices.',cases=cases,parentCases=parent_cases,objectIndexSha256=models['objectIndexSha256'])
target=root/'scripts/fixtures/chibi-billboard-rotation-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf-8')
else:assert json.loads(target.read_text(encoding='utf-8'))==proof,'Native billboard angle evidence drift'
print(json.dumps(dict(cases=len(cases),parentCases=len(parent_cases),positiveHalfRadianScreenAngle=cases[1]['screenRightAxisAngle'])))
