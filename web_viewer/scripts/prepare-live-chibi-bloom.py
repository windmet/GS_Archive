#!/usr/bin/env python3
"""Source-bound unmasked circle bloom; native seeds / damping step remain partial."""
import argparse, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
audit=module('bloom_audit','audit-live-chibi-stage-objects.py')
floor=module('bloom_curves','prepare-live-chibi-floor.py')
catalog=module('bloom_colors','prepare-live-chibi-floor-catalog.py')
require=floor.require

def model(record):
    systems=[]
    for p in record['particles']:
        m=p['modules'];i=m['InitialModule'];e=m['EmissionModule'];u=m['UVModule'];r=p['renderer'];main=p['main'];shape=m.get('ShapeModule');clamp=m['ClampVelocityModule']
        require(set(m)=={'InitialModule','EmissionModule','SizeModule','ColorModule','UVModule','ClampVelocityModule'} | ({'ShapeModule'} if shape else set()),'Unknown bloom module')
        require(not main['looping'] and not main['prewarm'] and main['simulationSpeed']==1 and main['scalingMode']==0 and main['moveWithTransform']==0,'Unsupported bloom lifecycle')
        require(r['renderMode']==0 and r['alignment'] in (0,2) and r['pivot']=={'x':0,'y':0,'z':0} and r['enabled'],'Unsupported bloom billboard')
        require(not i['size3D'] and not i['rotation3D'] and i['gravityModifier']['scalar']==0,'Unsupported bloom gravity/size')
        chain=p['transformChain'];require(all(t['rotation']['y']==t['rotation']['z']==0 and (abs(t['rotation']['x'])<1e-6 or r['alignment']==2 and abs(t['rotation']['x']-.537299633)<1e-6) and t['scale']['x']==t['scale']['z']==1 for t in chain),'Unsupported bloom transform')
        require(not shape or shape['type']==10 and shape['m_Rotation']=={'x':65,'y':0,'z':0} and shape['radiusThickness']==1 and shape['arc']['value']==360,'Unsupported bloom circle')
        require(not clamp['separateAxis'] and clamp['drag']['scalar']==0,'Unsupported bloom clamp')
        require(u['tilesX']==u['tilesY']==4 and u['startFrame']['minMaxState']==0 and u['frameOverTime']['scalar']==0,'Unsupported bloom atlas')
        require(e['rateOverTime']['minMaxState']==0 and e['rateOverDistance']['scalar']==0 and all(b['cycleCount']==1 and b['probability']==1 and b['countCurve']['minMaxState']==0 for b in e['m_Bursts']),'Unsupported bloom emission')
        require(len(r['materials'])==1,'Ambiguous bloom material');mat=r['materials'][0]
        require(mat['shader']['name']=='Mobile/Particles/Additive' and mat['colors']['_TintColor']=={'r':.5,'g':.5,'b':.5,'a':.5},'Unsupported bloom shader')
        tex=mat['textures'];require(len(tex)==1 and tex[0]['property']=='_MainTex' and tex[0]['pathId']=='3147239844506611722','Unsupported bloom texture')
        systems.append({'source':{k:p[k] for k in ('serializedFile','pathId','parameterTreeSha256')},'position':{k:sum(t['position'][k] for t in chain) for k in ('x','y','z')},'scaleY':chain[0]['scale']['y'],'billboardScaleY':1-2*chain[0]['rotation']['x']**2 if r['alignment']==2 else chain[0]['scale']['y'],
            'duration':main['lengthInSec'],'delay':main['startDelay']['scalar'],'rate':e['rateOverTime']['scalar'],
            'bursts':[{'time':b['time'],'count':int(b['countCurve']['scalar'])} for b in e['m_Bursts']],
            'radius':shape['radius']['value'] if shape else 0,'angle':65 if shape else 0,
            'lifetime':floor.compact_curve(i['startLifetime']),'speed':floor.compact_curve(i['startSpeed']),
            'size':floor.compact_curve(i['startSize']),'rotation':floor.compact_curve(i['startRotation']),
            'color':catalog.colors(i['startColor']),'colorMode':i['startColor']['minMaxState'],'colorOverLife':catalog.colors(m['ColorModule']['gradient']),
            'sizeOverLife':floor.compact_curve(m['SizeModule']['curve']),'speedLimit':floor.compact_curve(clamp['magnitude']),'dampen':clamp['dampen'],
            'frame':int(u['startFrame']['scalar']*16),'sortingOrder':r['sortingOrder'],'capacity':i['maxNumParticles']})
    return {'profile':'unmasked-circle-bloom-partial-v1','bundle':record['bundle'],'keeper':record['keeper'],'systems':systems,'particleCount':len(systems)}

def main():
    import UnityPy
    parser=argparse.ArgumentParser();audit.add_sources_config_argument(parser);args=parser.parse_args();sources=audit.load_archive_sources(args.sources_config)
    bundle=sources.raw_root/'asset/song_flslgt.unity3d';before=audit.file_hash(bundle);env=UnityPy.load(str(bundle))
    index_path=ROOT/'public/assets/live-chibi/object-layers/index.json';index=json.loads(index_path.read_text(encoding='utf8'))
    floor_path=ROOT/'public/assets/live-chibi/floor-particles/index.json';fm=json.loads(floor_path.read_text(encoding='utf8'))['assets']['fx_in_flslgt_panel_1']
    texture=fm['textures']['3147239844506611722'];tex_path=ROOT/'public/assets/live-chibi'/texture['file'];require(audit.file_hash(tex_path)==texture['pngSha256'],'Changed bloom texture')
    assets={}
    for name in [f'fx_in_flslgt_bloom_{i}' for i in range(1,4)]:
        record=audit.inspect_asset(env,name,index['assets'][name],True);assets[name]=model(record);assets[name]['bundleSha256']=before
    require(audit.file_hash(bundle)==before,'Changed RAW bloom bundle')
    body={'schemaVersion':1,'objectIndexSha256':audit.file_hash(index_path),'texture':texture,'assets':assets,'status':'native_inputs_partial_rng_projection_damping_step'}
    out=ROOT/'public/data/stage-bloom-particles.json';out.write_text(json.dumps(body,separators=(',',':'),allow_nan=False)+'\n',encoding='utf8')
    print(json.dumps({'assets':len(assets),'systems':sum(a['particleCount'] for a in assets.values()),'bytes':out.stat().st_size}))
if __name__=='__main__':main()
