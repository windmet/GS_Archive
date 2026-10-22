"""Extract bounded box/point emitters; keep noise/stretch as explicit gaps."""
import json,sys,argparse,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROMOTIONS=json.loads((ROOT/'scripts/fixtures/chibi-object-emitter-promotions.json').read_text(encoding='utf8'))
SPATIAL_CONTEXT=json.loads((ROOT/'scripts/fixtures/chibi-spatial-context-native.json').read_text(encoding='utf8'))
SPATIAL_CONES=json.loads((ROOT/'scripts/fixtures/chibi-cone-stretch-native.json').read_text(encoding='utf8'))
LOCAL_PARENTS=json.loads((ROOT/'scripts/fixtures/chibi-local-parent-native.json').read_text(encoding='utf8'))
LOCAL_SIZES=json.loads((ROOT/'scripts/fixtures/chibi-local-size-native.json').read_text(encoding='utf8'))
spec=importlib.util.spec_from_file_location('whole',ROOT/'scripts/prepare-chibi-whole-screen.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
from live_chibi_native_particle_mask import require_native_particle_mask,native_particle_texture_sampling

def initial_curve(c):
    import math
    mode=c['minMaxState']
    w.require(mode in (0,1,2,3),'Unsupported initial curve mode')
    # Both curves share scalar. minScalar is a constant-mode field, not a second multiplier.
    result=w.curve({**c,'minMaxState':1} if mode==2 else c)
    result['mode']=mode
    if mode==2:result['minKeys']=w.curve({**c,'minMaxState':1,'maxCurve':c['minCurve']})['keys']
    if mode in (1,2):
        for keys in [result['keys']]+([result['minKeys']] if mode==2 else []):
            w.require(bool(keys) and all(all(math.isfinite(k[f]) for f in ('time','value','inSlope','outSlope')) and (j==0 or keys[j-1]['time']<k['time']) for j,k in enumerate(keys)),'Unsupported initial curve keys')
    return result

def stationary_distance_proof(record, environment, audit, choreography):
    """Prove zero emitter displacement, rather than dropping a nonzero rate."""
    keeper=next(o for o in environment.objects if str(o.path_id)==record['keeper']['pathId'])
    script=audit.local_object(keeper,keeper.read_typetree()['m_Script'],'MonoScript')
    script_type=script.read_typetree()
    w.require(script_type['m_ClassName']=='LiveObjectObjectLayerRefKeeper' and script_type['m_Namespace']=='Growing.Live' and script_type['m_AssemblyName']=='Assembly-CSharp.dll','Unknown keeper may move emitters')
    root=record['rootTransformChain']
    w.require(len(root)==1 and root[0]['parent']==dict(fileId=0,pathId='0'),'External emitter parent needs motion history')
    byid={str(o.path_id):o for o in environment.objects};pending=[record['rootTransformChain'][0]['pathId']];components=[]
    while pending:
        tr=byid[pending.pop()];t=tr.read_typetree();go=audit.local_object(tr,t['m_GameObject'],'GameObject')
        for item in go.read_typetree()['m_Component']:
            ref=item['component'];w.require(ref['m_FileID']==0,'External motion component')
            co=byid[str(ref['m_PathID'])]
            w.require(co.type.name in ('Transform','ParticleSystem','ParticleSystemRenderer','SpriteRenderer') or co.path_id==keeper.path_id,'Animated or scripted emitter hierarchy')
            components.append(dict(source=audit.source_ref(co),treeSha256=audit.json_hash(co.read_typetree())))
        for child in t['m_Children']:
            w.require(child['m_FileID']==0,'External emitter transform')
            pending.append(str(child['m_PathID']))
    arrangements=[]
    for song in choreography['songs']:
        events=[e for e in song.get('objectLayerEvents',[]) if e['asset']==record['asset']]
        if not events:continue
        shown=[e for e in events if not e['hide']]
        w.require(len(shown)==1 and all(shown[0].get(k) is not None for k in ('x','y','scale')),'Emitter motion/repeated Play needs history')
        w.require(all(e['hide'] or e is shown[0] for e in events),'Unknown emitter motion')
        arrangements.append(dict(id=song['id'],eventSha256=audit.json_hash(events)))
    w.require(bool(arrangements),'No choreography proof for distance emitter')
    return dict(profile='stationary-object-layer-v1',components=components,arrangements=arrangements)

def model(p, partial=False, stationary=False, spatial_source=None, parent_source=None):
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
    if s and s['type'] in [0,2,4,10]:
        w.require(s['radius']['mode']==0 and s['arc']['mode']==0 and s['arc']['spread']==0,'Unsupported animated or stepped shape radius/arc')
    if parent_source:
        if parent_source['profile']=='native-local-size-orthographic-v1':w.require('SizeModule' not in m,'Nonuniform size envelope excludes lifetime size modules')
        w.require({k:p[k] for k in ['serializedFile','pathId','parameterTreeSha256']}==parent_source['source'] and chain==parent_source['chain'],'Local parent source changed')
        w.require(r['alignment']==2 and r['renderMode']==0 and i['size3D']==parent_source.get('size3D',False) and not i.get('rotation3D') and not c and not m.get('VelocityModule') and not m.get('NoiseModule') and i['gravityModifier']['minMaxState']==0 and i['gravityModifier']['scalar']==0,'Unsupported spatial local parent profile')
    for t in chain if not parent_source else []:
        q=t['rotation'];x,y,z,v=(q[k] for k in ['x','y','z','w'])
        w.require(abs(2*(x*z-v*y))<1e-5 and abs(2*(y*z+v*x))<1e-5,'Nonplanar emitter transform')
    if s and s['type']==12:w.require(s['radius']['mode']==0 and i['startSpeed']['scalar']==0,'Unsupported moving edge')
    for k in ['startLifetime','startSpeed','startSize','startRotation','gravityModifier']:
        initial_curve(i[k])
    if 'RotationModule' in m:
        rot3=m['RotationModule']
        w.require(rot3['curve']['minMaxState'] in (0,1,3),'Unsupported rotation curve mode')
        if rot3.get('separateAxes'):
            w.require(all(rot3[k]['minMaxState'] in (0,1,3) for k in ['x','y']),'Unsupported separate rotation curve mode')
    if 'ColorModule' in m:w.require(m['ColorModule']['gradient']['minMaxState']==1,'Unsupported lifetime color mode')
    w.require(e['rateOverTime']['minMaxState']==0,'Unsupported emission rate curve')
    distance=e['rateOverDistance']
    w.require(distance['minMaxState']==0 and (distance['scalar']==0 or stationary),'Rate-over-distance requires emitter motion history')
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
        w.require(all(velocity[k]['minMaxState'] in [0,1,3] for k in ['x','y','z']),'Unsupported velocity curve mode')
        w.require(not ('NoiseModule' in m and any(velocity[k]['minMaxState']==1 for k in ['x','y','z'])),'Curved velocity with Noise requires per-step sampling')
        for k in ['x','y','z']:initial_curve(velocity[k])
    mat=r['materials'][0];masked=mat['shader']['name'].startswith('Alpha Masked/')
    if masked:material_tint=require_native_particle_mask(mat,allow_tint=True)
    else:w.require(mat['shader']['name'] in ['Mobile/Particles/Additive','Mobile/Particles/Alpha Blended'],'Unsupported material')
    textures={t['property']:t['pathId'] for t in mat['textures']}
    one=dict(colors=[dict(time=t,r=1,g=1,b=1,a=1) for t in [0,1]],alphas=[dict(time=t,value=1) for t in [0,1]])
    data=dict(source={k:p[k] for k in ['serializedFile','pathId','parameterTreeSha256']},name=p['name'],alignment=r['alignment'],sortingOrder=r['sortingOrder'],chain=p['transformChain'],
        duration=main['lengthInSec'],looping=main['looping'],delay=delay,prewarm=bool(main.get('prewarm')),capacity=i['maxNumParticles'],rate=e['rateOverTime']['scalar'],bursts=bursts,
        shape=s,lifetime=initial_curve(i['startLifetime']),speed=initial_curve(i['startSpeed']),size=initial_curve(i['startSize']),sizeY=initial_curve(i['startSizeY']) if i['size3D'] else None,rotation=initial_curve(i['startRotation']),gravity=initial_curve(i['gravityModifier']),rotationX=initial_curve(i['startRotationX']) if i.get('rotation3D') else None,rotationY=initial_curve(i['startRotationY']) if i.get('rotation3D') else None,color=i['startColor']['maxColor'],colorMin=i['startColor'].get('minColor'),colorMode=i['startColor']['minMaxState'],colorGradient=w.gradient(i['startColor']['maxGradient']),angularVelocity=w.curve(m['RotationModule']['curve']) if 'RotationModule' in m else None,angularX=w.curve(m['RotationModule']['x']) if m.get('RotationModule',{}).get('separateAxes') else None,angularY=w.curve(m['RotationModule']['y']) if m.get('RotationModule',{}).get('separateAxes') else None,
        colorOverLife=w.gradient(m['ColorModule']['gradient']['maxGradient']) if 'ColorModule' in m else one,sizeOverLife=w.curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
        sizeOverLifeY=w.curve(m['SizeModule']['y']) if m.get('SizeModule',{}).get('separateAxes') else None,
        uv=dict(columns=u['tilesX'],rows=u['tilesY'],cycles=u['cycles'],startFrame=w.curve(u['startFrame']),frameOverTime=w.curve(u['frameOverTime'])) if u else None,
        velocity={k:w.curve(velocity[k]) for k in ['x','y','z']} if velocity else None,
        limit=dict(speed=c['magnitude']['scalar'],dampen=c['dampen']) if c else None,texture=textures['_MainTex'],maskTexture=textures.get('_AlphaTex'),blend='normal' if mat['shader']['name'].startswith('Alpha Masked/Unlit') or mat['shader']['name']=='Mobile/Particles/Alpha Blended' else 'add')
    if masked and material_tint!=[1,1,1,1]:data['materialTint']=material_tint
    if parent_source:data['parentProjection']=dict(profile=parent_source['profile'],proofSha256=parent_source['proofSha256'])
    if distance['scalar']:
        data['distanceRate']=w.curve(distance)
        data['distanceMode']='stationary-object-layer-v1'
    if partial:
        marks=[]
        if 'NoiseModule' in m:
            nz=m['NoiseModule']
            w.require(main.get('ringBufferMode')==0 and all(0<=b['time']<=main['lengthInSec'] for b in bursts),'Unsupported noise birth/capacity timeline')
            w.require(nz['quality']==2 and nz['octaves']==1 and not nz['remapEnabled'] and not nz['separateAxes'],'Unsupported curl noise profile')
            w.require(all(nz[k]['minMaxState']==0 for k in ['strength','scrollSpeed','positionAmount','rotationAmount','sizeAmount']) and nz['positionAmount']['scalar']==1 and nz['rotationAmount']['scalar']==nz['sizeAmount']['scalar']==0,'Unsupported noise amount/curve')
            data['noise']=dict(profile='native-high-curl-v1',strength=nz['strength']['scalar'],frequency=nz['frequency'],scroll=nz['scrollSpeed']['scalar'],damping=bool(nz['damping']),octaveCount=nz['octaves'],octaveMultiplier=nz['octaveMultiplier'],octaveScale=nz['octaveScale'],quality=nz['quality'],remapEnabled=False,separateAxes=False)
            marks.append('noise_preview')
        if r.get('renderMode')==1:
            # A scalar-size, force-free plane with an orthogonal emitter basis.
            # Keep 3D sphere trails and unproven combinations explicitly omitted.
            import math
            a,b,k,d=1,0,0,1
            for tr in chain:
                q=tr['rotation'];x,y,z,v=(q[f] for f in ['x','y','z','w'])
                A=(1-2*(y*y+z*z))*tr['scale']['x'];B=2*(x*y+v*z)*tr['scale']['x']
                C=2*(x*y-v*z)*tr['scale']['y'];D=(1-2*(x*x+z*z))*tr['scale']['y']
                a,b,k,d=A*a+C*b,B*a+D*b,A*k+C*d,B*k+D*d
            planar=bool(s) and ((s['type']==4 and s['angle']==0 and abs(abs(s['m_Rotation']['x'])-90)<1e-6 and s['m_Rotation']['y']==0) or (s['type']==10 and s['m_Rotation']['x']==s['m_Rotation']['y']==0))
            sr=r['stretch']
            supported=(planar and not c and not velocity and 'NoiseModule' not in m and not i['size3D'] and not i.get('rotation3D')
                and i['gravityModifier']['minMaxState']==0 and i['gravityModifier']['scalar']==0
                and all(t['scale']['x']>0 and t['scale']['y']>0 for t in chain)
                and abs(a*k+b*d)<1e-5 and min(math.hypot(a,b),math.hypot(k,d))>1e-6
                and sr['flip']==dict(x=0,y=0,z=0) and sr['cameraVelocityScale']==0 and 0<=sr['minSize']<=sr['maxSize'])
            if supported:
                data['stretch']={**sr,'profile':'native-classic-planar-v1'}
                marks.append('stretch_preview')
            elif spatial_source:
                bound=spatial_source['system']
                w.require(data['source']==bound['source'] and chain==bound['chain'] and sr==spatial_source['renderer'],'Spatial stretch RAW identity changed')
                w.require(s['type']==4 and s['angle']==1 and s['m_Rotation']==dict(x=-90,y=0,z=0) and not c and not velocity
                    and 'NoiseModule' not in m and not i['size3D'] and not i.get('rotation3D') and data['sizeOverLife'] is None
                    and i['startSize']['minMaxState']==i['startSpeed']['minMaxState']==i['gravityModifier']['minMaxState']==0
                    and i['gravityModifier']['scalar']==0 and r['alignment']==0 and sr['velocityScale']==0 and sr['cameraVelocityScale']==0,
                    'Spatial stretch exceeds the source-bound profile')
                data['stretch']={**sr,'profile':'native-source-spatial-v1','binding':dict(arrangements=[SPATIAL_CONTEXT['arrangement']['id']],
                    sourceContextSha256=w.sha((ROOT/'scripts/fixtures/chibi-spatial-context-native.json').read_bytes()))}
                marks.append('stretch_preview')
            else:marks.append('stretch_omitted')
        if marks:data['partial']=marks
    return data

def select_entries(index, mode, only=None):
    if only:
        return {k:v for k,v in index['assets'].items() if k in only}
    if mode=='all-particles':
        choreo=json.loads((ROOT/'public/assets/live-chibi/choreography/index.json').read_text(encoding='utf8'))
        referenced={e['asset'] for s in choreo['songs'] for e in s.get('objectLayerEvents') or []}
        return {k:v for k,v in index['assets'].items() if k in referenced and v.get('kind')=='particle'}
    extra={'fx_in_tfmvmt_Incidentlight','fx_in_ossshd_glitter','fx_in_swyrlv_leaf','fx_in_plmask_panel_1','fx_in_plmask_chandelier','fx_in_inndgn_smoke_1','fx_in_inndgn_smoke_2','fx_in_strclb_starlight','fx_in_wtstry_glitter','fx_in_tkstp1_panel_1','fx_in_pavetl_crystal_1','fx_in_pavetl_crystal_2','fx_in_smlegg_crystal_1','fx_in_smlegg_crystal_2'}
    # Frozen source identities from the all-particle audit; no per-song visual parameters.
    extra.update(PROMOTIONS['assets'])
    extra.update(PROMOTIONS.get('previewAssets',{}))
    return {k:v for k,v in index['assets'].items() if k in extra or k.startswith(('fx_in_rote77_','fx_in_tkstp1_linelight_','fx_in_plmask_incidentlight_','fx_in_infoct_Incidentlight_','fx_in_trhorz_','fx_in_swyrlv_incidentlight_'))}

def extract(mode='current', only=None, partial=False):
    import UnityPy
    a=w.load('object_audit','audit-live-chibi-stage-objects.py');e=w.load('object_effects','prepare-live-chibi-stage-effects.py');sources=e.load_archive_sources(None)
    indexpath=ROOT/'public/assets/live-chibi/object-layers/index.json';index=json.loads(indexpath.read_text(encoding='utf8'))
    choreopath=ROOT/'public/assets/live-chibi/choreography/index.json';choreography=json.loads(choreopath.read_text(encoding='utf8'))
    w.require(PROMOTIONS['schemaVersion']==1 and PROMOTIONS['objectIndexSha256']==w.sha(indexpath.read_bytes()),'Promotion source index changed')
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
            records.append(record);systems=[];deferred=[];distance_proof=None
            asset_partial=partial or name in PROMOTIONS.get('previewAssets',{})
            if any(p.get('modules',{}).get('EmissionModule',{}).get('rateOverDistance',{}).get('scalar',0) for p in record['particles']):
                try:distance_proof=stationary_distance_proof(record,env,a,choreography)
                except (ValueError,KeyError):pass # Unproven motion stays explicitly deferred.
            for p in record['particles']:
                reasons=[]
                prenderer=p.get('renderer') or {}
                if prenderer.get('renderMode')!=0:reasons.append('native_stretched_billboard_solver')
                if 'NoiseModule' in (p.get('modules') or {}):reasons.append('unity_noise_displacement')
                ob=next((o for o in env.objects if str(o.path_id)==p.get('pathId')),None)
                source=a.source_ref(ob) if ob else {k:p.get(k) for k in ['serializedFile','pathId']}
                if reasons and not asset_partial:deferred.append(dict(source=source,reasons=reasons));continue
                try:
                    spatial_source=SPATIAL_CONES['models'].get(name) if PROMOTIONS.get('previewAssets',{}).get(name,{}).get('spatialProfile') else None
                    parent_source=None
                    parent_profile=PROMOTIONS.get('assets',{}).get(name,{}).get('parentProfile')
                    if parent_profile:
                        w.require(parent_profile in ['native-local-orthographic-v1','native-local-size-orthographic-v1'],'Unknown local parent profile')
                        nonuniform=parent_profile=='native-local-size-orthographic-v1';proof=LOCAL_SIZES if nonuniform else LOCAL_PARENTS
                        if nonuniform:w.require(w.sha(choreopath.read_bytes())==proof['choreographySha256'],'Nonuniform local parent camera envelope changed')
                        parent_source=next((s for s in proof['models'][name]['systems'] if s['source']['pathId']==p['pathId']),None)
                        w.require(parent_source is not None,'Missing local parent proof')
                        parent_source={**parent_source,'profile':parent_profile,'proofSha256':w.sha((ROOT/('scripts/fixtures/chibi-local-size-native.json' if nonuniform else 'scripts/fixtures/chibi-local-parent-native.json')).read_bytes())}
                    system=model(p,asset_partial,bool(distance_proof),spatial_source,parent_source)
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
            if any(s.get('distanceRate') for s in systems):models[name]['distanceMotionProof']=distance_proof
            if name in PROMOTIONS['assets']:
                w.require(not deferred and not any(s.get('partial') for s in systems) and len(systems)==PROMOTIONS['assets'][name]['systems'],'Promoted emitter source no longer passes the bounded profile: '+name)
                expected=PROMOTIONS['assets'][name]
                if 'sources' in expected:
                    w.require(models[name]['bundleSha256']==expected['bundleSha256'] and [s['source'] for s in systems]==expected['sources'],'Promoted emitter source identity changed: '+name)
            if name in PROMOTIONS.get('previewAssets',{}):
                expected=PROMOTIONS['previewAssets'][name]
                if expected.get('spatialProfile'):
                    w.require(w.sha(choreopath.read_bytes())==SPATIAL_CONTEXT['choreographySha256']
                        and all(song['id']==SPATIAL_CONTEXT['arrangement']['id'] for song in choreography['songs'] if any(e['asset']==name for e in song.get('objectLayerEvents',[]))),
                        'Spatial source needs its bound free-camera choreography')
                w.require(not deferred and len(systems)==expected['systems'] and models[name]['bundleSha256']==expected['bundleSha256']
                    and [s['source'] for s in systems]==expected['sources']
                    and [s.get('partial',[]) for s in systems]==expected.get('systemPartials',[expected.get('partialMarkers',[])]*len(systems))
                    and all(not s.get('partial') or (s['partial']==['noise_preview'] and s.get('noise',{}).get('profile')=='native-high-curl-v1')
                        or (expected.get('spatialProfile') and s.get('partial')==['stretch_preview'] and s.get('stretch',{}).get('profile')=='native-source-spatial-v1') for s in systems),
                    'Preview emitter source or supported capability changed: '+name)
            for system in systems:
                if system['maskTexture']:w.require(any(m['texture']==system['maskTexture'] for m in bound_masks),'Unbound per-particle mask')
    data=dict(schemaVersion=1,objectIndexSha256=w.sha(indexpath.read_bytes()),shaderBundleSha256=w.sha(depfile.read_bytes()),assets=models,textures=textures)
    if any(a.get('distanceMotionProof') for a in models.values()):data['choreographyIndexSha256']=w.sha(choreopath.read_bytes())
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
