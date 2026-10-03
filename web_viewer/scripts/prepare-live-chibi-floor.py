#!/usr/bin/env python3
"""Take's masked nebula floor: retain native emission/gradient inputs, not RNG parity."""
import importlib.util
import json
from pathlib import Path
import UnityPy
from UnityPy.export.ShaderConverter import export_shader

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('floor_audit', ROOT / 'scripts/audit-live-chibi-stage-objects.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
ASSET = 'fx_in_tkstp1_panel_1'
PROFILE = 'take-masked-nebula-reference-v1'

def require(ok, message):
    if not ok: raise ValueError(message)

def compact_curve(c):
    require(c['minMaxState'] in (0, 1, 3), 'Unsupported floor curve mode')
    keys = c['maxCurve']['m_Curve']
    require(all(k['weightedMode'] == 0 for k in keys), 'Weighted curve unsupported')
    return {'mode': c['minMaxState'], 'scalar': c['scalar'], 'minScalar': c['minScalar'],
            'keys': [{k: v[k] for k in ('time','value','inSlope','outSlope')} for v in keys]}

def gradient(g):
    require(g['m_Mode'] == 0, 'Fixed gradient mode unsupported')
    return {'colors': [{'time':g[f'ctime{i}']/65535, **g[f'key{i}']} for i in range(g['m_NumColorKeys'])],
            'alphas': [{'time':g[f'atime{i}']/65535,'value':g[f'key{i}']['a']} for i in range(g['m_NumAlphaKeys'])]}

def floor_system(p):
    m=p['modules']; r=p['renderer']; i=m['InitialModule']; e=m['EmissionModule']
    require(set(m) <= {'InitialModule','ShapeModule','EmissionModule','ColorModule','UVModule','SizeModule','RotationModule','NoiseModule'}, 'Unknown floor module')
    require(r['renderMode']==0 and r['alignment']==2 and p['main']['looping'] and not p['main']['prewarm'], 'Unsupported floor simulation')
    require(e['rateOverTime']['minMaxState']==0 and e['rateOverDistance']['scalar']==0 and not e['m_Bursts'], 'Unsupported floor emission')
    require(m['ShapeModule']['type']==5 and not i['size3D'] and not i['rotation3D'], 'Unsupported floor shape')
    require(i['startColor']['minMaxState']==4 and m['ColorModule']['gradient']['minMaxState']==1, 'Unexpected floor gradients')
    mat=r['materials'][0]; tex={t['property']:t for t in mat['textures']}
    require(len(r['materials'])==1 and mat['shader']['name']=='Alpha Masked/Particles/Additive'
            and mat['shader']['status']=='resolved_dependency' and mat['floats']['_UseAlphaChannel']==1, 'Unresolved floor mask material')
    require(set(tex)=={'_AlphaTex','_MainTex'} and tex['_AlphaTex']['pathId']=='8211287001986913246', 'Floor mask identity changed')
    chain=p['transformChain']
    require(all(t['rotation']=={'x':0,'y':0,'z':0,'w':1} and t['scale']=={'x':1,'y':1,'z':1} for t in chain), 'Nonplanar floor transform')
    pos={k:sum(t['position'][k] for t in chain) for k in ('x','y','z')}
    u=m.get('UVModule')
    if u: require(u['tilesX']==u['tilesY']==4 and u['frameOverTime']['scalar']==0 and u['startFrame']['minMaxState']==0, 'Animated/random floor atlas unsupported')
    return {'source':{k:p[k] for k in ('serializedFile','pathId','parameterTreeSha256')},
            'position':pos,'shape':m['ShapeModule']['m_Scale'],'rate':e['rateOverTime']['scalar'],
            'capacity':i['maxNumParticles'],'lifetime':compact_curve(i['startLifetime']),
            'size':compact_curve(i['startSize']),'rotation':compact_curve(i['startRotation']),
            'color':gradient(i['startColor']['maxGradient']), 'alpha':gradient(m['ColorModule']['gradient']['maxGradient'])['alphas'],
            'sizeOverLife':compact_curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
            'angularVelocity':compact_curve(m['RotationModule']['curve']) if 'RotationModule' in m else None,
            'texture':tex['_MainTex']['pathId'], 'frame':int(u['startFrame']['scalar']*16) if u else None,
            'sortingOrder':r['sortingOrder'], 'noiseParameters':m.get('NoiseModule'),
            'speedParameters':compact_curve(i['startSpeed'])}

def extract(sources):
    bundle=sources.raw_root/'asset/song_tkstp1.unity3d'; shared=sources.raw_root/'asset/shaders_and_materials.unity3d'
    env=UnityPy.load(str(bundle)); dep=UnityPy.load(str(shared))
    files={o.assets_file.name:o.assets_file for o in dep.objects}
    index=json.loads((ROOT/'public/assets/live-chibi/object-layers/index.json').read_text())
    record=audit.inspect_asset(env,ASSET,index['assets'][ASSET],True,files)
    require(len(record['particles'])==4, 'Floor particle set changed')
    mask=next(o for o in env.objects if o.type.name=='MonoBehaviour' and '_isMaskingEnabled' in o.read_typetree())
    t=mask.read_typetree(); go=audit.local_object(mask,t['m_GameObject'],'GameObject')
    chain=audit.transform_chain(go)
    require(t['_isMaskingEnabled']==t['_useMaskAlphaChannel']==1 and t['mainTexTiling']=={'x':1,'y':1}
            and t['mainTexOffset']=={'x':0,'y':0}, 'Unexpected floor mask mapping')
    require(chain[0]['rotation']=={'x':0,'y':0,'z':0,'w':1} and chain[0]['scale']=={'x':15.25,'y':15.25,'z':1}, 'Floor mask plane changed')
    shader=next(o for o in dep.objects if o.path_id==-4808288818266491244)
    parsed=shader.read_typetree()['m_ParsedForm']; state=parsed['m_SubShaders'][0]['m_Passes'][0]['m_State']
    require({k:state['rtBlend0'][k]['val'] for k in ('srcBlend','destBlend','blendOp')}=={'srcBlend':5,'destBlend':1,'blendOp':0}, 'Floor blend changed')
    shader_text=export_shader(shader.read())
    require('texture(_AlphaTex, u_xlat1.xy).w' in shader_text and '_WorldToMask' in shader_text
            and 'u_xlat0.w = u_xlat9 * u_xlat16_2;' in shader_text, 'Floor shader alpha mask contract changed')
    systems=[floor_system(p) for p in record['particles']]
    evidence={'bundleSha256':audit.file_hash(bundle),'dependencySha256':audit.file_hash(shared),
              'object':record,'mask':{'source':audit.source_ref(mask),'tree':t,'transformChain':chain},
              'shader':{**audit.source_ref(shader),'parsedSha256':audit.json_hash(parsed)}}
    model={'profile':PROFILE,'asset':ASSET,'bundle':bundle.name,'bundleSha256':audit.file_hash(bundle),
           'keeper':record['keeper'],'particleCount':4,'systems':systems,
           'mask':{'texture':str(t['mainTex']['m_PathID']), 'x':chain[0]['position']['x']*100,
                   'y':-chain[0]['position']['y']*100,'width':1525,'height':1525},
           'status':'native_inputs_reference_projection_rng_noise_not_unity_equivalent'}
    return evidence,model,env

def main():
    parser=audit.argparse.ArgumentParser(description=__doc__)
    audit.add_sources_config_argument(parser)
    parser.add_argument('--evidence-output',type=Path,required=True)
    args=parser.parse_args();sources=audit.load_archive_sources(args.sources_config)
    evidence,model,env=extract(sources)
    out=ROOT/'public/assets/live-chibi/floor-particles';out.mkdir(parents=True,exist_ok=True)
    ids={s['texture'] for s in model['systems']}|{model['mask']['texture']};textures={}
    for identity in ids:
        o=next(o for o in env.objects if str(o.path_id)==identity)
        require(o.type.name=='Texture2D','Floor texture type changed')
        tex=o.read();image=tex.image.convert('RGBA');name=tex.m_Name
        require('/' not in name and '\\' not in name,'Unsafe texture name')
        target=out/f'{name}.png';image.save(target)
        textures[identity]={**audit.source_ref(o),'file':f'floor-particles/{name}.png',
                            'width':image.width,'height':image.height,'pngSha256':audit.file_hash(target)}
    model['textures']=textures
    (out/'index.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    args.evidence_output.parent.mkdir(parents=True,exist_ok=True)
    args.evidence_output.write_text(json.dumps(audit.stringify_path_ids(evidence),ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'systems':4,'capacities':[s['capacity'] for s in model['systems']], 'textures':len(textures),'status':model['status']}))

if __name__=='__main__':main()
