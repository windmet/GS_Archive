"""Native Laserlight style1: ordered Sprite/Animator bindings, no drawn beams."""
import hashlib
import struct
from live_chibi_laser import require
from live_chibi_turnlaser import streamed


def sprite_laser_model(source):
    raw = bytes.fromhex(source['owner']['rawHex'])
    require(hashlib.sha256(raw).hexdigest() == source['owner']['sha256'], 'Changed Laserlight owner')
    require(struct.unpack_from('<i', raw, 32)[0] == 9 and
            struct.unpack_from('<iq', raw, 36) == (0, 115970), 'Changed style1 binding')
    require(struct.unpack_from('<iq', raw, 144) == (0, 90083), 'Changed laser parent binding')
    base = source['base']['tree']
    require(base['m_LocalPosition'] == dict(x=0,y=0,z=0)
            and base['m_LocalScale'] == dict(x=1,y=1,z=1), 'Translated/scaled laser parent unsupported')
    prefab = source['prefab']
    script = next(c for c in prefab['components'] if c.get('scriptClass') == 'LiveObjectLightSpriteEffect')
    child = bytes.fromhex(script['rawHex'])
    require(prefab['name'] == 'fx_in_laserlight_side' and script['pathId'] == '115970'
            and hashlib.sha256(child).hexdigest() == script['sha256'] and len(child) == 112,
            'Wrong native sprite lamp')
    require(struct.unpack_from('<i', child, 32)[0] == struct.unpack_from('<i', child, 72)[0] == 3,
            'Changed ordered sprite/animator arrays')
    renderers = [struct.unpack_from('<iq', child, 36+i*12) for i in range(3)]
    animators = [struct.unpack_from('<iq', child, 76+i*12) for i in range(3)]
    bound = {}
    def visit(node, chain, animator=None):
        require(node['activeSelf'], 'Inactive native lamp node')
        t = next(c for c in node['components'] if c['type'] == 'Transform')
        require(t['rotation']['x'] == t['rotation']['y'] == 0, 'Nonplanar lamp transform')
        chain = chain + [t]
        local = [c for c in node['components'] if c['type'] == 'Animator']
        require(len(local) <= 1, 'Ambiguous lamp Animator')
        if local: animator = (len(chain)-1, local[0])
        for r in node['components']:
            if r['type'] == 'SpriteRenderer': bound[(0, int(r['pathId']))] = (r, chain, animator)
        for c in node['children']: visit(c, chain, animator)
    visit(prefab, [])
    require(set(bound) == set(renderers), 'Unresolved SpriteRenderer bindings')
    layers = []
    for ref, animator_ref in zip(renderers, animators):
        r, chain, (index, animator) = bound[ref]
        require(animator_ref == (0, int(animator['pathId'])), 'Wrong ordered Animator binding')
        controller = source['animations'][animator['animationEvidenceKey']]
        tree = controller['typetree']; machines = tree['m_Controller']['m_StateMachineArray']
        require(len(machines) == 1 and len(tree['m_Controller']['m_LayerArray']) == 1
                and not tree['m_StateMachineBehaviours'], 'Changed lamp controller')
        machine = machines[0]['data']
        require(machine['m_DefaultState'] == 0 and not machine['m_AnyStateTransitionConstantArray'], 'Changed default state')
        states = machine['m_StateConstantArray']
        require(len(states) == 2 and all(not s['data']['m_TransitionConstantArray'] for s in states), 'Lamp transitions unsupported')
        state = states[0]['data']
        require(state['m_Speed'] == 1 and state['m_Loop'] and not state['m_Mirror']
                and state['m_CycleOffset'] == 0 and all(state[k] == 0 for k in
                ('m_SpeedParamID','m_TimeParamID','m_MirrorParamID','m_CycleOffsetParamID')), 'Parameterized lamp animation')
        nodes = state['m_BlendTreeConstantArray'][0]['data']['m_NodeArray']
        require(len(nodes) == 1 and nodes[0]['data']['m_ClipID'] == 0 and not nodes[0]['data']['m_ChildIndices'], 'Blended lamp animation')
        clip = streamed.decode_clip(controller['clips'][0])
        require(clip['name'] == 'angle60' and clip['duration'] == 2 and clip['loop'], 'Changed default lamp clip')
        require(all(clip['validation']['sampledRanges'][k] == {'min':0,'max':0}
                    for k in ('eulerDegrees.x','eulerDegrees.y')), '3D animated lamp unsupported')
        sprite = r['sprite']
        require(sprite['name'] == sprite['texture']['name'] == 'laserlight_1'
                and sprite['pixelsToUnits'] == 100 and sprite['pivot'] == dict(x=.5,y=0)
                and sprite['rect'] == dict(x=0,y=0,width=512,height=512)
                and [m['shader'] for m in r['materials']] == ['Mobile/Particles/Additive'], 'Changed lamp Sprite/material')
        layers.append(dict(asset='laserlight_1',texturePathId=sprite['texture']['pathId'],rendererPathId=r['pathId'],anchorX=.5,anchorY=1,
            chain=[{k:t[k] for k in ('position','rotation','scale')} for t in chain],
            animationIndex=index,curve=next(c for c in clip['curves'] if c['channel']=='eulerDegrees.z'),
            duration=clip['duration'],clipSha256=clip['sha256']))
    return dict(status='native_style1_sprite_hierarchy_default_animator',style=1,layers=layers)
