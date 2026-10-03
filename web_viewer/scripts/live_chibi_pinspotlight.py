"""Native Pinspotlight mask/flash PPtr bindings; projection remains external."""
import hashlib
import struct

def raw_of(component, size):
    raw = bytes.fromhex(component['rawHex'])
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != component['sha256']:
        raise ValueError('Invalid Pinspotlight serialized bytes')
    return raw

def pinspotlight_sprite_model(prefab):
    if prefab['name'] != 'LiveObjectPinspotlight':
        raise ValueError('Unexpected Pinspotlight prefab')
    scripts = [c for c in prefab['components'] if c.get('scriptClass') == 'LiveObjectPinspotlight']
    if len(scripts) != 1:
        raise ValueError('Ambiguous Pinspotlight script')
    script = scripts[0]
    raw = raw_of(script, 80)
    pointers = [struct.unpack_from('<iq', raw, offset) for offset in (44, 56, 68)]
    components = {}
    for child in prefab['children']:
        for component in child['components']:
            key = (0, int(component['pathId']))
            if key in components or component['serializedFile'] != prefab['serializedFile']:
                raise ValueError('Ambiguous Pinspotlight component')
            components[key] = (child, component)
    if any(pointer not in components for pointer in pointers) or len(set(pointers)) != 3:
        raise ValueError('Unresolved Pinspotlight PPtr')
    mask_child, alpha_mask = components[pointers[0]]
    if alpha_mask.get('scriptClass') != 'AlphaMaskSprite':
        raise ValueError('Invalid Pinspotlight mask script')
    mask_raw = raw_of(alpha_mask, 52)
    interval = list(struct.unpack_from('<ii', mask_raw, 32))
    if interval != [1000, 3000]:
        raise ValueError('Unsupported native sorting interval')
    layers = []
    for pointer, shader, blend in zip(pointers[1:], ['Sprites/Default', 'ohashi/SimpleAdd'], ['mask', 'add']):
        child, renderer = components[pointer]
        if renderer['type'] != 'SpriteRenderer' or [m['shader'] for m in renderer['materials']] != [shader]:
            raise ValueError('Unexpected Pinspotlight renderer/material')
        if blend == 'mask' and child is not mask_child:
            raise ValueError('Mask script is bound to another child')
        transforms = [c for c in child['components'] if c['type'] == 'Transform']
        if len(transforms) != 1:
            raise ValueError('Missing Pinspotlight transform')
        transform = transforms[0]
        if (transform['position'] != {'x': 0, 'y': 0, 'z': 0}
                or transform['scale'] != {'x': 1, 'y': 1, 'z': 1}
                or transform['rotation'] != {'x': 0, 'y': 0, 'z': 0, 'w': 1}):
            raise ValueError('Unsupported Pinspotlight transform')
        sprite = renderer['sprite']
        if (sprite['name'] != 'pinspotlight' or sprite['texture']['name'] != 'pinspotlight'
                or sprite['rect'] != {'x': 0, 'y': 0, 'width': 512, 'height': 512}
                or sprite['pivot'] != {'x': 0.5, 'y': 0.5} or sprite['pixelsToUnits'] != 100
                or renderer['color'] != {'r': 0, 'g': 0, 'b': 0, 'a': 1}):
            raise ValueError('Unsupported Pinspotlight Sprite/color')
        layers.append({'asset': 'pinspotlight', 'rendererPathId': renderer['pathId'],
                       'spritePathId': sprite['pathId'], 'texturePathId': sprite['texture']['pathId'],
                       'anchorX': 0.5, 'anchorY': 0.5, 'scaleX': 1, 'scaleY': 1,
                       'sortingOrder': renderer['sortingOrder'], 'initialColor': 0,
                       'initialAlpha': 1, 'blend': blend})
    if layers[0]['texturePathId'] != layers[1]['texturePathId']:
        raise ValueError('Native mask and flash do not share a texture')
    return {'status': 'native_mask_flash_bindings_not_camera_or_script_semantics',
            'serializedFile': prefab['serializedFile'], 'prefabPathId': prefab['pathId'],
            'scriptPathId': script['pathId'], 'scriptSha256': script['sha256'],
            'alphaMaskPathId': alpha_mask['pathId'], 'sortingInterval': interval, 'layers': layers}
