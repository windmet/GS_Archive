import copy
import json
import struct
import hashlib
from pathlib import Path
from live_chibi_pinspotlight import pinspotlight_sprite_model

fixture = json.loads((Path(__file__).parent/'fixtures/chibi-pinspotlight-prefab.json').read_text(encoding='utf8'))
p = fixture['prefabs'][0]
assert pinspotlight_sprite_model(p) == fixture['model']
r = copy.deepcopy(p); r['children'].reverse()
assert pinspotlight_sprite_model(r) == fixture['model']
def rejected(edit):
    r = copy.deepcopy(p); edit(r)
    try: pinspotlight_sprite_model(r)
    except ValueError: return
    raise AssertionError('Corrupt Pinspotlight accepted')
def change_pointer(r):
    c = r['components'][1]; raw = bytearray.fromhex(c['rawHex'])
    struct.pack_into('<q', raw, 60, 52550)
    c.update(rawHex=raw.hex(), sha256=hashlib.sha256(raw).hexdigest())
rejected(change_pointer)
rejected(lambda r: r['components'][1].update(sha256='0'*64))
rejected(lambda r: r['children'][0]['components'][1]['materials'][0].update(shader='ohashi/SimpleAdd'))
rejected(lambda r: r['children'][0]['components'][1]['color'].update(r=1))
rejected(lambda r: r['children'][0]['components'][0]['scale'].update(x=0.7))
rejected(lambda r: r['children'].append(copy.deepcopy(r['children'][0])))
print('Native Pinspotlight mask/flash/interval bindings, reorder and corruption rejection passed')
