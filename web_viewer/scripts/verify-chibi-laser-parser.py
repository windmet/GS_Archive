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
            if isinstance(payload,bytes):payload=payload.decode('utf-8-sig')
            rows=[r for r in csv.DictReader(io.StringIO(payload)) if r.get('type')=='Laserlight' and r.get('value2')=='1' and r.get('value101')!='1']
    assert len(rows)==6 and all(r['time']=='26550' and r['value3']=='6000' and r['value10']=='1200' for r in rows)
    print('PASS re-read APK style1/controller/clip hashes, decrypted ELF and six RAW hndmkh alpha/period witnesses')

from live_chibi_laser_geometry import laser_geometry, laser_shader_receipt
geometry_fixtures={k:json.loads((root/f'fixtures/chibi-{k}-native.json').read_text(encoding='utf8')) for k in ['laser','spotbeam','turnlaser']}
geometry_expected=json.loads((root.parent/'src/core/chibiLaserGeometry.json').read_text(encoding='utf8'))
assert laser_geometry(geometry_fixtures)==geometry_expected
bad=copy.deepcopy(geometry_fixtures);bad['laser']['prefabs'][0]['systems'][0]['renderer']['alignment']=0
try:laser_geometry(bad)
except ValueError:pass
else:raise AssertionError('Unknown billboard plane accepted')
if args.native_elf:
    particle_audit=load('particle_audit',root/'audit-live-chibi-stage-objects.py')
    from live_chibi_laser import extract_laser_model
    from live_chibi_spotbeam import extract_spotbeam_model
    from live_chibi_turnlaser import extract_turnlaser_model
    reread={}
    for kind,extract in [('laser',extract_laser_model),('spotbeam',extract_spotbeam_model),('turnlaser',extract_turnlaser_model)]:
        model,f=extract(env,particle_audit,audit) if kind=='turnlaser' else extract(env,particle_audit)
        assert model==json.loads((root/f'fixtures/chibi-{kind}-model.json').read_text(encoding='utf8'))
        reread[kind]=f
    assert laser_geometry(reread)==geometry_expected
    print('PASS re-read APK all 60 particle planes, simulation/scaling/alignment flags and bound Animator chains')
print('PASS generated native particle parent planes, source identities and unsupported alignment rejection')

shader_expected=json.loads((root/'fixtures/chibi-laser-shader.json').read_text(encoding='utf8'))
assert shader_expected['blend']==dict(srcBlend=5,destBlend=1,srcBlendAlpha=5,destBlendAlpha=1,blendOp=0,blendOpAlpha=0,colMask=15)
if args.native_elf:
    assert laser_shader_receipt(env)==shader_expected
    for layer in sprite_expected['layers']:
        renderer=obj.assets_file.objects[int(layer['rendererPathId'])].read()
        assert renderer.m_Materials[0].read().m_Shader.path_id==950
print('PASS native Shader950 source hashes, all three GLES tiers COLOR0 clamp, Sprite binding and SrcAlpha/One blend state')

if args.native_elf:
    index=json.loads((root.parent/'public/assets/live-chibi/choreography/index.json').read_text(encoding='utf8'))
    by_name={s['id']:s for s in index['songs']};checked=0;bound=set()
    numeric={'value1':'id','value2':'style','value3':'sweepDuration','value4':'angle','value6':'length',
             'value7':'x','value8':'y','value10':'width','value11':'depth'}
    import re
    for code in sorted({s['songCode'] for s in index['songs']}):
        for asset in UnityPy.load(str(sources.raw_root/f'asset/song_{code}.unity3d')).objects:
            if asset.type.name!='TextAsset':continue
            text=asset.read()
            if text.m_Name not in by_name:continue
            payload=text.m_Script
            if isinstance(payload,bytes):payload=payload.decode('utf-8-sig')
            native_rows=[]
            for row in csv.DictReader(io.StringIO(payload)):
                if row.get('type')!='Laserlight' or row.get('value101')=='1':continue
                native={'time':float(row['time'])}
                for field,key in numeric.items():
                    value=(row.get(field) or '').strip()
                    assert re.fullmatch(r'[+-]?[0-9]+',value),(text.m_Name,field,value)
                    number=int(value);assert -2147483648<=number<=2147483647
                    native[key]=number
                native.update(direction=(row.get('value5') or '').strip(),color=(row.get('value9') or '').strip())
                native_rows.append(native)
            published=[{k:e[k] for k in ['time',*numeric.values(),'direction','color']}
                for e in by_name[text.m_Name].get('laserlightEvents',[]) if not e['hide']]
            sort=lambda r:(r['time'],r['id'])
            assert sorted(native_rows,key=sort)==sorted(published,key=sort),text.m_Name
            checked+=len(native_rows);bound.add(text.m_Name)
    assert checked==1089 and len(bound)==118
    print('PASS all 118 RAW arrangements / 1089 Laserlight shows: exact integer getters, field mapping and published event binding')
