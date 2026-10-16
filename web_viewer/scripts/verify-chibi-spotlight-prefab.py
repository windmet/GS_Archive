"""Portable native binding regression; no XAPK or textures needed in CI."""
import copy
import json
from pathlib import Path
from live_chibi_spotlight import spotlight_sprite_model

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-spotlight-prefab.json').read_text(encoding='utf-8'))
prefab = fixture['prefabs'][0]
model = spotlight_sprite_model(prefab)
assert model == fixture['model'], 'Actual exported descriptor must match native bindings'
assert [layer['asset'] for layer in model['layers']] == ['Spotlight1', 'Spotlight2']
assert abs(model['layers'][0]['y'] + 470) < 0.0001
assert abs(model['layers'][1]['scaleX'] - 0.6) < 0.000001
assert model['layers'][0]['anchorY'] == 0.5
reordered = copy.deepcopy(prefab)
reordered['children'].reverse()
assert spotlight_sprite_model(reordered) == model, 'Bindings must follow PPtrs, not tree order'

def rejected(change):
    bad = copy.deepcopy(prefab)
    change(bad)
    try:
        spotlight_sprite_model(bad)
    except ValueError:
        return
    raise AssertionError('Corrupt native binding accepted')

rejected(lambda p: p['components'][1].update(rawHex='00'))
rejected(lambda p: p['components'][1].update(sha256='0' * 64))
rejected(lambda p: p['children'][0]['components'][1].update(pathId='55516'))
rejected(lambda p: p['children'][0]['components'][1]['sprite']['texture'].update(name='pinspotlight'))
rejected(lambda p: p['children'][0]['components'][1]['materials'][0].update(shader='Sprites/Default'))
rejected(lambda p: p['children'][0]['components'][0]['position'].update(y=float('nan')))
rejected(lambda p: p['children'][0]['components'][0]['scale'].update(x=0))
rejected(lambda p: p['children'][0]['components'][0]['rotation'].update(z=0.5))
rejected(lambda p: p['children'][0]['components'][1]['sprite'].update(pixelsToUnits=0))
rejected(lambda p: p['children'][0]['components'][1]['sprite']['rect'].update(width=1))
print('Native Spotlight PPtr bindings, geometry, child reorder and 10 corruption cases passed')

# Optional native replay/export writes only a small command sidecar and receipt.
import argparse,hashlib,importlib.util,struct,sys
from live_chibi_spotlight_commands import native_spotlight_data,spotlight_command
parser=argparse.ArgumentParser();parser.add_argument('--native-elf',type=Path);parser.add_argument('--write',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
commands_path=root/'public/data/stage-spotlight-commands.json'
receipt_path=root/'scripts/fixtures/chibi-spotlight-native-chain.json'
if args.native_elf:
    def load(name,file):
        sp=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m
    effects=load('effects',root/'scripts/prepare-live-chibi-stage-effects.py')
    sources=effects.load_archive_sources(None)
    data=native_spotlight_data(root,sources)
    elf=args.native_elf.read_bytes();assert hashlib.sha256(elf).hexdigest()=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
    ph=struct.unpack_from('<Q',elf,32)[0];sz,n=struct.unpack_from('<HH',elf,54);ps=[struct.unpack_from('<IIQQQQQQ',elf,ph+i*sz) for i in range(n)]
    offset=lambda a:next(p[2]+a-p[3] for p in ps if p[0]==1 and p[3]<=a<p[3]+p[5])
    methods=[('Spotlight.Show',0x22262c0,0x22265ac),('Spotlight.Hide',0x22265ac,0x222673c),('Spotlight.PlayEffect',0x222673c,0x2226984),
        ('Spotlight.EraseEffect',0x2226984,0x22269c0),('LiveStage.GetTargetIdolObj',0x1f29b84,0x1f29c64),
        ('SpotlightBase.targetIdolPos',0x2223a20,0x2223b40),('SpotlightBase.Update',0x22243d8,0x22244f0),
        ('Spotlight.HideRenderer',0x1c9ee74,0x1c9eeb4),('Spotlight.SetRendererColor',0x1c9eebc,0x1c9eef8)]
    import UnityPy
    apk=effects.read_unity_data(effects.find_xapk(None,sources.xapk_file));env=UnityPy.load(apk)
    audit=load('spotlight_audit',root/'scripts/audit-chibi-light-resources.py')
    obj=next(o for o in env.objects if o.path_id==11425 and o.assets_file.name=='resources.assets')
    actual=audit.inspect_prefab(obj)
    assert spotlight_sprite_model(actual)==fixture['model']
    objects={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
    settings=objects[106549].get_raw_data()
    assert struct.unpack_from('<i',settings,88)[0]==6
    materials=[]
    for path_id in (231,232):
        material=objects[path_id].read()
        assert material.m_Shader.path_id==950
        materials.append(dict(pathId=path_id,shaderPathId=950,sha256=hashlib.sha256(objects[path_id].get_raw_data()).hexdigest()))
    receipt=dict(elfSha256=hashlib.sha256(elf).hexdigest(),unityDataSha256=hashlib.sha256(apk).hexdigest(),
        methods=[dict(name=name,start=hex(a),end=hex(b),sha256=hashlib.sha256(elf[offset(a):offset(b)]).hexdigest()) for name,a,b in methods],
        contract='native-spotlight-v1',materials=materials,dotweenSettingsSha256=hashlib.sha256(settings).hexdigest(),showMoveDurationMs=500,moveEase=6,hideEase=6,
        sourceRows=sum(len(s['events']) for s in data['songs'].values()),shows=sum(not e['hide'] for s in data['songs'].values() for e in s['events']))
    if args.write:
        commands_path.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8')
        receipt_path.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8')
    else:
        assert data==json.loads(commands_path.read_text(encoding='utf8'))
        assert receipt==json.loads(receipt_path.read_text(encoding='utf8'))
    print('PASS local APK/ELF Spotlight show/hide/target/scale chain and all 118 RAW arrangement sidecars')
else:
    data=json.loads(commands_path.read_text(encoding='utf8'))
    assert data['contract']=='native-spotlight-v1' and len(data['songs'])==118
assert spotlight_command({'time':'0','value1':'1','value4':'10000','value6':'1200'})['y']==10000
assert spotlight_command({'time':'0','value1':'1','value4':'10000','value6':'1200'})['duration']==500
assert spotlight_command({'time':'0','value1':'53'})['scale']==0
assert spotlight_command({'time':'0','value1':'1','value101':'1'})['duration']==0
