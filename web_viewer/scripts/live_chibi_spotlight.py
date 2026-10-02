"""Bind the two Spotlight sprites through the native serialized PPtr array.

Geometry is local 2D sprite geometry, not a reconstruction of the Unity camera.
"""
import hashlib
import math
import struct


def spotlight_background_model(prefab):
    """Resolve the background through both native PPtrs; no guessed mask runtime.

    The opaque-white Sprite is rendered normally only when there are no active
    Pinspotlight masks. The native masked shader path remains a separate gate.
    """
    if prefab['name'] != 'SpotlightBackground':
        raise ValueError('Unexpected Spotlight background prefab')
    scripts = [c for c in prefab['components'] if c.get('scriptClass') == 'SpotlightBackground']
    if len(scripts) != 1:
        raise ValueError('Ambiguous Spotlight background script')
    script = scripts[0]
    raw = bytes.fromhex(script['rawHex'])
    if len(raw) != 60 or hashlib.sha256(raw).hexdigest() != script['sha256']:
        raise ValueError('Invalid Spotlight background bytes')
    renderer_pointer = struct.unpack_from('<iq', raw, 32)
    system_pointer = struct.unpack_from('<iq', raw, 44)
    target_alpha = struct.unpack_from('<f', raw, 56)[0]
    if not math.isfinite(target_alpha) or not 0 <= target_alpha <= 1:
        raise ValueError('Invalid native target alpha')
    components = {(0, int(c['pathId'])): (child, c) for child in prefab['children']
                  for c in child['components']}
    if renderer_pointer not in components or system_pointer not in components:
        raise ValueError('Unresolved background PPtr')
    child, renderer = components[renderer_pointer]
    _, system = components[system_pointer]
    if renderer['type'] != 'SpriteRenderer' or system.get('scriptClass') != 'SpriteAlphaMaskSystem':
        raise ValueError('Invalid background renderer/mask system')
    if any(c['serializedFile'] != prefab['serializedFile'] for _, c in components.values()):
        raise ValueError('Cross-file background component')
    masked = [c for c in child['components'] if c.get('scriptClass') == 'AlphaMaskedSprite']
    if len(masked) != 1:
        raise ValueError('Missing background mask binding')
    mask_raw = bytes.fromhex(masked[0]['rawHex'])
    if (len(mask_raw) != 44 or hashlib.sha256(mask_raw).hexdigest() != masked[0]['sha256']
            or struct.unpack_from('<iq', mask_raw, 32) != system_pointer):
        raise ValueError('Background uses another mask system')
    transforms = [c for c in child['components'] if c['type'] == 'Transform']
    if len(transforms) != 1:
        raise ValueError('Ambiguous background transform')
    transform = transforms[0]
    if (transform['position'] != {'x': 0, 'y': 0, 'z': 0}
            or transform['rotation'] != {'x': 0, 'y': 0, 'z': 0, 'w': 1}
            or transform['scale'] != {'x': 20, 'y': 20, 'z': 1}):
        raise ValueError('Unsupported native background transform')
    sprite = renderer['sprite']
    if (sprite['name'] != 'pinspotlight_back' or sprite['texture']['name'] != sprite['name']
            or sprite['rect'] != {'x': 0, 'y': 0, 'width': 128, 'height': 128}
            or sprite['texture']['width'] != 128 or sprite['texture']['height'] != 128
            or sprite['pixelsToUnits'] != 100 or sprite['pivot'] != {'x': 0.5, 'y': 0.5}
            or [m['shader'] for m in renderer['materials']] != ['Custom/AlphaMaskedSprite']):
        raise ValueError('Unsupported background Sprite/material')
    return {'status': 'native_unmasked_sprite_only_pinspotlight_mask_pending',
            'serializedFile': prefab['serializedFile'], 'prefabPathId': prefab['pathId'],
            'scriptPathId': script['pathId'], 'scriptSha256': script['sha256'],
            'maskSystemPathId': system['pathId'], 'targetAlpha': target_alpha,
            'layers': [{'asset': sprite['texture']['name'],
                        'rendererPathId': renderer['pathId'], 'spritePathId': sprite['pathId'],
                        'texturePathId': sprite['texture']['pathId'],
                        'x': 0, 'y': 0, 'scaleX': 20, 'scaleY': 20,
                        'anchorX': 0.5, 'anchorY': 0.5,
                        'sortingOrder': renderer['sortingOrder'], 'blend': 'normal'}]}


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
