"""Replay RAW Bloom lifetime velocity limits through native ClampVelocity/integration."""
import argparse,hashlib,json,runpy,struct,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);uc,floats,ptr,execute=n['uc'],n['floats'],n['ptr'],n['execute']
w=runpy.run_path(str(root/'scripts/prepare-chibi-whole-screen.py'),run_name='limit_curve_source')
a=w['load']('limit_curve_audit','audit-live-chibi-stage-objects.py');e=w['load']('limit_curve_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
import UnityPy
index=json.loads((root/'public/assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
dep=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'));deps={o.assets_file.name:o.assets_file for o in dep.objects}
models={}
for name in [f'fx_in_pcuslv_bloom_{i}' for i in range(1,5)]:
 entry=index['assets'][name];blob=(sources.raw_root/'asset'/entry['bundle']).read_bytes();env=UnityPy.load(blob)
 record=a.inspect_asset(env,name,entry,True,deps);systems=[]
 for particle in record['particles']:
  c=particle['modules']['ClampVelocityModule'];initial=particle['modules']['InitialModule']
  assert not c['separateAxis'] and not c['inWorldSpace'] and c['drag']['minMaxState']==0 and c['drag']['scalar']==0
  assert c['magnitude']['minMaxState'] in (0,1) and initial['gravityModifier']['scalar']==0
  assert not {'NoiseModule','VelocityModule'} & particle['modules'].keys()
  renderer=next(o for o in env.objects if str(o.path_id)==particle['renderer']['pathId']).read_typetree()
  assert renderer['m_Flip']==renderer['m_Pivot']==dict(x=0,y=0,z=0)
  size=initial['startSize'];assert size['minMaxState'] in (0,3) and not initial['size3D']
  life_size=particle['modules']['SizeModule'];assert not life_size['separateAxes']
  growth=life_size['curve'];keys=growth['maxCurve']['m_Curve'];assert growth['minMaxState']==1 and all(k['weightedMode']==0 for k in keys)
  controls=[k['value'] for k in keys]
  for x,y in zip(keys,keys[1:]):controls.extend([x['value']+x['outSlope']*(y['time']-x['time'])/3,y['value']-y['inSlope']*(y['time']-x['time'])/3])
  assert min(controls)>=0
  size_upper=max(size['scalar'],size['minScalar'] if size['minMaxState']==3 else 0)*growth['scalar']*max(controls)
  systems.append(dict(source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']},chain=particle['transformChain'],limit=c,speed=initial['startSpeed'],lifetime=initial['startLifetime'],alignment=particle['renderer']['alignment'],sizeBounds=[renderer['m_MinParticleSize'],renderer['m_MaxParticleSize']],sizeUpperBound=size_upper))
 models[name]=dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems)

def replay(source,velocity,life,steps,dt,phase_offset=0):
 clamp,main,config,engine,modules,particles=0x2068000,0x2062000,0x2060000,0x2061000,0x2063000,0x2030000
 count,dtbuf,curve=0x2065000,0x2066000,0x2080000
 for address in [clamp,main,config,engine,modules,particles,curve]:uc.mem_write(address,bytes(0x1000))
 ptr(config,engine);ptr(config+8,main);ptr(engine+0x50,modules)
 c=source['limit'];m=c['magnitude'];floats(clamp+0xb4,[c['dampen']])
 if m['minMaxState']==1:
  keys=m['maxCurve']['m_Curve'];assert len(keys)==2 and keys[0]['time']==0 and keys[1]['time']==1
  x,y=keys;assert x.get('weightedMode',0)==y.get('weightedMode',0)==0
  coeff=[2*x['value']-2*y['value']+x['outSlope']+y['inSlope'],-3*x['value']+3*y['value']-2*x['outSlope']-y['inSlope'],x['outSlope'],x['value']]
  floats(curve+0x70,[v*m['scalar'] for v in coeff]+[0,0,0,y['value']*m['scalar'],1])
  uc.mem_write(clamp+0x74,struct.pack('<H',1));uc.mem_write(clamp+0x76,b'\x01');ptr(clamp+0x88,curve)
 else:floats(clamp+0x7c,[m['scalar']])
 for j in range(3):
  for member,address,value in [(0,0x2050000+j*0x100,0),(0x60,0x2054000+j*0x100,velocity[j]),(0xc0,0x2051000+j*0x100,0)]:
   ptr(particles+member+j*0x20,address);floats(address,[value]*4)
 ptr(particles+0x3e0,0x2057000);floats(0x2057000,[0]*4)
 ptr(particles+0x3c0,0x2058000);ptr(particles+0x380,0x2059000);floats(0x2059000,[0]*4)
 trace=[]
 for step in range(steps):
  phase=phase_offset+(step+1)*dt/life
  floats(0x2058000,[phase*100]*4);floats(dtbuf,[dt]*4);ptr(count,4);ptr(particles+16,4)
  execute(0x6f8e28,[clamp,main,0,particles,0,4,dtbuf])
  execute(0x6d1e9c,[config,particles,0,count,dtbuf,0])
  assert struct.unpack('<Q',uc.mem_read(count,8))[0]==4
  trace.append(dict(phase=phase,position=[struct.unpack('<f',uc.mem_read(0x2050000+j*0x100,4))[0] for j in range(3)],velocity=[struct.unpack('<f',uc.mem_read(0x2054000+j*0x100,4))[0] for j in range(3)]))
 return trace

cases=[]
for name,model in models.items():
 for source in model['systems']:
  for velocity in [[0,0,0],[0,8,0],[2,-3,4]]:
   for life,dt,steps in [(1,1/60,60),(.7,1/30,20),(1.7,.1,12)]:
    cases.append(dict(asset=name,source=source['source'],velocity=velocity,life=life,dt=dt,steps=steps,expected=replay(source,velocity,life,steps,dt)))
windows=[]
for address,length in [(0x6f8e28,256),(0x6d1e9c,128)]:
 payload=bytes(uc.mem_read(address,length));windows.append(dict(address=hex(address),bytes=payload.hex(),sha256=hashlib.sha256(payload).hexdigest()))
choreography=(root/'public/assets/live-chibi/choreography/index.json').read_bytes();songs=json.loads(choreography)['songs'];song=next(s for s in songs if s['id']=='pcuslv_live_effect')
events=[e for e in song['objectLayerEvents'] if e['asset'] in models and not e['hide']]
envelope=dict(arrangement=song['id'],minViewHeight=10000/max(e.get('zoom') or 1000 for e in song['cameraEvents']),maxObjectScale=max(e['scale'] for e in events)/1000,stageScaleUpperBound=1000/720)
assert all(s['id']==song['id'] for s in songs if any(e['asset'] in models for e in s.get('objectLayerEvents',[])))
for model in models.values():
 for s in model['systems']:
  assert s['sizeBounds'][0]==0 and s['sizeUpperBound']*envelope['maxObjectScale']*envelope['stageScaleUpperBound']<s['sizeBounds'][1]*envelope['minViewHeight']
proof=dict(schemaVersion=1,binarySha256=n['identity'],models=models,cases=cases,sourceWindows=windows,clampFunction='0x6f8e28',integrateFunction='0x6d1e9c',agePercentOffset='0x3c0',choreographySha256=hashlib.sha256(choreography).hexdigest(),nonbindingSizeEnvelope=envelope,boundary='Actual RAW Bloom limit fields. Native ClampVelocity and integration, harness-baked two-key unweighted Hermite coefficients; explicit post-step lifetime phase, fixed dt and zero animated velocity. Does not replay curve baking, native age update/scheduling, birth RNG, parent geometry or a game scene. External powf uses the existing host float32 ABI adapter.')
target=root/'scripts/fixtures/chibi-limit-curve-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Limit curve evidence changed'
print(json.dumps(dict(assets=len(models),systems=sum(len(m['systems']) for m in models.values()),cases=len(cases),steps=sum(c['steps'] for c in cases))))
