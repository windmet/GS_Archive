"""Resource-backed compilation and independent job caches, using temp fixtures."""
import json
import os
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'data_pipeline'))
from sidem_scenario import ScenarioCompiler, LocalScenarioResources

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    provider = LocalScenarioResources(lipsync_root=root/'lip', background_root=root/'bg', audio_root=root/'audio')
    meta = {'imageId': 'bg_fixture', 'bgmCueName': 'music', 'ambienceCueName': 'rain_t', 'lightAlpha': 0.5}
    write(root/'bg/advbg_data_valid.json', '\ufeff' + json.dumps(meta))
    write(root/'bg/advbg_data_broken.json', '{')
    write(root/'bg/ignored.json', json.dumps({'imageId': 'ignored'}))
    write(root/'audio/bgm/music.ogg', 'existence only; not decodable media')
    write(root/'audio/ambient/rain.ogg', 'existence only')
    write(root/'lip/047shu/fixture/fixture_1.json', json.dumps({'scales': [0, 1, 0]}))
    write(root/'lip/elsewhere/fixture_2.json', '{')
    assert provider.background_index() == {'bg_fixture': meta}
    assert provider.audio_exists('bgm', 'music')
    assert provider.audio_exists('ambient', 'rain_t')
    for cue in ('-', 'no_bgm', None, 'missing'):
        assert not provider.audio_exists('bgm', cue)
    assert provider.lip_info('missing.json') is None
    assert provider.lip_info(os.path.join('elsewhere', 'fixture_2.json')) == {'source': 'adxlip', 'path': 'adxlip/elsewhere/fixture_2.json'}
    raw = {'Command': [
        {'Type': 'image_bg', 'Values': ['bg_fixture']},
        {'Type': 'voice_file', 'Values': ['fixture']},
        {'Type': 'text', 'Values': ['speaker', 'one', '047shu', '1']},
        {'Type': 'text', 'Values': ['speaker', 'two', '047shu', '2']},
    ]}
    result = ScenarioCompiler(raw, 'fixture', resources=provider).compile()
    dialogues = [step for step in result['steps'] if step.get('dialogue')]
    assert dialogues[0]['dialogue']['lip']['frames'] == 3
    assert dialogues[1]['dialogue']['lip']['path'] == 'adxlip/elsewhere/fixture_2.json'
    assert dialogues[0]['state']['bgm'] == 'music'
    assert dialogues[0]['state']['environmental']['cue'] == 'rain_t'
    # The old class-root API uses the same lookup semantics.
    ScenarioCompiler.LIPSYNC_ROOT = str(root/'lip')
    ScenarioCompiler.ADV_BACKGROUND_ROOT = str(root/'bg')
    ScenarioCompiler.AUDIO_ROOT = str(root/'audio')
    ScenarioCompiler._ADV_BACKGROUND_INDEX = None
    ScenarioCompiler._LIPSYNC_BASENAME_INDEX = None
    assert ScenarioCompiler(raw, 'fixture').compile() == result
    other = LocalScenarioResources(lipsync_root=root/'empty', background_root=root/'empty', audio_root=root/'empty')
    empty = ScenarioCompiler(raw, 'fixture', resources=other).compile()
    assert all(not step.get('dialogue', {}).get('lip') for step in empty['steps'])
    assert all(not step['state']['bgm'] for step in empty['steps'])
    assert ScenarioCompiler(raw, 'fixture', resources=provider).compile() == result

    # A structural provider proves compilation needs no filesystem reads.
    class MemoryResources:
        def background_index(self): return {'bg_fixture': meta}
        def audio_exists(self, kind, cue): return cue in ('music', 'rain_t')
        def lip_info(self, path): return None
        def lip_index(self): return {}
    with patch('builtins.open', side_effect=AssertionError('compiler read filesystem')):
        in_memory = ScenarioCompiler(raw, 'fixture', resources=MemoryResources()).compile()
        grouped = ScenarioCompiler.compile_group([raw, raw], 'fixture', resources=MemoryResources())
    assert in_memory['steps'][0]['state']['bgm'] == 'music'
    assert len(grouped['episodes']) == 2
print('Scenario resources: background/audio/lip lookups, malformed fallback, legacy parity, independent caches and filesystem-free injected compilation passed')
