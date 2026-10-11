"""Native PPtr lamp binding, corruption/reorder, and optional published export."""
import copy
import json
from pathlib import Path
import sys
from live_chibi_stagelight import stagelight_model, NAMES

root = Path(__file__).resolve().parents[1]
fixture = json.loads((root / 'scripts/fixtures/chibi-stagelight-prefabs.json').read_text(encoding='utf8'))
models = {n['name']: stagelight_model(n) for n in fixture['prefabs']}
assert set(models) == NAMES
assert sum(len(m['layers']) for m in models.values()) == 87
for prefab in fixture['prefabs']:
    reordered = copy.deepcopy(prefab)
    reordered['children'].reverse()
    assert stagelight_model(reordered) == models[prefab['name']]
    broken = copy.deepcopy(prefab)
    script = next(c for c in broken['components'] if c.get('scriptClass') == 'LiveObjectLightSpriteEffect')
    script['rawHex'] = 'ff' + script['rawHex'][2:]
    try:
        stagelight_model(broken)
    except ValueError:
        pass
    else:
        raise AssertionError('Corrupt native lamp accepted')
if '--published-assets' in sys.argv:
    exported = json.loads((root / 'public/assets/live-chibi/stage-effects/index.json').read_text(encoding='utf8'))
    assert {n:exported['stagelights'][n] for n in models} == models
    for m in models.values():
        for layer in m['layers']:
            asset = exported['assets'][layer['asset']]
            assert asset['source']['pathId'] == layer['texturePathId']
            assert asset['source']['serializedFile'] == m['serializedFile']
print('22 native stage lamp prefabs / 87 ordered Sprite bindings, reorder and corruption checks passed')
general=json.loads((root/'scripts/fixtures/chibi-stagelight-general-prefabs.json').read_text(encoding='utf8'))
for prefab in general['prefabs']:
    model=stagelight_model(prefab,allow_general=True)
    reordered=copy.deepcopy(prefab);reordered['children'].reverse()
    assert stagelight_model(reordered,allow_general=True)==model
    if '--published-assets' in sys.argv: assert exported['stagelights'][prefab['name']]==model
    for layer in model['layers']:
        if 'crop' in layer:
            child=next(ch for ch in prefab['children'] if any(c.get('pathId')==layer['rendererPathId'] for c in ch['components']))
            sprite=next(c['sprite'] for c in child['components'] if c['type']=='SpriteRenderer')
            assert layer['crop']['y']==sprite['texture']['height']-sprite['rect']['y']-sprite['rect']['height']
            broken=copy.deepcopy(prefab)
            for ch in broken['children']:
                for c in ch['components']:
                    if 'sprite' in c:c['sprite']['packingFlags']=1
            try:stagelight_model(broken,allow_general=True)
            except ValueError:pass
            else:raise AssertionError('Packed atlas accepted without native UV decoder')
assert any('rotation' in l for p in general['prefabs'] for l in stagelight_model(p,True)['layers'])
assert any('nativeColor' in l for p in general['prefabs'] for l in stagelight_model(p,True)['layers'])
print('General lamp atlas coordinates, rotated planes, native opacity, ordered bindings and packed-atlas refusal passed')
