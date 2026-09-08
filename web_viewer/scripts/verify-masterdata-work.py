"""Work projection and compiled input adapter contracts."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import masterdata_extract as legacy
from sidem_masterdata.work import build_work_story_index, work_story_files
from sidem_masterdata.compiled_inputs import load_scenario_payloads
from sidem_masterdata import extract_table_rows, iter_top_records


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data, compiled_dir, api=legacy):
    tables = extract_table_rows(list(iter_top_records(data)), {2, 24, 53, 54, 55, 107, 108, 110})
    idols = legacy.build_idol_unit_dictionary(tables)
    backgrounds = legacy.build_background_catalog(tables)
    stems = legacy.collect_compiled_stems(compiled_dir)
    files = work_story_files(tables, stems)
    summaries = {Path(name).stem: legacy.summarize_compiled_scenario(compiled_dir / name) for name in files}
    return api.build_work_story_index(tables, compiled_dir, stems, summaries, idols, backgrounds)


def verify():
    tables = {53: [{'1': 1, '2': 'Work', '3': 10, '4': 20}],
              54: [{'1': 1, '2': 10, '3': 1, '5': 'scene', '_offset': 12},
                   {'1': 2, '2': 10, '3': 1, '5': 'broken'},
                   {'1': 3, '3': 'invalid', '5': 'unused'}],
              55: [{'1': 4, '2': 20, '3': 1, '5': 'scene'}, {'1': 5, '3': 2, '5': 'missing'}]}
    stems = {'scene', 'broken', 'unused'}
    summaries = {'scene': {'title': 'Title', 'step_count': 4, 'voice_count': 1}}
    idols = {'by_numeric_id': {'1': {'idol_code': '001tom', 'display_name': 'Idol'}}}
    backgrounds = {'backgrounds': {'bg001': {'names': ['', 'Studio']}}}
    payload = {'steps': [None, {'type': 'effect', 'state': {'bg': 'bg001', 'spines': [{'model': 'model'}]}},
                         {'type': 'adv', 'dialogue': {'speaker': 'A', 'text_jp': '日本語', 'text': 'fallback'}},
                         {'type': 'call', 'dialogue': {'speaker': 'A', 'text': 'next'}},
                         {'type': 'talk', 'dialogue': {'speaker': 'B', 'text': 'last'}},
                         {'type': 'effect', 'dialogue': {'speaker': 'ignored'}}]}
    args = [tables, stems, summaries, idols, backgrounds, {'scene.json': payload}]
    before = copy.deepcopy(args)
    with patch.object(Path, 'read_text', side_effect=AssertionError('projection performed IO')):
        result = build_work_story_index(*args)
    assert args == before
    assert work_story_files(tables, stems) == ['scene.json', 'broken.json']
    entry = result['idols'][0]['short_stories'][0]
    assert entry['background_name'] == 'Studio'
    assert entry['background_name_source'] == 'masterdata_picture_studio'
    assert entry['model_resource_id'] == 'model'
    assert entry['dialogue_count'] == 3 and entry['dialogue_preview'] == '日本語'
    assert entry['speakers'] == ['A', 'B']
    assert result['idols'][0]['scene_lines'][1]['_source']['offset'] == 12
    assert result['meta']['missing_resource_count'] == 1
    assert 'dialogue_count' not in result['idols'][0]['scene_lines'][0]
    assert result['idols'][1]['idol_code'] is None
    unnamed = build_work_story_index(tables, stems, summaries, idols, {}, {'scene.json': payload})
    assert unnamed['idols'][0]['short_stories'][0]['background_name_source'] == 'compiled_resource_only'
    with tempfile.TemporaryDirectory() as temp:
        directory = Path(temp)
        (directory / 'scene.json').write_text(json.dumps(payload), encoding='utf-8')
        (directory / 'broken.json').write_text('{', encoding='utf-8')
        (directory / 'unicode.json').write_bytes(b'\xff')
        assert load_scenario_payloads(None, ['scene.json']) == {}
        assert load_scenario_payloads(directory, ['absent.json', 'broken.json', 'unicode.json']) == {}
        original = Path.read_text
        calls = []

        def read(path, *args, **kwargs):
            calls.append(path.name)
            return original(path, *args, **kwargs)

        with patch.object(Path, 'read_text', read):
            loaded = load_scenario_payloads(directory, ['scene.json', 'scene.json'])
        assert calls == ['scene.json'] and loaded == {'scene.json': payload}
        assert legacy.build_work_story_index(tables, directory, stems, summaries, idols, backgrounds) == result
        # Successful JSON decoding is distinct from missing evidence; invalid root shape is not silently hidden.
        (directory / 'null.json').write_text('null', encoding='utf-8')
        assert load_scenario_payloads(directory, ['null.json']) == {'null.json': None}
        try:
            build_work_story_index(*args[:-1], {'scene.json': None})
        except AttributeError:
            pass
        else:
            raise AssertionError('invalid root shape silently accepted')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    parser.add_argument('--compiled-dir', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        if args.compiled_dir is None:
            parser.error('--compiled-dir is required for mounted baseline verification')
        data = args.decoded_masterdata.read_bytes()
        result = corpus(data, args.compiled_dir)
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/work-baseline.json').read_text())
        assert {'input_sha256': hashlib.sha256(data).hexdigest(), 'output_sha256': digest(result)} == expected['summary']
        print(json.dumps(result['meta']))
    print('Masterdata work: pure projection, selected reads, missing evidence, dialogue/background provenance and compatibility passed')


if __name__ == '__main__':
    main()
