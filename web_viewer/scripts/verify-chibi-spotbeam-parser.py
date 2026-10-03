import copy
import json
from pathlib import Path
from live_chibi_spotbeam import spotbeam_model

root = Path(__file__).parent
fixture = json.loads((root/'fixtures/chibi-spotbeam-native.json').read_text(encoding='utf-8'))
expected = json.loads((root/'fixtures/chibi-spotbeam-model.json').read_text(encoding='utf-8'))
assert spotbeam_model(**fixture) == expected
reordered = copy.deepcopy(fixture)
for prefab in reordered['prefabs']: prefab['systems'].reverse()
assert spotbeam_model(**reordered) == expected
for mutate in (
    lambda f: f['root'].__setitem__('sha256','0'*64),
    lambda f: f['prefabs'][0].__setitem__('pointerPathId','1'),
    lambda f: f['prefabs'][0]['systems'][0]['renderer']['materials'][0]['textures'][0].__setitem__('pathId','630'),
    lambda f: f['prefabs'][0]['systems'][0]['modules']['UVModule'].__setitem__('tilesX',1),
    lambda f: f['prefabs'][0]['systems'][0]['main']['startDelay'].__setitem__('minMaxState',3),
    lambda f: f['prefabs'][0]['systems'][0]['modules']['EmissionModule']['m_Bursts'][0].__setitem__('probability',.5),
    lambda f: f['prefabs'][0]['systems'][0]['transformChain'][0]['scale'].__setitem__('x',2),
):
    bad = copy.deepcopy(fixture); mutate(bad)
    try: spotbeam_model(**bad)
    except ValueError: pass
    else: raise AssertionError('Unsupported native binding/module accepted')
for model in expected['styles'].values():
    assert {s['frame'] for s in model['systems']} == {0,1}
    assert len({round(s['bursts'][0]['time'],2) for s in model['systems']}) == 4
print('PASS native spotbeam: exact owner PPtrs, atlas frames, ordered systems, four bursts, unsupported source rejection')
