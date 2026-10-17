"""Extract bounded box/point emitters; keep noise/stretch as explicit gaps."""
import json,sys,argparse,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('whole',ROOT/'scripts/prepare-chibi-whole-screen.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
from live_chibi_native_particle_mask import require_native_particle_mask,native_particle_texture_sampling

def model(p):
    m=p['modules'];i=m['InitialModule'];e=m['EmissionModule'];r=p['renderer'];main=p['main'];s=m.get('ShapeModule');u=m.get('UVModule');c=m.get('ClampVelocityModule')
    w.require(set(m)<=set(['InitialModule','ShapeModule','EmissionModule','UVModule','SizeModule','ColorModule','ClampVelocityModule']),'Unsupported module')
    w.require(r['renderMode']==0 and r['alignment'] in [0,2] and not i['size3D'] and not i['rotation3D'],'Unsupported renderer')
    w.require(not main['prewarm'] and main['simulationSpeed']==1 and main['moveWithTransform']==0 and main['scalingMode']==0,'Unsupported clock/scale')
    w.require(i['gravityModifier']['scalar']==0 and i['startColor']['minMaxState']==0,'Unsupported initial state')
    w.require(not s or s['type']==5,'Unsupported shape')
    if s:w.require(s['randomDirectionAmount']==s['sphericalDirectionAmount']==s['randomPositionAmount']==0 and not s['alignToDirection'],'Unsupported shape direction')
    w.require(all(t['rotation']['x']==t['rotation']['y']==0 for t in p['transformChain']),'Nonplanar emitter transform')
    w.require(e['rateOverTime']['minMaxState']==0 and e['rateOverDistance']['scalar']==0,'Unsupported emission rate')
    bursts=[]
    for b in e['m_Bursts']:
        w.require(b['countCurve']['minMaxState']==0 and b['cycleCount']==1 and b['probability']==1,'Unsupported burst')
        bursts.append(dict(time=b['time'],count=int(b['countCurve']['scalar'])))
    if u:w.require(u['mode']==u['timeMode']==u['animationType']==0 and u['flipU']==u['flipV']==0,'Unsupported sheet')
    if c:w.require(not c['separateAxis'] and c['drag']['scalar']==0 and c['magnitude']['minMaxState']==0,'Unsupported velocity limit')
    mat=r['materials'][0];masked=mat['shader']['name'].startswith('Alpha Masked/')
    if masked:require_native_particle_mask(mat)
    else:w.require(mat['shader']['name']=='Mobile/Particles/Additive','Unsupported material')
    textures={t['property']:t['pathId'] for t in mat['textures']}
    one=dict(colors=[dict(time=t,r=1,g=1,b=1,a=1) for t in [0,1]],alphas=[dict(time=t,value=1) for t in [0,1]])
    return dict(source={k:p[k] for k in ['serializedFile','pathId','parameterTreeSha256']},name=p['name'],alignment=r['alignment'],sortingOrder=r['sortingOrder'],chain=p['transformChain'],
        duration=main['lengthInSec'],looping=main['looping'],delay=main['startDelay']['scalar'],capacity=i['maxNumParticles'],rate=e['rateOverTime']['scalar'],bursts=bursts,
        shape=s,lifetime=w.curve(i['startLifetime']),speed=w.curve(i['startSpeed']),size=w.curve(i['startSize']),rotation=w.curve(i['startRotation']),color=i['startColor']['maxColor'],
        colorOverLife=w.gradient(m['ColorModule']['gradient']['maxGradient']) if 'ColorModule' in m else one,sizeOverLife=w.curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
        uv=dict(columns=u['tilesX'],rows=u['tilesY'],cycles=u['cycles'],startFrame=w.curve(u['startFrame']),frameOverTime=w.curve(u['frameOverTime'])) if u else None,
        limit=dict(speed=c['magnitude']['scalar'],dampen=c['dampen']) if c else None,texture=textures['_MainTex'],maskTexture=textures.get('_AlphaTex'),blend='normal' if mat['shader']['name'].startswith('Alpha Masked/Unlit') else 'add')

def extract():
    import UnityPy
    a=w.load('object_audit','audit-live-chibi-stage-objects.py');e=w.load('object_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
    indexpath=ROOT/'public/assets/live-chibi/object-layers/index.json';index=json.loads(indexpath.read_text(encoding='utf8'))
    path=sources.raw_root/'asset/song_rote77.unity3d';env=UnityPy.load(str(path));depfile=sources.raw_root/'asset/shaders_and_materials.unity3d';dep=UnityPy.load(str(depfile));dependencies={o.assets_file.name:o.assets_file for o in dep.objects}
    entries={k:v for k,v in index['assets'].items() if k.startswith('fx_in_rote77_')};models={};records=[];textures={};images={}
    masks=[]
    for ob in env.objects:
        if ob.type.name!='MonoBehaviour':continue
        t=ob.read_typetree()
        if '_isMaskingEnabled' not in t:continue
        go=a.local_object(ob,t['m_GameObject'],'GameObject');chain=a.transform_chain(go)
        w.require(t['_isMaskingEnabled']==t['_useMaskAlphaChannel']==1 and t['mainTexTiling']==dict(x=1,y=1) and t['mainTexOffset']==dict(x=0,y=0),'Changed mask flags')
        masks.append(dict(source=a.source_ref(ob),chain=chain,texture=str(t['mainTex']['m_PathID'])))
    for name,entry in entries.items():
        record=a.inspect_asset(env,name,entry,True,dependencies);records.append(record);systems=[];deferred=[]
        for p in record['particles']:
            reasons=[]
            if p['renderer']['renderMode']!=0:reasons.append('native_stretched_billboard_solver')
            if 'NoiseModule' in p['modules']:reasons.append('unity_noise_displacement')
            if reasons:deferred.append(dict(source=a.source_ref(next(o for o in env.objects if str(o.path_id)==p['pathId'])),reasons=reasons));continue
            system=model(p);systems.append(system)
            for identity in [system['texture'],system['maskTexture']]:
                if not identity or identity in textures:continue
                ob=next(o for o in env.objects if str(o.path_id)==identity);tex=ob.read();images[identity]=tex.image.convert('RGBA');textures[identity]=dict(source=a.source_ref(ob),rawSha256=w.sha(ob.get_raw_data()),file=f'/data/stage-object-emitters/{identity}.png',width=tex.m_Width,height=tex.m_Height,nativeSampling=native_particle_texture_sampling(tex))
        root=record['rootTransformChain'][-1]['pathId']
        bound_masks=[m for m in masks if m['chain'][-1]['pathId']==root]
        models[name]=dict(profile='native-box-point-emitters-v1',bundle=entry['bundle'],bundleSha256=w.sha(path.read_bytes()),particleCount=entry['particleCount'],keeper=record['keeper'],systems=systems,deferred=deferred,masks=bound_masks)
        for s in systems:
            if s['maskTexture']:w.require(any(m['texture']==s['maskTexture'] for m in bound_masks),'Unbound per-particle mask')
    data=dict(schemaVersion=1,objectIndexSha256=w.sha(indexpath.read_bytes()),shaderBundleSha256=w.sha(depfile.read_bytes()),assets=models,textures=textures)
    return data,dict(objects=records,masks=masks,objectIndexSha256=data['objectIndexSha256'],shaderBundleSha256=data['shaderBundleSha256']),images

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');args=parser.parse_args();data,fixture,images=extract()
    for identity,image in images.items():
        path=ROOT/'public'/data['textures'][identity]['file'].lstrip('/')
        if args.write:path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
        else:
            from PIL import Image
            w.require(Image.open(path).convert('RGBA').tobytes()==image.tobytes(),'Emitter native pixels changed')
        data['textures'][identity]['pngSha256']=w.sha(path.read_bytes())
    for path,value in [(ROOT/'public/data/stage-object-emitters.json',data),(ROOT/'scripts/fixtures/chibi-object-emitters-native.json',fixture)]:
        if args.write:path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
        else:w.require(json.loads(path.read_text(encoding='utf8'))==value,'Emitter native binding changed')
    print(json.dumps(dict(assets=len(data['assets']),systems=sum(len(a['systems']) for a in data['assets'].values()),deferred=sum(len(a['deferred']) for a in data['assets'].values()),textures=len(images))))
if __name__=='__main__':main()
