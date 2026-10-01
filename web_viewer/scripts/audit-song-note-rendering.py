#!/usr/bin/env python3
"""Bind native note PNGs and flick prefab hints to screenshot-matched chart types."""
import argparse, hashlib, io, json, struct, sys, zipfile
from pathlib import Path
import UnityPy
ROOT=Path(__file__).resolve().parents[1]
MEMBER='Payload/BNEI0395.app/Data/data.unity3d'
def sha(b):return hashlib.sha256(b).hexdigest()
def encode(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
def png(im):
    stream=io.BytesIO();im.save(stream,format='PNG',optimize=True);return stream.getvalue()

def run(args):
    with zipfile.ZipFile(args.ipa) as z:binary=z.read(MEMBER)
    env=UnityPy.load(binary)
    objects={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
    audit=json.loads((ROOT/'config/song-chart-sprite-audit.v1.json').read_bytes())
    if audit['source']['dataSha256']!=sha(binary):raise ValueError('Different native sprite source')
    skins={};assets={};pending={}
    for atlas in ['Note1SpriteAtlas','Note2SpriteAtlas','Note3SpriteAtlas']:
        skins[atlas]={}
        for s in audit['sprites']:
            if s['atlas']!=atlas:continue
            role=s['name'].removeprefix('live_notes_')
            image=objects[s['spritePathId']].read().image.convert('RGBA')
            original=png(image)
            if sha(original)!=s['pngSha256']:raise ValueError('Native sprite changed')
            url='/assets/song-chart-sprites/'+s['file']
            if (ROOT/'public'/url.lstrip('/')).read_bytes()!=original:raise ValueError('Native PNG drift')
            # Shadows on sideways flick sprites have nonzero alpha throughout
            # the original square. Use bright body bounds for alignment only;
            # original decoded PNG bytes are preserved.
            pixels=image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata()
            coords=[(i%image.width,i//image.width) for i,(r,g,b,a) in enumerate(pixels) if a>=128 and max(r,g,b)>=180]
            bounds=[min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords)+1,max(y for x,y in coords)+1]
            skins[atlas][role]=dict(url=url,width=image.width,height=image.height,displayBounds=bounds,spritePathId=s['spritePathId'])
            assets[url]=dict(sha256=sha(original),bytes=len(original))
    # Native filled/outlined chevron texture: two horizontal cells, right/up.
    texture=objects[618].read()
    if texture.m_Name!='fx_in_flicknotes_effects':raise ValueError('Flick texture identity changed')
    hints={}
    for role,rect in [('right',[0,0,512,512]),('up',[512,0,1024,512])]:
        image=texture.image.convert('RGBA').crop(rect)
        content=png(image);filename=f'flick-hint-{role}.png'
        pending[filename]=content;url='/assets/song-chart-hints/'+filename
        hints[role]=dict(url=url,width=image.width,height=image.height,displayBounds=image.getchannel('A').getbbox(),
                        texturePathId=618,sourceRect=rect,pixelSha256=sha(image.tobytes()))
        assets[url]=dict(sha256=sha(content),bytes=len(content))
    particles={}
    names={'NoteEffectFlickLeft_1':'swipe_left','NoteEffectFlickRight_1':'swipe_right','NoteEffectFlickUp_1':'swipe_up'}
    def visit(go,role):
        for component in go.read().m_Component:
            obj=component.component.deref()
            if obj.type.name=='Transform':
                for child in obj.read().m_Children:visit(child.read().m_GameObject.deref(),role)
            if obj.type.name=='ParticleSystem':
                t=obj.read_typetree()
                particles[role]=dict(pathId=obj.path_id,startColor=t['InitialModule']['startColor']['maxColor'],
                    uvTiles=[t['UVModule']['tilesX'],t['UVModule']['tilesY']])
    for o in objects.values():
        if o.type.name=='GameObject' and o.read().m_Name in names:visit(o,names[o.read().m_Name])
    if len(particles)!=3:raise ValueError('Missing native arrow particle settings')
    metadata=args.metadata.read_bytes();sys.path.insert(0,str(ROOT.parent/'data_pipeline'))
    import extract_il2cpp_protobuf_schema as native
    _,sections=native.parse_header(metadata);strings=native.build_string_reader(metadata,sections['string'])
    types=native.read_records(metadata,sections['type_definitions'],native.TYPE_DEFINITION_FORMAT)
    fields=native.read_records(metadata,sections['fields'],native.FIELD_DEFINITION_FORMAT)
    defaults={i:pos for i,ty,pos in native.read_records(metadata,sections['field_default_values'],native.FIELD_DEFAULT_FORMAT)}
    enums={}
    for i,t in enumerate(types):
        name=strings(t[0])
        if name not in {'EventNoteType','EventNoteEndType','NoteDrawType','NoteHitType'}:continue
        values=[]
        for k in range(t[8],t[8]+t[18]):
            if k not in defaults:continue
            offset=sections['default_value_data'][0]+defaults[k];raw=metadata[offset:offset+4]
            values.append(dict(name=strings(fields[k][0]),fieldIndex=k,byteOffset=offset,hex=raw.hex(),value=struct.unpack('<i',raw)[0]))
        enums[name]=dict(typeDefinitionIndex=i,values=values)
    chart_path=ROOT/'public/data/song_charts/cfprde-4.json';chart=json.loads(chart_path.read_bytes())
    reference_notes=[n for n in chart['notes'] if n['sourceIndex'] in [172,176,180,181,239,1035]]
    assert next(n for n in reference_notes if n['sourceIndex']==239)['type']=='LARGE'
    assert next(n for n in reference_notes if n['sourceIndex']==239)['tick']==30720
    special_path=ROOT/'public/data/song_charts/knwonl-4.json';special_chart=json.loads(special_path.read_bytes())
    special_note=next(n for n in special_chart['notes'] if n['sourceIndex']==610)
    assert (special_note['type'],special_note['tick'],special_note['start'])==('SPECIAL',74400,2)
    middle_note=next(n for n in special_chart['notes'] if n['sourceIndex']==994)
    framework=args.framework.read_bytes()
    if struct.unpack_from('<I',framework)[0]!=0xfeedfacf:raise ValueError('Expected 64-bit Mach-O framework')
    commands=struct.unpack_from('<I',framework,16)[0];offset=32;encryption=[]
    for _ in range(commands):
        command,size=struct.unpack_from('<II',framework,offset)
        if command==0x2c:
            cryptoff,cryptsize,cryptid=struct.unpack_from('<III',framework,offset+8)
            encryption.append(dict(cryptoff=cryptoff,cryptsize=cryptsize,cryptid=cryptid))
        offset+=size
    if not encryption or encryption[0]['cryptid']!=1:raise ValueError('Native code boundary changed; revisit method inspection')
    result=dict(schemaVersion=1,source=dict(dataSha256=sha(binary),metadataSha256=sha(metadata),frameworkSha256=sha(framework),encryption=encryption),skins=skins,
        hints=hints,particles=particles,assets=assets,nativeEnums=enums,
        mapping=dict(SMALL='normal',LARGE='p_skill',FLICK_LEFT='swipe_left',FLICK_UP='swipe_up',FLICK_RIGHT='swipe_right',
            HOLD='normal',VARIABLE_HOLD='normal',LARGE_HOLD='p_skill',LARGE_VARIABLE_HOLD='p_skill',SPECIAL='sp'),
        evidence=dict(songCode='cfprde',difficultyType=4,chartSha256=sha(chart_path.read_bytes()),referenceNotes=reference_notes,
            largeMapping='screenshot matched: purple star on lane 4 before LARGE tick 30720; LARGE hold family follows the same native LARGE declaration',
            specialMapping='user screenshot confirmed: K.now O.nly EX SPECIAL sourceIndex 610, tick 74400, lane 2 uses green 315 crest',
            specialReference=dict(songCode='knwonl',difficultyType=4,chartSha256=sha(special_path.read_bytes()),note=special_note),
            middleReference=dict(songCode='knwonl',difficultyType=4,note=middle_note,
                interpretation='native live_notes_middle at interior source poly nodes; automatic judgement generation/merging unverified'),
            flickHint='native particle texture and start colors; static compositing/placement estimated',
            simultaneousLine='native sameTiming fields and screenshot; group raw heads/tails at identical tick, no synthesized middle nodes',
            methodCode='UnityFramework LC_ENCRYPTION_INFO_64 cryptid=1; live branch disassembly unavailable'))
    manifest=ROOT/'config/song-note-rendering.v1.json'
    if args.check:
        if json.loads(manifest.read_bytes())!=json.loads(encode(result)):raise ValueError('Rendering audit drift')
        for f,b in pending.items():
            if (ROOT/'public/assets/song-chart-hints'/f).read_bytes()!=b:raise ValueError('Arrow PNG drift')
    else:
        manifest.write_bytes(encode(result))
        for f,b in pending.items():
            target=ROOT/'public/assets/song-chart-hints'/f;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
    print(f"Native note rendering {'verified' if args.check else 'bound'}: 3 skins, 2 chevron cells, 3 prefab colors; LARGE purple-star reference matched")

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--ipa',type=Path,required=True)
    p.add_argument('--metadata',type=Path,default=ROOT/'.analysis/sidem_ios_keyfiles/global-metadata.dat')
    p.add_argument('--framework',type=Path,default=ROOT/'.analysis/sidem_ios_keyfiles/UnityFramework')
    p.add_argument('--check',action='store_true');run(p.parse_args())
