"""Event rewards and derived gasha evidence boundaries."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import masterdata_extract as legacy
from sidem_masterdata.events import extract_event_tables, build_event_index
from sidem_masterdata.gasha import extract_gasha_announcements, build_gasha_index
from sidem_masterdata import iter_top_records


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data, cards, curated, api=legacy):
    records = list(iter_top_records(data))
    stories = legacy.extract_scenario_titles(records)
    announcements = api.extract_gasha_announcements(records)
    return {'announcements': announcements,
            'events': api.build_event_index(records, stories, cards),
            'gasha': api.build_gasha_index(announcements, cards, curated)}


def verify():
    assert legacy.extract_gasha_announcements is extract_gasha_announcements
    assert legacy.build_gasha_index is build_gasha_index
    records = [(112, 42, 0, 0, b'\x08\x01'), (999, 0, 0, 0, b'bad'), (112, 0, 0, 0, 'ignored')]
    assert extract_event_tables(records) == {112: [{'1': 1, '_offset': 42}]}
    cards = {'cards': [{'card_id': 1, 'resource_id': 'card', 'character_id': 'idol', 'rarity': 'SSR',
                        'title': 'Title', 'limitbreak_item_id': 5, 'release_at': 100}]}
    tables = {112: [{'1': 100, '3': 1, '4': 10, '5': {'1': 0, '2': 20}}, {'1': 200, '3': 3, '4': 20}],
              113: [{'1': 10, '4': 30}], 124: [{'1': 20, '6': 40}],
              114: [{'2': 30, '3': 0, '5': {'1': 7, '2': 1, '3': 1}, '_offset': 114},
                    {'2': 30, '5': {'1': 7, '2': 999}}, {'2': 30, '5': {'1': 1, '2': 1}}],
              126: [{'2': 40, '5': {'1': 30, '2': 1, '3': 5}, '_offset': 126}],
              10: [{'1': 1, '2': 100}], 70: [{'2': 50, '3': {'1': 7, '2': 1}}, {'2': 60, '3': {'1': 30, '2': 1}}]}
    stories = {'event_groups': [{'1': 2, '2': 1}], 'event_episodes': [{'1': 3, '2': 2, '7': 50, '9': 60}]}
    before = copy.deepcopy([tables, stories, cards])
    events = build_event_index(tables, stories, cards)['by_code']
    assert [tables, stories, cards] == before
    assert events['100']['point_reward_cards'][0]['required_points'] == 0
    assert len(events['100']['point_reward_cards']) == 1
    assert events['200']['point_reward_cards'][0]['reward_kind'] == 'card_fragment'
    assert events['200']['point_reward_cards'][0]['_source']['table'] == 126
    assert [row['availability'] for row in events['100']['story_reward_cards']] == ['archive', 'in_event_term']
    assert events['100']['reward_card_ids'] == ['card']
    assert build_event_index({}, {}, {})['meta']['event_count'] == 0
    announcements = {'announcements': [{'announcement_id': 1, 'gasha_code': '1', 'start_at': 100},
                                        {'announcement_id': 2, 'gasha_code': '2', 'start_at': 200},
                                        {'announcement_id': 3, 'gasha_code': '3', 'start_at': 300}]}
    curated = {'entries_by_code': {'1': {'title': 'Title', 'logical_id': 'shared', 'source_ref': 's'},
                                    '2': {'logical_id': 'shared', 'phase': 'secondary'},
                                    '3': {'is_reprint': True, 'reprint_of': '1'}},
               'sources': {'s': {'label': 'Source', 'url': 'source', 'retrieved_at': 'date'}}}
    before = copy.deepcopy([announcements, cards, curated])
    gasha = build_gasha_index(announcements, cards, curated)
    assert [announcements, cards, curated] == before
    assert gasha['relations_by_card']['card']['evidence_level'] == 'derived'
    assert gasha['by_code']['1']['name_source']['source_url'] == 'source'
    assert gasha['by_code']['2']['related_pickup_source'] == 'logical_primary'
    assert gasha['by_code']['3']['related_pickup_source'] == 'reprint'
    assert gasha['by_code']['3']['derived_pickup_cards'] == []
    ambiguous = copy.deepcopy(announcements)
    ambiguous['announcements'].append({'announcement_id': 4, 'gasha_code': '4', 'start_at': 100})
    assert build_gasha_index(ambiguous, cards, curated)['relations_by_card'] == {}
    for changed in ({'release_at': 101}, {'limitbreak_item_id': None}):
        assert build_gasha_index(announcements, {'cards': [{**cards['cards'][0], **changed}]}, {})['relations_by_card'] == {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        cards = json.loads((ROOT / 'public/data/masterdata/card_index.json').read_text(encoding='utf-8'))
        curated = json.loads((ROOT.parent / 'data_pipeline/curated/gasha_titles.json').read_text(encoding='utf-8'))
        result = corpus(data, cards, curated)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(), 'cards_sha256': digest(cards),
                  'curated_sha256': digest(curated), 'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/events-gasha-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({key: value['meta'] for key, value in result.items()}))
    print('Masterdata events/gasha: reward provenance, exact unique matches, derived evidence and indirect relations passed')


if __name__ == '__main__':
    main()
