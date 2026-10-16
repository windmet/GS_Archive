import copy
import json
from pathlib import Path
from live_chibi_laser import laser_model

root = Path(__file__).parent
fixture = json.loads((root/'fixtures/chibi-laser-native.json').read_text(encoding='utf-8'))
expected = json.loads((root/'fixtures/chibi-laser-model.json').read_text(encoding='utf-8'))
assert laser_model(**fixture) == expected
# Native script array order, not hierarchy traversal, controls emitter order.
reordered = copy.deepcopy(fixture)
for p in reordered['prefabs']: p['systems'].reverse()
assert laser_model(**reordered) == expected
for mutate in (
    lambda f: f['root'].__setitem__('sha256','0'*64),
    lambda f: f['prefabs'][0].__setitem__('pointerPathId','130374'),
    lambda f: f['prefabs'][0]['systems'][0]['renderer']['materials'][0]['textures'][0].__setitem__('pathId','886'),
    lambda f: f['prefabs'][0]['systems'][0]['modules']['InitialModule']['startSpeed'].__setitem__('scalar',1),
):
    bad = copy.deepcopy(fixture); mutate(bad)
    try: laser_model(**bad)
    except ValueError: pass
    else: raise AssertionError('Tampered native binding/module accepted')
assert expected['styles']['7']['systems'][1]['mirrored']
assert expected['styles']['7']['systems'][0]['anchorY'] > .98
print('PASS native laser: style PPtrs, ordered particles, mirrored fans, source texture, unsupported module rejection')

from live_chibi_sprite_laser import sprite_laser_model
sprite_fixture=json.loads((root/'fixtures/chibi-sprite-laser-native.json').read_text(encoding='utf8'))
sprite_expected=json.loads((root.parent/'src/core/chibiSpriteLaserModel.json').read_text(encoding='utf8'))
assert sprite_laser_model(sprite_fixture)==sprite_expected
reordered=copy.deepcopy(sprite_fixture)
reordered['prefab']['children'].reverse()
assert sprite_laser_model(reordered)==sprite_expected
for mutate in (
    lambda f:f['owner'].update(sha256='0'*64),
    lambda f:f['prefab']['components'][1].update(sha256='0'*64),
    lambda f:f['prefab']['children'][0].update(activeSelf=False),
    lambda f:next(iter(f['animations'].values()))['typetree']['m_Controller']['m_StateMachineArray'][0]['data'].update(m_DefaultState=1),
):
    bad=copy.deepcopy(sprite_fixture);mutate(bad)
    try:sprite_laser_model(bad)
    except ValueError:pass
    else:raise AssertionError('Changed Sprite laser binding/state accepted')
print('PASS native style1 ordered Sprites/Animators, active hierarchy, default clip and unsupported state rejection')

import argparse,importlib.util,hashlib,sys,struct,csv,io
parser=argparse.ArgumentParser();parser.add_argument('--native-elf',type=Path);args=parser.parse_args()
if args.native_elf:
    import UnityPy
    def load(name,file):
        spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
    effects=load('effects',root/'prepare-live-chibi-stage-effects.py');audit=load('audit',root/'audit-chibi-light-resources.py')
    sources=effects.load_archive_sources(None);data=effects.read_unity_data(effects.find_xapk(None,sources.xapk_file));env=UnityPy.load(data)
    obj=next(o for o in env.objects if o.path_id==106566 and o.assets_file.name=='resources.assets');raw=obj.get_raw_data()
    child=obj.assets_file.objects[115970];v=child.read(check_read=False);animations={};sprites={}
    result=dict(owner=dict(rawHex=raw.hex(),sha256=hashlib.sha256(raw).hexdigest()),
        prefab=audit.inspect_prefab(v.m_GameObject.deref(),animations,sprites),animations=animations,unityDataSha256=hashlib.sha256(data).hexdigest())
    base=obj.assets_file.objects[90083]
    result['base']=dict(pathId=90083,sha256=hashlib.sha256(base.get_raw_data()).hexdigest(),tree=base.read_typetree())
    assert json.loads(json.dumps(result))=={k:v for k,v in sprite_fixture.items() if k!='native'}
    elf=args.native_elf.read_bytes();assert hashlib.sha256(elf).hexdigest()=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
    ph=struct.unpack_from('<Q',elf,32)[0];sz,n=struct.unpack_from('<HH',elf,54);segments=[struct.unpack_from('<IIQQQQQQ',elf,ph+i*sz) for i in range(n)]
    offset=lambda a:next(p[2]+a-p[3] for p in segments if p[0]==1 and p[3]<=a<p[3]+p[5])
    assert struct.unpack_from('<f',elf,offset(0x317a3bc))[0]==1000
    for address,value in sprite_fixture['native']['constants'].items():
        assert struct.unpack_from('<f',elf,offset(int(address,16)))[0]==value
    for method in sprite_fixture['native']['methodWindows']:
        a,z=int(method['start'],16),int(method['end'],16)
        assert hashlib.sha256(elf[offset(a):offset(z)]).hexdigest()==method['sha256']
    # Freeze the exact six RAW witnesses, including alpha mislabeled width.
    bundle=sources.raw_root/'asset/song_hndmkh.unity3d';rows=[]
    for o in UnityPy.load(str(bundle)).objects:
        if o.type.name=='TextAsset' and o.read().m_Name=='hndmkh_live_effect':
            payload=o.read().m_Script
            if isinstance(payload,bytes):payload=payload.decode('utf8-sig')
            rows=[r for r in csv.DictReader(io.StringIO(payload)) if r.get('type')=='Laserlight' and r.get('value2')=='1' and r.get('value101')!='1']
    assert len(rows)==6 and all(r['time']=='26550' and r['value3']=='6000' and r['value10']=='1200' for r in rows)
    print('PASS re-read APK style1/controller/clip hashes, decrypted ELF and six RAW hndmkh alpha/period witnesses')
