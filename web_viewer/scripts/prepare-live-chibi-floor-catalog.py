#!/usr/bin/env python3
"""Traverse native floor panels; publish only the bounded continuous box profile.

Each object keeps its own mask, gradients and emitter geometry. Unsupported
modules are reported, not replaced by Take's parameters or a static texture.
"""
import importlib.util
import json
from pathlib import Path
from live_chibi_fire import ASSET as FIRE_ASSET, PROFILE as FIRE_PROFILE, SHADER_ID, fire_model

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('take_floor',ROOT/'scripts/prepare-live-chibi-floor.py')
take=importlib.util.module_from_spec(spec);spec.loader.exec_module(take)
PROFILE='continuous-masked-box-floor-v1'
VOLUME_PROFILE='continuous-masked-volume-floor-v1'
require=take.require

def colors(c):
    mode=c['minMaxState']
    require(mode in (0,1,4), 'Start/color gradient mode unsupported')
    if mode==0:
        col=c['maxColor']
        return {'colors':[{'time':t,**col} for t in (0,1)],
                'alphas':[{'time':t,'value':col['a']} for t in (0,1)]}
    return take.gradient(c['maxGradient'])

def system(p):
    m=p['modules'];i=m['InitialModule'];e=m.get('EmissionModule',{});u=m.get('UVModule')
    require(set(m)<= {'InitialModule','ShapeModule','EmissionModule','ColorModule','UVModule','SizeModule','RotationModule'},
            'Velocity/noise/clamping module requires its own profile')
    require(p['renderer']['renderMode']==0 and p['renderer']['alignment']==2
            and p['main']['looping'] and p['main']['simulationSpeed']==1
            and p['main']['startDelay']['minMaxState']==0 and p['main']['startDelay']['scalar']==0,
            'Renderer/system simulation unsupported')
    require(e and e['rateOverTime']['minMaxState']==0 and 0<e['rateOverTime']['scalar']<=250
            and e['rateOverDistance']['scalar']==0 and not e['m_Bursts'], 'Noncontinuous emission')
    require(m.get('ShapeModule',{}).get('type')==5 and not i['size3D'] and not i['rotation3D'], 'Nonbox/3D shape')
    require(i['startSpeed']['minMaxState']==0 and i['startSpeed']['scalar']==0,'Moving particles need a direction/velocity profile')
    require(0<i['maxNumParticles']<=250,'Emitter exceeds sprite budget')
    require(i['startColor']['minMaxState'] in (0,4), 'Random two-color source unsupported')
    require(m['ColorModule']['gradient']['minMaxState'] in (0,1), 'Lifetime gradient unsupported')
    chain=p['transformChain']
    require(all(t['rotation']=={'x':0,'y':0,'z':0,'w':1} and t['scale']=={'x':1,'y':1,'z':1} for t in chain),
            'Transformed floor requires its own projection profile')
    shape=m['ShapeModule']
    require(shape['m_Position']=={'x':0,'y':0,'z':0} and shape['m_Rotation']=={'x':0,'y':0,'z':0},'Shape-local transform unsupported')
    if u:
        require(u['tilesX']==u['tilesY']==4 and u['frameOverTime']['minMaxState']==0
                and u['frameOverTime']['scalar']==0 and u['startFrame']['minMaxState']==0,'Animated/random atlas unsupported')
    mat=p['renderer']['materials'][0];tex={t['property']:t for t in mat['textures']}
    require(len(p['renderer']['materials'])==1 and mat['shader']['name']=='Alpha Masked/Particles/Additive'
            and mat['shader']['status']=='resolved_dependency' and mat['floats']['_UseAlphaChannel']==1
            and set(tex)=={'_AlphaTex','_MainTex'},'Mask shader/material unsupported')
    require(all(t['scale']=={'x':1,'y':1} and t['offset']=={'x':0,'y':0} for t in tex.values()),'Material UV mapping unsupported')
    lifetime=take.compact_curve(i['startLifetime'])
    require(lifetime['mode'] in (0,3) and 0<lifetime['scalar']<=10
            and (lifetime['mode']!=3 or 0<lifetime['minScalar']<=lifetime['scalar']),'Lifetime out of bounded profile')
    require(p['main']['lengthInSec']<=10,'Prewarm exceeds bounded profile')
    color_over_life=colors(m['ColorModule']['gradient'])
    size=take.compact_curve(i['startSize']);rotation=take.compact_curve(i['startRotation'])
    require(size['mode'] in (0,3) and rotation['mode'] in (0,3),'Time-varying birth size/rotation unsupported')
    result={'source':{k:p[k] for k in ('serializedFile','pathId','parameterTreeSha256')},
            'position':{k:sum(t['position'][k] for t in chain) for k in ('x','y','z')},
            'shape':shape['m_Scale'],'rate':e['rateOverTime']['scalar'],'capacity':i['maxNumParticles'],
            'lifetime':lifetime,'size':size,
            'rotation':rotation,'color':colors(i['startColor']),
            'colorMode':i['startColor']['minMaxState'], 'colorOverLife':color_over_life,'alpha':color_over_life['alphas'],
            'sizeOverLife':take.compact_curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
            'angularVelocity':take.compact_curve(m['RotationModule']['curve']) if 'RotationModule' in m else None,
            'texture':tex['_MainTex']['pathId'],'frame':int(u['startFrame']['scalar']*16) if u else None,
            'sortingOrder':p['renderer']['sortingOrder'],'prewarm':p['main']['prewarm'],
            'prewarmSeconds':p['main']['lengthInSec'] if p['main']['prewarm'] else 0,
            'noiseParameters':None,'speedParameters':take.compact_curve(i['startSpeed'])}
    return result,tex['_AlphaTex']['pathId']

