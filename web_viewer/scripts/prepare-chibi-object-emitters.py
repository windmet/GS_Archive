"""Extract bounded box/point emitters; keep noise/stretch as explicit gaps."""
import json,sys,argparse,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('whole',ROOT/'scripts/prepare-chibi-whole-screen.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
from live_chibi_native_particle_mask import require_native_particle_mask,native_particle_texture_sampling

def model(p, partial=False):
    m=p.get('modules') or {};i=m.get('InitialModule');e=m.get('EmissionModule');r=p.get('renderer') or {};main=p.get('main') or {}
    w.require(bool(i) and bool(e) and bool(r) and bool(main),'Missing core particle modules')
    s=m.get('ShapeModule');u=m.get('UVModule');c=m.get('ClampVelocityModule');chain=p.get('transformChain') or []
    allowed=['InitialModule','ShapeModule','EmissionModule','UVModule','SizeModule','ColorModule','ClampVelocityModule','RotationModule','VelocityModule']
    if partial:allowed.append('NoiseModule')
    w.require(set(m)<=set(allowed),'Unsupported module')
    w.require(r.get('enabled') and r.get('pivot')==dict(x=0,y=0,z=0),'Unsupported renderer pivot')
    w.require(r.get('alignment') in [0,2],'Unsupported alignment')
    w.require(main.get('startDelay',{}).get('minMaxState') in [0,3],'Unsupported start delay mode')
    delay=main.get('startDelay',{})
    delay=dict(mode=delay.get('minMaxState',0),value=delay.get('scalar',0),min=delay.get('minScalar',0))
    w.require(main.get('simulationSpeed')==1,'Unsupported simulation speed')
    w.require(main.get('moveWithTransform')==0,'Unsupported move with transform')
    w.require(main.get('scalingMode')==0,'Unsupported scaling mode')
    w.require(i['startColor']['minMaxState'] in [0,2,4],'Unsupported start color mode')
    w.require(not s or s['type'] in [0,2,4,5,10,12],'Unsupported shape')
    if s:w.require(s['randomDirectionAmount']==s['sphericalDirectionAmount']==s['randomPositionAmount']==0 and not s['alignToDirection'],'Unsupported shape direction')
    for t in chain:
        q=t['rotation'];x,y,z,v=(q[k] for k in ['x','y','z','w'])
        w.require(abs(2*(x*z-v*y))<1e-5 and abs(2*(y*z+v*x))<1e-5,'Nonplanar emitter transform')
    if s and s['type']==12:w.require(s['radius']['mode']==0 and i['startSpeed']['scalar']==0,'Unsupported moving edge')
    w.require(all(i[k]['minMaxState'] in [0,3] for k in ['startLifetime','startSpeed','startSize','startRotation']),'Initial curve requires birth-time sampling')
    if 'RotationModule' in m:
        rot3=m['RotationModule']
        w.require(rot3['curve']['minMaxState'] in (0,1,3),'Unsupported rotation curve mode')
        if rot3.get('separateAxes'):
            w.require(all(rot3[k]['minMaxState'] in (0,1,3) for k in ['x','y']),'Unsupported separate rotation curve mode')
    if 'ColorModule' in m:w.require(m['ColorModule']['gradient']['minMaxState']==1,'Unsupported lifetime color mode')
    w.require(e['rateOverTime']['minMaxState']==0 and e['rateOverDistance']['scalar']==0,'Unsupported emission rate')
    bursts=[]
    for b in e['m_Bursts']:
        w.require(b['countCurve']['minMaxState']==0 and b['cycleCount']==1 and b['probability']==1,'Unsupported burst')
        bursts.append(dict(time=b['time'],count=int(b['countCurve']['scalar'])))
    if u:w.require(u['mode']==u['timeMode']==u['animationType']==0 and u['flipU']==u['flipV']==0,'Unsupported sheet')
    if c:w.require(not c['separateAxis'] and c['drag']['scalar']==0 and c['magnitude']['minMaxState']==0,'Unsupported velocity limit')
    w.require(len(r['materials'])==1,'Ambiguous renderer material')
    velocity=m.get('VelocityModule')
    if velocity:
        w.require(not velocity['inWorldSpace'] and all(t['scale']==dict(x=1,y=1,z=1) for t in chain) and not c,'Unsupported velocity coordinate scale/limit')
        w.require(all(velocity[k]['minMaxState']==0 and velocity[k]['scalar']==0 for k in ['orbitalX','orbitalY','orbitalZ','orbitalOffsetX','orbitalOffsetY','orbitalOffsetZ','radial']) and velocity['speedModifier']['scalar']==1,'Unsupported orbital velocity')
        w.require(all(velocity[k]['minMaxState'] in [0,3] for k in ['x','y','z']),'Velocity curve requires integration')
    mat=r['materials'][0];masked=mat['shader']['name'].startswith('Alpha Masked/')
    if masked:require_native_particle_mask(mat)
    else:w.require(mat['shader']['name'] in ['Mobile/Particles/Additive','Mobile/Particles/Alpha Blended'],'Unsupported material')
    textures={t['property']:t['pathId'] for t in mat['textures']}
    one=dict(colors=[dict(time=t,r=1,g=1,b=1,a=1) for t in [0,1]],alphas=[dict(time=t,value=1) for t in [0,1]])
    data=dict(source={k:p[k] for k in ['serializedFile','pathId','parameterTreeSha256']},name=p['name'],alignment=r['alignment'],sortingOrder=r['sortingOrder'],chain=p['transformChain'],
        duration=main['lengthInSec'],looping=main['looping'],delay=delay,prewarm=bool(main.get('prewarm')),capacity=i['maxNumParticles'],rate=e['rateOverTime']['scalar'],bursts=bursts,
        shape=s,lifetime=w.curve(i['startLifetime']),speed=w.curve(i['startSpeed']),size=w.curve(i['startSize']),sizeY=w.curve(i['startSizeY']) if i['size3D'] else None,rotation=w.curve(i['startRotation']),gravity=w.curve(i['gravityModifier']),rotationX=w.curve(i['startRotationX']) if i.get('rotation3D') else None,rotationY=w.curve(i['startRotationY']) if i.get('rotation3D') else None,color=i['startColor']['maxColor'],colorMin=i['startColor'].get('minColor'),colorMode=i['startColor']['minMaxState'],colorGradient=w.gradient(i['startColor']['maxGradient']),angularVelocity=w.curve(m['RotationModule']['curve']) if 'RotationModule' in m else None,angularX=w.curve(m['RotationModule']['x']) if m.get('RotationModule',{}).get('separateAxes') else None,angularY=w.curve(m['RotationModule']['y']) if m.get('RotationModule',{}).get('separateAxes') else None,
        colorOverLife=w.gradient(m['ColorModule']['gradient']['maxGradient']) if 'ColorModule' in m else one,sizeOverLife=w.curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
        sizeOverLifeY=w.curve(m['SizeModule']['y']) if m.get('SizeModule',{}).get('separateAxes') else None,
        uv=dict(columns=u['tilesX'],rows=u['tilesY'],cycles=u['cycles'],startFrame=w.curve(u['startFrame']),frameOverTime=w.curve(u['frameOverTime'])) if u else None,
        velocity={k:w.curve(velocity[k]) for k in ['x','y','z']} if velocity else None,
        limit=dict(speed=c['magnitude']['scalar'],dampen=c['dampen']) if c else None,texture=textures['_MainTex'],maskTexture=textures.get('_AlphaTex'),blend='normal' if mat['shader']['name'].startswith('Alpha Masked/Unlit') or mat['shader']['name']=='Mobile/Particles/Alpha Blended' else 'add')
    if partial:
        marks=[]
        if 'NoiseModule' in m:
            nz=m['NoiseModule']
            data['noise']=dict(strength=nz.get('strength',{}).get('scalar',0),frequency=nz.get('frequency',0),scroll=nz.get('scrollSpeed',{}).get('scalar',0),damping=bool(nz.get('damping')),octaveCount=nz.get('octaveCount',1),octaveMultiplier=nz.get('octaveMultiplier',1),octaveScale=nz.get('octaveScale',1),quality=nz.get('quality',0))
            marks.append('noise_preview')
        if r.get('renderMode')==1:marks.append('stretch_omitted')
        if marks:data['partial']=marks
    return data

def select_entries(index, mode, only=None):
    if only:
        return {k:v for k,v in index['assets'].items() if k in only}
    if mode=='all-particles':
        choreo=json.loads((ROOT/'public/assets/live-chibi/choreography/index.json').read_text(encoding='utf8'))
        referenced={e['asset'] for s in choreo['songs'] for e in s.get('objectLayerEvents') or []}
        return {k:v for k,v in index['assets'].items() if k in referenced and v.get('kind')=='particle'}
    extra={'fx_in_tfmvmt_Incidentlight','fx_in_ossshd_glitter','fx_in_swyrlv_leaf','fx_in_plmask_panel_1','fx_in_plmask_chandelier','fx_in_inndgn_smoke_1','fx_in_inndgn_smoke_2','fx_in_strclb_starlight','fx_in_wtstry_glitter','fx_in_tkstp1_panel_1'}
    return {k:v for k,v in index['assets'].items() if k in extra or k.startswith(('fx_in_rote77_','fx_in_tkstp1_linelight_','fx_in_plmask_incidentlight_','fx_in_infoct_Incidentlight_','fx_in_trhorz_','fx_in_swyrlv_incidentlight_'))}

def extract(mode='current', only=None, partial=False):
    import UnityPy
    a=w.load('object_audit','audit-live-chibi-stage-objects.py');e=w.load('object_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
    indexpath=ROOT/'public/assets/live-chibi/object-layers/index.json';index=json.loads(indexpath.read_text(encoding='utf8'))
    depfile=sources.raw_root/'asset/shaders_and_materials.unity3d';dep=UnityPy.load(str(depfile));dependencies={o.assets_file.name:o.assets_file for o in dep.objects}
    entries=select_entries(index,mode,only)
    models={};records=[];textures={};images={};all_masks=[]
    for bundle in sorted({entry['bundle'] for entry in entries.values()}):
        path=sources.raw_root/'asset'/bundle;env=UnityPy.load(str(path));masks=[]
        for ob in env.objects:
            if ob.type.name!='MonoBehaviour':continue
            t=ob.read_typetree()
            if '_isMaskingEnabled' not in t:continue
            go=a.local_object(ob,t['m_GameObject'],'GameObject');chain=a.transform_chain(go)
            w.require(t['_isMaskingEnabled']==t['_useMaskAlphaChannel']==1 and t['mainTexTiling']==dict(x=1,y=1) and t['mainTexOffset']==dict(x=0,y=0),'Changed mask flags')
            masks.append(dict(source=a.source_ref(ob),chain=chain,texture=str(t['mainTex']['m_PathID'])))
        for name,entry in entries.items():
            if entry['bundle']!=bundle:continue
            try: record=a.inspect_asset(env,name,entry,True,dependencies)
            except Exception as error:
                models[name]=dict(profile='native-planar-emitters-v2',bundle=entry['bundle'],bundleSha256=w.sha(path.read_bytes()),particleCount=entry['particleCount'],keeper=[],systems=[],deferred=[dict(source={'serializedFile':entry['bundle'],'pathId':None},reasons=[f'asset_inspect_failed: {error}'])],masks=[]);continue
            records.append(record);systems=[];deferred=[]
            for p in record['particles']:
                reasons=[]
                prenderer=p.get('renderer') or {}
                if prenderer.get('renderMode')!=0:reasons.append('native_stretched_billboard_solver')
                if 'NoiseModule' in (p.get('modules') or {}):reasons.append('unity_noise_displacement')
                ob=next((o for o in env.objects if str(o.path_id)==p.get('pathId')),None)
                source=a.source_ref(ob) if ob else {k:p.get(k) for k in ['serializedFile','pathId']}
                if reasons and not partial:deferred.append(dict(source=source,reasons=reasons));continue
                try:
                    system=model(p,partial)
                    if prenderer['materials'][0]['shader']['name']=='Mobile/Particles/Alpha Blended':
                        shader=next(o for o in env.objects if str(o.path_id)==prenderer['materials'][0]['shader']['pathId']);parsed=shader.read_typetree()['m_ParsedForm'];blend=parsed['m_SubShaders'][0]['m_Passes'][0]['m_State']['rtBlend0']
                        values={k:blend[k]['val'] for k in ['srcBlend','destBlend','blendOp']};w.require(values==dict(srcBlend=5,destBlend=10,blendOp=0),'Unsupported native alpha blend')
                        from UnityPy.export.ShaderConverter import export_shader
                        code=export_shader(shader.read());w.require('SV_Target0 = u_xlat16_0 * vs_COLOR0;' in code and 'vs_COLOR0 = clamp(vs_COLOR0, 0.0, 1.0);' in code,'Changed alpha shader math')
                        system['alphaShader']=dict(source=a.source_ref(shader),rawSha256=w.sha(shader.get_raw_data()),blend=values)
                    for field in ['texture','maskTexture']:
                        identity=system[field]
                        if not identity:continue
                        texob=next(o for o in env.objects if str(o.path_id)==identity);key=f'{texob.assets_file.name}:{identity}';system[field]=key
                        if key in textures:continue
                        tex=texob.read();images[key]=tex.image.convert('RGBA');filename=w.sha(key.encode())[:24]
                        textures[key]=dict(source=a.source_ref(texob),rawSha256=w.sha(texob.get_raw_data()),file=f'/data/stage-object-emitters/{filename}.png',width=tex.m_Width,height=tex.m_Height,nativeSampling=native_particle_texture_sampling(tex))
                    systems.append(system)
                except Exception as error:
                    deferred.append(dict(source=source,reasons=[f'unsupported_source_profile: {error}']))
            root=record['rootTransformChain'][-1]['pathId'] if record.get('rootTransformChain') else None
            bound_masks=[{**m,'texture':f'{m["source"]["serializedFile"]}:{m["texture"]}'} for m in masks if m['chain'][-1]['pathId']==root]
            all_masks.extend(bound_masks)
            models[name]=dict(profile='native-planar-emitters-v2',bundle=entry['bundle'],bundleSha256=w.sha(path.read_bytes()),particleCount=entry['particleCount'],keeper=record['keeper'],systems=systems,deferred=deferred,masks=bound_masks)
            for system in systems:
                if system['maskTexture']:w.require(any(m['texture']==system['maskTexture'] for m in bound_masks),'Unbound per-particle mask')
    data=dict(schemaVersion=1,objectIndexSha256=w.sha(indexpath.read_bytes()),shaderBundleSha256=w.sha(depfile.read_bytes()),assets=models,textures=textures)
    return data,dict(objects=records,masks=all_masks,objectIndexSha256=data['objectIndexSha256'],shaderBundleSha256=data['shaderBundleSha256']),images

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--mode',choices=['current','all-particles'],default='current');parser.add_argument('--report',action='store_true');parser.add_argument('--asset',action='append',default=[]);parser.add_argument('--consume-deferred',action='store_true');args=parser.parse_args()
    data,fixture,images=extract(args.mode,set(args.asset) or None,args.consume_deferred)
    if args.report:
        import collections
        reasons=collections.Counter(r for a in data['assets'].values() for d in a['deferred'] for r in d['reasons'])
        detail={k:dict(systems=len(a['systems']),deferred=len(a['deferred']),partialSystems=sum(bool(s.get('partial')) for s in a['systems']),reasons=[r for d in a['deferred'] for r in d['reasons']]) for k,a in data['assets'].items()}
        markers=collections.Counter(mark for a in data['assets'].values() for s in a['systems'] for mark in s.get('partial',[]))
        print(json.dumps(dict(mode=args.mode,assets=len(data['assets']),systems=sum(len(a['systems']) for a in data['assets'].values()),deferred=sum(len(a['deferred']) for a in data['assets'].values()),partialSystems=sum(v['partialSystems'] for v in detail.values()),partialMarkers=dict(markers),textures=len(images),reasons=dict(reasons),empty=[k for k,a in data['assets'].items() if not a['systems']],detail=detail),ensure_ascii=False))
        return
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
