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
parser.add_argument('--native-unity',type=Path)
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
            nativeCapability=('partial' if all(r['reason'] in ('nonpositive_animator_period','nonpositive_channel_period') for r in reasons) else 'unsupported') if reasons else 'supported',reasons=reasons,
            commands=sorted({e['command'] for e in events}))
    settings=next(o for o in env.objects if o.path_id==106549 and o.assets_file.name=='resources.assets').get_raw_data()
    assert struct.unpack_from('<i',settings,88)[0]==6
    material=next(o for o in env.objects if o.path_id==225 and o.assets_file.name=='resources.assets')
    assert material.read().m_Shader.path_id==950
    supplement=dict(schemaVersion=1,contract='native-old-suspension-v1',stageEffectIndexSha256=hashlib.sha256(index_path.read_bytes()).hexdigest(),model=actual,songs=songs)
    receipt=dict(elfSha256=hashlib.sha256(elf).hexdigest(),unityDataSha256=hashlib.sha256(apk).hexdigest(),
        methods=[dict(name=name,start=hex(a),end=hex(b),sha256=hashlib.sha256(elf[offset(a):offset(b)]).hexdigest()) for name,a,b in windows],
        materialPathId=225,shaderPathId=950,dotweenSettingsSha256=hashlib.sha256(settings).hexdigest(),defaultEase=6,colorEase=1,colorLoopType=1,
        arrangements=len(songs),enabled=sum(s['nativeCapability']=='supported' for s in songs.values()),
        partial=sum(s['nativeCapability']=='partial' for s in songs.values()),rows=sum(s['eventCount'] for s in songs.values()))
    for path,data in [(root/'public/data/stage-old-suspension.json',supplement),(p/'chibi-old-suspension-chain.json',receipt)]:
        if args.write:path.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8')
        else:assert data==json.loads(path.read_text(encoding='utf8'))
    print(f"PASS live APK/ELF, all105 RAW/track bindings, {receipt['enabled']} capability-qualified arrangements, {receipt['rows']} rows")


