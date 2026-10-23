"""Replay exact APK Smoke bindings and all indexed RAW Smoke commands.

This is source evidence, not a renderer registration or visual acceptance.
Default compares the saved fixture; --write requires a managed instruction proof.
"""
import argparse,csv,hashlib,io,json,runpy,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from live_chibi_raw_semantics import load_raw_live_semantics
from live_chibi_native_particle_mask import native_particle_texture_sampling
sha=lambda value:hashlib.sha256(value).hexdigest()
WINDOWS={'25c16c4':0x5c,'25c1720':0x5c,'2225d04':0xf0,'2225df4':0x194,'2225f88':0x124,'1c9ec74':0x1c,'1c9ec90':0x24,
    '1d6f858':0xac,'1d6f904':0x40,'221a2d0':0x1a0,'221a470':0x2bc}

def managed_windows(path):
    elf=path.read_bytes()
    common=json.loads((ROOT/'scripts/fixtures/chibi-spatial-context-native.json').read_text(encoding='utf8'))
    assert sha(elf)==common['managedBinarySha256'],'Changed managed binary'
    assert elf[:6]==b'\x7fELF\x02\x01','Expected little-endian ELF64'
    offset=struct.unpack_from('<Q',elf,32)[0];entry_size,count=struct.unpack_from('<HH',elf,54)
    segments=[struct.unpack_from('<IIQQQQQQ',elf,offset+i*entry_size) for i in range(count)]
    windows=[]
    for address_hex,length in WINDOWS.items():
        address=int(address_hex,16)
        segment=next(s for s in segments if s[0]==1 and s[3]<=address and address+length<=s[3]+s[5])
        start=segment[2]+address-segment[3]
        payload=elf[start:start+length]
        windows.append(dict(address=address_hex,bytes=payload.hex(),sha256=sha(payload)))
    return dict(schemaVersion=1,managedBinarySha256=sha(elf),windows=windows)

