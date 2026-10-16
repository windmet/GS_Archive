import copy,json
from pathlib import Path
from live_chibi_old_suspension import old_suspension_model
p=Path(__file__).with_name('fixtures')
source=json.loads((p/'chibi-old-suspension-native.json').read_text())
expected=json.loads((p/'chibi-old-suspension-model.json').read_text())
assert old_suspension_model(source['prefabs'],source['controllers'])==expected
for mutation in ('pointer','pivot','rotation','duration','default_state','animation_target'):
    bad=copy.deepcopy(source)
    root=bad['prefabs'][0]
    if mutation=='pointer':
        c=next(c for c in root['components'] if c.get('scriptClass'))
        c['rawHex']='00'+c['rawHex'][2:-2]+'01'
    elif mutation=='duration':
        next(iter(bad['controllers'].values()))['clips'][0]['typetree']['m_MuscleClip']['m_StopTime']=3
    elif mutation=='default_state':
        next(iter(bad['controllers'].values()))['typetree']['m_Controller']['m_StateMachineArray'][0]['data']['m_DefaultState']=1
    elif mutation=='animation_target':
        next(iter(bad['controllers'].values()))['clips'][0]['typetree']['m_ClipBindingConstant']['genericBindings'][0]['path']=123
    else:
        c=root['children'][0]['children'][0]['children'][0]['components']
        if mutation=='pivot':next(x for x in c if x['type']=='SpriteRenderer')['sprite']['pivot']['y']=.5
        else:next(x for x in root['children'][0]['children'][0]['components'] if x['type']=='Transform')['rotation']['z']=0
    try:old_suspension_model(bad['prefabs'],bad['controllers'])
    except ValueError:pass
    else:raise AssertionError('Changed native binding accepted: '+mutation)
print('PASS old sidelight native sprite, pivot, base and two streamed Animator bindings')

