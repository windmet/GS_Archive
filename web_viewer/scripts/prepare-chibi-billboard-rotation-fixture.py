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

def vertices(angles,rotation3d):
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
    function=0x81beac if rotation3d else 0x81e2e0
    execute(function,[out,context,params,modules,particles,scratch])
    result=[]
    for i in range(4):
        values=struct.unpack('<9f',uc.mem_read(out+i*36,36))
        result.append(dict(position=list(values[:3]),uv=list(values[7:])))
    assert all(math.isfinite(v) for row in result for values in row.values() for v in values)
    return result

cases=[]
for rotation3d,angles in [(False,[0,0,a]) for a in [0,.5,-.5,math.pi/2]]+[(True,a) for a in [[0,0,0],[.4,0,0],[0,.5,0],[0,0,.6],[.4,.5,.6]]]:
    expected=vertices(angles,rotation3d)
    dx=expected[1]['position'][0]-expected[0]['position'][0]
    dy=expected[1]['position'][1]-expected[0]['position'][1]
    cases.append(dict(rotation3d=rotation3d,angles=angles,expected=expected,screenRightAxisAngle=math.atan2(-dy,dx)))
uc.hook_del(hook)
assert cases[1]['screenRightAxisAngle']>0 and cases[2]['screenRightAxisAngle']<0
windows=[]
for address in [0x809088,0x81e2e0,0x81beac]:
    payload=bytes(uc.mem_read(address,128))
    windows.append(dict(address=hex(address),bytes=payload.hex(),sha256=hashlib.sha256(payload).hexdigest()))
proof=dict(schemaVersion=1,binarySha256=native['identity'],functions=dict(dispatch='0x809088',billboard2d='0x81e2e0',billboard3d='0x81beac'),rotationOffsets=['0x1e0','0x200','0x220'],sourceWindows=windows,
    boundary='Direct native vertices and UVs with synthetic identity camera/emitter context, size2, no pivot/flip. Only free(NULL) is adapted. Does not replay initial-module conversion, angular integration, scene frames, or prove other alignment modes. Screen Y is negated only when interpreting the returned world-space vertices.',cases=cases)
target=root/'scripts/fixtures/chibi-billboard-rotation-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf-8')
else:assert json.loads(target.read_text(encoding='utf-8'))==proof,'Native billboard angle evidence drift'
print(json.dumps(dict(cases=len(cases),positiveHalfRadianScreenAngle=cases[1]['screenRightAxisAngle'])))
