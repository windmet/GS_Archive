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
    assert exported['stagelights'] == models
    for m in models.values():
        for layer in m['layers']:
            asset = exported['assets'][layer['asset']]
            assert asset['source']['pathId'] == layer['texturePathId']
            assert asset['source']['serializedFile'] == m['serializedFile']
print('22 native stage lamp prefabs / 87 ordered Sprite bindings, reorder and corruption checks passed')
