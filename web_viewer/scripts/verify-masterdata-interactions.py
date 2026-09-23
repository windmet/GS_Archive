"""Interaction semantics and optional complete pre-extraction corpus baseline."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata import extract_table_rows, iter_top_records
from sidem_masterdata.identities import build_idol_unit_dictionary, build_speaker_dictionary
from sidem_masterdata.episodes import build_idol_episode_index
from sidem_masterdata.mobile import build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index
from sidem_masterdata.seasonal import build_seasonal_communication_index, build_seasonal_campaign_index
from sidem_masterdata import story_resources as resources
import masterdata_extract as legacy

BUILDERS = [build_idol_episode_index, build_mobile_archive_index, build_home_interaction_index,
            build_short_adv_profile_index, build_seasonal_communication_index, build_seasonal_campaign_index]
API = SimpleNamespace(**{fn.__name__: fn for fn in BUILDERS})


def outputs(tables, stems, summaries, idols, speakers, api=API):
    result = {}
    for fn in BUILDERS:
        args = [tables, stems, summaries]
        if fn in (build_idol_episode_index, build_mobile_archive_index, build_seasonal_campaign_index):
            args.append(idols)
        if fn is build_seasonal_campaign_index:
            args.append(speakers)
        result[fn.__name__] = getattr(api, fn.__name__)(*args)
    return result


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus_outputs(data, api=API):
    # Deterministic supplied resource evidence, not claims about mounted availability.
    records = list(iter_top_records(data))
    tables = extract_table_rows(records, {2, 24, 29, 100, 176, 7, 8, 9, 68, 94, 96, 98,
        32, 34, 36, 43, 44, 63, 180, 103, 104, 105, 106, 90, 112,
        147, 148, 149, 150, 153, 159, 162, 165, 168})
    idols = build_idol_unit_dictionary(tables)
    speakers = build_speaker_dictionary(tables, idols)
    strings = set()

    def collect(value):
        if isinstance(value, str):
            strings.add(value)
        elif isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)

    collect(tables)
    stems = {resources.normalize_compiled_resource(value) for value in strings if '_' in value}
    summaries = {stem: {'evidence': 'synthetic', 'resource': stem} for stem in stems}
    return {label: outputs(tables, supplied, summaries, idols, speakers, api)
            for label, supplied in [('missing', set()), ('supplied', stems)]}


def verify():
    for fn in BUILDERS:
        assert getattr(legacy, fn.__name__) is fn
    for name in ('normalize_compiled_resource', 'compiled_exists', 'compiled_filename',
                 'enrich_resource_row', 'normalize_release_condition', 'normalize_term'):
        assert getattr(legacy, name) is getattr(resources, name)
    for resource in ('1_1_001_01_a', '1_2_001_01_b', '1_4_001_01_a', '1_3_10001_01_a', '5_01_001_01_a'):
        assert resources.normalize_compiled_resource(resource) == resource[:-2]
    assert resources.normalize_compiled_resource('9_1_001_01_a') == '9_1_001_01_a'
    candidates = {'z_1_1_001_01_a', 'a_1_1_001_01_b'}
    assert resources.compiled_filename('1_1_001_01_a', candidates) == 'a_1_1_001_01_b.json'
    assert resources.compiled_filename('1_1_001_01_a', candidates | {'1_1_001_01'}) == '1_1_001_01.json'
    assert not resources.compiled_exists('missing', candidates)
    assert resources.normalize_release_condition({'1': 999, '2': 0}) == {
        'type': 999, 'kind': 'unknown', 'param_a': 0, 'param_b': None, 'raw': {'1': 999, '2': 0}}
    assert resources.normalize_release_condition(0) is None
    assert resources.normalize_term({'1': 0, '2': 4102412400}) == {'start_at': 0, 'end_at': 4102412400}
    tables = {
        7: [{'1': 1, '2': 1}], 8: [{'1': 10, '2': 1}],
        9: [{'1': 101, '2': 10, '6': '1_1_001_01_a', '7': 2, '8': 5, '_offset': 91},
            {'1': 102, '2': 10, '6': 'missing', '7': 1}],
        68: [{'1': 1, '2': 5, '3': {'1': 2, '2': 100, '3': 0}}],
        94: [{'1': 1, '2': 1}], 96: [{'1': 2, '2': 1}],
        32: [{'1': 1, '3': 'talk', '8': 1, '9': '1_1_001_01', '10': '1_1_001_01_a'}],
        34: [{'1': 2, '8': 2, '9': 'missing'}],
        43: [{'1': 3, '5': 1, '4': 'missing'}],
        63: [{'1': 11, '2': 1, '3': 1, '4': 1, '7': 9},
             {'1': 12, '3': 2, '4': 2}, {'1': 13, '3': 101, '4': 3},
             {'1': 14, '3': 999, '4': 1}, {'1': 15, '3': 1, '4': 999}],
        180: [{'1': 1, '2': 9, '3': {'1': 1602, '2': 1}}],
        103: [{'1': 1, '3': 1}],
        104: [{'1': 1, '2': 1, '3': 'missing', '4': '1_1_001_01_a', '9': 0}],
        90: [{'1': 1, '2': 1, '3': {'1': 'base', '2': '1_1_001_01_a'}}, {'1': 2, '3': 0}],
        159: [{'1': 1, '2': 1, '3': 1, '4': 1, '5': '1_1_001_01_a'},
              {'1': 2, '2': 1, '4': 0, '5': 'intro'}],
        162: [{'1': 3, '2': 1, '3': 102, '5': 'missing'}],
        165: [{'1': 4, '2': 1, '3': 1, '5': 'missing', '8': {'reward': 1}}],
        147: [{'2': 1, '3': 1, '4': 50}], 149: [{'2': 50}], 153: [{'1': 1, '2': 1}],
    }
    idols = {'by_numeric_id': {'1': {'idol_code': '001tom', 'display_name': 'Idol'}},
             'by_unit_id': {'1': {'unit_code': 'unit'}}}
    speakers = {'speakers': {'102sha': {'speaker_id': '102sha', 'npc_id': 901, 'display_name': 'President'}}}
    stems = {'1_1_001_01'}
    summaries = {'1_1_001_01': {'steps': 2}}
    inputs = [tables, stems, summaries, idols, speakers]
    before = copy.deepcopy(inputs)
    with patch('builtins.open', side_effect=AssertionError('domain accessed filesystem')):
        result = outputs(*inputs)
    assert inputs == before
    episodes = result['build_idol_episode_index']['chapters'][0]['sections'][0]['episodes']
    assert [item['id'] for item in episodes] == [102, 101]
    assert episodes[1]['products'][0]['amount'] == 0
    assert episodes[1]['_source']['offset'] == 91
    mobile = result['build_mobile_archive_index']
    assert mobile['by_kind'] == {'idol_talk': [11], 'unit_talk': [12], 'idol_phone': [13]}
    assert mobile['scenarios'][0]['release_condition']['kind'] == 'card_acquired'
    assert 'actual unlock state' in mobile['meta']['user_state_note']
    assert mobile['random_talk']['topics'][0]['intro_weights'] == [0] + [None] * 15
    profile = result['build_short_adv_profile_index']['entries']
    assert profile[0]['compiled_summary'] == {'steps': 2}
    assert 'compiled_exists' not in profile[1]  # Absent resource is not a negative availability claim.
    campaign = result['build_seasonal_campaign_index']['by_id']['valentine_2022']
    assert len(campaign['introduction']) == 1
    assert campaign['participants'][1]['participant_code'] == '102sha'
    assert campaign['participants'][0]['level_group_id'] == 50
    assert result['build_seasonal_campaign_index']['by_id']['white_day_2022']['participants'][0]['episodes'][0]['reward'] == {'reward': 1}
    assert result['build_home_interaction_index']['interactions'][0]['compiled_summary'] == {'steps': 2}
    assert result['build_seasonal_communication_index']['communications'][2]['participant_type'] == 'support'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        result = corpus_outputs(data)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(),
                  'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/interactions-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({key: value['meta'] for key, value in result['supplied'].items()}))
    print('Masterdata interactions: resource precedence, conditions, identities, joins, missing evidence and input isolation passed')


if __name__ == '__main__':
    main()
