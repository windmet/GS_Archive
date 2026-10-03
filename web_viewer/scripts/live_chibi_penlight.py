"""Native Penlight render inputs, without guessed CSV or camera semantics.

Retains the complete local Transform hierarchy (including z), Sprite tight mesh,
full-texture UV transform, state bindings and streamed animation coefficients.
This is a source descriptor, not an assertion of rendered Unity equivalence.
"""
import importlib.util
import math
from pathlib import Path
import struct


def load_decoder(filename, name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bindings = load_decoder('audit-chibi-penlight-bindings.py', 'native_penlight_bindings')
animations = load_decoder('audit-chibi-streamed-animation.py', 'native_penlight_animations')


def finite_vector(value, axes):
    if set(value) != set(axes) or any(type(value[a]) not in (int, float) or not math.isfinite(value[a]) for a in axes):
        raise ValueError('Invalid native vector')
    return dict(value)


def sprite_mesh(evidence):
    tree, source = evidence['typetree'], {k: evidence[k] for k in ('serializedFile', 'pathId', 'bytes', 'sha256')}
    render = tree['m_RD']
    if (tree['m_SpriteAtlas']['m_PathID'] or tree['m_AtlasTags'] or tree['m_Bones']
            or tree['m_IsPolygon'] or render['alphaTexture']['m_PathID']
            or render['secondaryTextures'] or render['m_Bindpose'] or render['settingsRaw'] != 64
            or render['downscaleMultiplier'] != 1 or render['texture']['m_FileID']):
        raise ValueError('Unsupported atlas, skinning, packing or texture binding')
    vertex = render['m_VertexData']
    count = vertex['m_VertexCount']
    if type(count) is not int or not 0 < count <= 10000:
        raise ValueError('Invalid Sprite vertex count')
    channels = vertex['m_Channels']
    if (len(channels) != 14 or channels[0] != {'stream': 0, 'offset': 0, 'format': 0, 'dimension': 3}
            or channels[4] != {'stream': 1, 'offset': 0, 'format': 0, 'dimension': 2}
            or any(c['dimension'] for i, c in enumerate(channels) if i not in (0, 4))):
        raise ValueError('Unsupported Sprite vertex stream layout')
    raw = bytes.fromhex(vertex['m_DataSize']['bytesHex'])
    uv_offset = (count * 12 + 15) // 16 * 16
    if len(raw) != uv_offset + count * 8 or any(raw[count * 12:uv_offset]):
        raise ValueError('Unexpected Sprite vertex stream length/alignment')
    positions = [list(struct.unpack_from('<3f', raw, i * 12)) for i in range(count)]
    uv = [list(struct.unpack_from('<2f', raw, uv_offset + i * 8)) for i in range(count)]
    if any(not math.isfinite(v) for p in positions + uv for v in p) or any(v for p in uv for v in p):
        raise ValueError('Nonfinite position or unresolved explicit UV stream')
    indices_raw = render['m_IndexBuffer']
    if not indices_raw or len(indices_raw) % 6 or any(type(v) is not int or not 0 <= v <= 255 for v in indices_raw):
        raise ValueError('Invalid triangle index bytes')
    indices = list(struct.unpack('<' + 'H' * (len(indices_raw) // 2), bytes(indices_raw)))
    if any(i >= count for i in indices):
        raise ValueError('Sprite index outside vertex stream')
    meshes = render['m_SubMeshes']
    if len(meshes) != 1 or any(meshes[0][k] != expected for k, expected in {
            'firstByte': 0, 'indexCount': len(indices), 'topology': 0,
            'baseVertex': 0, 'firstVertex': 0, 'vertexCount': count}.items()):
        raise ValueError('Unsupported Sprite submesh')
    if (type(tree['m_PixelsToUnits']) not in (int, float)
            or not math.isfinite(tree['m_PixelsToUnits']) or tree['m_PixelsToUnits'] <= 0):
        raise ValueError('Invalid Sprite pixel scale')
    return {'name': tree['m_Name'], 'source': source,
        'texture': {'serializedFile': source['serializedFile'], 'pathId': str(render['texture']['m_PathID'])},
        'rect': finite_vector(tree['m_Rect'], ('x', 'y', 'width', 'height')),
        'pivot': finite_vector(tree['m_Pivot'], ('x', 'y')), 'pixelsToUnits': tree['m_PixelsToUnits'],
        'textureRect': finite_vector(render['textureRect'], ('x', 'y', 'width', 'height')),
        'textureRectOffset': finite_vector(render['textureRectOffset'], ('x', 'y')),
        'uvTransform': finite_vector(render['uvTransform'], ('x', 'y', 'z', 'w')),
        'positions': positions, 'indices': indices, 'explicitUVStream': uv,
        'units': 'native Sprite local units, Unity y-up; unprojected'}


def penlight_render_model(evidence):
    bound = bindings.decode_evidence(evidence)
    sprite_evidence = evidence.get('spriteEvidence')
    if not sprite_evidence:
        raise ValueError('Native Sprite geometry evidence required')
    sprites = {key: sprite_mesh(value) for key, value in sorted(sprite_evidence.items())}
    for key, sprite in sprites.items():
        if key != sprite['source']['serializedFile'] + ':' + sprite['source']['pathId']:
            raise ValueError('Sprite evidence key/identity mismatch')
    prefabs, used_sprites = [], set()
    for root, prefab in zip(evidence['prefabs'], bound['prefabs']):
        nodes, renderers = [], {}

        def walk(node, parent):
            route = (parent or '') + '/' + node['name']
            transforms = [c for c in node['components'] if c['type'] == 'Transform']
            if len(transforms) != 1 or any(n['route'] == route for n in nodes):
                raise ValueError('Missing, duplicate or ambiguous native Transform')
            t = transforms[0]
            if node['serializedFile'] != root['serializedFile'] or t['serializedFile'] != root['serializedFile']:
                raise ValueError('Transform crosses native prefab serialized file')
            position, scale = finite_vector(t['position'], 'xyz'), finite_vector(t['scale'], 'xyz')
            rotation = finite_vector(t['rotation'], 'xyzw')
            if abs(sum(v * v for v in rotation.values()) - 1) > 1e-5:
                raise ValueError('Invalid native quaternion')
            nodes.append({'route': route, 'parent': parent, 'gameObjectPathId': node['pathId'],
                'transformPathId': t['pathId'], 'position': position, 'scale': scale, 'rotation': rotation})
            for renderer in [c for c in node['components'] if c['type'] == 'SpriteRenderer']:
                source = renderer['sprite']
                key = source['serializedFile'] + ':' + source['pathId']
                if key not in sprites:
                    raise ValueError('SpriteRenderer has no native mesh evidence')
                sprite = sprites[key]
                if (source['name'] != sprite['name'] or source['rect'] != sprite['rect']
                        or source['pivot'] != sprite['pivot'] or source['pixelsToUnits'] != sprite['pixelsToUnits']
                        or {k: source['texture'][k] for k in ('serializedFile', 'pathId')} != sprite['texture']):
                    raise ValueError('SpriteRenderer geometry or texture identity differs')
                if (len(renderer['materials']) != 1
                        or renderer['materials'][0]['shader'] != 'Sprites/Default'):
                    raise ValueError('Unsupported native Penlight material')
                rid = renderer['serializedFile'] + ':' + renderer['pathId']
                if rid in renderers:
                    raise ValueError('Duplicate SpriteRenderer identity')
                renderers[rid] = {'route': route, 'spriteKey': key,
                    'rendererPathId': renderer['pathId'], 'material': renderer['materials'][0],
                    'initialColor': finite_vector(renderer['color'], 'rgba'), 'sortingOrder': renderer['sortingOrder']}
                used_sprites.add(key)
            for child in node['children']:
                walk(child, route)

        walk(root, None)
        actors = []
        for pair in prefab['pairs']:
            key = pair['spriteRenderer']['serializedFile'] + ':' + pair['spriteRenderer']['pathId']
            actors.append({**renderers.pop(key), 'index': pair['index'],
                'animatorPathId': pair['animator']['pathId'], 'controllerKey': pair['controllerKey']})
        shadows = []
        for excluded in prefab['excludedSprites']:
            key = excluded['serializedFile'] + ':' + excluded['pathId']
            shadows.append(renderers.pop(key))
        if renderers:
            raise ValueError('Unaccounted native SpriteRenderer')
        prefabs.append({k: prefab[k] for k in ('name', 'serializedFile', 'pathId', 'frontMiddleObjCount')} |
            {'nodes': sorted(nodes, key=lambda n: n['route']), 'actors': actors, 'shadows': shadows})
    if used_sprites != set(sprites):
        raise ValueError('Unbound Sprite evidence')
    clips = {}
    for controller in evidence['animationEvidence'].values():
        for clip in controller['clips']:
            model = animations.decode_clip(clip)
            clips[model['serializedFile'] + ':' + model['pathId']] = model
    return {'schemaVersion': 1, 'status': 'native_render_inputs_not_csv_or_camera_equivalence',
        'source': evidence['source'], 'sprites': sprites, 'prefabs': sorted(prefabs, key=lambda p: p['name']),
        'controllers': bound['controllers'], 'clips': clips, 'unresolved': bound['unresolved']}
