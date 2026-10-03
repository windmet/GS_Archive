import copy
import json
from pathlib import Path
from live_chibi_laser import laser_model

root = Path(__file__).parent
fixture = json.loads((root/'fixtures/chibi-laser-native.json').read_text(encoding='utf-8'))
expected = json.loads((root/'fixtures/chibi-laser-model.json').read_text(encoding='utf-8'))
assert laser_model(**fixture) == expected
# Native script array order, not hierarchy traversal, controls emitter order.
reordered = copy.deepcopy(fixture)
for p in reordered['prefabs']: p['systems'].reverse()
assert laser_model(**reordered) == expected
for mutate in (
    lambda f: f['root'].__setitem__('sha256','0'*64),
    lambda f: f['prefabs'][0].__setitem__('pointerPathId','130374'),
    lambda f: f['prefabs'][0]['systems'][0]['renderer']['materials'][0]['textures'][0].__setitem__('pathId','886'),
    lambda f: f['prefabs'][0]['systems'][0]['modules']['InitialModule']['startSpeed'].__setitem__('scalar',1),
):
    bad = copy.deepcopy(fixture); mutate(bad)
    try: laser_model(**bad)
    except ValueError: pass
    else: raise AssertionError('Tampered native binding/module accepted')
assert expected['styles']['7']['systems'][1]['mirrored']
assert expected['styles']['7']['systems'][0]['anchorY'] > .98
print('PASS native laser: style PPtrs, ordered particles, mirrored fans, source texture, unsupported module rejection')
