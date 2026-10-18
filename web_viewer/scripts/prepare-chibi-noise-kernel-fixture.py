import sys,struct,json,argparse,hashlib
parser=argparse.ArgumentParser(description='Replay local Unity AArch64 Noise kernel; Unicorn is an optional local analysis dependency.')
parser.add_argument('--native-engine',required=True)
parser.add_argument('--unicorn-path')
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
from pathlib import Path
if args.unicorn_path:sys.path.insert(0,args.unicorn_path)
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM
from unicorn.arm64_const import UC_ARM64_REG_SP,UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X8,UC_ARM64_REG_X30,UC_ARM64_REG_PC,UC_ARM64_REG_CPACR_EL1
binary=Path(args.native_engine).read_bytes()
identity=hashlib.sha256(binary).hexdigest()
assert identity=='acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0', 'Unexpected Unity binary'
uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
uc.mem_map(0x100000,0x1400000)
phoff=struct.unpack_from('<Q',binary,0x20)[0]
ents,num=struct.unpack_from('<HH',binary,0x36)
for j in range(num):
 p=struct.unpack_from('<IIQQQQQQ',binary,phoff+j*ents)
 if p[0]==1:uc.mem_write(0x100000+p[3],binary[p[2]:p[2]+p[5]])
uc.mem_map(0x2000000,0x100000)
uc.reg_write(UC_ARM64_REG_SP,0x200f000)
uc.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20)
def sample(point,freq=1):
 uc.mem_write(0x2001000,struct.pack('<12f',*(v for x in point for v in [x]*4)))
 uc.mem_write(0x2002000,struct.pack('<4f',*[freq]*4))
 for r,v in [(UC_ARM64_REG_X8,0x2003000),(UC_ARM64_REG_X0,0x2001000),(UC_ARM64_REG_X1,0x2002000),(UC_ARM64_REG_X30,0x2004000)]:uc.reg_write(r,v)
 uc.emu_start(0x8406ec,0x2004000,count=10000)
 assert uc.reg_read(UC_ARM64_REG_PC)==0x2004000,'Derivative replay did not return'
 return struct.unpack('<8f',uc.mem_read(0x2003000,32))[::4]
points=[(0,0,0),(.1,.2,.3),(-.1,1.2,2.3),(4.5,-2.7,.001)]
def worker(point,freq,offset,scroll,strength,damping):
 module,particles,task=0x2020000,0x2030000,0x2040000
 uc.mem_write(module,bytes(0x200))
 uc.mem_write(particles,bytes(0x800))
 uc.mem_write(task,bytes(0x40))
 def floats(addr,values):uc.mem_write(addr,struct.pack('<'+'f'*len(values),*values))
 def ptr(addr,val):uc.mem_write(addr,struct.pack('<Q',val))
 # Constant strength, clamped frequency, separateAxes/remap off, positionAmount=1.
 floats(module+0x1c,[strength]);floats(module+0x3c,[strength]);floats(module+0x5c,[strength]);floats(module+0x70,[freq]);uc.mem_write(module+0x75,bytes([int(damping)]))
 floats(module+0x170,[scroll]);floats(module+0x11c,[1])
 for j in range(3):
  pos=0x2050000+j*0x100
  floats(pos,[point[j]]*4);ptr(particles+j*0x20,pos)
  out=0x2051000+j*0x100
  floats(out,[0]*4);ptr(particles+0xc0+j*0x20,out)
 for member,address in [(0x380,0x2052000),(0x3c0,0x2053000)]:
  ptr(particles+member,address);uc.mem_write(address,bytes(16))
 for off,value in [(0,module),(8,particles),(16,0),(24,4)]:ptr(task+off,value)
 floats(task+32,offset+[0])
 uc.reg_write(UC_ARM64_REG_X0,task);uc.reg_write(UC_ARM64_REG_X30,0x2004000)
 uc.emu_start(0x85444c,0x2004000,count=100000)
 assert uc.reg_read(UC_ARM64_REG_PC)==0x2004000,'Noise worker replay did not return'
 return [struct.unpack('<f',uc.mem_read(0x2051000+j*0x100,4))[0] for j in range(3)]

gradientCases=[dict(point=p,frequency=f,expected=sample(p,f)) for p in points for f in [1,.5,.1]]
workerCases=[dict(point=p,frequency=f,offset=o,scroll=s,strength=.2,damping=d,expected=worker(p,f,o,s,.2,d)) for p in points for f in [1,.5,.1] for o,s in [([0,0,0],0),([.1,.2,.3],.7)] for d in [False,True]]
proof=dict(schemaVersion=1,binarySha256=identity,gradientFunction='0x8406ec',workerFunction='0x85444c',sourceBoundary='High quality, one octave, shared constant strength, remap off, positionAmount=1, rotation/size=0; direct AArch64 CPU replay, not a game scene replay',gradientTable=list(struct.unpack_from('<48f',binary,0xdf7fc0)),permutation=list(struct.unpack_from('<256I',binary,0xdf8134)),gradientCases=gradientCases,workerCases=workerCases)
path=Path(__file__).parent/'fixtures/chibi-noise-kernel-native.json'
rendered=json.dumps(proof,ensure_ascii=False,indent=2)+'\n'
if args.write:path.write_text(rendered,encoding='utf8')
else:assert json.loads(path.read_text(encoding='utf8'))==json.loads(rendered),'Native replay fixture mismatch'
print(f'Native Noise replay: {len(gradientCases)} derivative and {len(workerCases)} worker cases match')
