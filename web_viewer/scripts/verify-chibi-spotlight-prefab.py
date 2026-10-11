"""Portable native binding regression; no XAPK or textures needed in CI."""
import copy
import json
from pathlib import Path
from live_chibi_spotlight import spotlight_sprite_model

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-spotlight-prefab.json').read_text(encoding='utf-8'))
prefab = fixture['prefabs'][0]
model = spotlight_sprite_model(prefab)
assert model == fixture['model'], 'Actual exported descriptor must match native bindings'
assert [layer['asset'] for layer in model['layers']] == ['Spotlight1', 'Spotlight2']
assert abs(model['layers'][0]['y'] + 470) < 0.0001
assert abs(model['layers'][1]['scaleX'] - 0.6) < 0.000001
assert model['layers'][0]['anchorY'] == 0.5
reordered = copy.deepcopy(prefab)
reordered['children'].reverse()
assert spotlight_sprite_model(reordered) == model, 'Bindings must follow PPtrs, not tree order'

def rejected(change):
    bad = copy.deepcopy(prefab)
    change(bad)
    try:
        spotlight_sprite_model(bad)
    except ValueError:
        return
    raise AssertionError('Corrupt native binding accepted')

rejected(lambda p: p['components'][1].update(rawHex='00'))
rejected(lambda p: p['components'][1].update(sha256='0' * 64))
rejected(lambda p: p['children'][0]['components'][1].update(pathId='55516'))
rejected(lambda p: p['children'][0]['components'][1]['sprite']['texture'].update(name='pinspotlight'))
rejected(lambda p: p['children'][0]['components'][1]['materials'][0].update(shader='Sprites/Default'))
rejected(lambda p: p['children'][0]['components'][0]['position'].update(y=float('nan')))
rejected(lambda p: p['children'][0]['components'][0]['scale'].update(x=0))
rejected(lambda p: p['children'][0]['components'][0]['rotation'].update(z=0.5))
rejected(lambda p: p['children'][0]['components'][1]['sprite'].update(pixelsToUnits=0))
rejected(lambda p: p['children'][0]['components'][1]['sprite']['rect'].update(width=1))
print('Native Spotlight PPtr bindings, geometry, child reorder and 10 corruption cases passed')