if args.native_unity:
    import capstone
    binary=args.native_unity.read_bytes()
    unity_hash=hashlib.sha256(binary).hexdigest()
    assert unity_hash=='acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0'
    # ELF LOAD0 maps file offsets to VA directly; Ghidra project rebases +0x100000.
    assert struct.unpack_from('<4s',binary)[0]==b'\x7fELF'
    ph=struct.unpack_from('<Q',binary,32)[0];sz,n=struct.unpack_from('<HH',binary,54)
    segments=[struct.unpack_from('<IIQQQQQQ',binary,ph+i*sz) for i in range(n)]
    assert any(p[0]==1 and p[2]==p[3]==0 and p[5]>0xd4ee6b for p in segments)
    assert binary.startswith(b'UnityEngine.Animator::set_speed\x00',0xd4ee4e)
    md=capstone.Cs(capstone.CS_ARCH_ARM64,capstone.CS_MODE_LITTLE_ENDIAN)
    decode=lambda a,b:[[hex(i.address),i.mnemonic,i.op_str] for i in md.disasm(binary[a:b],a)]
    registration=decode(0x1c924c,0x1c9260)
    assert [(i[1],i[2]) for i in registration]==[
        ('adrp','x0, #0xd4e000'),('adrp','x1, #0x1c6000'),
        ('add','x0, x0, #0xe4e'),('add','x1, x1, #0xfc0'),('b','#0x344d14')]
    wrapper=decode(0x1c6fc0,0x1c70cc)
    assert ['0x1c7058','bl','#0xfb8cc'] in wrapper
    setter=decode(0xfb8cc,0xfb93c)
    assert ['0xfb8e0','fcmp','s0, #0.0'] in setter
    assert ['0xfb8e8','csel','x9, x9, x10, gt'] in setter
    assert ['0xfb8f8','str','w9, [x0, #0x47c]'] in setter
    assert ['0xfb930','str','w9, [x8]'] in setter
    advance=decode(0x135ca0,0x135f70)
    assert ['0x135d6c','bl','#0x135c04'] in advance
    assert ['0x135d98','fmul','s2, s0, s2'] in advance
    assert ['0x135d9c','fdiv','s2, s2, s8'] in advance
    assert ['0x135de4','fadd','s8, s2, s0'] in advance
    assert ['0x135f38','str','s8, [x8]'] in advance
    assert struct.unpack_from('<2Q',binary,0x10a3fb8)==(0x8680a4,0x8666d0)
    clip_set=decode(0x8680a4,0x8680d4)
    assert ['0x8680d0','b','#0x33a758'] in clip_set
    assert ['0x33a780','str','d8, [x19, #0x60]'] in decode(0x33a758,0x33a7e0)
    loop_time=decode(0x6ab648,0x6ab768)
    assert ['0x6ab6bc','bl','#0xaf9c0'] in loop_time
    assert ['0x6ab72c','fmax','s1, s1, s11'] in loop_time
    assert ['0x6ab730','fmin','s1, s1, s12'] in loop_time
    # The quaternion-channel safety branch and Euler branch are different.
    binding=decode(0x118a70,0x118bf4)
    assert ['0x118a74','b.eq','#0x118ae0'] in binding
    assert ['0x118abc','fcmgt','v25.4s, v22.4s, v20.4s'] in binding
    assert ['0x118ac4','bsl','v25.16b, v21.16b, v19.16b'] in binding
    assert ['0x118bec','str','q21, [x13, x18, lsl #4]'] in binding
    assert struct.unpack_from('<4f',binary,0xd41b60)==(0,0,0,1)
    euler_branch=decode(0x118ae0,0x118bf4)
    assert not any(i[1] in ('fcmgt','bsl','frsqrte') for i in euler_branch)
    assert struct.unpack_from('<QQq',binary,0xae138)==(0x10d2748,(241<<32)|0x402,0)
    symbol_name=struct.unpack_from('<I',binary,0xbb8+241*24)[0]+0x2c40
    assert binary.startswith(b'modff\x00',symbol_name)
    cached=decode(0x11ea98,0x11eb70)
    assert ['0x11eadc','b.hi','#0x11eb64'] in cached
    assert ['0x11eb60','b.ls','#0x11eae8'] in cached


    supplement=json.loads((root/'public/data/stage-old-suspension.json').read_text(encoding='utf8'))
    empty_rows=[]
    for song,descriptor in supplement['songs'].items():
        track_bytes=(root/'public/assets/live-chibi'/descriptor['file']).read_bytes()
        assert hashlib.sha256(track_bytes).hexdigest()==descriptor['fileSha256']
        events=json.loads(track_bytes)['events']
        for i,event in enumerate(events):
            if event['erase'] or event['values'][3]:continue
            assert not any(event['values'][1:])
            tail=[e for e in events[i+1:] if e['command']==event['command'] and e['id']==event['id']]
            later=next((e for e in tail if not e['erase']),None)
            completed_erase=bool(later and any(e['erase'] and e['time']+200<=later['time'] for e in tail if e['time']<=later['time']))
            empty_rows.append(dict(song=song,sourceRow=event['sourceRow'],time=event['time'],command=event['command'],id=event['id'],
                nextShowTime=later['time'] if later else None,completedEraseBeforeNextShow=completed_erase))
    assert len(empty_rows)==118 and sum(e['nextShowTime'] is not None for e in empty_rows)==78
    assert not any(e['completedEraseBeforeNextShow'] for e in empty_rows)
    # These are source/byte proofs; no Unity graph is executed or emulated.
    receipt=dict(schemaVersion=1,unitySha256=unity_hash,source='config.arm64_v8a.apk/lib/arm64-v8a/libunity.so',
        icall='UnityEngine.Animator::set_speed',icallStringVa='0xd4ee4e',
        windows=[dict(name=name,start=hex(a),end=hex(b),sha256=hashlib.sha256(binary[a:b]).hexdigest())
            for name,a,b in [('register_set_speed',0x1c924c,0x1c9260),('set_speed_wrapper',0x1c6fc0,0x1c70cc),
                             ('Animator.SetSpeed',0xfb8cc,0xfb93c),('Animator.SyncSpeed',0xf7f1c,0xf7f60),('Controller.EffectiveSpeed',0x135c04,0x135ca0),
                             ('Controller.AdvanceStateTime',0x135ca0,0x135f70),('Controller.ClipNormalizedToTime',0x865bcc,0x865d64),
                             ('Clip.Constructor',0x8665a4,0x866650),('Clip.GetAsset',0x8666d0,0x8666d8),
                             ('Clip.SetTime',0x8680a4,0x8680d4),('Playable.SetTime',0x33a758,0x33a7e0),
                             ('Clip.LoopTime',0x6ab648,0x6ab768),('Streamed.EvaluateCubic',0x11e82c,0x11e9a4),
                             ('Streamed.FrameCache',0x11ea98,0x11eb70),('Binding.QuaternionAndEuler',0x118a70,0x118bf4),('Import.modff.PLT',0xaf9c0,0xaf9d0)]],
        registration=registration,setter=setter,emptyShows=empty_rows,
        conclusion='positive_infinity_stored_and_controller_state_time_becomes_nonfinite',
        libmImport=dict(symbol='modff',symbolIndex=241,relocationVa='0xae138',gotVa='0x10d2748',pltVa='0xaf9c0'),
        clipConclusion='settime_stores_nonfinite; positive_infinity_loop_fraction_zero; nan_streamed_cubic_stays_nan; quaternion_guard_is_not_euler_guard',
        unresolved='animation_output_transform_write_after_nan_euler_conversion')
    path=p/'chibi-old-suspension-engine.json'
    if args.write:path.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8')
    else:assert receipt==json.loads(path.read_text(encoding='utf8'))
    print('PASS Unity Animator icall, Infinity setter and controller state-time advance; Clip time/streamed branches verified; final Transform output NOT verified')
