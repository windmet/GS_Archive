"""Bind Whole_screen commands to APK prefabs; never rewrite shared assets."""
import argparse,csv,hashlib,importlib.util,io,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from live_chibi_raw_semantics import text_asset_payload
from live_chibi_native_particle_mask import native_particle_texture_sampling

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def sha(data):return hashlib.sha256(data).hexdigest()
def require(ok,message):
    if not ok:raise ValueError(message)
def curve(c):
    require(c['minMaxState'] in (0,1,3),'Unimplemented whole-screen curve mode')
    keys=c['maxCurve']['m_Curve']
    require(all(k['weightedMode']==0 for k in keys),'Weighted whole-screen curve')
    return dict(mode=c['minMaxState'],scalar=c['scalar'],minScalar=c['minScalar'],
        keys=[{k:v[k] for k in ('time','value','inSlope','outSlope')} for v in keys])
def gradient(g):
    require(g['m_Mode']==0,'Fixed gradient unsupported')
    return dict(colors=[dict(time=g[f'ctime{i}']/65535,**g[f'key{i}']) for i in range(g['m_NumColorKeys'])],
        alphas=[dict(time=g[f'atime{i}']/65535,value=g[f'key{i}']['a']) for i in range(g['m_NumAlphaKeys'])])

def particle_model(p):
    m=p['modules'];i=m['InitialModule'];e=m['EmissionModule'];s=m['ShapeModule'];r=p['renderer'];main=p['main']
    require(set(m)<=set(['InitialModule','ShapeModule','EmissionModule','SizeModule','RotationModule','ColorModule','UVModule','NoiseModule']),'Unknown particle module')
    require(s['type']==5 and r['renderMode']==0 and r['alignment']==0 and not i['size3D'] and not i['rotation3D'],'Non-view box particle')
    require(main['looping'] and not main['prewarm'] and main['simulationSpeed']==1 and main['moveWithTransform']==0 and main['scalingMode'] in (0,1),'Unsupported particle simulation')
    require(main['startDelay']['scalar']==0 and i['gravityModifier']['scalar']==0,'Delay/gravity requires another profile')
    require(e['rateOverTime']['minMaxState']==0 and e['rateOverDistance']['scalar']==0 and not e['m_Bursts'],'Noncontinuous emission')
    require(i['startColor']['minMaxState'] in (0,4) and m['ColorModule']['gradient']['minMaxState']==1,'Random gradient unsupported')
    require(all(s[k]==0 for k in ['randomDirectionAmount','sphericalDirectionAmount','randomPositionAmount']),'Random shape direction unsupported')
    mat=r['materials'][0]
    require(len(r['materials'])==1 and mat['shader']['name']=='Mobile/Particles/Additive' and mat['shader']['pathId']=='950','Unknown whole-screen material')
    require(len(mat['textures'])==1 and mat['textures'][0]['property']=='_MainTex','Unknown texture binding')
    tex=mat['textures'][0];uv=m.get('UVModule')
    require(tex['scale']==dict(x=1,y=1) and tex['offset']==dict(x=0,y=0),'Texture UV transform unsupported')
    if uv:require(uv['mode']==0 and uv['timeMode']==0 and uv['animationType']==0 and uv['flipU']==uv['flipV']==0,'Unknown UV animation')
    return dict(source={k:p[k] for k in ('serializedFile','pathId','parameterTreeSha256')},texture=tex['pathId'],
        duration=main['lengthInSec'],capacity=i['maxNumParticles'],rate=e['rateOverTime']['scalar'],
        scalingMode=main['scalingMode'],shape=s,chain=p['transformChain'],
        lifetime=curve(i['startLifetime']),size=curve(i['startSize']),speed=curve(i['startSpeed']),rotation=curve(i['startRotation']),
        color=i['startColor']['maxColor'],colorMode=i['startColor']['minMaxState'],
        colorGradient=gradient(i['startColor']['maxGradient']),colorOverLife=gradient(m['ColorModule']['gradient']['maxGradient']),
        sizeOverLife=curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
        angularVelocity=curve(m['RotationModule']['curve']) if 'RotationModule' in m else None,
        uv=dict(columns=uv['tilesX'],rows=uv['tilesY'],cycles=uv['cycles'],startFrame=curve(uv['startFrame']),frameOverTime=curve(uv['frameOverTime'])) if uv else None,
        noise=m.get('NoiseModule'),deferred=['unity_noise_displacement','unity_auto_random_seed'] if 'NoiseModule' in m else ['unity_auto_random_seed'])

