"""Native new-suspension bindings and ordered command arguments.

Field interpretation is a recording-guided preview, not recovered tween code.
Unknown commands remain present and invalidate an object's preview state.
"""
import csv
import hashlib
import io
import struct

ASSET = 'new_suspension_light_sample'


def suspensionlight_model(prefab):
    if prefab['name'] != 'LiveObjectNewSuspensionLight':
        raise ValueError('Unexpected new-suspension root')
    def nodes(node):
        yield node
        for child in node['children']:
            yield from nodes(child)
    components = {int(c['pathId']): (n, c) for n in nodes(prefab) for c in n['components']}
    scripts = [c for c in prefab['components'] if c.get('scriptClass') == 'LiveObjectNewSuspensionLight']
    if len(scripts) != 1:
        raise ValueError('Ambiguous new-suspension script')
    script = scripts[0]
    raw = bytes.fromhex(script['rawHex'])
    if hashlib.sha256(raw).hexdigest() != script['sha256']:
        raise ValueError('Changed new-suspension bytes')
    # Metadata field order: _lightSprite, _rotateBase. These PPtrs, rather
    # than a similarly named texture elsewhere in the corpus, bind the beam.
    sprite_ptr, rotate_ptr = [struct.unpack_from('<iq', raw, offset) for offset in (32, 44)]
    if sprite_ptr[0] != 0 or rotate_ptr[0] != 0:
        raise ValueError('External suspension binding not supported')
    node, renderer = components[sprite_ptr[1]]
    if renderer['type'] != 'SpriteRenderer' or [m['shader'] for m in renderer['materials']] != ['ohashi/SimpleAdd']:
        raise ValueError('Changed suspension renderer/shader')
    if not any(int(n['pathId']) == rotate_ptr[1] and n['name'] == 'RotateBase' for n in nodes(prefab)):
        raise ValueError('Unresolved suspension rotation base')
    sprite = renderer['sprite']
    if (sprite['name'] != ASSET or sprite['texture']['name'] != ASSET
            or sprite['pivot'] != {'x': .5, 'y': 1} or sprite['pixelsToUnits'] != 100
            or sprite['rect'] != {'x': 0, 'y': 0, 'width': 1024, 'height': 1024}):
        raise ValueError('Changed suspension sprite geometry')
    for n in nodes(prefab):
        for c in n['components']:
            if c['type'] in ('Transform', 'RectTransform') and (
                    c['position'] != {'x': 0, 'y': 0, 'z': 0}
                    or c['scale'] != {'x': 1, 'y': 1, 'z': 1}
                    or c['rotation'] != {'x': 0, 'y': 0, 'z': 0, 'w': 1}):
                raise ValueError('Unimplemented suspension prefab transform')
    return {'status': 'native_sprite_binding_reference_timeline_projection',
            'serializedFile': prefab['serializedFile'], 'prefabPathId': prefab['pathId'],
            'scriptPathId': script['pathId'], 'scriptSha256': script['sha256'],
            'layers': [{'asset': ASSET, 'rendererPathId': renderer['pathId'],
                        'spritePathId': sprite['pathId'], 'texturePathId': sprite['texture']['pathId'],
                        'anchorX': .5, 'anchorY': 0, 'scaleX': 1, 'scaleY': 1, 'blend': 'add'}]}


def suspensionlight_events(payload):
    reader = csv.reader(io.StringIO(payload.decode('utf-8-sig')))
    header = next(reader)
    fields = {name: i for i, name in enumerate(header)}
    result = []
    for source_row, row in enumerate(reader, 2):
        if not row or not row[0].startswith('NewSuspensionlight_'):
            continue
        def field(name):
            index = fields.get(name)
            return row[index].strip() if index is not None and index < len(row) else ''
        try:
            time, identifier = float(row[1]), int(field('value1'))
        except ValueError:
            raise ValueError(f'Invalid suspension time/id at source row {source_row}')
        result.append({'time': time, 'id': identifier, 'command': row[0],
                       'sourceRow': source_row, 'values': [field(f'value{i}') for i in range(1, 11)],
                       'extraValues': {name: field(name) for name in header if name.startswith('value')
                                       and int(name[5:]) > 10 and field(name)},
                       'erase': field('value101') == '1' or field('value102') == '1'})
    return sorted(result, key=lambda e: (e['time'], e['sourceRow']))
