"""Story wire identities, birthday relations and master index projection."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import masterdata_extract as legacy
from sidem_masterdata import iter_top_records
from sidem_masterdata.story_tables import extract_scenario_titles
from sidem_masterdata.birthday import build_birthday_semantic_catalog
from sidem_masterdata.story_index import build_story_master_index


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data, api=legacy):
    tables = api.extract_scenario_titles(list(iter_top_records(data)))
    # A fixed supplied set exercises exact, prefixed, and absent resource matching.
    stems = {'1_1_001_01', 'prefix_1_2_001_01_a', '5_01_001_01'}
    summaries = {stem: {'title': 'fixture', 'step_count': 2} for stem in stems}
    return {'tables': tables, 'birthday': api.build_birthday_semantic_catalog(tables),
            'index_missing': api.build_story_master_index(tables, set(), {}),
            'index_supplied': api.build_story_master_index(tables, stems, summaries)}


def verify():
    for fn in (extract_scenario_titles, build_birthday_semantic_catalog, build_story_master_index):
        assert getattr(legacy, fn.__name__) is fn
    # Field 2 contains printable '-' (45), but its authoritative identity is integer 45.
    payload = b'\x08\x01\x12\x01-'
    tables = extract_scenario_titles([(80, 100, 102, 108, payload), (999, 0, 0, 0, b'bad'), (80, 0, 0, 0, 'ignored')])
    assert tables['birthday_characters'] == [{'1': 1, '2': 45, '_top_field': 80, '_offset': 100}]
    tables.update({
        'birthday_chapters': [{'1': 1, '2': 2, '3': 'Producer birthday', '7': 1}],
        'birthday_sections': [{'1': 10, '2': 1, '3': 'Section'}],
        'birthday_episodes': [{'1': 1, '2': 10, '4': 0, '5': '5_01_001_01_a', '_offset': 200},
                              {'1': 2, '2': 99}, {'1': 3, '2': 10}],
        'birthday_characters': tables['birthday_characters'] + [{'1': 3, '2': 'unknown'}],
        'birthday_announcements': [
            {'1': 50, '3': 'Name', '4': '3月7日', '8': '102d'},
            {'1': 1, '2': 45, '4': 'no date', '8': 'not hex'},
            {'1': 2, '8': 'not hex'}, {'1': 3, '8': '1080'},
            {'1': 4, '2': 46, '8': '102d'}],
        'main_episodes': [{'1': 1, '6': '1_1_001_01_a', '_top_field': 6, '_offset': 10}],
        'event_episodes': [{'1': 2, '5': 'missing', '_top_field': 12}],
        'card_scenarios': [{'1': 3, '4': '1_1_001_01_a', '_top_field': 43}],
        'unit_episodes': [{'1': 4, '6': 0, '_top_field': 15}],
    })
    before = copy.deepcopy(tables)
    birthday = build_birthday_semantic_catalog(tables)
    semantics = birthday['by_episode_id']['1']
    assert semantics['target'] == 'producer' and semantics['subject_numeric_id'] == 45
    assert semantics['announcement_ids'] == [50, 1]
    assert semantics['scheduled_at'] == 0 and semantics['sources']['character']['offset'] == 100
    assert birthday['announcements'][0]['edition'] == 2
    assert (birthday['announcements'][0]['month'], birthday['announcements'][0]['day']) == (3, 7)
    assert birthday['announcements'][1]['month'] is None
    assert birthday['announcements'][2]['subject_numeric_id'] is None
    assert birthday['announcements'][3]['subject_numeric_id'] is None
    assert birthday['announcements'][4]['subject_numeric_id'] == 46
    assert birthday['meta']['missing_section_ids'] == [2]
    assert birthday['meta']['missing_chapter_ids'] == [2]
    assert birthday['meta']['missing_character_ids'] == [2]
    assert birthday['meta']['unassigned_episode_ids'] == [3]
    index = build_story_master_index(tables, {'1_1_001_01'}, {'1_1_001_01': {'title': 'Title'}})
    assert index['main']['episodes'][0]['compiled_file'] == '1_1_001_01.json'
    assert index['main']['episodes'][0]['compiled_summary'] == {'title': 'Title'}
    assert index['card_scenarios'][0]['_source']['fields']['resource_id'] == 4
    assert index['event']['episodes'][0]['compiled_exists'] is False
    assert 'compiled_exists' not in index['unit_story']['episodes'][0]
    assert tables == before


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        result = corpus(data)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(),
                  'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/story-domains-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({'table_rows': {key: len(value) for key, value in result['tables'].items()},
                          'birthday': result['birthday']['meta']}))
    print('Masterdata story domains: raw subject identity, announcement fallback, missing relations, resource provenance and compatibility passed')


if __name__ == '__main__':
    main()
