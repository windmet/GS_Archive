"""Replay source electric renderer size bounds through native uniform billboard writers."""
import argparse,hashlib,json,runpy,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');p.add_argument('--fire',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-billboard-rotation-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);uc=n['uc']
w=runpy.run_path(str(root/'scripts/prepare-chibi-whole-screen.py'),run_name='uniform_size_source');a=w['load']('uniform_size_audit','audit-live-chibi-stage-objects.py');e=w['load']('uniform_size_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
import UnityPy
index=json.loads((root/'public/assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
name='fx_in_bnckgy_fire' if args.fire else 'fx_in_tktkkt_electric';entry=index['assets'][name];blob=(sources.raw_root/'asset'/entry['bundle']).read_bytes();env=UnityPy.load(blob)
dep=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'));deps={o.assets_file.name:o.assets_file for o in dep.objects};record=a.inspect_asset(env,name,entry,True,deps)
from unicorn import UC_HOOK_CODE
current_size=2
def supply_size(uc,address,size,user):n['floats'](0x20c0000+0x2a0*8,[current_size]*4)
h=uc.hook_add(UC_HOOK_CODE,supply_size,begin=0x81e2e0,end=0x81e2e0)
free=uc.hook_add(UC_HOOK_CODE,n['free_null'],begin=0x306258,end=0x306258)
systems=[];cases=[]
for particle in record['particles']:
 if 'EmissionModule' not in particle['modules'] or particle['renderer']['renderMode']!=0:continue
 initial=particle['modules']['InitialModule'];assert not initial['size3D'] and not initial['rotation3D']
 renderer=next(o for o in env.objects if str(o.path_id)==particle['renderer']['pathId']).read_typetree()
 assert renderer['m_MinParticleSize']==0 and renderer['m_MaxParticleSize']==1 and renderer['m_Flip']==renderer['m_Pivot']==dict(x=0,y=0,z=0)
 if not args.fire:assert all(t['scale']==dict(x=1,y=1,z=1) for t in particle['transformChain'])
 else:assert all(t['rotation']==dict(x=0,y=0,z=0,w=1) and all(v>0 for v in t['scale'].values()) for t in particle['transformChain'])
 source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']}
 system=dict(source=source,chain=particle['transformChain'],alignment=particle['renderer']['alignment'],bounds=[0,1],rendererSource=particle['renderer']['pathId']);systems.append(system)
 for size in [.1,initial['startSize']['scalar'],16]:
  current_size=size
  for view in [3,7.2,10]:
   for angle in [0,.5]:
    case=dict(asset=name,source=source,chain=system['chain'],alignment=system['alignment'],size=size,viewHeight=view,angle=angle)
    case['expected']=n['vertices']([0,0,angle],False,system['chain'],system['alignment'],case,position=[.2,-.3,0],sizeBounds=system['bounds'],viewHeight=view);cases.append(case)
uc.hook_del(h);uc.hook_del(free)
assert len(systems)==(30 if args.fire else 14) and len(cases)==(540 if args.fire else 252)
windows=[]
for address,length in [(0x81e2e0,256),(0x6c505c,128)]:
 b=bytes(uc.mem_read(address,length));windows.append(dict(address=hex(address),bytes=b.hex(),sha256=hashlib.sha256(b).hexdigest()))
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],models={name:dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems)},cases=cases,sourceWindows=windows,boundary='Actual RAW renderer bounds/pivot/flip and unit-scale planar chains, native hierarchy/context and uniform billboard writer. Controlled scalar particle size, angle, position and normalized orthographic view height. No native stage camera history, Noise, RNG, perspective or device scene proof; zero-min/unit-max source only.')
target=root/'scripts/fixtures/chibi-uniform-size-native.json'
if args.fire:
 target=root/'scripts/fixtures/chibi-fire-uniform-size-native.json'
 proof['boundary']='Actual RAW fire renderer min0/max1/pivot0/flip0, positive source scales and identity parent rotations. Native hierarchy/context and uniform writer, controlled size/angle/position/view height. Width sets screen size clamp; original aspect ratio retained. No scene camera history, Noise, birth RNG, perspective or device proof.'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Uniform screen size proof changed'
print(json.dumps(dict(systems=len(systems),cases=len(cases))))