def extract(managed):
    fx=runpy.run_path(str(ROOT/'scripts/prepare-live-chibi-stage-effects.py'),run_name='smoke_fx')
    audit=runpy.run_path(str(ROOT/'scripts/audit-live-chibi-stage-objects.py'),run_name='smoke_audit')
    emitter=runpy.run_path(str(ROOT/'scripts/prepare-chibi-object-emitters.py'),run_name='smoke_emitter')
    sources=fx['load_archive_sources'](None)
    unity=fx['read_unity_data'](sources.xapk_file);env=fx['UnityPy'].load(unity)
    by={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
    controller=by[132564];value=controller.read(check_read=False)
    script=value.m_Script.read()
    assert (script.m_ClassName,script.m_Namespace,script.m_AssemblyName)==('LiveObjectSmoke','Growing.Live','Assembly-CSharp.dll')
    raw=controller.get_raw_data();assert len(raw)==132 and struct.unpack_from('<i',raw,28)[0]==0
    groups=[]
    for variant,offset in [(1,32),(2,44)]:
        file,path=struct.unpack_from('<iq',raw,offset);assert file==0 and by[path].type.name=='GameObject'
        go=by[path];chain=audit['transform_chain'](go)
        assert chain[-1]['pathId']=='44553'
        groups.append(dict(variant=variant,offset=offset,source=audit['source_ref'](go),name=go.read().m_Name,
            rawSha256=sha(go.get_raw_data()),chain=chain,systems=[]))
    count=struct.unpack_from('<i',raw,56)[0];assert count==6
    particles=[]
    for i in range(count):
        file,path=struct.unpack_from('<iq',raw,60+12*i);assert file==0
        particle=audit['particle_record'](controller,dict(m_FileID=file,m_PathID=path),True)
        renderer=by[int(particle['renderer']['pathId'])];rt=renderer.read_typetree()
        particle['rendererBounds']={k:rt[k] for k in ['m_MinParticleSize','m_MaxParticleSize']}
        particle['rendererRawSha256']=sha(renderer.get_raw_data())
        matched=[g for g in groups if g['chain'][0]['pathId'] in [t['pathId'] for t in particle['transformChain']]]
        assert len(matched)==1;matched[0]['systems'].append(str(path))
        try:
            emitter['model'](particle,True);gate={'accepted':True}
        except ValueError as error:gate={'accepted':False,'firstRejectedGuard':str(error)}
        particle['currentGenericSampler']=gate
        particles.append(particle)
    assert [len(g['systems']) for g in groups]==[2,4]
    textures={};shaders={}
    for particle in particles:
        for material in particle['renderer']['materials']:
            shader=by[int(material['shader']['pathId'])]
            shaders[str(shader.path_id)]={'source':audit['source_ref'](shader),'rawSha256':sha(shader.get_raw_data())}
            for ref in material['textures']:
                if ref.get('type')!='Texture2D':continue
                reader=by[int(ref['pathId'])];texture=reader.read()
                textures[str(reader.path_id)]={'source':audit['source_ref'](reader),'name':texture.m_Name,
                    'rawSha256':sha(reader.get_raw_data()),'rgbaSha256':sha(texture.image.convert('RGBA').tobytes()),
                    'width':texture.m_Width,'height':texture.m_Height,'sampling':native_particle_texture_sampling(texture)}
    index_bytes=(ROOT/'public/assets/live-chibi/choreography/index.json').read_bytes()
    index=json.loads(index_bytes);records=load_raw_live_semantics(sources.raw_root/'asset')['choreography'];tracks={}
    for song in index['songs']:
        record=records[song['source'].removesuffix('.csv')]
        rows=list(csv.DictReader(io.StringIO(record['payload'].decode('utf-8-sig',errors='surrogateescape'))))
        commands=[]
        for source_row,row in enumerate(rows,2):
            if row['type']!='Smoke':continue
            commands.append(dict(sourceRow=source_row,time=int(row['time']),
                values={key:row[key] for key in row if key.startswith('value')}))
        if commands:
            assert record['bundles']==[f'song_{song["songCode"]}.unity3d']
            assert sha((sources.raw_root/'asset'/record['bundles'][0]).read_bytes())==record['bundleSha256']
            tracks[song['id']]={'songCode':song['songCode'],'source':song['source'],
                'raw':{key:record[key] for key in ['sha256','bundles','bundleSha256']},'commands':commands}
    assert len(index['songs'])==118 and sum(len(t['commands']) for t in tracks.values())==5
    assert {int(e['values']['value1']) for t in tracks.values() for e in t['commands']}=={1}
    common_path=ROOT/'scripts/fixtures/chibi-spatial-context-native.json'
    common=json.loads(common_path.read_text(encoding='utf8'))
    assert sha(unity)==common['unityDataSha256']
    assert managed['managedBinarySha256'].lower()==common['managedBinarySha256']
    assert {w['address']:len(bytes.fromhex(w['bytes'])) for w in managed['windows']}==WINDOWS
    for window in managed['windows']:assert sha(bytes.fromhex(window['bytes']))==window['sha256']
    return dict(schemaVersion=1,status='source_audited_consumer_missing',unityDataSha256=sha(unity),
        choreographyIndexSha256=sha(index_bytes),managed=managed,
        controller=dict(source=audit['source_ref'](controller),rawSha256=sha(raw),bytes=raw.hex(),
            chain=audit['transform_chain'](value.m_GameObject.deref())),
        factory=dict(commonContextSha256=sha(common_path.read_bytes()),container=common['container']['source'],
            parent=common['container']['parent'],rootTrsResetAt='221a470'),
        groups=groups,particles=particles,textures=textures,shaders=shaders,songs=tracks,
        boundaries=['Runtime world/local axes, stage scale and camera context still need a joined scene proof',
            'alignment=1, local simulation and moving edge emission are not admitted by the generic sampler',
            'Nonuniform bounds, native RNG and full scene/camera/material parity require further proof'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--write',action='store_true');p.add_argument('--managed-proof',type=Path)
    p.add_argument('--native-il2cpp',type=Path,help='Also verify each saved instruction window against the original ELF')
    args=p.parse_args();out=ROOT/'scripts/fixtures/chibi-smoke-source.json'
    if args.write and not (args.managed_proof or args.native_il2cpp):p.error('--write requires --native-il2cpp or --managed-proof')
    if args.managed_proof:managed=json.loads(args.managed_proof.read_text(encoding='utf8'))
    elif args.native_il2cpp:managed=managed_windows(args.native_il2cpp)
    else:managed=json.loads(out.read_text(encoding='utf8'))['managed']
    if args.native_il2cpp:assert managed_windows(args.native_il2cpp)==managed,'Changed native Smoke instruction windows'
    data=extract(managed)
    if args.write:out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    else:assert json.loads(out.read_text(encoding='utf8'))==data,'Changed Smoke RAW/source/guard binding'
    print(json.dumps(dict(groups=len(data['groups']),systems=len(data['particles']),arrangements=len(data['songs']),
        commands=sum(len(t['commands']) for t in data['songs'].values()),status=data['status'])))