def volume_system(p):
    """A separate, bounded projection contract; original box guards stay strict."""
    import copy
    native=copy.deepcopy(p);m=p['modules'];i=m['InitialModule'];shape=m['ShapeModule'];e=m['EmissionModule'];u=m.get('UVModule')
    require(shape['type'] in (0,5) and shape['radius']['mode']==0 and 0<shape['radius']['value']<=10
            and shape['radiusThickness']==1 and not shape['alignToDirection']
            and all(shape[k]==0 for k in ('randomDirectionAmount','sphericalDirectionAmount','randomPositionAmount')),
            'Volume shape/direction unsupported')
    require(p['renderer']['pivot']=={'x':0,'y':0,'z':0} and not i['size3D'] and not i['rotation3D']
            and i['gravityModifier']['minMaxState']==0 and i['gravityModifier']['scalar']==0,'Volume pivot/gravity/3D unsupported')
    require(e['rateOverTime']['minMaxState']==0 and 0<e['rateOverTime']['scalar']<=1000
            and 0<i['maxNumParticles']<=1024,'Volume exceeds bounded emitter budget')
    speed=take.compact_curve(i['startSpeed'])
    require(speed['mode'] in (0,3) and max(abs(speed['scalar']),abs(speed['minScalar']))<=2,'Volume birth speed unsupported')
    frame=take.compact_curve(u['startFrame']) if u else None
    require(not frame or frame['mode'] in (0,3) and 0<=frame['minScalar']<=1 and 0<=frame['scalar']<=1,'Volume atlas birth frame unsupported')
    # Reuse all shader, hierarchy, curve and lifetime checks without loosening v1.
    n=native['modules'];n['ShapeModule']['type']=5
    n['InitialModule']['startSpeed'].update(minMaxState=0,scalar=0)
    n['InitialModule']['maxNumParticles']=min(i['maxNumParticles'],250)
    n['EmissionModule']['rateOverTime']['scalar']=min(e['rateOverTime']['scalar'],250)
    if u:n['UVModule']['startFrame'].update(minMaxState=0,scalar=0)
    if 'ColorModule' not in n:n['ColorModule']={'gradient':{'minMaxState':0,'maxColor':{'r':1,'g':1,'b':1,'a':1}}}
    result,mask=system(native)
    result.update(shapeType=shape['type'],radius=shape['radius']['value'],rate=e['rateOverTime']['scalar'],
                  capacity=i['maxNumParticles'],speedParameters=speed,frameRange=frame,frame=None)
    return result,mask

def mask_for(env,identity):
    audit=take.load_audit()
    matches=[]
    for obj in env.objects:
        if obj.type.name!='MonoBehaviour':continue
        t=obj.read_typetree()
        if not t.get('_isMaskingEnabled') or str(t.get('mainTex',{}).get('m_PathID'))!=identity:continue
        require(t['_useMaskAlphaChannel']==1 and t['mainTex']['m_FileID']==0
                and t['mainTexTiling']=={'x':1,'y':1} and t['mainTexOffset']=={'x':0,'y':0},'Mask mapping unsupported')
        go=audit.local_object(obj,t['m_GameObject'],'GameObject');chain=audit.transform_chain(go)
        require(all(c['rotation']=={'x':0,'y':0,'z':0,'w':1} for c in chain)
                and all(c['scale']=={'x':1,'y':1,'z':1} for c in chain[1:]),'Mask hierarchy transform unsupported')
        # WorldToMask is derived from this exact masker, never from a texture name.
        pos={k:sum(c['position'][k] for c in chain) for k in ('x','y')}
        matches.append({'texture':identity,'x':pos['x']*100,'y':-pos['y']*100,
                        'width':chain[0]['scale']['x']*100,'height':chain[0]['scale']['y']*100})
    require(matches and all(m==matches[0] for m in matches),'Missing/ambiguous native mask mapping')
    return matches[0]

