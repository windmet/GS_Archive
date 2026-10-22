"""Bind actual tilted panel parents to native hierarchy/context/vertex execution."""
import argparse,hashlib,json,runpy,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');p.add_argument('--nonuniform',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-billboard-rotation-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);hook=n['uc'].hook_add(n['UC_HOOK_CODE'],n['free_null'],begin=0x306258,end=0x306258)
w=runpy.run_path(str(root/'scripts/prepare-chibi-whole-screen.py'),run_name='local_parent_source')
a=w['load']('local_parent_audit','audit-live-chibi-stage-objects.py');e=w['load']('local_parent_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
import UnityPy
index=json.loads((root/'public/assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
dep=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'));dependencies={o.assets_file.name:o.assets_file for o in dep.objects}
models={};cases=[]
if args.nonuniform:
 choreography=(root/'public/assets/live-chibi/choreography/index.json').read_bytes();songs=json.loads(choreography)['songs']
 song=next(s for s in songs if s['id']=='jfhtmk_live_effect');maxZoom=max(e.get('zoom') or 1000 for e in song['cameraEvents'])
 events=[e for s in songs for e in s.get('objectLayerEvents',[]) if e['asset']=='fx_in_jfhtmk_panel_1' and not e['hide']]
 assert all(e['scale']>0 for e in events) and all(s['id']==song['id'] for s in songs if any(e['asset']=='fx_in_jfhtmk_panel_1' for e in s.get('objectLayerEvents',[])))
 envelope=dict(arrangement=song['id'],maxZoom=maxZoom,maxObjectScale=max(e['scale'] for e in events)/1000,minViewHeight=10000/maxZoom,maxSourceSize=7.5,stageScaleUpperBound=1000/720)
for name in (['fx_in_jfhtmk_panel_1'] if args.nonuniform else ['fx_in_unmikn_panel_3','fx_in_vvfmrm_panel_1']):
 entry=index['assets'][name];path=sources.raw_root/'asset'/entry['bundle'];blob=path.read_bytes();env=UnityPy.load(blob);record=a.inspect_asset(env,name,entry,True,dependencies)
 systems=[]
 for particle in record['particles']:
  source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']}
  systems.append(dict(source=source,chain=particle['transformChain'],alignment=particle['renderer']['alignment']))
  if args.nonuniform:
   assert 'SizeModule' not in particle['modules'],'Size envelope requires constant birth dimensions'
   initial=particle['modules']['InitialModule']
   for k in (['startSize','startSizeY','startSizeZ'] if initial['size3D'] else ['startSize']):
    assert initial[k]['minMaxState'] in [0,3] and 0<=min(initial[k]['scalar'],initial[k]['minScalar']) and max(initial[k]['scalar'],initial[k]['minScalar'])<=envelope['maxSourceSize']
   renderer=next(o for o in env.objects if str(o.path_id)==particle['renderer']['pathId']).read_typetree()
   assert renderer['m_Flip']==renderer['m_Pivot']==dict(x=0,y=0,z=0),'Native size proof excludes pivot/flip'
   systems[-1].update(size3D=particle['modules']['InitialModule']['size3D'],sizeBounds=[renderer[k] for k in ['m_MinParticleSize','m_MaxParticleSize']])
  for angle in [0,.5,-.5]:
   for position in [[0,0,0],[.3,-.2,.7],[-.4,.6,-.8]]:
    nonuniform=args.nonuniform and systems[-1]['size3D']
    c=dict(asset=name,source=source,chain=particle['transformChain'],alignment=particle['renderer']['alignment'],angles=[0,0,angle],position=position,size=[5.5,7.5,1] if nonuniform else [2,2,2])
    assert c['alignment']==2 and not particle['modules']['InitialModule']['rotation3D']
    if args.nonuniform:c.update(nonuniform=nonuniform,function='0x815a1c' if nonuniform else '0x81e2e0')
    c['expected']=n['vertices'](c['angles'],False,c['chain'],2,c,position=c['position'],particleSize=c['size'] if nonuniform else None,sizeBounds=systems[-1].get('sizeBounds'),viewHeight=envelope['minViewHeight'] if args.nonuniform else 10);cases.append(c)
 models[name]=dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems)
n['uc'].hook_del(hook)
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],sourceWindows=n['proof']['sourceWindows'],models=models,cases=cases,
 boundary='Actual RAW static parent chains; native hierarchy/context and 2D Local vertex writer, controlled positions/angles/uniform size2, identity orthographic camera, no pivot/flip. Not RNG, native scene/tween history, perspective, nonuniform particle size or 3D particle rotation.')
target=root/'scripts/fixtures/chibi-local-parent-native.json'
if args.nonuniform:
 assert all(s['sizeBounds']==[0,50] and all(t['scale']==dict(x=1,y=1,z=1) for t in s['chain']) for m in models.values() for s in m['systems'])
 assert envelope['maxSourceSize']*envelope['stageScaleUpperBound']*envelope['maxObjectScale'] < 50*envelope['minViewHeight']
 proof.update(choreographySha256=hashlib.sha256(choreography).hexdigest(),nonbindingSizeEnvelope=envelope)
 proof['boundary']='Actual RAW local parents and size bounds; native hierarchy/context and correct nonuniform (0x815a1c)/uniform (0x81e2e0) writer. Controlled positions/angles, source5.5x7.5x1 or uniform2. Static orthographic no pivot/flip; not full dispatcher execution, initial-module conversion, RNG, native scene/tween history or perspective.'
 for address,length in [(0x809208,112),(0x809584,156),(0xef7d48,16),(0x815a1c,128)]:
  payload=bytes(n['uc'].mem_read(address,length));proof['sourceWindows'].append(dict(address=hex(address),bytes=payload.hex(),sha256=hashlib.sha256(payload).hexdigest()))
 target=root/'scripts/fixtures/chibi-local-size-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Local parent evidence changed'
print(json.dumps(dict(assets=len(models),systems=sum(len(m['systems']) for m in models.values()),cases=len(cases))))
