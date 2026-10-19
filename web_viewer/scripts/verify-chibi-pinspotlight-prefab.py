import copy
import json
import struct
import hashlib
from pathlib import Path
from live_chibi_pinspotlight import pinspotlight_sprite_model

fixture = json.loads((Path(__file__).parent/'fixtures/chibi-pinspotlight-prefab.json').read_text(encoding='utf8'))
p = fixture['prefabs'][0]
assert pinspotlight_sprite_model(p) == fixture['model']
r = copy.deepcopy(p); r['children'].reverse()
assert pinspotlight_sprite_model(r) == fixture['model']
def rejected(edit):
    r = copy.deepcopy(p); edit(r)
    try: pinspotlight_sprite_model(r)
    except ValueError: return
    raise AssertionError('Corrupt Pinspotlight accepted')
def change_pointer(r):
    c = r['components'][1]; raw = bytearray.fromhex(c['rawHex'])
    struct.pack_into('<q', raw, 60, 52550)
    c.update(rawHex=raw.hex(), sha256=hashlib.sha256(raw).hexdigest())
rejected(change_pointer)
rejected(lambda r: r['components'][1].update(sha256='0'*64))
rejected(lambda r: r['children'][0]['components'][1]['materials'][0].update(shader='ohashi/SimpleAdd'))
rejected(lambda r: r['children'][0]['components'][1]['color'].update(r=1))
rejected(lambda r: r['children'][0]['components'][0]['scale'].update(x=0.7))
rejected(lambda r: r['children'].append(copy.deepcopy(r['children'][0])))
print('Native Pinspotlight mask/flash/interval bindings, reorder and corruption rejection passed')

# Optional local source replay. The small receipt is checked in; APK/ELF stay local.
import argparse, importlib.util, sys
parser=argparse.ArgumentParser()
parser.add_argument('--native-elf',type=Path)
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
receipt_path=Path(__file__).parent/'fixtures/chibi-pinspotlight-native-chain.json'
if args.native_elf:
    import UnityPy
    spec=importlib.util.spec_from_file_location('effects',Path(__file__).parent/'prepare-live-chibi-stage-effects.py')
    effects=importlib.util.module_from_spec(spec);spec.loader.exec_module(effects)
    sources=effects.load_archive_sources(None)
    apk=effects.read_unity_data(effects.find_xapk(None,sources.xapk_file))
    objects={o.path_id:o for o in UnityPy.load(apk).objects if o.assets_file.name=='resources.assets'}
    elf=args.native_elf.read_bytes()
    phoff=struct.unpack_from('<Q',elf,32)[0];size,count=struct.unpack_from('<HH',elf,54)
    segments=[struct.unpack_from('<IIQQQQQQ',elf,phoff+i*size) for i in range(count)]
    def offset(address):
        return next(p[2]+address-p[3] for p in segments if p[0]==1 and p[3]<=address<p[3]+p[5])
    def window(start,end):return hashlib.sha256(elf[offset(start):offset(end)]).hexdigest()
    methods=[('Pinspotlight.targetIdolPos',0x22239a0,0x2223a20),('Pinspotlight.Show',0x2223ba8,0x2223ed0),
        ('Pinspotlight.Hide',0x2223ed0,0x2223fec),('Pinspotlight.PlayEffect',0x2223fec,0x22241c0),
        ('SpotlightBase.Update',0x22243d8,0x22244f0),('Container.Create',0x221a470,0x221a72c),
        ('LiveStage.stageScale',0x1f29edc,0x1f29f64),('LiveStage.pixelToCameraPos',0x1f29f70,0x1f29f90)]
    constants={hex(a):struct.unpack_from('<f',elf,offset(a))[0] for a in [0x31734d0,0x3168e80,0x32d3d9c]}
    assert list(constants.values())==[150,100,1.3888888359069824]
    container=objects[123890];raw=container.get_raw_data()
    assert container.read(check_read=False).m_Script.read().m_ClassName=='LiveObjectContainer'
    assert struct.unpack_from('<iq',raw,32)==(0,10178)
    def transform(go):return next(c.component.deref() for c in objects[go].read().m_Component if c.component.deref().type.name=='Transform')
    ancestors=[];node=transform(10178)
    while node:
        t=node.read_typetree();ancestors.append(dict(pathId=node.path_id,sha256=hashlib.sha256(node.get_raw_data()).hexdigest(),tree=t))
        assert t['m_LocalScale']==dict(x=1,y=1,z=1)
        node=objects.get(t['m_Father']['m_PathID'])
    sprites=[]
    for obj in objects.values():
        if obj.type.name!='Sprite':continue
        t=obj.read_typetree()
        if 'pinspotlight' not in t['m_Name'].lower() or t['m_Name']=='pinspotlight_back':continue
        assert t['m_Rect']==dict(x=0,y=0,width=512,height=512) and t['m_Pivot']==dict(x=.5,y=.5) and t['m_PixelsToUnits']==100
        sprites.append(dict(name=t['m_Name'],pathId=obj.path_id,sha256=hashlib.sha256(obj.get_raw_data()).hexdigest()))
    settings=objects[106549].get_raw_data()
    # DOTweenSettings: name is length-prefixed, padded to 48; serialized values.
    assert struct.unpack_from('<if',settings,88)==(6,1.7015800476074219)
    result=dict(elfSha256=hashlib.sha256(elf).hexdigest(),unityDataSha256=hashlib.sha256(apk).hexdigest(),
        constants=constants,methods=[dict(name=n,start=hex(a),end=hex(b),sha256=window(a,b)) for n,a,b in methods],
        containerSha256=hashlib.sha256(raw).hexdigest(),ancestors=ancestors,sprites=sprites,
        dotweenSettingsSha256=hashlib.sha256(settings).hexdigest(),defaultEase=6,overshoot=struct.unpack_from('<f',settings,92)[0])
    if args.write:receipt_path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    else:assert result==json.loads(receipt_path.read_text(encoding='utf8'))
    print('PASS local APK container/Base hierarchy, all six lamp Sprites, DOTween settings and native ELF method/constant bindings')
else:
    receipt=json.loads(receipt_path.read_text(encoding='utf8'))
    assert len(receipt['sprites'])==6 and receipt['constants']['0x31734d0']==150
    assert receipt['defaultEase']==6 and receipt['overshoot']==1.7015800476074219
