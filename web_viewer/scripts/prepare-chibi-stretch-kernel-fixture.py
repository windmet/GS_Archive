"""Replay native stretch vertices and UVs, without replacing vertex math."""
import argparse, hashlib, json, math, runpy, struct, sys
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-engine',required=True)
parser.add_argument('--unicorn-path')
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
# Reuse the provenance-checked ELF loader and ABI setup. It also verifies the
# existing Noise/transform fixture, without writing it, before this replay.
sys.argv=[str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
native=runpy.run_path(str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'))
uc,ptr,floats,execute=(native[k] for k in ['uc','ptr','floats','execute'])
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0,UC_ARM64_REG_X30,UC_ARM64_REG_PC,UC_ARM64_REG_Q0

# Execute the solver's actual FRSQRTE opcode in a two-instruction probe.
# Positive normal float32 only; special/subnormal values are outside this proof.
uc.mem_write(0x20d0000,native['binary'][0x70bb70:0x70bb74]+struct.pack('<I',0xd65f03c0))
def estimate(bits):
    uc.reg_write(UC_ARM64_REG_Q0,int.from_bytes(struct.pack('<4I',*[bits]*4),'little'))
    execute(0x20d0000,[])
    return struct.unpack('<f',(uc.reg_read(UC_ARM64_REG_Q0)&0xffffffff).to_bytes(4,'little'))[0]
def estimate_model(bits):
    exponent=(bits>>23)-127;bucket=(bits&0x7fffff)>>16
    midpoint=(1+(bucket+.5)/128)*(2 if exponent&1 else 1)
    value=math.floor(512/math.sqrt(midpoint)+.5)/512*2**(-(exponent//2))
    return struct.unpack('<f',struct.pack('<f',value))[0]
estimate_table=[]
for exponent in [127,128]:
    row=[]
    for bucket in range(128):
        bits=exponent<<23|bucket<<16
        value=estimate(bits);assert value==estimate_model(bits)
        assert estimate(bits|0xffff)==value,'Unexpected estimate bucket boundary'
        row.append(value)
    estimate_table.append(row)
seed=0x12345678
for j in range(4096):
    seed=(1664525*seed+1013904223)&0xffffffff
    bits=((1+((seed>>23)%254))<<23)|(seed&0x7fffff)
    assert estimate(bits)==estimate_model(bits),'FRSQRTE exponent/mantissa model mismatch'

def null_free(uc,address,size,user):
    assert uc.reg_read(UC_ARM64_REG_X0)==0,'Unexpected real allocation during stretch replay'
    uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_X30))
hook=uc.hook_add(UC_HOOK_CODE,null_free,begin=0x306258,end=0x306258)

def vertices(function,case):
    context,params,modules,particles,scratch,out=0x20a0000,0x20a1000,0x20a2000,0x20a4000,0x20a6000,0x20b0000
    for address,size in [(context,0x1000),(params,0x1000),(modules,0x2000),(particles,0x1000),(scratch,0x1000),(out,0x10000)]:
        uc.mem_write(address,bytes(size))
    for offset in range(0,0x780,0x20):
        address=0x20c0000+offset*8;ptr(particles+offset,address);floats(address,[0]*8)
    ptr(particles+0x10,4)
    ptr(scratch,0x20c9000);uc.mem_write(0x20c9000,bytes([255])*16)
    for offset in [0,0x40,0x80]:floats(context+offset,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
    floats(context+0x30,[0,0,-10,1]);floats(context+0x138,[1000,1,1])
    floats(context+0x120,[1,1,1]);floats(context+0xf0,[0,0,-10]);floats(context+0xfc,[0,0,-10])
    floats(params+8,[10000]) # Synthetic nonbinding screen-size cap.
    floats(params+0xc,[0,case['velocityScale'],case['lengthScale']])
    def field(offset,value):floats(0x20c0000+offset*8,[value]*4)
    for axis in range(3):
        field(axis*0x20,[0,0,1][axis])
        field(0x60+axis*0x20,case['velocity'][axis])
        field(0xc0+axis*0x20,case.get('animatedVelocity',[0,0,0])[axis])
    field(0x2a0,case['size']);field(0x2c0,case['size']);field(0x2e0,case['size'])
    field(0x3c0,case.get('rotation',0))
    if case.get('packedContext'):
        # Include the real context/compact-renderer construction, not a guessed
        # set of independent context matrices. Camera remains a synthetic input.
        renderer,engine,main,state,camera=0x20e0000,0x20e1000,0x20e2000,0x20e3000,0x20e4000
        for address in [renderer,engine,main,state,camera]:uc.mem_write(address,bytes(0x1000))
        ptr(engine+0x40,main);ptr(engine+0x48,state);ptr(engine+0x50,modules)
        uc.mem_write(renderer+0x1c8,struct.pack('<H',1))
        floats(renderer+0x1cc,[0,case.get('maxParticleSize',100),0,case['velocityScale'],case['lengthScale'],0,1,0])
        floats(renderer+0x1fc,[0,0,0]) # RAW m_Flip; never introduce random UV flips.
        default=struct.unpack('<Q',uc.mem_read(0x11d1178,8))[0]
        uc.mem_write(modules+0x8ac,bytes(uc.mem_read(default,8)))
        floats(state+0x154,case.get('particleScale',[1,1,1]))
        floats(state+0x7c,case.get('worldRotation',[0,0,0,1]))
        a,b,c,d,tx,ty=case.get('matrix',[1,0,0,1,0,0])
        floats(state+0x3c,[a,b,0,0,c,d,0,0,0,0,1,0,tx,ty,0,1])
        angle=case.get('cameraRotation',0);cos=math.cos(angle);sin=math.sin(angle)
        floats(camera+4,[cos,sin,0,0,-sin,cos,0,0,0,0,1,0,0,0,-10,1])
        floats(camera+0x44,[cos,-sin,0,0,sin,cos,0,0,0,0,1,0,0,0,10,1])
        floats(camera+0xd4,[0,0,1]);floats(camera+0xe0,[10,1,1])
        uc.mem_write(camera+0xec,bytes([1]))
        execute(0x6c505c,[renderer,engine,camera,0,context,params,0])
        field(0x40,0)
    execute(function,[out,context,params,modules,particles,scratch])
    # Fixed stream: position3, normal3, packed RGBA, UV2, four vertices per particle.
    result=[]
    for j in range(4):
        values=struct.unpack('<9f',uc.mem_read(out+j*36,36))
        result.append(dict(position=list(values[:3]),uv=list(values[7:])))
    assert all(math.isfinite(x) for v in result for field in v.values() for x in field)
    return result

inputs=[dict(name='x',velocity=[1,0,0],size=2,velocityScale=1,lengthScale=2),
    dict(name='y',velocity=[0,2,0],size=2,velocityScale=1,lengthScale=2),
    dict(name='diagonal',velocity=[3,4,0],size=2,velocityScale=.5,lengthScale=2),
    dict(name='reverse',velocity=[-1,0,0],size=1,velocityScale=0,lengthScale=3),
    dict(name='stationary',velocity=[0,0,0],size=2,velocityScale=1,lengthScale=2),
    dict(name='rotation',velocity=[1,0,0],size=2,velocityScale=1,lengthScale=2,rotation=1.57),
    dict(name='animated',velocity=[1,0,0],animatedVelocity=[0,2,0],size=2,velocityScale=.5,lengthScale=2),
    dict(name='length-zero',velocity=[0,5,0],size=1,velocityScale=.3,lengthScale=0),
    dict(name='packed-identity',velocity=[3,4,0],size=2,velocityScale=1,lengthScale=2,packedContext=True),
    dict(name='packed-scaled',velocity=[3,4,0],size=2,velocityScale=1,lengthScale=2,packedContext=True,matrix=[2,0,0,3,0,0],particleScale=[2,3,1]),
    dict(name='packed-rotated',velocity=[3,4,0],size=2,velocityScale=1,lengthScale=2,packedContext=True,matrix=[1,math.sqrt(3),-3*math.sqrt(3)/2,1.5,0,0],particleScale=[2,3,1],worldRotation=[0,0,.5,math.sqrt(3)/2]),
    dict(name='packed-clamped',velocity=[3,4,0],size=2,velocityScale=1,lengthScale=2,packedContext=True,maxParticleSize=.01)]
# Repeat all scalar inputs through real packing as well, including birth and
# animated-velocity boundaries. These are separate from the early direct context.
inputs += [{**case,'name':'packed-'+case['name'],'packedContext':True} for case in inputs[:8]]
inputs += [dict(name='packed-camera',velocity=[3,4,0],size=2,velocityScale=1,lengthScale=2,packedContext=True,matrix=[2,0,0,3,0,0],particleScale=[2,3,1],cameraRotation=.7),
    dict(name='packed-offset',velocity=[-3,2,0],size=.7,velocityScale=0,lengthScale=3,packedContext=True,matrix=[.25,0,0,.45,2,3],particleScale=[.25,.45,1]),
    dict(name='packed-fire-birth',velocity=[0,20,0],size=1.2000000476837158,velocityScale=0,lengthScale=3,packedContext=True)]
cases=[dict(function=hex(function),**case,expected=vertices(function,case)) for function in [0x80b8a4,0x817658] for case in inputs]
uc.hook_del(hook)
half=len(inputs)
assert all(a['expected']==b['expected'] for a,b in zip(cases[:half],cases[half:])),'Native normal-path variants disagree'
by_name={case['name']:case for case in cases[:half]}
assert by_name['x']['expected']==by_name['rotation']['expected'],'Classic stretch unexpectedly rotates with particle angle'
assert len({tuple(v['position']) for v in by_name['stationary']['expected']})==1,'Zero velocity must collapse this classic stretch profile'
assert [v['uv'] for v in by_name['x']['expected']]==[[0,1],[1,1],[1,0],[0,0]],'Unexpected native texture orientation'

# Read the exact eight currently marked renderer sources. No material or public export.
sys.path.insert(0,str(root/'scripts'))
effects=runpy.run_path(str(root/'scripts/prepare-live-chibi-stage-effects.py'),run_name='stretch_source_import')
sources=effects['load_archive_sources'](None)
import UnityPy
bound=json.loads((root/'scripts/fixtures/chibi-object-emitters-native.json').read_text(encoding='utf8'))
renderers=[]
for asset in bound['objects']:
    selected={p['renderer']['pathId'] for p in asset['particles'] if p['renderer']['renderMode']==1}
    if not selected:continue
    path=sources.raw_root/'asset'/asset['bundle'];blob=path.read_bytes();env=UnityPy.load(blob)
    for obj in env.objects:
        if str(obj.path_id) not in selected:continue
        tree=obj.read_typetree()
        keys=['m_RenderMode','m_RenderAlignment','m_Pivot','m_Flip','m_MinParticleSize','m_MaxParticleSize','m_CameraVelocityScale','m_VelocityScale','m_LengthScale']
        renderers.append(dict(asset=asset['asset'],bundle=asset['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),pathId=str(obj.path_id),rendererTreeSha256=hashlib.sha256(json.dumps(tree,sort_keys=True,separators=(',',':')).encode()).hexdigest(),fields={k:tree[k] for k in keys}))
proof=dict(binarySha256=native['identity'],boundary='Synthetic camera inputs: old cases use direct identity context/z=1; packedContext cases execute real 0x6c505c and 0x6c5580 before the solvers, with z=0. Scalar size, zero pivot/camera speed, fixed stream. Two real vertex solvers and real stream writer execute. Only null cleanup 0x306258 is skipped; no allocator or full scene replay.',reciprocalSqrtEstimate=dict(instructionSource='0x80bb70: frsqrte v0.4S,v0.4S copied verbatim, followed by ret',profile='positive-normal-float32',normalizedExponents=[127,128],normalizedBuckets=estimate_table,randomSeed='0x12345678',randomCases=4096,bucketEdgeCases=512),cases=cases,renderers=sorted(renderers,key=lambda r:(r['asset'],r['pathId'])))
path=root/'scripts/fixtures/chibi-stretch-kernel-native.json'
if args.write:path.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
else:assert json.loads(path.read_text(encoding='utf8'))==proof,'Native stretch replay/source fixture mismatch'
print(f'Native Stretch replay: {len(cases)} vertex/UV cases and {len(renderers)} source renderers match')