def extract():
    import UnityPy
    effects=load('whole_effects','prepare-live-chibi-stage-effects.py');audit=load('whole_audit','audit-live-chibi-stage-objects.py')
    sources=effects.load_archive_sources(None);data=effects.read_unity_data(effects.find_xapk(None,sources.xapk_file));env=UnityPy.load(data)
    fixture=dict(unityDataSha256=sha(data),prefabs=[]);models={};images={};textures={}
    for go in env.objects:
        if go.type.name!='GameObject' or not go.read().m_Name.startswith('LiveObjectWhole_screen_Type'):continue
        typ=int(go.read().m_Name.rsplit('Type',1)[1]);gt=go.read_typetree()
        owner=next(audit.local_object(go,c['component']) for c in gt['m_Component'] if audit.local_object(go,c['component']).type.name=='MonoBehaviour')
        v=owner.read(check_read=False);cls=v.m_Script.read().m_ClassName;raw=owner.get_raw_data()
        native=dict(type=typ,source=audit.source_ref(go),script=audit.source_ref(owner),className=cls,rawSha256=sha(raw),rawHex=raw.hex())
        if cls=='LiveObjectWholeScreenParticle':
            count=struct.unpack_from('<i',raw,32)[0]
            native['particles']=[audit.particle_record(owner,dict(zip(['m_FileID','m_PathID'],struct.unpack_from('<iq',raw,36+j*12))),True) for j in range(count)]
            if typ==6:
                models[str(typ)]=dict(kind='unsupported',reason='confetti_local_3d_rotation_gravity_noise_solver',source=native['script'])
            else:
                systems=[particle_model(p) for p in native['particles']]
                models[str(typ)]=dict(kind='particle',systems=systems,source=native['script'],deferred=sorted({d for s in systems for d in s['deferred']}))
                for system in systems:
                    ob=owner.assets_file.objects[int(system['texture'])];tex=ob.read();images[system['texture']]=tex.image.convert('RGBA')
                    textures[system['texture']]=dict(source=audit.source_ref(ob),rawSha256=sha(ob.get_raw_data()),width=tex.m_Width,height=tex.m_Height,
                        file=f'/data/stage-whole-screen/texture-{system["texture"]}.png',nativeSampling=native_particle_texture_sampling(tex))
        else:
            require(cls=='LiveObjectWholeScreenSprite','Unknown whole-screen object')
            sr=audit.local_object(owner,dict(zip(['m_FileID','m_PathID'],struct.unpack_from('<iq',raw,32))),'SpriteRenderer');t=sr.read_typetree();native['renderer']=dict(source=audit.source_ref(sr),tree=t)
            require(t['m_Sprite']==dict(m_FileID=4,m_PathID=220),'Changed rectangle Sprite PPtr')
            sp=next(o for o in env.objects if o.assets_file.name=='sharedassets0.assets' and o.path_id==220)
            st=sp.read_typetree();require(st['m_Rect']==dict(x=0,y=0,width=4,height=4) and st['m_PixelsToUnits']==100,'Changed native rectangle size')
            image=sp.read().image.convert('RGBA');require(image.getextrema()==((255,255),)*4,'Native rectangle is not solid white')
            native['sprite']=dict(source=audit.source_ref(sp),rawSha256=sha(sp.get_raw_data()),rect=st['m_Rect'],pixelsToUnits=st['m_PixelsToUnits'])
            srgo=audit.local_object(sr,t['m_GameObject'],'GameObject');chain=audit.transform_chain(srgo)
            require(len(chain)==1 and chain[0]['scale']==dict(x=1000,y=1000,z=1),'Changed whole-screen rectangle transform')
            native['chain']=chain
            models[str(typ)]=dict(kind='sprite',source=native['script'],color=t['m_Color'],width=4000,height=4000,initialDepth=t['m_SortingOrder'])
        fixture['prefabs'].append(native)
    require(set(models)==set(map(str,range(1,7))),'Incomplete whole-screen type binding')
    index_path=ROOT/'public/assets/live-chibi/choreography/index.json';index=json.loads(index_path.read_text(encoding='utf8'));songs={};by_id={s['id']:s for s in index['songs']}
    for code in sorted({s['songCode'] for s in index['songs']}):
        path=sources.raw_root/f'asset/song_{code}.unity3d';bundle_hash=sha(path.read_bytes())
        for ob in UnityPy.load(str(path)).objects:
            if ob.type.name!='TextAsset':continue
            text=ob.read()
            if text.m_Name not in by_id:continue
            payload=text_asset_payload(text);events=[]
            for row_no,row in enumerate(csv.DictReader(io.StringIO(payload.decode('utf-8-sig',errors='surrogateescape'))),2):
                if row.get('type')!='Whole_screen':continue
                if not (row.get('time') or '').strip():continue
                hide=row.get('value101')=='1';typ=int(row['value1'] or 0)
                events.append(dict(time=float(row['time']),type=typ,hide=hide,duration=int(row.get('value102' if hide else 'value2') or 0),
                    depth=None if hide else int(row.get('value3') or 0),sourceRow=row_no))
                if str(typ) not in models:events[-1]['unresolvedReason']='missing_type_resource'
            songs[text.m_Name]=dict(songCode=code,source=by_id[text.m_Name]['source'],bundleSha256=bundle_hash,textSha256=sha(payload),events=events)
    require(len(songs)==118,'Incomplete Whole_screen RAW coverage')
    return dict(schemaVersion=1,contract='native-whole-screen-v1',choreographyIndexSha256=sha(index_path.read_bytes()),unityDataSha256=sha(data),models=models,textures=textures,songs=songs),fixture,images

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--native-elf',type=Path,required=True);args=parser.parse_args()
    data,fixture,images=extract();elf=args.native_elf.read_bytes();require(sha(elf)=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e','Wrong IL2CPP ELF')
    ph=struct.unpack_from('<Q',elf,32)[0];sz,n=struct.unpack_from('<HH',elf,54);segments=[struct.unpack_from('<IIQQQQQQ',elf,ph+i*sz) for i in range(n)]
    def off(a):return next(p[2]+a-p[3] for p in segments if p[0]==1 and p[3]<=a<p[3]+p[5])
    windows=[('GetWholeScreenTargetObject',0x1feded0,0x1fedff0),('Particle.PlayEffect',0x1c03900,0x1c039f0),('Particle.EraseEffect',0x1c039f0,0x1c03afc),
        ('Particle.PlayCallback',0x1ca04c0,0x1ca0574),('Particle.StopCallback',0x1ca057c,0x1ca0664),('Particle.Deactivate',0x1ca066c,0x1ca06c0),
        ('Sprite.PlayEffect',0x1c03b60,0x1c03c00),('Sprite.EraseEffect',0x1c03c00,0x1c03cdc)]
    fixture['elfSha256']=sha(elf);fixture['methods']=[dict(name=name,start=hex(a),end=hex(b),sha256=sha(elf[off(a):off(b)])) for name,a,b in windows]
    for identity,image in images.items():
        path=ROOT/'public'/data['textures'][identity]['file'].lstrip('/')
        if args.write:path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
        else:
            from PIL import Image
            require(Image.open(path).convert('RGBA').tobytes()==image.tobytes(),'Changed exported native texture')
        data['textures'][identity]['pngSha256']=sha(path.read_bytes())
    for path,value in [(ROOT/'public/data/stage-whole-screen.json',data),(ROOT/'scripts/fixtures/chibi-whole-screen-native.json',fixture)]:
        if args.write:path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
        else:require(json.loads(path.read_text(encoding='utf8'))==value,f'Native Whole_screen receipt changed: {path.name}')
    print(json.dumps(dict(arrangements=len(data['songs']),commands=sum(len(s['events']) for s in data['songs'].values()),textures=len(images),types={k:v['kind'] for k,v in data['models'].items()})))
if __name__=='__main__':main()
