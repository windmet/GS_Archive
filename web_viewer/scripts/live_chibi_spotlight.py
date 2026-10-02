"""Bind the two Spotlight sprites through the native serialized PPtr array.

Geometry is local 2D sprite geometry, not a reconstruction of the Unity camera.
"""
import hashlib
import math
import struct


def spotlight_sprite_model(prefab):
    if prefab['name'] != 'LiveObjectSpotlight':
        raise ValueError('Unexpected Spotlight prefab')
    scripts = [c for c in prefab['components'] if c.get('scriptClass') == 'LiveObjectSpotlight']
    if len(scripts) != 1:
        raise ValueError('Ambiguous Spotlight script')
    script = scripts[0]
    raw = bytes.fromhex(script['rawHex'])
    if len(raw) != 72 or hashlib.sha256(raw).hexdigest() != script['sha256']:
        raise ValueError('Invalid Spotlight script bytes')
    # Common MonoBehaviour header (32), targetIdol PPtr (12), then _flashSprites.
    # The visible auto-property is not serialized in the prefab.
    if struct.unpack_from('<I', raw, 44)[0] != 2:
        raise ValueError('Unexpected Spotlight sprite count')
    pointers = [struct.unpack_from('<iq', raw, offset) for offset in (48, 60)]
    renderers = {}
    for child in prefab['children']:
        transforms = [c for c in child['components'] if c['type'] == 'Transform']
        sprites = [c for c in child['components'] if c['type'] == 'SpriteRenderer']
        if len(transforms) != 1 or len(sprites) != 1:
            raise ValueError('Unexpected Spotlight child components')
        renderer, transform = sprites[0], transforms[0]
        key = (0, int(renderer['pathId']))
        if key in renderers or renderer['serializedFile'] != prefab['serializedFile']:
            raise ValueError('Ambiguous Spotlight renderer')
        renderers[key] = (renderer, transform)
    if len(set(pointers)) != 2 or set(pointers) != set(renderers):
        raise ValueError('Unresolved Spotlight sprite bindings')
    layers = []
    for pointer in pointers:
        renderer, transform = renderers[pointer]
        sprite = renderer['sprite']
        ppu = sprite['pixelsToUnits']
        if not math.isfinite(ppu) or ppu <= 0:
            raise ValueError('Invalid Spotlight pixels to units')
        if any(not math.isfinite(value) for group in ('position', 'scale', 'rotation') for value in transform[group].values()):
            raise ValueError('Invalid Spotlight transform')
        if transform['scale']['x'] <= 0 or transform['scale']['y'] <= 0:
            raise ValueError('Invalid Spotlight scale')
        if any(transform['rotation'][k] != v for k, v in {'x': 0, 'y': 0, 'z': 0, 'w': 1}.items()):
            raise ValueError('Unsupported Spotlight sprite rotation')
        if [m['shader'] for m in renderer['materials']] != ['Mobile/Particles/Additive']:
            raise ValueError('Unsupported Spotlight material')
        if sprite['name'] != sprite['texture']['name'] or sprite['rect']['x'] or sprite['rect']['y']:
            raise ValueError('Unsupported Spotlight atlas geometry')
        if (sprite['rect']['width'], sprite['rect']['height']) != (sprite['texture']['width'], sprite['texture']['height']):
            raise ValueError('Unexpected Spotlight texture dimensions')
        # Unity local Y points up; the canvas local Y points down.
        layers.append({'asset': sprite['texture']['name'],
            'rendererPathId': renderer['pathId'], 'spritePathId': sprite['pathId'],
            'texturePathId': sprite['texture']['pathId'],
            'x': transform['position']['x'] * ppu,
            'y': -transform['position']['y'] * ppu,
            'scaleX': transform['scale']['x'], 'scaleY': transform['scale']['y'],
            'anchorX': sprite['pivot']['x'], 'anchorY': 1 - sprite['pivot']['y'],
            'sortingOrder': renderer['sortingOrder'], 'blend': 'add'})
    if [layer['asset'] for layer in layers] != ['Spotlight1', 'Spotlight2']:
        raise ValueError('Unexpected Spotlight texture order')
    return {'status': 'native_local_sprite_geometry_not_camera_projection',
        'serializedFile': prefab['serializedFile'], 'prefabPathId': prefab['pathId'],
        'scriptPathId': script['pathId'], 'scriptSha256': script['sha256'], 'layers': layers}
