"""Resource adapters and pure background/compiled projections."""
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
from sidem_masterdata import resource_inputs as inputs
from sidem_masterdata.backgrounds import build_background_catalog
from sidem_masterdata.compiled_projection import summarize_compiled_payload, card_home_voice_files, build_card_home_voice_previews
from sidem_masterdata import iter_top_records, extract_table_rows


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data, directory, api=legacy):
    records = list(iter_top_records(data))
    tables = extract_table_rows(records, {107, 108, 110})
    cues = legacy.extract_card_voice_cues(records)
    stems = api.collect_compiled_stems(directory)
    return {'backgrounds': api.build_background_catalog(tables),
            'stems': sorted(stems), 'summaries': api.collect_compiled_summaries(directory),
            'previews': api.collect_card_home_voice_previews(cues, directory, stems)}


def verify():
    payload = {'scenario_id': 'scene', 'steps': [None,
        {'type': 'adv', 'step_id': 1, 'dialogue': {'text': '【あらすじ】'}},
        {'type': 'adv', 'step_id': 2, 'chara_id': 'B', 'state': {'spines': [{'id': 'A'}]},
         'dialogue': {'speaker': 'A', 'text': 'First\nSecond', 'voice': 'audio/base_01.m4a', 'lip': {'path': 'lip'}}},
        {'type': 'adv', 'step_id': 3, 'dialogue': {'text': 'foreign', 'voice': 'audio/other.m4a'}}]}
    saved = copy.deepcopy(payload)
    with patch.object(Path, 'read_text', side_effect=AssertionError('projection read filesystem')):
        summary = summarize_compiled_payload(payload)
        mapping = card_home_voice_files([{'scenario_base': 'base'}], {'prefix_base'})
        previews = build_card_home_voice_previews(mapping, {'prefix_base.json': payload})
    assert payload == saved
    assert summary == {'scenario_id': 'scene', 'title': 'First', 'step_count': 4,
                       'step_types': {'adv': 3}, 'voice_count': 2, 'lip_count': 1, 'characters': ['A', 'B']}
    assert list(previews) == ['base_01']
    assert previews['base_01']['preview_step'] == payload['steps'][2]
    assert previews['base_01']['_source'] == {'compiled_file': 'prefix_base.json', 'scenario_base': 'base', 'cue': 'base_01'}
    titled = copy.deepcopy(payload)
    titled['steps'].append({'type': 'title', 'dialogue': {'text': 'Title'}})
    assert summarize_compiled_payload(titled)['title'] == 'Title'
    duplicate = copy.deepcopy(payload)
    duplicate['steps'].append({**payload['steps'][2], 'step_id': 9})
    assert build_card_home_voice_previews(mapping, {'prefix_base.json': duplicate})['base_01']['step_id'] == 9
    tables = {107: [{'1': 1, '2': 'Name', '5': 'bg001', '_offset': 107}],
              108: [{'1': 2, '6': 'bg001', '7': 'effect'}], 110: [{'2': 'bg002'}]}
    before = copy.deepcopy(tables)
    unknown = build_background_catalog(tables, set())
    known = build_background_catalog(tables, {'bg001'})
    assert tables == before
    assert unknown['backgrounds']['bg001']['asset_exists'] is None
    assert known['backgrounds']['bg001']['asset_exists'] is True
    assert known['backgrounds']['bg002']['asset_exists'] is False
    assert known['backgrounds']['bg001']['_source']['offset'] == 107
    assert len(known['backgrounds']['bg001']['_sources']) == 2
    with tempfile.TemporaryDirectory() as temp:
        directory = Path(temp)
        (directory / 'prefix_base.json').write_text(json.dumps(payload), encoding='utf-8')
        (directory / 'broken.json').write_text('{', encoding='utf-8')
        (directory / 'index.json').write_text('{}', encoding='utf-8')
        (directory / 'voice_index.json').write_text('{}', encoding='utf-8')
        (directory / 'nested').mkdir()
        (directory / 'nested/deep.json').write_text('{}', encoding='utf-8')
        (directory / 'nested/voice.m4a').write_bytes(b'')
        (directory / 'bg001.png').write_bytes(b'')
        assert inputs.collect_compiled_stems(directory) == {'prefix_base', 'broken'}
        assert inputs.collect_compiled_summaries(directory) == {'prefix_base': summary}
        assert inputs.collect_card_home_voice_previews([{'scenario_base': 'base'}], directory, {'prefix_base'}) == previews
        assert inputs.collect_voice_stems(directory) == {'voice'}
        assert inputs.collect_background_stems(directory) == {'bg001'}
        assert legacy.build_background_catalog(tables, directory) == known
        assert inputs.load_json_file(directory / 'broken.json') is None
        (directory / 'models.json').write_text('{"models": {"one": {}}}', encoding='utf-8')
        assert inputs.load_spine_ids(directory / 'models.json') == {'one'}
        assert inputs.load_prefab_models(directory / 'models.json') == {'one': {}}
    assert inputs.collect_compiled_stems(None) == set()
    assert inputs.collect_card_home_voice_previews([], None, set()) == {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    parser.add_argument('--compiled-dir', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        if args.compiled_dir is None:
            parser.error('--compiled-dir required for mounted verification')
        data = args.decoded_masterdata.read_bytes()
        result = corpus(data, args.compiled_dir)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(),
                  'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/resource-inputs-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({key: len(value) for key, value in result.items() if key != 'backgrounds'}))
    print('Masterdata resources: pure projections, adapter scope, raw previews, title selection and unknown availability passed')


if __name__ == '__main__':
    main()
