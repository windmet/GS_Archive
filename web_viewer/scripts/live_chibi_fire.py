"""Bounded native K.now O.nly masked flame flipbook inputs; sparks stay deferred."""
from pathlib import Path
import importlib.util

spec=importlib.util.spec_from_file_location('fire_floor',Path(__file__).with_name('prepare-live-chibi-floor.py'))
floor=importlib.util.module_from_spec(spec);spec.loader.exec_module(floor)
require=floor.require
ASSET='fx_in_knwonl_panel'
PROFILE='knwonl-masked-fire-flipbook-v1'
SHADER_ID=-6609531647517366895

def fire_system(p):
    m=p['modules'];i=m['InitialModule'];e=m['EmissionModule'];u=m['UVModule'];r=p['renderer'];main=p['main']
    require(set(m)=={'InitialModule','EmissionModule','UVModule'},'Unimplemented flame particle module')
    require(r['enabled'] and r['renderMode']==0 and r['alignment']==2
            and r['pivot']=={'x':0,'y':0,'z':0},'Unimplemented flame renderer')
    require(main['looping'] and not main['prewarm'] and main['simulationSpeed']==1
            and main['lengthInSec']==1 and main['moveWithTransform']==0
            and main['startDelay']['minMaxState']==0 and 0<=main['startDelay']['scalar']<=.11,
            'Unimplemented flame lifecycle')
    require(e['rateOverTime']['minMaxState']==0 and e['rateOverTime']['scalar']==0
            and e['rateOverDistance']['scalar']==0 and len(e['m_Bursts'])==1,'Unimplemented flame emission')
    b=e['m_Bursts'][0]
    require(b['time']==0 and b['cycleCount']==1 and b['probability']==1
            and b['countCurve']['minMaxState']==0 and b['countCurve']['scalar']==1,'Unimplemented flame burst')
    require(not i['size3D'] and not i['rotation3D'] and i['maxNumParticles']==2
            and all(i[n]['minMaxState']==0 for n in ('startLifetime','startSpeed','startSize','startRotation','startColor','gravityModifier'))
            and i['startLifetime']['scalar']==1 and i['startSpeed']['scalar']==0
            and i['startRotation']['scalar']==0 and i['gravityModifier']['scalar']==0,'Unimplemented flame initial state')
    require(u['mode']==u['timeMode']==u['animationType']==0 and u['tilesX']==4 and u['tilesY']==2
            and u['cycles']==1 and u['startFrame']['minMaxState']==0 and u['startFrame']['scalar']==0
            and u['flipU']==u['flipV']==0,'Unimplemented flame UV mapping')
    uv=floor.compact_curve(u['frameOverTime'])
    require(uv['mode']==1 and uv['scalar']==.5 and len(uv['keys'])==2
            and uv['keys'][0]=={'time':0,'value':0,'inSlope':0,'outSlope':1}
            and uv['keys'][1]=={'time':1,'value':1,'inSlope':1,'outSlope':0},'Unimplemented flame UV curve')
    chain=p['transformChain']
    require(all(t['rotation']=={'x':0,'y':0,'z':0,'w':1} and t['scale']=={'x':1,'y':1,'z':1} for t in chain),
            'Unimplemented flame projection transform')
    require(len(r['materials'])==1,'Multiple flame materials')
    mat=r['materials'][0];tex={t['property']:t for t in mat['textures']}
    require(mat['shader']['name']=='Alpha Masked/Unlit Alpha Masked - World Coords'
            and mat['shader']['status']=='resolved_dependency' and int(mat['shader']['pathId'])==SHADER_ID
            and mat['floats']['_UseAlphaChannel']==1 and mat['floats']['_Enabled']==1
            and mat['floats']['_ClampHoriz']==mat['floats']['_ClampVert']==0
            and mat['colors']['_Color']=={'r':1,'g':1,'b':1,'a':1},'Unimplemented flame shader mapping')
    require(set(tex)=={'_AlphaTex','_MainTex'} and all(t['fileId']==0 and t['status']=='resolved_in_bundle'
            and t['scale']=={'x':1,'y':1} and t['offset']=={'x':0,'y':0} for t in tex.values()),'Unresolved flame textures')
    return {'source':{k:p[k] for k in ('serializedFile','pathId','parameterTreeSha256')},
            'position':{k:sum(t['position'][k] for t in chain) for k in ('x','y','z')},
            'period':main['lengthInSec'],'delay':main['startDelay']['scalar'],
            'lifetime':i['startLifetime']['scalar'],'size':i['startSize']['scalar'],
            'color':i['startColor']['maxColor'],'texture':tex['_MainTex']['pathId'],
            'uv':uv,'tilesX':4,'tilesY':2,'sortingOrder':r['sortingOrder'],'blend':'normal'},tex['_AlphaTex']['pathId']

def fire_model(native):
    require(native['asset']==ASSET and native['bundle']=='song_knwonl.unity3d'
            and len(native['particles'])==3,'Changed K.now O.nly particle set')
    systems=[];deferred=[];masks=set()
    for p in native['particles']:
        if p['name']=='fx_in_anwhre_fire_mask':
            system,mask=fire_system(p);systems.append(system);masks.add(mask)
        else:
            deferred.append({'pathId':p['pathId'],'name':p['name'],'reason':'Noise and upward sparks not implemented'})
    require(len(systems)==2 and len(deferred)==1 and len(masks)==1,'Changed flame/spark composition')
    require(sorted(s['delay'] for s in systems)==[0,0.10000000149011612],'Changed flame stagger')
    return systems,next(iter(masks)),deferred
