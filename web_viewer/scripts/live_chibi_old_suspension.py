"""Old sidelight sprite/Animator bindings; director projection is a preview."""
import hashlib
import struct
from live_chibi_turnlaser import streamed
from live_chibi_laser import require

ASSET = 'sidelight'

def old_suspension_model(prefabs, controllers):
    layers = {}
    for prefab in prefabs:
        name = prefab['name']
        if name not in {'LiveObjectSuspensionlight', 'LiveObjectSuspensionlight_2', 'LiveObjectSuspensionlight_3', 'LiveObjectSuspensionlight_5'}:
            continue
        def walk(n):
            yield n
            for child in n['children']: yield from walk(child)
        nodes = list(walk(prefab))
        components = {int(c['pathId']):c for n in nodes for c in n['components']}
        script = next(c for c in prefab['components'] if c.get('scriptClass') == name)
        raw = bytes.fromhex(script['rawHex'])
        require(hashlib.sha256(raw).hexdigest() == script['sha256'] and len(raw) == 80, 'Changed old suspension fields')
        pointers = [struct.unpack_from('<iq', raw, o) for o in (32,44,56,68)]
        require(all(f == 0 for f,p in pointers), 'External sidelight binding')
        renderer, animator = (components[pointers[i][1]] for i in (1,2))
        require(renderer['type'] == 'SpriteRenderer' and animator['type'] == 'Animator', 'Changed sidelight binding')
        sprite = renderer['sprite']
        require(sprite['name'] == sprite['texture']['name'] == ASSET
                and sprite['pivot'] == {'x':.5,'y':1} and sprite['pixelsToUnits'] == 100
                and sprite['rect'] == {'x':0,'y':0,'width':1024,'height':1024}
                and [m['shader'] for m in renderer['materials']] == ['Mobile/Particles/Additive'], 'Changed sidelight sprite')
        require(pointers[0][1] in {int(n['pathId']) for n in nodes if n['name']=='fx_in_sidelight'}
                and pointers[3][1] in {int(n['pathId']) for n in nodes if n['name']=='LeftRightBase'}, 'Changed sidelight bases')
        for n in nodes:
            for c in n['components']:
                if c['type'] != 'Transform': continue
                require(c['position']=={'x':0,'y':0,'z':0} and c['scale']=={'x':1,'y':1,'z':1},'Changed sidelight transform')
                expected = {'x':0,'y':0,'z':.5,'w':0.8660253882408142} if n['name']=='fx_in_sidelight' else {'x':0,'y':0,'z':0,'w':1}
                require(c['rotation']==expected,'Changed sidelight base angle')
        controller = controllers[animator['animationEvidenceKey']]
        require(controller['pathId']=='1350' and len(controller['clips'])==2,'Changed sidelight controller')
        tree = controller['typetree']
        machine = tree['m_Controller']['m_StateMachineArray'][0]['data']
        require(len(tree['m_Controller']['m_StateMachineArray'])==len(tree['m_Controller']['m_LayerArray'])==1
                and len(machine['m_StateConstantArray'])==2 and not machine['m_AnyStateTransitionConstantArray']
                and not tree['m_StateMachineBehaviours'],'Changed sidelight state machine')
        for index,state in enumerate(machine['m_StateConstantArray']):
            state=state['data'];nodes=state['m_BlendTreeConstantArray']
            require(state['m_Loop'] and state['m_Speed']==1 and not state['m_Mirror']
                    and not state['m_TransitionConstantArray'] and state['m_CycleOffset']==0
                    and not any(state[k] for k in ('m_SpeedParamID','m_TimeParamID','m_MirrorParamID','m_CycleOffsetParamID'))
                    and len(nodes)==1 and len(nodes[0]['data']['m_NodeArray'])==1
                    and nodes[0]['data']['m_NodeArray'][0]['data']['m_ClipID']==index,
                    'Changed sidelight clip selection/transition')
        clips = {}
        for source in controller['clips']:
            clip = streamed.decode_clip(source)
            require(clip['duration']==2 and clip['loop'] and clip['name'] in ('angle30','angle60')
                    and clip['validation']['sampledRanges']['eulerDegrees.x']=={'min':0,'max':0}
                    and clip['validation']['sampledRanges']['eulerDegrees.y']=={'min':0,'max':0}
                    and clip['validation']['sampledRanges']['eulerDegrees.z']=={'min':0,'max':int(clip['name'][5:])}, 'Changed sidelight animation')
            clips[clip['name']] = dict(duration=clip['duration'],pathId=clip['pathId'],sha256=clip['sha256'],
                curve=next(c for c in clip['curves'] if c['channel']=='eulerDegrees.z'))
        layers[name.removeprefix('LiveObject')] = dict(serializedFile=prefab['serializedFile'],
            prefabPathId=prefab['pathId'],scriptSha256=script['sha256'],baseAngle=60,clips=clips,
            layers=[dict(asset=ASSET,texturePathId=sprite['texture']['pathId'],anchorX=.5,anchorY=0)])
    require(len(layers)==4,'Incomplete old sidelight profiles')
    return dict(status='native_sprite_and_angle_curves_reference_director_projection',styles=layers)
