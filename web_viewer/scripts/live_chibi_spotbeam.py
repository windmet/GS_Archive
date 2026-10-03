"""Native Not Alone beam/pool particle inputs; bounded 2D director preview."""
import hashlib
import struct
from live_chibi_laser import require, curve

NAMES={8:'fx_in_ntalon_spotlight_front',9:'fx_in_ntalon_spotlight_back'}

def system_model(p):
    m,r,main=p['modules'],p['renderer'],p['main']
    require(set(m)=={'InitialModule','EmissionModule','ColorModule','UVModule'},'Changed spotbeam modules')
    i,e,u=m['InitialModule'],m['EmissionModule'],m['UVModule']
    require(not i['size3D'] and not i['rotation3D'] and i['startSpeed']['scalar']==0
            and i['gravityModifier']['scalar']==0,'Moving or 3D spotbeam unsupported')
    require(main['looping'] and not main['prewarm'] and main['simulationSpeed']==1
            and r['renderMode']==0 and r['alignment']==2,'Changed spotbeam renderer')
    require(len(r['materials'])==1,'Changed spotbeam materials')
    mat=r['materials'][0]
    require(len(mat['textures'])==1,'Changed spotbeam textures')
    tex=mat['textures'][0]
    require(mat['pathId']=='184' and mat['shader']['pathId']=='950'
            and mat['shader']['name']=='Mobile/Particles/Additive'
            and tex['pathId']=='629' and tex['name']=='fx_in_ntalon_spotlight'
            and tex['scale']=={'x':1,'y':1} and tex['offset']=={'x':0,'y':0}
            and (tex['width'],tex['height'])==(1024,512),'Changed spotbeam atlas')
    require(u['mode']==u['timeMode']==u['animationType']==0 and u['tilesX']==2 and u['tilesY']==1
            and u['frameOverTime']['minMaxState']==u['startFrame']['minMaxState']==0
            and u['startFrame']['scalar']==0 and u['frameOverTime']['scalar'] in (0,.5),
            'Animated/random spotbeam atlas unsupported')
    require(e['rateOverTime']['scalar']==e['rateOverDistance']['scalar']==0,'Continuous spotbeam emission unsupported')
    require(all(b['cycleCount']==1 and b['probability']==1 and b['countCurve']['minMaxState']==0 for b in e['m_Bursts']),
            'Random spotbeam bursts unsupported')
    chain=p['transformChain'];q=chain[0]['rotation'];t=chain[0]['position']
    require(all(c['rotation']=={'x':0,'y':0,'z':0,'w':1} and c['scale']=={'x':1,'y':1,'z':1} for c in chain),
            'Changed spotbeam transform')
    require(main['startDelay']['minMaxState']==0,'Random spotbeam delay unsupported')
    g=m['ColorModule']['gradient']['maxGradient']
    require(m['ColorModule']['gradient']['minMaxState']==1 and g['m_Mode']==0
            and all(g[f'key{j}'][k]==1 for j in range(g['m_NumColorKeys']) for k in ('r','g','b')),
            'Random/colored spotbeam gradient unsupported')
    return dict(source={k:p[k] for k in ('serializedFile','pathId','parameterTreeSha256')},
        name=p['name'],asset=tex['name'],frame=int(u['frameOverTime']['scalar']*2),
        period=main['lengthInSec'],delay=main['startDelay']['scalar'],capacity=i['maxNumParticles'],
        lifetime=curve(i['startLifetime']),size=curve(i['startSize']),rotation=curve(i['startRotation']),
        x=t['x']*100,y=-t['y']*100,anchorX=.5-r['pivot']['x'],anchorY=.5+r['pivot']['y'],
        alpha=[{'time':g[f'atime{j}']/65535,'value':g[f'key{j}']['a']} for j in range(g['m_NumAlphaKeys'])],
        bursts=[{'time':b['time'],'count':int(b['countCurve']['scalar'])} for b in e['m_Bursts']])

def spotbeam_model(root,prefabs):
    raw=bytes.fromhex(root['rawHex'])
    require(hashlib.sha256(raw).hexdigest()==root['sha256'] and struct.unpack_from('<i',raw,32)[0]==9,'Changed laser owner')
    models={}
    for p in prefabs:
        style=p['style']
        if style not in NAMES:continue
        require(struct.unpack_from('<iq',raw,36+(style-1)*12)==(0,int(p['pointerPathId']))
                and p['name']==NAMES[style] and p['scriptClass']=='LiveObjectLightParticleEffect','Wrong spotbeam binding')
        child=bytes.fromhex(p['rawHex']);count=struct.unpack_from('<i',child,32)[0]
        require(count==len(p['systems'])==(22 if style==8 else 18),'Changed spotbeam count')
        by_id={int(s['pathId']):s for s in p['systems']}
        refs=[struct.unpack_from('<iq',child,36+j*12) for j in range(count)]
        require(all(file==0 and path in by_id for file,path in refs),'External/missing spotbeam system')
        systems=[system_model(by_id[path]) for _,path in refs]
        require(struct.unpack_from('<i',child,36+count*12)[0]==0,'Spotbeam animator unsupported')
        models[str(style)]=dict(kind='spotbeam',name=p['name'],scriptPathId=p['pointerPathId'],
            scriptSha256=hashlib.sha256(child).hexdigest(),defaultDuration=struct.unpack_from('<f',child,40+count*12)[0],systems=systems)
    require(set(models)=={'8','9'},'Incomplete spotbeam set')
    return dict(status='native_particle_atlas_and_bursts_reference_director_projection',styles=models)

def extract_spotbeam_model(environment,audit):
    owner=next(o for o in environment.objects if o.assets_file.name=='resources.assets' and o.path_id==106566)
    raw=owner.get_raw_data();root=dict(pathId=str(owner.path_id),rawHex=raw.hex(),sha256=hashlib.sha256(raw).hexdigest())
    prefabs=[]
    for style in NAMES:
        file,path=struct.unpack_from('<iq',raw,36+(style-1)*12);require(file==0,'External spotbeam unsupported')
        obj=owner.assets_file.objects[path];v=obj.read(check_read=False);child=obj.get_raw_data()
        count=struct.unpack_from('<i',child,32)[0]
        systems=[audit.particle_record(obj,{'m_FileID':0,'m_PathID':struct.unpack_from('<iq',child,36+j*12)[1]},True) for j in range(count)]
        prefabs.append(dict(style=style,pointerPathId=str(path),name=v.m_GameObject.read().m_Name,
            scriptClass=v.m_Script.read().m_ClassName,rawHex=child.hex(),systems=systems))
    return spotbeam_model(root,prefabs),dict(root=root,prefabs=prefabs)
