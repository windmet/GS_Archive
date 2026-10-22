"""Bind actual tilted panel parents to native hierarchy/context/vertex execution."""
import argparse,hashlib,json,runpy,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args()
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
for name in ['fx_in_unmikn_panel_3','fx_in_vvfmrm_panel_1']:
 entry=index['assets'][name];path=sources.raw_root/'asset'/entry['bundle'];blob=path.read_bytes();record=a.inspect_asset(UnityPy.load(blob),name,entry,True,dependencies)
 systems=[]
 for particle in record['particles']:
  source={k:particle[k] for k in ['serializedFile','pathId','parameterTreeSha256']}
  systems.append(dict(source=source,chain=particle['transformChain'],alignment=particle['renderer']['alignment']))
  for angle in [0,.5,-.5]:
   for position in [[0,0,0],[.3,-.2,.7],[-.4,.6,-.8]]:
    c=dict(asset=name,source=source,chain=particle['transformChain'],alignment=particle['renderer']['alignment'],angles=[0,0,angle],position=position,size=[2,2,2])
    assert c['alignment']==2 and not particle['modules']['InitialModule']['rotation3D'] and not particle['modules']['InitialModule']['size3D']
    c['expected']=n['vertices'](c['angles'],False,c['chain'],2,c,position=c['position']);cases.append(c)
 models[name]=dict(bundle=entry['bundle'],bundleSha256=hashlib.sha256(blob).hexdigest(),systems=systems)
n['uc'].hook_del(hook)
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],sourceWindows=n['proof']['sourceWindows'],models=models,cases=cases,
 boundary='Actual RAW static parent chains; native hierarchy/context and 2D Local vertex writer, controlled positions/angles/uniform size2, identity orthographic camera, no pivot/flip. Not RNG, native scene/tween history, perspective, nonuniform particle size or 3D particle rotation.')
target=root/'scripts/fixtures/chibi-local-parent-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Local parent evidence changed'
print(json.dumps(dict(assets=len(models),systems=sum(len(m['systems']) for m in models.values()),cases=len(cases))))
