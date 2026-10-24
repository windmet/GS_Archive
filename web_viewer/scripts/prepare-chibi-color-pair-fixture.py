"""Bake actual RAW electric gradients and replay native packed ColorModule output."""
import argparse,hashlib,json,runpy,struct,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);uc,floats,ptr,execute=n['uc'],n['floats'],n['ptr'],n['execute']
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X2,UC_ARM64_REG_Q0,UC_ARM64_REG_TPIDR_EL0
w=runpy.run_path(str(root/'scripts/prepare-chibi-whole-screen.py'),run_name='color_pair_source')
a=w['load']('color_pair_audit','audit-live-chibi-stage-objects.py');e=w['load']('color_pair_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
import UnityPy
index=json.loads((root/'public/assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
name='fx_in_tktkkt_electric';entry=index['assets'][name];blob=(sources.raw_root/'asset'/entry['bundle']).read_bytes();env=UnityPy.load(blob)
dep=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'));deps={o.assets_file.name:o.assets_file for o in dep.objects}
record=a.inspect_asset(env,name,entry,True,deps);byid={str(o.path_id):o for o in env.objects}

def gradient(address,g):
 assert g['m_Mode']==0 and 1<g['m_NumColorKeys']<=8 and 1<g['m_NumAlphaKeys']<=8
 uc.mem_write(address,bytes(0x100))
 for i in range(8):
  floats(address+i*16,[g[f'key{i}'][k] for k in 'rgba'])
  uc.mem_write(address+0x80+i*2,struct.pack('<H',g[f'ctime{i}']))
  uc.mem_write(address+0x90+i*2,struct.pack('<H',g[f'atime{i}']))
 uc.mem_write(address+0xa0,bytes([g['m_NumColorKeys'],g['m_NumAlphaKeys']]))

def setup(g):
 module,maximum,minimum,cache=0x20a0000,0x20a1000,0x20a2000,0x20a3000
 uc.mem_write(module,bytes(0x1000));gradient(maximum,g['maxGradient']);gradient(minimum,g['minGradient'])
 ptr(module+0x18,minimum);ptr(module+0x20,maximum);uc.mem_write(module+0x48,struct.pack('<H',3))
 execute(0x6bd6b0,[module+0x10,cache])
 def cached(address):
  count=struct.unpack('<I',uc.mem_read(address+0xc0,4))[0];assert 1<count<=16
  return dict(keys=[dict(time=struct.unpack('<f',uc.mem_read(address+0x40+i*4,4))[0],rgba=list(uc.mem_read(address+i*4,4))) for i in range(count)],inverseSpans=list(struct.unpack('<'+'f'*count,uc.mem_read(address+0x80,count*4))))
 return dict(max=cached(cache),min=cached(cache+0xd0))

systems=[];dormant=[]
for particle in record['particles']:
 source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']};tree=byid[particle['pathId']].read_typetree()
 if not tree['EmissionModule']['enabled']:
  assert list(particle['modules'])==['InitialModule'] and not tree['SubModule']['enabled']
  dormant.append(dict(source=source,chain=particle['transformChain'],emission=tree['EmissionModule'],subEmitters=tree['SubModule']))
 g=particle['modules'].get('ColorModule',{}).get('gradient',{})
 if g.get('minMaxState')==3:systems.append(dict(source=source,chain=particle['transformChain'],gradient=g,cache=setup(g)))
assert len(systems)==12 and len(dormant)==3 and len(record['particles'])==17
# Reject animators and custom scripts that could enable or Emit into a dormant node.
components=[]
for ob in env.objects:
 if ob.type.name!='GameObject':continue
 chain=a.transform_chain(ob)
 if not chain or chain[-1]['pathId']!=record['rootTransformChain'][-1]['pathId']:continue
 for item in ob.read_typetree()['m_Component']:
  co=a.local_object(ob,item['component']);assert co.type.name in ('Transform','ParticleSystem','ParticleSystemRenderer') or str(co.path_id)==record['keeper']['pathId']
  components.append(dict(source=a.source_ref(co),treeSha256=a.json_hash(co.read_typetree())))
models={name:dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems,nonEmitting=dormant,staticComponents=components)}

uc.reg_write(UC_ARM64_REG_TPIDR_EL0,0x20e0000)
# Native function-local constant initialization: 8 ushort rounding biases=128.
uc.mem_write(0x126bc30,b'\x01');uc.mem_write(0x126bc20,struct.pack('<8H',*([128]*8)))
observed=[]
def observe(uc,address,size,user):
 address=uc.reg_read(UC_ARM64_REG_X2);observed.append(list(struct.unpack('<4f',uc.mem_read(address,16))))
hook=uc.hook_add(UC_HOOK_CODE,observe,begin=0x6f77a8,end=0x6f77a8)

def replay(g,phases,seeds,colors):
 setup(g);particles,out=0x20b0000,0x20b1000
 uc.mem_write(particles,bytes(0x1000));ptr(particles+0x10,4);ptr(particles+0x3c0,0x20b2000);floats(0x20b2000,[v*100 for v in phases])
 ptr(particles+0x380,0x20b3000);uc.mem_write(0x20b3000,struct.pack('<4I',*seeds));uc.mem_write(out,bytes(v for row in colors for v in row));observed.clear()
 execute(0x6ea298,[0x20a0000,particles,out])
 assert len(observed)==1
 return dict(weights=observed[0],expected=[list(uc.mem_read(out+i*4,4)) for i in range(4)])

cases=[]
for system in systems:
 knots=sorted({key['time'] for cache in system['cache'].values() for key in cache['keys']})
 points=[max(0,min(1,t+d)) for t in knots for d in [-1e-7,0,1e-7]]
 groups=[[0,.1,.25,.5],[.17,.36,.547,.9],[.999,1,0,.75]]+[points[i:i+4] for i in range(0,len(points),4)]
 for phases in groups:
  phases=phases+[phases[-1]]*(4-len(phases))
  for seeds in [[0,1,2,3],[0xffffffff,0x80000000,1234567,99]]:
   colors=[[255]*4,[255,255,255,100],[80,120,160,200],[0,17,255,128]]
   cases.append(dict(source=system['source'],phases=phases,seeds=seeds,colors=colors,**replay(system['gradient'],phases,seeds,colors)))
uc.hook_del(hook)
windows=[]
for address,length in [(0x65a708,128),(0x6bd6b0,100),(0x6ea298,128),(0x6ea4d0,96),(0x6f77a8,916)]:
 payload=bytes(uc.mem_read(address,length));windows.append(dict(address=hex(address),bytes=payload.hex(),sha256=hashlib.sha256(payload).hexdigest()))
proof=dict(schemaVersion=1,binarySha256=n['identity'],models=models,cases=cases,sourceWindows=windows,cacheFunction='0x65a708',moduleFunction='0x6ea298',pairFunction='0x6f77a8',boundary='Native gradient cache baking and complete ColorModule update from actual RAW gradients, controlled seed/lifetime/color buffers. Constant rounding-bias initialization supplied; mix weights observed without replacing native math. This does not prove native birth seed allocation, scene timing, Noise, projection or device rendering.')
target=root/'scripts/fixtures/chibi-color-pair-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Color pair evidence changed'
print(json.dumps(dict(systems=len(systems),nonEmitting=len(dormant),cases=len(cases),particles=4*len(cases))))
