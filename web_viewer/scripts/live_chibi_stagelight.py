"""Bounded Take a StuMp! sprite lamps, with original command parameters retained."""
import csv
import hashlib
import io
import math
import struct

NAMES = {f'fx_in_tkstp1_stagelight_{i}' for i in range(1, 23)}
TEXTURES = {'fx_in_tkstp1_stagelight_1', 'fx_in_tkstp1_stagelight_2', 'fx_in_underlight'}


def stagelight_model(prefab, allow_general=False):
    if prefab['name'] not in NAMES and not (allow_general and prefab['name'].startswith('fx_in_') and '_stagelight_' in prefab['name']):
        raise ValueError('Unregistered stage lamp')
    root = next(c for c in prefab['components'] if c['type'] == 'Transform')
    script = next(c for c in prefab['components'] if c.get('scriptClass') == 'LiveObjectLightSpriteEffect')
    raw = bytes.fromhex(script['rawHex'])
    if hashlib.sha256(raw).hexdigest() != script['sha256']:
        raise ValueError('Stage lamp script hash mismatch')
    count = struct.unpack_from('<I', raw, 32)[0]
    if not count or len(raw) != 40 + count * 12 or struct.unpack_from('<I', raw, 36 + count * 12)[0] != 0:
        raise ValueError('Unexpected Sprite/Animator array layout')
    pointers = [struct.unpack_from('<iq', raw, 36 + i * 12) for i in range(count)]
    bound = {}
    for child in prefab['children']:
        renderer = next(c for c in child['components'] if c['type'] == 'SpriteRenderer')
        transform = next(c for c in child['components'] if c['type'] == 'Transform')
        bound[(0, int(renderer['pathId']))] = (renderer, transform)
    if len(set(pointers)) != count or set(bound) != set(pointers):
        raise ValueError('Unresolved ordered SpriteRenderer array')
    layers = []
    for pointer in pointers:
        renderer, transform = bound[pointer]
        sprite = renderer['sprite']
        texture = sprite['texture']
        if (not allow_general and texture['name'] not in TEXTURES) or renderer['serializedFile'] != prefab['serializedFile']:
            raise ValueError('Unexpected stage lamp resource')
        rect = sprite['rect']; tint = renderer['color']
        whole = rect == {'x': 0, 'y': 0, 'width': texture['width'], 'height': texture['height']}
        if (sprite['pixelsToUnits'] != 100 or sprite['pivot'] != {'x': .5, 'y': .5}
                or (allow_general and (not renderer.get('enabled') or renderer.get('drawMode')!=0))
                or (not allow_general and (not whole or tint != {'r': 1, 'g': 1, 'b': 1, 'a': 1}))
                or (not whole and (sprite.get('packingFlags', 1) & 1))
                or not (0 <= rect['x'] < texture['width'] and 0 <= rect['y'] < texture['height']
                        and 0 < rect['width'] <= texture['width'] - rect['x']
                        and 0 < rect['height'] <= texture['height'] - rect['y'])
                or any(not math.isfinite(v) or not 0 <= v <= 1 for v in tint.values())
                or [m['shader'] for m in renderer['materials']] != ['Mobile/Particles/Additive']):
            raise ValueError('Unsupported stage lamp Sprite/material')
        for t in [root, transform]:
            if (any(not math.isfinite(v) for k in ('position', 'rotation', 'scale') for v in t[k].values())
                    or (not allow_general and (t['rotation'] != {'x': 0, 'y': 0, 'z': 0, 'w': 1} or t['scale']['z'] != 1))):
                raise ValueError('Unsupported stage lamp transform')
        def plane(t):
            x,y,z,w = (t['rotation'][k] for k in ('x','y','z','w'))
            if abs(x*x+y*y+z*z+w*w-1) > 1e-5 or abs(2*(x*z-w*y)) > 1e-5 or abs(2*(y*z+w*x)) > 1e-5:
                raise ValueError('Nonplanar stage lamp rotation')
            return ((1-2*(y*y+z*z))*t['scale']['x'], 2*(x*y-w*z)*t['scale']['y'],
                    2*(x*y+w*z)*t['scale']['x'], (1-2*(x*x+z*z))*t['scale']['y'])
        a,b,c,d = plane(root); e,f,g,h = plane(transform)
        xx,xy,yx,yy = a*e+b*g,a*f+b*h,c*e+d*g,c*f+d*h
        sx = math.hypot(xx,yx); sy = (xx*yy-xy*yx)/sx if sx else 0
        angle = math.atan2(yx,xx)
        if not sx or not sy or abs(xx*xy+yx*yy) > 1e-5:
            raise ValueError('Sheared or degenerate stage lamp plane')
        layer = {'asset': texture['name'], 'rendererPathId': renderer['pathId'],
            'spritePathId': sprite['pathId'], 'texturePathId': texture['pathId'],
            'x': (root['position']['x'] + a*transform['position']['x'] + b*transform['position']['y']) * 100,
            'y': -(root['position']['y'] + c*transform['position']['x'] + d*transform['position']['y']) * 100,
            'scaleX': sx, 'scaleY': sy,
            'anchorX': .5, 'anchorY': .5, 'sortingOrder': renderer['sortingOrder'], 'blend': 'add'}
        if angle: layer['rotation'] = -angle
        if renderer.get('flipX'): layer['scaleX'] *= -1
        if renderer.get('flipY'): layer['scaleY'] *= -1
        if not whole: layer['crop'] = {**rect, 'y':texture['height']-rect['y']-rect['height']}
        if tint != {'r':1,'g':1,'b':1,'a':1}: layer['nativeColor'] = tint
        layers.append(layer)
    return {'status': 'native_ordered_sprite_geometry_not_unity_camera_equivalence',
        'serializedFile': prefab['serializedFile'], 'prefabPathId': prefab['pathId'],
        'scriptPathId': script['pathId'], 'scriptSha256': script['sha256'],
        'nativeZ': root['position']['z'], 'layers': layers}


def stagelight_events(payload, native_names=None):
    events = []
    for number, row in enumerate(csv.reader(io.StringIO(payload.decode('utf-8-sig'))), 1):
        if not row or row[0] != 'Stagelight':
            continue
        if len(row) < 19 or (native_names is None and len(row) != 24):
            raise ValueError('Unexpected Stagelight command width')
        def value(i):
            return float(row[i]) if row[i].strip() else None
        hide = row[17].strip() == '1'
        if not hide and row[3] not in (NAMES if native_names is None else native_names):
            raise ValueError('Unregistered command target')
        events.append({'time': value(1), 'id': value(2), 'asset': row[3] or None,
            'depth': value(4), 'alphaMode': value(5), 'colorMode': value(6),
            'color': row[7] or None, 'period': value(8), 'interval': value(9),
            'parameter10': (row[10] if row[10].startswith('#') else value(10)), 'alphaPeriod': value(11), 'direction': value(12),
            'hide': hide, 'fadeDuration': value(18) if hide else None, 'sourceRow': number})
    return sorted(events, key=lambda e: (e['time'], e['sourceRow']))
