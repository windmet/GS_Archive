import sys,struct,json,argparse,hashlib,math
parser=argparse.ArgumentParser(description='Replay local Unity AArch64 Noise kernel; Unicorn is an optional local analysis dependency.')
parser.add_argument('--native-engine',required=True)
parser.add_argument('--unicorn-path')
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
from pathlib import Path
if args.unicorn_path:sys.path.insert(0,args.unicorn_path)
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_SP,UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X2,UC_ARM64_REG_X3,UC_ARM64_REG_X4,UC_ARM64_REG_X5,UC_ARM64_REG_X6,UC_ARM64_REG_X8,UC_ARM64_REG_X30,UC_ARM64_REG_PC,UC_ARM64_REG_S0,UC_ARM64_REG_S1,UC_ARM64_REG_CPACR_EL1
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
def floats(a,v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def ptr(a,v):uc.mem_write(a,struct.pack('<Q',v))
def execute(address,args):
 for r,v in zip([UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X2,UC_ARM64_REG_X3,UC_ARM64_REG_X4,UC_ARM64_REG_X5,UC_ARM64_REG_X6],args):uc.reg_write(r,v)
 uc.reg_write(UC_ARM64_REG_X30,0x2004000)
 uc.emu_start(address,0x2004000,count=100000)
 assert uc.reg_read(UC_ARM64_REG_PC)==0x2004000,'Trajectory replay did not return'
def powf_hook(uc,address,size,user):
 # The ELF imports libm powf. Supply only this external C ABI function, leaving
 # all Noise, ClampVelocity and position integration instructions untouched.
 a=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S0)))[0]
 b=struct.unpack('<f',struct.pack('<I',uc.reg_read(UC_ARM64_REG_S1)))[0]
 uc.reg_write(UC_ARM64_REG_S0,struct.unpack('<I',struct.pack('<f',math.pow(a,b)))[0])
 uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_X30))
uc.hook_add(UC_HOOK_CODE,powf_hook,begin=0x1aed80,end=0x1aed80)
def trajectory(c):
 config,engine,main,modules,count,dtbuf,clamp=0x2060000,0x2061000,0x2062000,0x2063000,0x2065000,0x2066000,0x2068000
 particles=0x2030000
 for a in [config,engine,main,modules,clamp]:uc.mem_write(a,bytes(0x2000 if a==modules else 0x1000))
 ptr(config,engine);ptr(config+8,main);ptr(engine+0x50,modules)
 p=c['point'];v=c['velocity']
 if c['limit']:floats(clamp+0x7c,[c['limit']['speed']]);floats(clamp+0xb4,[c['limit']['dampen']])
 for step in range(c['steps']):
  worker(p,c['frequency'],c['offset'],(c['phase']+(step+1)*c['dt'])*c['scrollSpeed'],c['strength'],True)
  ptr(count,4);ptr(particles+16,4);floats(dtbuf,[c['dt']]*4)
  for j in range(3):
   a=0x2054000+j*0x100;ptr(particles+0x60+j*0x20,a);floats(a,[v[j]]*4)
   a=0x2051000+j*0x100;nv=struct.unpack('<f',uc.mem_read(a,4))[0];floats(a,[nv+c['animatedVelocity'][j]]*4)
  ptr(particles+0x3e0,0x2057000);floats(0x2057000,[0]*4)
  if c['limit']:execute(0x6f8e28,[clamp,main,0,particles,0,4,dtbuf])
  execute(0x6d1e9c,[config,particles,0,count,dtbuf,0])
  assert struct.unpack('<Q',uc.mem_read(count,8))[0]==4,'Synthetic particles unexpectedly retired'
  p=[struct.unpack('<f',uc.mem_read(0x2050000+j*0x100,4))[0] for j in range(3)]
  v=[struct.unpack('<f',uc.mem_read(0x2054000+j*0x100,4))[0] for j in range(3)]
 return dict(position=p,velocity=v)
trajectoryCases=[]
for p,v in [([.1,.2,.3],[1,2,3]),([-1,.7,2],[30,0,0])]:
 for limit in [None,dict(speed=1,dampen=.1)]:
  for steps in [1,10,60]:
   c=dict(point=p,velocity=v,animatedVelocity=[.1,-.2,.3],frequency=.5,offset=[.1,.2,.3],phase=.7,scrollSpeed=1,strength=1,dt=1/60,steps=steps,limit=limit)
   trajectoryCases.append({**c,'expected':trajectory(c)})
proof=dict(schemaVersion=1,binarySha256=identity,gradientFunction='0x8406ec',workerFunction='0x85444c',sourceBoundary='High quality, one octave, shared constant strength, remap off, positionAmount=1, rotation/size=0; direct AArch64 CPU replay, not a game scene replay',gradientTable=list(struct.unpack_from('<48f',binary,0xdf7fc0)),permutation=list(struct.unpack_from('<256I',binary,0xdf8134)),gradientCases=gradientCases,workerCases=workerCases)
proof['trajectoryProof']=dict(integrateFunction='0x6d1e9c',clampFunction='0x6f8e28',externalCAbi=dict(powf='0x1aed80: host pow rounded to float32'),cases=trajectoryCases)
path=Path(__file__).parent/'fixtures/chibi-noise-kernel-native.json'
rendered=json.dumps(proof,ensure_ascii=False,indent=2)+'\n'
if args.write:path.write_text(rendered,encoding='utf8')
else:assert json.loads(path.read_text(encoding='utf8'))==json.loads(rendered),'Native replay fixture mismatch'
print(f'Native Noise replay: {len(gradientCases)} derivative, {len(workerCases)} worker and {len(trajectoryCases)} trajectory cases match')
