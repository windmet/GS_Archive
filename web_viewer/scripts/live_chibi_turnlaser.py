"""Bounded native turning laser particles and single-state Animator bindings."""
import copy
import hashlib
import importlib.util
import math
from pathlib import Path
import struct
from live_chibi_laser import require, system_model

spec=importlib.util.spec_from_file_location('native_streamed',Path(__file__).with_name('audit-chibi-streamed-animation.py'))
streamed=importlib.util.module_from_spec(spec)
spec.loader.exec_module(streamed)
NAMES={5:'fx_in_laserlight_turn_front',6:'fx_in_laserlight_turn_back'}

def animator_model(controller):
    tree=controller['typetree'];c=tree['m_Controller']
    require(len(c['m_LayerArray'])==len(c['m_StateMachineArray'])==len(controller['clips'])==1,
            'Multi-state turn laser unsupported')
    machine=c['m_StateMachineArray'][0]['data']
    require(machine['m_DefaultState']==0 and len(machine['m_StateConstantArray'])==1
            and not machine['m_AnyStateTransitionConstantArray'] and not tree['m_StateMachineBehaviours'],
            'Turn laser state transitions unsupported')
    state=machine['m_StateConstantArray'][0]['data']
    require(not state['m_TransitionConstantArray'] and state['m_Loop'] and not state['m_Mirror']
            and state['m_CycleOffset']==0 and not any(state[k] for k in ('m_SpeedParamID','m_TimeParamID','m_MirrorParamID','m_CycleOffsetParamID')),
            'Parameterized turn laser state unsupported')
    trees=state['m_BlendTreeConstantArray']
    require(len(trees)==1 and len(trees[0]['data']['m_NodeArray'])==1,'Turn laser blend tree unsupported')
    node=trees[0]['data']['m_NodeArray'][0]['data']
    require(node['m_ClipID']==0 and not node['m_ChildIndices'] and node['m_CycleOffset']==0 and not node['m_Mirror'],
            'Turn laser blended clip unsupported')
    clip=streamed.decode_clip(controller['clips'][0])
    require(clip['loop'] and clip['duration']==3 and {x['channel'] for x in clip['curves']}=={'eulerDegrees.x','eulerDegrees.y','eulerDegrees.z'},
            'Turn laser clip channels changed')
    require(all(clip['validation']['sampledRanges'][k]=={'min':0,'max':0} for k in ('eulerDegrees.x','eulerDegrees.y')),
            'Turn laser 3D Animator unsupported')
    curve=next(x for x in clip['curves'] if x['channel']=='eulerDegrees.z')
    return dict(controllerPathId=controller['pathId'],clipPathId=clip['pathId'],clipSha256=clip['sha256'],
                duration=clip['duration'],speed=state['m_Speed'],curve=curve)

def turn_system(p,animation):
    require(set(p['modules'])=={'InitialModule','EmissionModule','ColorModule','ClampVelocityModule'},'Changed turn laser modules')
    chain=p['transformChain']
    require(len(chain)==3 and chain[0]['rotation']=={'x':0,'y':0,'z':0,'w':1}
            and chain[-1]['rotation']=={'x':0,'y':0,'z':0,'w':1}
            and all(t['position']=={'x':0,'y':0,'z':0} for t in chain[:-1]),'Changed turn laser hierarchy')
    q=chain[1]['rotation']
    mirrored=q['w']==q['z']==0
    require(mirrored or q['x']==q['y']==0,'Unsupported turn laser rotation')
    angle=2*math.atan2(q['x'],q['y']) if mirrored else 2*math.atan2(q['z'],q['w'])
    # The common particle profile validates all remaining modules. Parent Y180
    # is kept as an explicit plane mirror instead of discarding its rotation.
    normalized=copy.deepcopy(p)
    normalized['transformChain'][1]['rotation']={'x':0,'y':0,'z':0,'w':1}
    normalized['transformChain'][-1]['position']={'x':0,'y':0,'z':0}
    model=system_model(normalized)
    model.update(angle=angle,mirrored=mirrored,animation=animation,prefabRootPosition=chain[-1]['position'])
    return model

