"""Bind all bnckgy fire nodes and replay each source cone with native stretch writers."""
import argparse,hashlib,importlib.util,json,math,runpy,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-stretch-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);hook=n['uc'].hook_add(n['UC_HOOK_CODE'],n['null_free'],begin=0x306258,end=0x306258)
spec=importlib.util.spec_from_file_location('fire_emitters',root/'scripts/prepare-chibi-object-emitters.py');em=importlib.util.module_from_spec(spec);spec.loader.exec_module(em)
a=em.w.load('fire_audit','audit-live-chibi-stage-objects.py');e=em.w.load('fire_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
import UnityPy
index=json.loads((root/'public/assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
name='fx_in_bnckgy_fire';entry=index['assets'][name];blob=(sources.raw_root/'asset'/entry['bundle']).read_bytes();env=UnityPy.load(blob)
dep=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'));deps={o.assets_file.name:o.assets_file for o in dep.objects};record=a.inspect_asset(env,name,entry,True,deps)
byid={str(o.path_id):o for o in env.objects};systems=[];inactive=[];stretch=[];cases=[]
for particle in record['particles']:
 source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']};tree=byid[particle['pathId']].read_typetree()
 if not tree['EmissionModule']['enabled']:
  assert list(particle['modules'])==['InitialModule'] and not tree['SubModule']['enabled']
  inactive.append(dict(source=source,chain=particle['transformChain'],emission=tree['EmissionModule'],subEmitters=tree['SubModule']));continue
 system=em.model(particle,True);systems.append(system)
 if particle['renderer']['renderMode']!=1:continue
 shape=system['shape'];sr=particle['renderer']['stretch']
 assert shape['type']==4 and shape['angle']==1 and shape['m_Rotation']==dict(x=-90,y=0,z=0) and shape['m_Scale']==dict(x=1,y=1,z=1) and shape['m_Position']==dict(x=0,y=0,z=0)
 assert system['size']['mode']==system['speed']['mode']==0 and system['sizeOverLife'] is None and system['sizeY'] is None
 assert system['velocity'] is None and system['limit'] is None and system['gravity']['scalar']==0 and not system.get('noise')
 assert sr['velocityScale']==sr['cameraVelocityScale']==0 and sr['lengthScale']==3 and sr['flip']==dict(x=0,y=0,z=0) and system['alignment']==0
 A,B,C,D,tx,ty,sz,tz=1,0,0,1,0,0,1,0;sx,sy,scaleZ=1,1,1
 for tr in system['chain']:
  q=tr['rotation'];scale=tr['scale'];pos=tr['position'];assert q==dict(x=0,y=0,z=0,w=1) and all(scale[k]>0 for k in 'xyz')
  A,B,C,D,tx,ty=scale['x']*A,scale['y']*B,scale['x']*C,scale['y']*D,scale['x']*tx+pos['x'],scale['y']*ty+pos['y']
  sz,tz=scale['z']*sz,scale['z']*tz+pos['z'];sx*=scale['x'];sy*=scale['y'];scaleZ*=scale['z']
 bound=dict(system=system,renderer=sr);stretch.append(bound)
 for arc in range(8):
  phi=arc*math.pi/4
  for fraction in [math.sqrt(.001),.5,1]:
   angle=shape['angle']*math.pi/180;direction=[math.cos(phi)*fraction*math.sin(angle),math.cos(angle),-math.sin(phi)*fraction*math.sin(angle)];norm=math.sqrt(sum(v*v for v in direction));v=[x/norm*system['speed']['scalar'] for x in direction]
   birth=[math.cos(phi)*shape['radius']['value']*fraction,0,-math.sin(phi)*shape['radius']['value']*fraction]
   for age in [.025,.1,.225]:
    for camera in [0,.7]:
     case=dict(position=[birth[i]+v[i]*age for i in range(3)],velocity=v,size=system['size']['scalar'],velocityScale=sr['velocityScale'],lengthScale=sr['lengthScale'],maxParticleSize=sr['maxSize'],matrix=[A,B,C,D,tx,ty],particleScale=[sx,sy,scaleZ],worldRotation=[0,0,0,1],depthMatrix=[sz,tz],cameraRotation=camera,packedContext=True,sameViewMatrices=True)
     for function in [0x80b8a4,0x817658]:cases.append(dict(asset=name,source=source,arc=arc,fraction=fraction,age=age,function=hex(function),input=case,expected=n['vertices'](function,case)))
components=[]
for ob in env.objects:
 if ob.type.name!='GameObject':continue
 chain=a.transform_chain(ob)
 if not chain or chain[-1]['pathId']!=record['rootTransformChain'][-1]['pathId']:continue
 for item in ob.read_typetree()['m_Component']:
  co=a.local_object(ob,item['component']);assert co.type.name in ('Transform','ParticleSystem','ParticleSystemRenderer') or str(co.path_id)==record['keeper']['pathId']
  components.append(dict(source=a.source_ref(co),treeSha256=a.json_hash(co.read_typetree())))
assert len(systems)==36 and len(inactive)==6 and len(stretch)==6 and len(cases)==1728
n['uc'].hook_del(hook)
choreography=(root/'public/assets/live-chibi/choreography/index.json').read_bytes();song=next(s for s in json.loads(choreography)['songs'] if s['id']=='bnckgy_live_effect');assert not any(e.get('focusSlot') for e in song['cameraEvents'])
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],sourceWindows=n['source_windows'],choreographySha256=hashlib.sha256(choreography).hexdigest(),arrangement=dict(id=song['id'],cameraEvents=song['cameraEvents'],fireEvents=[e for e in song['objectLayerEvents'] if e['asset']==name]),models={name:dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems,nonEmitting=inactive,staticComponents=components,stretchSystems=stretch)},cases=cases,boundary='Actual RAW all42nodes partitioned into36emitters/6disabled-emission containers. Six controlled source cones through native hierarchy/context and both stretch writers, source parent XYZ, speed/size and renderer fields. Not native RNG/birth schedule, scene camera tween, Noise or device rendering.')
target=root/'scripts/fixtures/chibi-bnckgy-fire-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Fire source/native evidence changed'
print(json.dumps(dict(systems=36,nonEmitting=6,stretchSystems=6,cases=len(cases))))