def main():
    import UnityPy
    from UnityPy.export.ShaderConverter import export_shader
    audit=take.load_audit()
    parser=audit.argparse.ArgumentParser(description=__doc__);audit.add_sources_config_argument(parser)
    parser.add_argument('--report',type=Path,required=True)
    args=parser.parse_args();sources=audit.load_archive_sources(args.sources_config)
    require(not args.report.resolve().is_relative_to(sources.raw_root.resolve())
            and not args.report.resolve().is_relative_to(ROOT/'public'),'Audit report must stay outside source/published assets')
    index=json.loads((ROOT/'public/assets/live-chibi/object-layers/index.json').read_text())
    out=ROOT/'public/assets/live-chibi/floor-particles';out.mkdir(parents=True,exist_ok=True)
    evidence,take_model,take_env=take.extract(sources) # verifies exact shared shader blend/alpha contract
    # Reuse the already verified Take descriptor without widening its guards.
    old=json.loads((out/'index.json').read_text())
    if old.get('schemaVersion')==2:old=old['assets'][take.ASSET]
    require({k:v for k,v in old.items() if k!='textures'}==take_model,'Run the Take floor preparer before catalog expansion')
    models={take.ASSET:old};records=[]
    shared=UnityPy.load(str(sources.raw_root/'asset/shaders_and_materials.unity3d'))
    dep={o.assets_file.name:o.assets_file for o in shared.objects};envs={}
    candidates=sorted(a for a,e in index['assets'].items() if 'panel' in a and e['kind']=='particle')
    for asset in candidates:
        entry=index['assets'][asset];bundle=entry['bundle'];path=sources.raw_root/'asset'/bundle
        record={'asset':asset,'bundle':bundle,'particleCount':entry['particleCount']}
        if asset==take.ASSET:
            record.update(status='registered_take_reference_profile');records.append(record);continue
        if bundle not in envs:envs[bundle]=UnityPy.load(str(path))
        env=envs[bundle]
        try:
            native=audit.inspect_asset(env,asset,entry,True,dep)
            deferred=[]
            if asset==FIRE_ASSET:
                systems,mask_id,deferred=fire_model(native);mask_ids={mask_id}
                shader=next(o for o in shared.objects if o.path_id==SHADER_ID)
                parsed_shader=shader.read_typetree()['m_ParsedForm']
                blend=parsed_shader['m_SubShaders'][0]['m_Passes'][0]['m_State']['rtBlend0']
                require([blend[k]['val'] for k in ('srcBlend','destBlend','blendOp')]==[5,10,0],'Flame alpha blend changed')
                text=export_shader(shader.read())
                require('texture(_AlphaTex, u_xlat1.xy).w' in text and 'u_xlat0.w = u_xlat0.w * u_xlat7;' in text,
                        'Flame shader mask contract changed')
                profile=FIRE_PROFILE
            else:
                try:
                    parsed=[system(p) for p in native['particles']];profile=PROFILE
                except (ValueError,KeyError):
                    parsed=[volume_system(p) for p in native['particles']];profile=VOLUME_PROFILE
                systems=[s for s,_ in parsed];mask_ids={i for _,i in parsed}
                require(sum(s['capacity'] for s in systems)<=(2048 if profile==VOLUME_PROFILE else 512),'Object exceeds profile sprite budget')
            require(len(mask_ids)==1,'Multiple masks require separate emitter groups')
            mask=mask_for(env,next(iter(mask_ids)));textures={}
            for identity in {s['texture'] for s in systems}|mask_ids:
                obj=next(o for o in env.objects if str(o.path_id)==identity)
                require(obj.type.name=='Texture2D','Texture pointer type changed')
                tex=obj.read();image=tex.image.convert('RGBA');filename=f'{asset}-{identity}.png'
                target=out/filename;image.save(target)
                textures[identity]={**audit.source_ref(obj),'file':f'floor-particles/{filename}',
                                    'width':image.width,'height':image.height,'pngSha256':audit.file_hash(target)}
            models[asset]={'profile':profile,'asset':asset,'bundle':bundle,'bundleSha256':audit.file_hash(path),
                           'keeper':native['keeper'],'particleCount':len(native['particles']),'systems':systems,'mask':mask,'textures':textures,
                           'status':'native_inputs_reference_projection_rng_not_unity_equivalent'}
            if deferred:
                models[asset]['deferredSystems']=deferred
                record.update(status='registered_partial_fire_flipbook_profile',supportedSystems=2,deferredSystems=deferred,spriteBudget=2)
            else:
                record.update(status='registered_continuous_volume_profile' if profile==VOLUME_PROFILE else 'registered_continuous_box_profile',spriteBudget=sum(s['capacity'] for s in systems))
        except (ValueError,KeyError) as error:
            record.update(status='deferred',reason=str(error))
        records.append(record)
    catalog={'schemaVersion':2,'assets':models,'inventory':records,'status':'partial_native_floor_profiles'}
    (out/'index.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps({'schemaVersion':1,'objectIndexSha256':audit.file_hash(ROOT/'public/assets/live-chibi/object-layers/index.json'),
                                     'candidates':len(candidates),'registered':len(models),'records':records},ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'candidates':len(candidates),'registered':len(models),'assets':list(models)}))

if __name__=='__main__':main()
