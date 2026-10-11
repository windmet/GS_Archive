#!/usr/bin/env python3
"""Validate native Penlight object arrays and Animator state-to-clip bindings.

Does not infer CSV animation type IDs, time scale, color placement or projection.
The custom component layout is structurally validated against typed descendants;
field labels are corroborated by iOS metadata, not an Android method body.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct


def identity(obj):
    return obj['serializedFile'], str(obj['pathId'])


def decode_controller(controller):
    tree = controller['typetree']
    names = {}
    for key, value in tree['m_TOS']:
        if key in names and names[key] != value:
            raise ValueError('Ambiguous Animator string hash')
        names[key] = value
    native = tree['m_Controller']
    if len(native['m_LayerArray']) != 1 or len(native['m_StateMachineArray']) != 1:
        raise ValueError('Only the observed single-layer Penlight controller is supported')
    clips, pointers = controller['clips'], tree['m_AnimationClips']
    if len(clips) != len(pointers) or not clips:
        raise ValueError('Controller clip references and typed evidence differ')
    for clip, pointer in zip(clips, pointers):
        if pointer['m_FileID'] != 0 or identity(clip) != (controller['serializedFile'], str(pointer['m_PathID'])):
            raise ValueError('Controller clip PPtr does not match typed clip identity')
    states = []
    for entry in native['m_StateMachineArray'][0]['data']['m_StateConstantArray']:
        state = entry['data']
        if (state['m_TransitionConstantArray'] or state['m_BlendTreeConstantIndexArray'] != [0]
                or len(state['m_BlendTreeConstantArray']) != 1
                or state['m_Speed'] != 1 or state['m_CycleOffset'] != 0
                or any(state[k] for k in ('m_SpeedParamID', 'm_MirrorParamID', 'm_CycleOffsetParamID', 'm_TimeParamID'))
                or state['m_Mirror']):
            raise ValueError('Unresolved state transition, speed, mirror or blend semantics')
        nodes = state['m_BlendTreeConstantArray'][0]['data']['m_NodeArray']
        if len(nodes) != 1:
            raise ValueError('Multiple blend nodes unsupported')
        node = nodes[0]['data']
        if node['m_ChildIndices'] or node['m_BlendType'] != 0 or node['m_CycleOffset'] != 0 or node['m_Mirror']:
            raise ValueError('Unresolved blend node semantics')
        index = node['m_ClipID']
        if type(index) is not int or not 0 <= index < len(clips):
            raise ValueError('Clip index outside native pointer array')
        clip = clips[index]
        name = names.get(state['m_NameID'])
        full_name = names.get(state['m_FullPathID'])
        muscle = clip['typetree']['m_MuscleClip']
        if (not name or name != clip['typetree']['m_Name'] or full_name != 'Base Layer.' + name
                or names.get(state['m_PathID']) != full_name
                or type(state['m_Loop']) is not bool or state['m_Loop'] != muscle['m_LoopTime']):
            raise ValueError('Animator state name, path or loop differs from bound native clip')
        states.append({'name': name, 'fullName': full_name, 'clipIndex': index,
            'clip': {key: clip[key] for key in ('serializedFile', 'pathId', 'sha256')},
            'duration': muscle['m_StopTime'], 'loop': state['m_Loop'], 'stateSpeed': state['m_Speed']})
    if len({s['name'] for s in states}) != len(states) or sorted(s['clipIndex'] for s in states) != list(range(len(clips))):
        raise ValueError('State/clip mapping is not one-to-one and complete')
    return {'serializedFile': controller['serializedFile'], 'pathId': controller['pathId'],
            'name': controller['name'], 'states': states}


def decode_prefab(prefab, controllers):
    components = {}

    def walk(node, route):
        route = route + '/' + node['name']
        for component in node['components']:
            key = identity(component)
            if key in components:
                raise ValueError('Duplicate typed descendant component identity')
            components[key] = (route, component)
        for child in node['children']:
            walk(child, route)

    walk(prefab, '')
    scripts = [c for c in prefab['components'] if c['type'] == 'MonoBehaviour' and c.get('scriptClass') == 'LiveObjectPenlight']
    if len(scripts) != 1:
        raise ValueError('Exactly one native LiveObjectPenlight component required')
    script = scripts[0]
    raw = bytes.fromhex(script['rawHex'])
    if len(raw) != script['bytes'] or hashlib.sha256(raw).hexdigest() != script['sha256']:
        raise ValueError('Custom component byte identity mismatch')
    common = script['commonFields']
    if len(raw) < 44 or common['m_Name'] != '' or struct.unpack_from('<i', raw, 28)[0] != 0:
        raise ValueError('Unsupported MonoBehaviour common header')
    for offset, key in ((0, 'm_GameObject'), (16, 'm_Script')):
        if struct.unpack_from('<iq', raw, offset) != (common[key]['m_FileID'], common[key]['m_PathID']):
            raise ValueError('Raw common PPtr differs from typed common header')
    if raw[12] != common['m_Enabled'] or any(raw[13:16]):
        raise ValueError('Raw enabled field/padding differs from typed header')
    if (common['m_GameObject']['m_FileID'] != 0
            or str(common['m_GameObject']['m_PathID']) != str(prefab['pathId'])):
        raise ValueError('Custom component belongs to a different prefab')
    cursor = 32

    def array(expected_type):
        nonlocal cursor
        if cursor + 4 > len(raw):
            raise ValueError('Truncated custom array length')
        count = struct.unpack_from('<i', raw, cursor)[0]
        cursor += 4
        if not 0 < count <= 500 or cursor + 12 * count > len(raw):
            raise ValueError('Invalid or truncated custom PPtr array')
        result = []
        for _ in range(count):
            file_id, path_id = struct.unpack_from('<iq', raw, cursor)
            cursor += 12
            key = (prefab['serializedFile'], str(path_id))
            if file_id != 0 or key not in components or components[key][1]['type'] != expected_type:
                raise ValueError('PPtr must resolve to a typed descendant of the expected class')
            result.append(key)
        if len(set(result)) != len(result):
            raise ValueError('Duplicate custom array reference')
        return result

    sprites, animators = array('SpriteRenderer'), array('Animator')
    if len(sprites) != len(animators) or cursor + 4 != len(raw):
        raise ValueError('Array count mismatch or unknown serialized custom tail')
    boundary = struct.unpack_from('<i', raw, cursor)[0]
    if not 0 <= boundary <= len(sprites):
        raise ValueError('Custom split field outside array bounds')
    pairs = []
    for index, (sprite_id, animator_id) in enumerate(zip(sprites, animators)):
        route, sprite = components[sprite_id]
        animator_route, animator = components[animator_id]
        if route != animator_route:
            raise ValueError('Sprite and Animator array indices belong to different nodes')
        key = animator['animationEvidenceKey']
        if key not in controllers or identity(animator['controller']) != identity(controllers[key]):
            raise ValueError('Animator controller evidence missing or identity differs')
        pairs.append({'index': index, 'route': route,
            'spriteRenderer': {'serializedFile': sprite_id[0], 'pathId': sprite_id[1]},
            'animator': {'serializedFile': animator_id[0], 'pathId': animator_id[1]},
            'controllerKey': key, 'sprite': sprite['sprite'],
            'initialColor': sprite['color'], 'sortingOrder': sprite['sortingOrder']})
    if set(animators) != {key for key, (_, c) in components.items() if c['type'] == 'Animator'}:
        raise ValueError('Custom array does not cover all descendant Animators')
    excluded = [{'route': route, 'serializedFile': key[0], 'pathId': key[1]}
        for key, (route, c) in components.items() if c['type'] == 'SpriteRenderer' and key not in sprites]
    if any(not item['route'].endswith('/Shadow') for item in excluded):
        raise ValueError('Unresolved non-shadow SpriteRenderer excluded from custom array')
    return {'name': prefab['name'], 'serializedFile': prefab['serializedFile'], 'pathId': prefab['pathId'],
        'script': {key: script[key] for key in ('serializedFile', 'pathId', 'bytes', 'sha256')},
        'structuralLayout': '32-byte common header; SpriteRenderer PPtr array; Animator PPtr array; int32 split field; no tail',
        'fieldLabels': 'iOS metadata corroborates _sprites/_animators/_frontMiddleObjCount; no Android method-body proof',
        'frontMiddleObjCount': boundary, 'pairCount': len(pairs), 'pairs': pairs, 'excludedSprites': excluded}


def decode_evidence(evidence):
    if evidence.get('status') != 'typed_resource_evidence_only' or not evidence.get('prefabs'):
        raise ValueError('Typed native prefab evidence required')
    controllers = {key: decode_controller(c) for key, c in evidence['animationEvidence'].items()}
    prefabs = [decode_prefab(p, controllers) for p in evidence['prefabs']]
    if len({identity(p) for p in prefabs}) != len(prefabs):
        raise ValueError('Duplicate native prefab identity')
    return {'schemaVersion': 1, 'status': 'verified_native_penlight_bindings_not_command_mapping',
        'source': evidence['source'], 'controllers': controllers, 'prefabs': prefabs,
        'unresolved': ['CSV animation type/id/speed mapping', 'native color-placement algorithm',
                       'camera and stage coordinate projection', 'rendered recording acceptance']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-file', type=Path, required=True)
    parser.add_argument('--output-file', type=Path, required=True)
    args = parser.parse_args()
    if args.input_file.resolve() == args.output_file.resolve():
        raise ValueError('Evidence input cannot be overwritten')
    raw = args.input_file.read_bytes()
    result = decode_evidence(json.loads(raw))
    result['inputSha256'] = hashlib.sha256(raw).hexdigest()
    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf8')
    print(json.dumps({'prefabs': len(result['prefabs']), 'pairs': sum(p['pairCount'] for p in result['prefabs']),
                      'states': sum(len(c['states']) for c in result['controllers'].values())}))


if __name__ == '__main__':
    main()