# Optional local replay. Never rewrites the shared media/index corpus.
import argparse,hashlib,importlib.util,struct,re,sys
from live_chibi_suspensionlight import suspensionlight_events
parser=argparse.ArgumentParser()
parser.add_argument('--native-elf',type=Path)
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
if args.native_elf:
    def load(name,file):
        sp=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m
    effects=load('effects',root/'scripts/prepare-live-chibi-stage-effects.py')
    audit=load('audit',root/'scripts/audit-chibi-light-resources.py')
    import UnityPy
    sources=effects.load_archive_sources(None)
    apk=effects.read_unity_data(effects.find_xapk(None,sources.xapk_file));env=UnityPy.load(apk)
    controllers={}
    names={'LiveObject'+command for command in expected['styles']}
    prefabs=[audit.inspect_prefab(o,controllers) for o in env.objects if o.type.name=='GameObject' and o.read().m_Name in names]
    actual=old_suspension_model(prefabs,controllers)
    assert actual==expected
    elf=args.native_elf.read_bytes()
    assert hashlib.sha256(elf).hexdigest()=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
    ph=struct.unpack_from('<Q',elf,32)[0];sz,n=struct.unpack_from('<HH',elf,54)
    ps=[struct.unpack_from('<IIQQQQQQ',elf,ph+i*sz) for i in range(n)]
    offset=lambda a:next(p[2]+a-p[3] for p in ps if p[0]==1 and p[3]<=a<p[3]+p[5])
    windows=[('Suspensionlight.PlayEffect',0x2226fec,0x22270d0),('Suspensionlight.ApplyData',0x22270d0,0x2227328),
        ('Suspensionlight.Show',0x2227328,0x222738c),('Suspensionlight.EraseEffect',0x222738c,0x22274d8),
        ('Suspensionlight_4.Show',0x1c026c8,0x1c02848),('LiveEffectData.value4AsFloat',0x1d6ca44,0x1d6ca84)]
    base=root/'public/assets/live-chibi';index_path=base/'stage-effects/index.json'
    index=json.loads(index_path.read_text(encoding='utf8'));songs={}
    raw_tracks={}
    for code in sorted({id.split('_live_effect')[0] for id in index['oldSuspensionlightSongs']}):
        bundle=sources.raw_root/f'asset/song_{code}.unity3d'
        bundle_hash=hashlib.sha256(bundle.read_bytes()).hexdigest()
        for asset in UnityPy.load(str(bundle)).objects:
            if asset.type.name!='TextAsset':continue
            text=asset.read()
            if text.m_Name not in index['oldSuspensionlightSongs']:continue
            payload=text.m_Script
            if isinstance(payload,str):payload=payload.encode('utf8')
            raw_tracks[text.m_Name]=(suspensionlight_events(payload,'Suspensionlight',15),bundle_hash,hashlib.sha256(payload).hexdigest(),str(asset.path_id))
    assert len(raw_tracks)==105
    for id,descriptor in index['oldSuspensionlightSongs'].items():
        path=base/descriptor['file'];track=json.loads(path.read_text(encoding='utf8'))
        events,bundle_hash,text_hash,path_id=raw_tracks[id]
        assert events==track['events'] and descriptor['eventCount']==len(events)
        assert descriptor['source']==track['source']
        assert track['source']['bundleSha256']==bundle_hash and track['source']['sha256']==text_hash and track['source']['pathId']==path_id
        reasons=[]
        for e in events:
            if e['erase']:continue
            values=e['values'];reason=None
            if e['command'] not in actual['styles']:reason='unbound_prefab'
            elif not values[3] or float(values[3])<=0:reason='nonpositive_animator_period'
            elif not re.fullmatch('#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?',values[9]):reason='invalid_color'
            elif e['command'] in ('Suspensionlight_3','Suspensionlight_4','Suspensionlight_5') and float(values[11] or 0)<=0:reason='nonpositive_channel_period'
            if reason:reasons.append(dict(sourceRow=e['sourceRow'],time=e['time'],command=e['command'],id=e['id'],reason=reason))
        songs[id]=dict(file=descriptor['file'],eventCount=len(events),source=descriptor['source'],fileSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            nativeCapability='unsupported' if reasons else 'supported',reasons=reasons,
            commands=sorted({e['command'] for e in events}))
    settings=next(o for o in env.objects if o.path_id==106549 and o.assets_file.name=='resources.assets').get_raw_data()
    assert struct.unpack_from('<i',settings,88)[0]==6
    material=next(o for o in env.objects if o.path_id==225 and o.assets_file.name=='resources.assets')
    assert material.read().m_Shader.path_id==950
    supplement=dict(schemaVersion=1,contract='native-old-suspension-v1',stageEffectIndexSha256=hashlib.sha256(index_path.read_bytes()).hexdigest(),model=actual,songs=songs)
    receipt=dict(elfSha256=hashlib.sha256(elf).hexdigest(),unityDataSha256=hashlib.sha256(apk).hexdigest(),
        methods=[dict(name=name,start=hex(a),end=hex(b),sha256=hashlib.sha256(elf[offset(a):offset(b)]).hexdigest()) for name,a,b in windows],
        materialPathId=225,shaderPathId=950,dotweenSettingsSha256=hashlib.sha256(settings).hexdigest(),defaultEase=6,colorEase=1,colorLoopType=1,
        arrangements=len(songs),enabled=sum(s['nativeCapability']=='supported' for s in songs.values()),rows=sum(s['eventCount'] for s in songs.values()))
    for path,data in [(root/'public/data/stage-old-suspension.json',supplement),(p/'chibi-old-suspension-chain.json',receipt)]:
        if args.write:path.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8')
        else:assert data==json.loads(path.read_text(encoding='utf8'))
    print(f"PASS live APK/ELF, all105 RAW/track bindings, {receipt['enabled']} capability-qualified arrangements, {receipt['rows']} rows")
