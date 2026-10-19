"""Execute IL2CPP RotateSprite mesh math with explicit libm/mesh-output adapters."""
import argparse,hashlib,json,math,struct,sys,runpy
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-elf',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true')
a=p.parse_args()
if a.unicorn_path:sys.path.insert(0,a.unicorn_path)
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_SP,UC_ARM64_REG_CPACR_EL1,UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X30,UC_ARM64_REG_PC,UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2
binary=Path(a.native_elf).read_bytes();identity=hashlib.sha256(binary).hexdigest()
assert identity=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM);uc.mem_map(0,0x4800000);uc.mem_map(0x5000000,0x100000)
phoff=struct.unpack_from('<Q',binary,32)[0];ents,num=struct.unpack_from('<HH',binary,54)
for i in range(num):
    h=struct.unpack_from('<IIQQQQQQ',binary,phoff+i*ents)
    if h[0]==1:uc.mem_write(h[3],binary[h[2]:h[2]+h[5]])
# This decrypted ELF retains symbols but strips the original PLT relocation
# mapping. External math identities below remain explicit adapter assumptions.
sys.path.insert(0,str(Path(__file__).parent))
effects=runpy.run_path(str(Path(__file__).with_name('prepare-live-chibi-stage-effects.py')),run_name='logo_kernel_source')
import UnityPy
sources=effects['load_archive_sources'](None);unity_data=effects['read_unity_data'](sources.xapk_file)
env=UnityPy.load(unity_data)
sprite=next(o for o in env.objects if o.assets_file.name=='resources.assets' and o.path_id==1832)
tree=sprite.read_typetree();vertex=tree['m_RD']['m_VertexData']
assert vertex['m_VertexCount']==4 and vertex['m_Channels'][0]==dict(stream=0,offset=0,format=0,dimension=3)
sprite_vertices=struct.unpack('<12f',vertex['m_DataSize'][:48])
assert sprite_vertices==(-6,4,0,6,4,0,-6,-4,0,6,-4,0)
sprite_uvq=[v for x,y,z in zip(sprite_vertices[::3],sprite_vertices[1::3],sprite_vertices[2::3]) for v in [(100*x+600)/1200,(100*y+400)/800,1]]
def ptr(addr,value):uc.mem_write(addr,struct.pack('<Q',value))
def floats(addr,values):uc.mem_write(addr,struct.pack('<'+'f'*len(values),*values))
def readf(reg):return struct.unpack('<f',struct.pack('<I',uc.reg_read(reg)))[0]
def returnf(value):uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',value))[0])
def adapter(uc,address,size,user):
    if address==0x1ee0c78:
        assert uc.reg_read(UC_ARM64_REG_X0)==0x5002000
        uc.reg_write(UC_ARM64_REG_PC,0x50ff000);return
    x=readf(UC_ARM64_REG_S0)
    if address==0xcd8910:value=math.fmod(x,readf(UC_ARM64_REG_S1))
    elif address==0xcda6e0:value=math.cos(x)
    elif address==0xcd93b0:value=math.sin(x)
    else:raise AssertionError(hex(address))
    returnf(value);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_X30))
for addr in [0xcd8910,0xcda6e0,0xcd93b0,0x1ee0c78]:uc.hook_add(UC_HOOK_CODE,adapter,begin=addr,end=addr)
observed={}
def observe(uc,address,size,user):
    observed['angles' if address==0x24359b4 else 'center']=[readf(r) for r in [UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_S2]]
for addr in [0x24359b4,0x2435ab8]:uc.hook_add(UC_HOOK_CODE,observe,begin=addr,end=addr)
uc.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20)
uc.mem_write(0x466d195,bytes([1,1])) # metadata flags only, not math
ptr(0x42ed180,0x500a000);ptr(0x42cbc98,0x500b000)
ptr(0x500b000,0x500c000)
def sample(angle):
    obj,original,rotated=0x5000000,0x5001000,0x5002000
    uc.mem_write(obj,bytes(0x100));ptr(obj+0x50,original);ptr(obj+0x58,rotated);ptr(obj+0x60,0x5007000)
    floats(obj+0x38,[angle,10]);uc.mem_write(0x5007000+0x18,struct.pack('<I',5));floats(0x5007020,[0,10,0,-10,0])
    for mesh,verts,uv in [(original,0x5003000,0x5004000),(rotated,0x5005000,0x5006000)]:
        uc.mem_write(mesh,struct.pack('<Q',0)*2+struct.pack('<Q',4));ptr(mesh+0x18,verts);ptr(mesh+0x20,uv)
        uc.mem_write(verts+0x18,struct.pack('<I',4));uc.mem_write(uv+0x18,struct.pack('<I',4))
        floats(verts+0x20,sprite_vertices);floats(uv+0x20,sprite_uvq)
    uc.reg_write(UC_ARM64_REG_SP,0x50fe000);uc.reg_write(UC_ARM64_REG_X0,obj);uc.reg_write(UC_ARM64_REG_X30,0x50ff000)
    uc.emu_start(0x243595c,0x50ff000,count=100000)
    assert uc.reg_read(UC_ARM64_REG_PC)==0x50ff000,'Native RotateSprite did not reach mesh output'
    return dict(angle=angle,intermediate=dict(observed),vertices=list(struct.unpack('<12f',uc.mem_read(0x5005020,48))),uvq=list(struct.unpack('<12f',uc.mem_read(0x5006020,48))))
cases=[sample(angle) for angle in [0,15,45,75,89,90,91,105,135,165,180,225,270,315,345,360,-45,405]]
proof=dict(binarySha256=identity,sprite=dict(unityDataSha256=hashlib.sha256(unity_data).hexdigest(),pathId='1832',sha256=hashlib.sha256(sprite.get_raw_data()).hexdigest(),vertices=list(sprite_vertices),uvq=sprite_uvq,uvTransform=tree['m_RD']['uvTransform']),boundary='RAW Sprite vertex order; UV3 derived from RAW uvTransform. Original Rotate, CalcAngles, CalcRotatedMeshCenter, Math.Sign and Vector3 magnitude execute. External math adapters at 0xcd8910/0xcda6e0/0xcd93b0 assume fmodf/cosf/sinf from caller semantics; decrypted ELF strips original PLT relocation mapping, so these identities are not independently proved. Host libm outputs round to float32. MeshGeometry.Apply is the output boundary. Metadata flags/objects initialized without managed runtime. No Animator, scene or device replay.',cases=cases)
out=Path(__file__).with_name('fixtures')/'chibi-logo-kernel-native.json'
if a.write:out.write_text(json.dumps(proof,indent=2)+'\n',encoding='utf8')
else:assert json.loads(out.read_text(encoding='utf8'))==proof,'Native logo replay mismatch'
print(f'Native RotateSprite: {len(cases)} vertex/UV cases match')
