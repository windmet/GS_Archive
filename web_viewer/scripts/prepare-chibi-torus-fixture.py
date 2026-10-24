"""Replay the constant random-arc torus worker with actual RAW panel sources."""
import argparse,copy,hashlib,json,runpy,struct,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);uc,floats,ptr=n['uc'],n['floats'],n['ptr']
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X6,UC_ARM64_REG_X7
w=runpy.run_path(str(root/'scripts/prepare-chibi-whole-screen.py'),run_name='torus_source')
a=w['load']('torus_audit','audit-live-chibi-stage-objects.py');e=w['load']('torus_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
import UnityPy
index=json.loads((root/'public/assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
name='fx_in_pavetl_panel';entry=index['assets'][name];blob=(sources.raw_root/'asset'/entry['bundle']).read_bytes();env=UnityPy.load(blob)
dep=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'));deps={o.assets_file.name:o.assets_file for o in dep.objects}
record=a.inspect_asset(env,name,entry,True,deps);systems=[]
for particle in record['particles']:
 source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']}
 renderer=next(o for o in env.objects if str(o.path_id)==particle['renderer']['pathId']).read_typetree()
 assert renderer['m_Flip']==renderer['m_Pivot']==dict(x=0,y=0,z=0)
 systems.append(dict(source=source,chain=particle['transformChain'],shape=particle['modules']['ShapeModule'],alignment=particle['renderer']['alignment'],sizeBounds=[renderer['m_MinParticleSize'],renderer['m_MaxParticleSize']]))
 assert systems[-1]['sizeBounds']==[0,50]
models={name:dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems)}
source_shape=next(s['shape'] for s in systems if s['shape']['type']==17)

def draws(seed):
 states=[seed[i:i+4] for i in range(0,16,4)];samples=[]
 for _ in range(3):
  a,b,c,d=states;t=[(x^(x<<11))&0xffffffff for x in a]
  result=[(d[i]^(d[i]>>19)^t[i]^(t[i]>>8))&0xffffffff for i in range(4)]
  states=[b,c,d,result];samples.append([(v&0x7fffff)/8388608 for v in result])
 return samples,[v for row in states for v in row]

def replay(shape,seed):
 module,particles,speed,mat=0x20a0000,0x20a1000,0x20a2000,0x20a3000
 for address in [module,particles,speed,mat]:uc.mem_write(address,bytes(0x1000))
 for offset in range(0,0x780,0x20):ptr(particles+offset,0x20c0000+offset*8);floats(0x20c0000+offset*8,[0]*8)
 ptr(particles+0x10,4);floats(speed,[1]*16)
 scale=shape['m_Scale'];floats(mat,[scale['x'],0,0,0,0,scale['y'],0,0,0,0,scale['z'],0,0,0,0,1]);floats(mat+0x100,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
 floats(module+0x10,[shape['radius']['value']]);floats(module+0x50,[shape['radiusThickness'],shape['donutRadius']]);floats(module+0x68,[shape['arc']['value'],0,0])
 uc.mem_write(module+0x230,struct.pack('<16I',*seed));uc.reg_write(UC_ARM64_REG_X7,0)
 raw_directions=[]
 def observe(uc,address,size,user):raw_directions.append(struct.unpack('<12f',uc.mem_read(uc.reg_read(UC_ARM64_REG_X6),48)))
 hook=uc.hook_add(UC_HOOK_CODE,observe,begin=0x8611d8,end=0x8611d8)
 try:n['execute'](0x861c50,[module,particles,speed,speed,mat,mat+0x100,0])
 finally:uc.hook_del(hook)
 assert len(raw_directions)==1
 expected=[]
 for lane in range(4):
  read=lambda offset:struct.unpack('<f',uc.mem_read(0x20c0000+offset*8+lane*4,4))[0]
  expected.append(dict(position=[read(o) for o in [0,0x20,0x40]],direction=[read(o) for o in [0x60,0x80,0xa0]],rawDirection=[raw_directions[0][axis*4+lane] for axis in range(3)]))
 return expected,list(struct.unpack('<16I',uc.mem_read(module+0x230,64)))

variants=[source_shape]
for radius,tube,thickness,arc,scale in [(2,.8,0,180,[1,1,1]),(.5,.1,.25,90,[2,.7,3]),(1,.3,.8,270,[1,2,.5]),(0,.5,1,360,[1,1,1]),(2,0,1,360,[1,1,1])]:
 shape=copy.deepcopy(source_shape);shape['radius']['value']=radius;shape['donutRadius']=tube;shape['radiusThickness']=thickness;shape['arc']['value']=arc;shape['m_Scale']=dict(zip('xyz',scale));variants.append(shape)
seeds=[[0]*16]+[[(base+i*0x13782103)&0xffffffff for i in range(16)] for base in [0x12345678,0xdeadbeef,0x87654321,0x7fffffff]]
cases=[]
for variant,shape in enumerate(variants):
 for seed in seeds:
  randoms,final=draws(seed);expected,native_final=replay(shape,seed);assert final==native_final,'Native RNG draw count/order changed'
  cases.append(dict(variant=variant,shape=shape,seed=seed,uniforms=[[r[lane] for r in randoms] for lane in range(4)],finalState=final,expected=expected))
windows=[]
for address,length in [(0x856a10,64),(0x861c50,256),(0x8611d8,128)]:
 raw=bytes(uc.mem_read(address,length));windows.append(dict(address=hex(address),bytes=raw.hex(),sha256=hashlib.sha256(raw).hexdigest()))
proof=dict(schemaVersion=1,binarySha256=n['identity'],function='0x861c50',moduleFields=dict(radius='0x10',radiusThickness='0x50',donutRadius='0x54',arc='0x68',spread='0x70',rng='0x230'),sourceWindows=windows,models=models,cases=cases,
 boundary='Actual worker and direction/position helper execute. Controlled 4-lane RNG states and three draws, constant random arc, zero spread/extra random direction/position and no texture sampling. Raw worker directions are observed before the helper; final helper vectors retain the injected matrix scale. This is not a native caller-matrix reconstruction or moving-torus admission. Source-bound zero-speed admission; synthetic variants do not expand it. Web RNG/birth clock are not replaced or claimed native-equivalent.')
target=root/'scripts/fixtures/chibi-torus-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Native torus source/replay changed'
print(json.dumps(dict(assets=1,sourceSystems=len(systems),torusSystems=sum(s['shape']['type']==17 for s in systems),batches=len(cases),particles=len(cases)*4)))
