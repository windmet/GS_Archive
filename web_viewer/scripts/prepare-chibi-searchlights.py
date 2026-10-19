"""Source-bound Searchlight instructions and native sprite resources."""
import csv,io,json,struct,sys,argparse
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("whole",ROOT/"scripts/prepare-chibi-whole-screen.py")
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)

def extract(native_elf):
    import UnityPy
    e=w.load('search_effects','prepare-live-chibi-stage-effects.py');a=w.load('search_audit','audit-live-chibi-stage-objects.py')
    sources=e.load_archive_sources(None);raw=e.read_unity_data(e.find_xapk(None,sources.xapk_file));env=UnityPy.load(raw)
    path=ROOT/'public/assets/live-chibi/choreography/index.json';index=json.loads(path.read_text(encoding='utf8'));songs={};names=set();name_codes={}
    for code in sorted({s['songCode'] for s in index['songs']}):
        file=sources.raw_root/f'asset/song_{code}.unity3d';bundle=w.sha(file.read_bytes());by={s['id']:s for s in index['songs'] if s['songCode']==code}
        for ob in UnityPy.load(str(file)).objects:
            if ob.type.name!='TextAsset' or ob.read().m_Name not in by:continue
            text=ob.read();payload=w.text_asset_payload(text);events=[]
            for rowno,row in enumerate(csv.DictReader(io.StringIO(payload.decode('utf-8-sig',errors='surrogateescape'))),2):
                if not row.get('type','').startswith('Searchlight_') or not (row.get('time') or '').strip():continue
                events.append(dict(time=float(row['time']),command=row['type'],values=[row.get(f'value{i}') or '' for i in range(1,12)],hide=row.get('value101')=='1',eraseDuration=float(row.get('value102') or 0) if row.get('value101')=='1' else 0,sourceRow=rowno))
                if row['type'] in ['Searchlight_show','Searchlight_show_2'] and row.get('value2') and row.get('value101')!='1':names.add(row['value2']);name_codes.setdefault(row['value2'],set()).add(code)
            song=by[text.m_Name];songs[text.m_Name]=dict(songCode=code,source=song['source'],bundleSha256=bundle,textSha256=w.sha(payload),events=sorted(events,key=lambda e:(e['time'],e['sourceRow'])))
    owner=next(o for o in env.objects if o.assets_file.name=='resources.assets' and o.path_id==129244)
    script=owner.get_raw_data();w.require(len(script)==68,'Changed SearchLight script')
    sr=a.local_object(owner,dict(zip(['m_FileID','m_PathID'],struct.unpack_from('<iq',script,44))),'SpriteRenderer');tree=sr.read_typetree()
    material=a.material_record(sr,tree['m_Materials'][0]);w.require(material['shader']['name']=='ohashi/SimpleAdd','Changed Searchlight material')
    shader=a.local_object(sr,dict(m_FileID=0,m_PathID=1014),'Shader');state=shader.read_typetree()['m_ParsedForm']['m_SubShaders'][0]['m_Passes'][0]['m_State'];material['nativeBlend']={k:state['rtBlend0'][k]['val'] for k in ['srcBlend','destBlend','blendOp']}
    go=a.local_object(sr,tree['m_GameObject'],'GameObject');chain=a.transform_chain(go)
    w.require(all(t['position']==dict(x=0,y=0,z=0) and t['rotation']==dict(x=0,y=0,z=0,w=1) and t['scale']==dict(x=1,y=1,z=1) for t in chain),'Changed searchlight geometry')
    assets={};images={}
    for name in sorted(names):
        matches=[o for o in env.objects if o.type.name=='Sprite' and o.read().m_Name==name]
        origin=None
        if not matches:
            for code in sorted(name_codes[name]):
                rawpath=sources.raw_root/f'asset/song_{code}.unity3d'
                candidates=[o for o in UnityPy.load(str(rawpath)).objects if o.type.name=='Sprite' and o.read().m_Name==name]
                if candidates:
                    matches=candidates;origin=dict(bundle=rawpath.name,sha256=w.sha(rawpath.read_bytes()));break
        if not matches:assets[name]=dict(unresolved='sprite_resource_unresolved');continue
        w.require(len(matches)==1,'Ambiguous Searchlight Sprite');ob=matches[0];sprite=ob.read_typetree();image=ob.read().image.convert('RGBA');images[name]=image
        assets[name]=dict(bundle=origin,source=a.source_ref(ob),rawSha256=w.sha(ob.get_raw_data()),file=f'/data/stage-searchlights/{name}.png',
            width=image.width*100/sprite['m_PixelsToUnits'],height=image.height*100/sprite['m_PixelsToUnits'],anchorX=sprite['m_Pivot']['x'],anchorY=1-sprite['m_Pivot']['y'])
    data=dict(schemaVersion=1,contract='native-searchlights-v1',choreographyIndexSha256=w.sha(path.read_bytes()),unityDataSha256=w.sha(raw),songs=songs,assets=assets,
        prefab=dict(script=a.source_ref(owner),rawSha256=w.sha(script),rawHex=script.hex(),renderer=a.source_ref(sr),material=material,chain=chain))
    elf=native_elf.read_bytes();w.require(w.sha(elf)=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e','Wrong native ELF')
    ph=struct.unpack_from('<Q',elf,32)[0];sz,n=struct.unpack_from('<HH',elf,54);segments=[struct.unpack_from('<IIQQQQQQ',elf,ph+i*sz) for i in range(n)]
    def off(a):return next(p[2]+a-p[3] for p in segments if p[0]==1 and p[3]<=a<p[3]+p[5])
    methods=[('SearchLight',0x2224264,0x22259b4),('OvalMoveCallback',0x1c9e748,0x1c9e81c),('OvalMoveTrampoline',0x2227578,0x2227580)]
    data['nativeSemantics']=dict(elfSha256=w.sha(elf),methods=[dict(name=name,start=hex(a),end=hex(b),sha256=w.sha(elf[off(a):off(b)])) for name,a,b in methods],
        ovalReturnAngles=list(struct.unpack_from('<4f',elf,off(0x32d4d80))),ovalFirstAngles=list(struct.unpack_from('<4f',elf,off(0x32d4d90))))
    w.require(data['nativeSemantics']['ovalReturnAngles']==[360,-360,0,0] and data['nativeSemantics']['ovalFirstAngles']==[180,-180,180,-180],'Changed oval mode table')
    return data,images

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--native-elf',type=Path,required=True);args=parser.parse_args();data,images=extract(args.native_elf)
    for name,image in images.items():
        path=ROOT/'public'/data['assets'][name]['file'].lstrip('/')
        if args.write:path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
        else:
            from PIL import Image
            w.require(Image.open(path).convert('RGBA').tobytes()==image.tobytes(),'Searchlight Sprite pixels changed')
        data['assets'][name]['pngSha256']=w.sha(path.read_bytes())
    path=ROOT/'public/data/stage-searchlights.json'
    if args.write:path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    else:w.require(json.loads(path.read_text(encoding='utf8'))==data,'Searchlight source binding changed')
    print(json.dumps(dict(songs=len(data['songs']),commands=sum(len(s['events']) for s in data['songs'].values()),sprites=len(images),unresolved=[k for k,v in data['assets'].items() if 'unresolved' in v])))
if __name__=='__main__':main()