def turnlaser_model(root,prefabs,animationEvidence):
    raw=bytes.fromhex(root['rawHex'])
    require(hashlib.sha256(raw).hexdigest()==root['sha256'] and struct.unpack_from('<i',raw,32)[0]==9,'Changed laser owner')
    models={}
    for p in prefabs:
        style=p['style']
        require(style in NAMES and p['name']==NAMES[style] and p['scriptClass']=='LiveObjectLightParticleEffect'
                and struct.unpack_from('<iq',raw,36+(style-1)*12)==(0,int(p['pointerPathId'])),'Wrong turn laser binding')
        child=bytes.fromhex(p['rawHex'])
        require(struct.unpack_from('<i',child,32)[0]==struct.unpack_from('<i',child,84)[0]==len(p['systems'])==len(p['animators'])==4,
                'Changed turn laser system/Animator count')
        systems={int(s['pathId']):s for s in p['systems']}
        animators={int(a['pathId']):a for a in p['animators']}
        result=[]
        for j in range(4):
            file,pid=struct.unpack_from('<iq',child,36+j*12)
            afile,aid=struct.unpack_from('<iq',child,88+j*12)
            require(file==afile==0 and pid in systems and aid in animators
                    and int(animators[aid]['particlePathId'])==pid,'Turn laser Animator/particle pairing changed')
            animation=animator_model(animationEvidence[animators[aid]['controllerEvidenceKey']])
            result.append(turn_system(systems[pid],animation))
        models[str(style)]=dict(kind='turnlaser',name=p['name'],scriptPathId=p['pointerPathId'],
            scriptSha256=hashlib.sha256(child).hexdigest(),defaultDuration=struct.unpack_from('<f',child,136)[0],systems=result)
    require(set(models)=={'5','6'},'Incomplete turn laser profiles')
    return dict(status='native_particles_and_single_state_animators_reference_director_projection',styles=models)

def extract_turnlaser_model(environment,particle_audit,light_audit):
    owner=next(o for o in environment.objects if o.assets_file.name=='resources.assets' and o.path_id==106566)
    raw=owner.get_raw_data();root=dict(pathId=str(owner.path_id),rawHex=raw.hex(),sha256=hashlib.sha256(raw).hexdigest())
    prefabs=[];evidence={}
    for style in NAMES:
        file,path=struct.unpack_from('<iq',raw,36+(style-1)*12);require(file==0,'External turn laser unsupported')
        obj=owner.assets_file.objects[path];v=obj.read(check_read=False);child=obj.get_raw_data()
        prefab=light_audit.inspect_prefab(v.m_GameObject.deref(),evidence)
        def bindings(node):
            particles=[c for c in node['components'] if c['type']=='ParticleSystem']
            animators=[c for c in node['components'] if c['type']=='Animator']
            if animators:
                require(len(particles)==len(animators)==1,'Ambiguous turn laser Animator owner')
                yield dict(pathId=animators[0]['pathId'],particlePathId=particles[0]['pathId'],
                           controllerEvidenceKey=animators[0]['animationEvidenceKey'])
            for descendant in node['children']:yield from bindings(descendant)
        systems=[particle_audit.particle_record(obj,{'m_FileID':0,'m_PathID':struct.unpack_from('<iq',child,36+j*12)[1]},True) for j in range(4)]
        prefabs.append(dict(style=style,pointerPathId=str(path),name=prefab['name'],scriptClass=v.m_Script.read().m_ClassName,
                            rawHex=child.hex(),systems=systems,animators=list(bindings(prefab))))
    fixture=dict(root=root,prefabs=prefabs,animationEvidence=evidence)
    return turnlaser_model(**fixture),fixture
