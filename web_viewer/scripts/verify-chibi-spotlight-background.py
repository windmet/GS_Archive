"""Exact PPtr background contract; portable fixture contains no media."""
import copy
import hashlib
import json
import struct
from pathlib import Path
from live_chibi_spotlight import spotlight_background_model

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-spotlight-background.json').read_text(encoding='utf8'))
prefab = fixture['prefabs'][0]
assert spotlight_background_model(prefab) == fixture['model']
reordered = copy.deepcopy(prefab)
reordered['children'].reverse()
assert spotlight_background_model(reordered) == fixture['model']

def rejected(change):
    bad = copy.deepcopy(prefab)
    change(bad)
    try:
        spotlight_background_model(bad)
    except ValueError:
        return
    raise AssertionError('Corrupt native background accepted')

def raw_edit(p, offset, fmt, value):
    script = next(c for c in p['components'] if c.get('scriptClass') == 'SpotlightBackground')
    raw = bytearray.fromhex(script['rawHex'])
    struct.pack_into(fmt, raw, offset, value)
    script.update(rawHex=raw.hex(), sha256=hashlib.sha256(raw).hexdigest())

rejected(lambda p: raw_edit(p, 36, '<q', 1))
rejected(lambda p: raw_edit(p, 48, '<q', 1))
rejected(lambda p: raw_edit(p, 56, '<f', float('nan')))
rejected(lambda p: p['components'][1].update(sha256='0' * 64))
sprite = next(c for child in prefab['children'] for c in child['components'] if c['type'] == 'SpriteRenderer')
def renderer(p):
    return next(c for child in p['children'] for c in child['components'] if c['type'] == 'SpriteRenderer')
rejected(lambda p: renderer(p)['materials'][0].update(shader='Sprites/Default'))
rejected(lambda p: renderer(p)['sprite']['texture'].update(name='pinspotlight'))
rejected(lambda p: p['children'][0]['components'][0]['scale'].update(x=1))
assert sprite['sortingOrder'] == 1900
print('Native background renderer/mask PPtrs, child reorder, geometry and corruption rejection passed')
