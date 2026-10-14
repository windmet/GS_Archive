"""Re-extract all supported floor material bindings and executable shader oracles."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
import UnityPy
from live_chibi_native_particle_mask import require_native_particle_mask,native_particle_texture_sampling

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'data_pipeline'))
from archive_paths import add_sources_config_argument,load_archive_sources
parser=argparse.ArgumentParser()
add_sources_config_argument(parser)
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
sources=load_archive_sources(args.sources_config)
models=json.loads((ROOT/'public/assets/live-chibi/floor-particles/index.json').read_text(encoding='utf8'))['assets']
dependency=sources.raw_root/'asset/shaders_and_materials.unity3d'
dep=UnityPy.load(str(dependency))
shaders={o.path_id:o for o in dep.objects if o.type.name=='Shader'}
cache={};rows=[];programs={}
for asset,model in models.items():
    if model['bundle'] not in cache:
        bundle=sources.raw_root/'asset'/model['bundle']
        assert hashlib.sha256(bundle.read_bytes()).hexdigest()==model['bundleSha256']
        cache[model['bundle']]=UnityPy.load(str(bundle))
    objects={o.path_id:o for o in cache[model['bundle']].objects if o.assets_file.name==model['keeper']['serializedFile']}
    for tid,metadata in model['textures'].items():
        sampling=native_particle_texture_sampling(objects[int(tid)].read())
        if args.write:metadata['nativeSampling']=sampling
        else:assert metadata['nativeSampling']==sampling
    if args.write:model['nativeMaskMaterial']='alpha-per-particle-v1'
    else:assert model['nativeMaskMaterial']=='alpha-per-particle-v1'
    for system in model['systems']:
        particle=objects[int(system['source']['pathId'])].read()
        go=particle.m_GameObject.deref().read()
        renderer=next(c.component.deref() for c in go.m_Component if c.component.deref().type.name=='ParticleSystemRenderer')
        material=renderer.read().m_Materials[0].deref().read_typetree()
        props=material['m_SavedProperties'];floats=dict(props['m_Floats']);colors=dict(props['m_Colors'])
        textures=[{'scale':t['m_Scale'],'offset':t['m_Offset']} for _,t in props['m_TexEnvs']]
        shader=shaders[material['m_Shader']['m_PathID']]
        form=shader.read_typetree()['m_ParsedForm'];state=form['m_SubShaders'][0]['m_Passes'][0]['m_State']
        additive=form['m_Name']=='Alpha Masked/Particles/Additive'
        require_native_particle_mask({'shader':{'name':form['m_Name']},'floats':floats,'colors':colors,'textures':textures})
        blend=[state['rtBlend0'][k]['val'] for k in ['srcBlend','destBlend','srcBlendAlpha','destBlendAlpha']]
        assert blend==([5,1,5,1] if additive else [5,10,5,10])
        assert [state['zTest']['val'],state['zWrite']['val']]==[4,0]
        mask=objects[int(system.get('maskTexture',model['mask']['texture']))].read().m_TextureSettings
        primary_texture=objects[int(system['texture'])].read()
        primary=primary_texture.m_TextureSettings
        assert (mask.m_WrapU,mask.m_WrapV,mask.m_FilterMode)==(1,1,1)
        primary_settings=[primary.m_WrapU,primary.m_WrapV,primary.m_FilterMode,primary_texture.m_MipCount]
        rows.append(dict(asset=asset,source=system['source'],shaderPathId=str(shader.path_id),blend=blend,primarySampling=primary_settings))
        kind='add' if additive else 'normal'
        if kind not in programs:
            exported=shader.read().export()
            fragment=re.findall(r'#ifdef FRAGMENT\s*#version 300 es(.*?void main\(\).*?\n\})',exported,re.S)[0]
            tail=fragment.split('SV_Target0;',1)[1].replace('texture(', 'texture2D(').replace('SV_Target0 =','gl_FragColor =')
            programs[kind]=dict(shaderSha256=hashlib.sha256(shader.get_raw_data()).hexdigest(),fragmentTail=tail)
fixture=dict(dependencySha256=hashlib.sha256(dependency.read_bytes()).hexdigest(),systems=rows,nativePrograms=programs)
target=ROOT/'scripts/fixtures/chibi-native-particle-masks.json'
if args.write:
    target.write_text(json.dumps(fixture,indent=2)+'\n',encoding='utf8')
    index_path=ROOT/'public/assets/live-chibi/floor-particles/index.json'
    index=json.loads(index_path.read_text(encoding='utf8'));index['assets']=models
    index_path.write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    for name in ['chibi-floor-model','chibi-floor-catalog']:
        path=ROOT/'scripts/fixtures'/(name+'.json')
        value=json.loads(path.read_text(encoding='utf8'))
        records=value.get('assets',{}) if name.endswith('catalog') else {value['asset']:value}
        for asset,model in records.items():
            model['nativeMaskMaterial']='alpha-per-particle-v1'
            for tid,metadata in model['textures'].items():metadata['nativeSampling']=models[asset]['textures'][tid]['nativeSampling']
        path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
else:assert fixture==json.loads(target.read_text(encoding='utf8'))
print('Verified',len(rows),'native material bindings; primary sampling',sorted(set(tuple(r['primarySampling']) for r in rows)))
