"""Bind serialized stage/container/camera frames and managed native instruction windows."""
import argparse,hashlib,json,runpy,struct
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-il2cpp',required=True)
parser.add_argument('--write',action='store_true')
args=parser.parse_args();root=Path(__file__).resolve().parents[1]
effects=runpy.run_path(str(root/'scripts/prepare-live-chibi-stage-effects.py'),run_name='spatial_import')
audit=runpy.run_path(str(root/'scripts/audit-live-chibi-stage-objects.py'),run_name='spatial_audit')
import UnityPy
sha=lambda b:hashlib.sha256(b).hexdigest()
sources=effects['load_archive_sources'](None);blob=effects['read_unity_data'](sources.xapk_file)
env=UnityPy.load(blob);by={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
def pointer(obj,offset,kind):
    file,path=struct.unpack_from('<iq',obj.get_raw_data(),offset)
    assert file==0 and by[path].type.name==kind
    return by[path]
def record(obj):return dict(source=audit['source_ref'](obj),rawSha256=sha(obj.get_raw_data()))
def mono(obj,name):assert obj.read(check_read=False).m_Script.read().m_ClassName==name
def chain(go):return audit['transform_chain'](go)
stage=by[114160];mono(stage,'LiveStage')
stagego=by[stage.read(check_read=False).m_GameObject.path_id]
base=pointer(stage,32,'GameObject');camera_script=pointer(stage,136,'MonoBehaviour');mono(camera_script,'LiveObjectCamera')
container=pointer(stage,148,'MonoBehaviour');mono(container,'LiveObjectContainer')
camera=pointer(camera_script,32,'Camera');container_parent=pointer(container,32,'GameObject')
assert camera.path_id==45565 and base.path_id==container_parent.path_id
camgo=by[camera.read_typetree()['m_GameObject']['m_PathID']]
camscriptgo=by[camera_script.read(check_read=False).m_GameObject.path_id]
elf=Path(args.native_il2cpp).read_bytes();identity=sha(elf)
assert identity=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
phoff=struct.unpack_from('<Q',elf,32)[0];ents,num=struct.unpack_from('<HH',elf,54)
def read(va,length):
    for j in range(num):
        p=struct.unpack_from('<IIQQQQQQ',elf,phoff+j*ents)
        if p[0]==1 and p[3]<=va<va+length<=p[3]+p[5]:return elf[p[2]+va-p[3]:p[2]+va-p[3]+length]
    raise ValueError(hex(va))
windows=[]
for name,address,length in [('Container.Create',0x221a470,0x2bc),('ObjectLayer.PlayEffect',0x2220db8,0x398),
    ('Camera.PlayAnimation',0x2219960,0x368),('Camera.targetIdolPos',0x22195cc,0x178),('Camera.Update',0x2219744,0x108),
    ('Stage.Prepare.scale.window',0x1cb0a2c,0x34),
    ('ScriptPosToStagePos.window',0x2218894,96),('ScriptPosToCameraPos.window',0x2219c1c,96),
    ('Stage.stageScale',0x1f29edc,0x88),('Stage.pixelToStagePos',0x1f29f64,12),
    ('Stage.pixelToCameraPos',0x1f29f70,32),('Component.cctor.window',0x2219f74,96)]:
    b=read(address,length);windows.append(dict(name=name,address=hex(address),bytes=b.hex(),sha256=sha(b)))
constants={name:dict(address=hex(address),bytes=read(address,4).hex(),value=struct.unpack('<f',read(address,4))[0])
    for name,address in [('pixelToStage',0x31734bc),('scriptDivisor',0x3168e80),('wideStageScale',0x32d3d9c),('aspectBoundary',0x32ccf68)]}
origin=list(struct.unpack('<2f',read(0x32d4d78,8)))+[0]
assert origin==[0,360,0]
choreo=root/'public/assets/live-chibi/choreography/index.json';song=next(s for s in json.loads(choreo.read_text(encoding='utf8'))['songs'] if s['id']=='pfofos_live_effect')
assert len(song['cameraEvents'])==152 and not any(e.get('focusSlot') for e in song['cameraEvents'])
proof=dict(schemaVersion=1,unityDataSha256=sha(blob),managedBinarySha256=identity,instructionWindows=windows,constants=constants,basePos=origin,
    stage={**record(stage),'gameObject':record(stagego),'chain':chain(stagego),'base':record(base)},
    container={**record(container),'parent':record(container_parent),'chain':chain(container_parent)},
    cameraScript={**record(camera_script),'gameObject':record(camscriptgo),'chain':chain(camscriptgo)},
    camera={**record(camera),'gameObject':record(camgo),'chain':chain(camgo),'orthographic':camera.read_typetree()['orthographic']},
    pointerOffsets=dict(stageBase=32,stageCameraScript=136,stageContainer=148,containerParent=32,cameraComponent=32),
    choreographySha256=sha(choreo.read_bytes()),arrangement=dict(id=song['id'],cameraEvents=song['cameraEvents'],
        fireEvents=[e for e in song['objectLayerEvents'] if e['asset'].startswith('fx_in_pfofos_fire_')]),
    boundary='Serialized source frames and native instruction identity; no native execution, instantiated scene capture, camera matrix getter replay, tween frame history or renderer admission. Initial Z values are not general runtime constants.')
target=root/'scripts/fixtures/chibi-spatial-context-native.json'
if args.write:target.write_text(json.dumps(proof,ensure_ascii=False,separators=(',',':')),encoding='utf8')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Spatial source/context evidence changed'
binding=dict(schemaVersion=1,sourceContextSha256=sha(target.read_bytes()),stageScaleXY=constants['wideStageScale']['value'],
    pixelToStage=constants['pixelToStage']['value'],scriptDivisor=constants['scriptDivisor']['value'],basePos=origin,
    containerZ=sum(t['position']['z'] for t in proof['container']['chain']),cameraParentZ=sum(t['position']['z'] for t in proof['camera']['chain'][1:]))
binding_path=root/'src/data/chibiObjectSpatialBinding.json'
if args.write:binding_path.write_text(json.dumps(binding,ensure_ascii=False,separators=(',',':')),encoding='utf8')
else:assert json.loads(binding_path.read_text(encoding='utf8'))==binding,'Spatial runtime binding changed'
print(json.dumps(dict(stage=stage.path_id,container=container.path_id,parent=base.path_id,camera=camera.path_id,cameraEvents=len(song['cameraEvents']),fireEvents=len(proof['arrangement']['fireEvents']))))
