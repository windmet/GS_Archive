"""Card gameplay provenance and optional full decoded corpus comparison."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import masterdata_extract as legacy
from sidem_masterdata import card_gameplay as domain
from sidem_masterdata import extract_table_rows, iter_top_records


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data, api=domain):
    tables = extract_table_rows(list(iter_top_records(data)), {1, 2, 16, 20, 21, 23, 27, 28, 74, 75, 130})
    references = api.build_card_reference_maps(tables)
    return [{'card_id': card.get('1'), 'gameplay': api.build_card_gameplay(card, references),
             'costumes': api.build_card_costume_relations(card, references)} for card in tables[1]]


def verify():
    for name in ('IDOL_TYPE_NAMES', 'build_card_parameter', 'render_skill_description',
                 'build_card_reference_maps', 'build_card_gameplay', 'build_card_costume_relations'):
        assert getattr(legacy, name) is getattr(domain, name)
    assert domain.build_card_parameter(None) is None
    assert domain.build_card_parameter({'1': '100'}) is None
    assert domain.build_card_parameter({'1': 0, '2': 'unknown'}) == {
        'initial': 0, 'max_unlimit': 0, 'max_limitbreak': 0,
        'awakening_step': 0, 'limitbreak_step': 0, 'idol_limitbreak_step': 0}
    card = {'1': 1, '2': 1, '5': 10, '6': 20, '9': {'1': 100, '2': 10, '3': 5, '4': 99},
            '10': {'1': 50}, '11': None, '45': 7, '48': 7, '49': 99, '50': 'invalid', '_offset': 100}
    tables = {
        2: [{'1': 1, '7': 2, '_offset': 200}],
        20: [{'1': 10, '2': 'Skill', '3': '<interval>/<calc_rate>/<period>/<d01>/<d10>/<unknown>', '5': 99, '8': 3}],
        21: [{'1': 2, '2': 99, '3': 2, '8': 4, '10': 0, '11': 9, '12': 6, '_offset': 21},
             {'1': 1, '2': 99, '3': 1, '8': 4}, {'1': 3, '2': 10, '3': 99}, {'1': 4, '2': 'invalid'}],
        40: [{'1': 2, '2': 4, '4': 20, '9': 2}, {'1': 1, '2': 4, '4': 10, '9': 1}],
        74: [{'1': 2, '2': 4, '3': 4, '4': 900, '5': 12, '8': 2},
             {'1': 1, '2': 4, '3': 3, '4': 800, '5': 6, '6': 30, '8': 1, '_offset': 74}],
        75: [{'1': 3, '2': 'Category'}],
        23: [{'1': 20, '2': 'Center', '9': 5}], 130: [{'1': 5, '2': 'Center category'}],
        27: [{'1': 7, '5': 'live-model', '_offset': 27}],
        28: [{'1': 7, '5': 'story-model', '_offset': 28}],
    }
    original = copy.deepcopy([card, tables])
    references = domain.build_card_reference_maps(tables)
    saved_references = copy.deepcopy(references)
    result = domain.build_card_gameplay(card, references)
    costumes = domain.build_card_costume_relations(card, references)
    assert [card, tables] == original and references == saved_references
    assert result['attribute']['name'] == 'Intelligence'
    assert result['appeal'] == {'initial': 150, 'max_unlimit': 160, 'max_limitbreak': 180}
    assert result['parameters']['visual']['idol_limitbreak_step'] == 99
    levels = result['skill']['levels']
    assert [level['level'] for level in levels] == [1, 2]
    assert levels[1]['description'] == '9/0/6/30/12/<unknown>'
    assert levels[0]['description'] == '<interval>/<calc_rate>/<period>/30/12/<unknown>'
    assert [effect['id'] for effect in levels[0]['effects']] == [1, 2]
    assert levels[1]['_source']['offset'] == 21
    assert result['skill']['detail_group_id'] == 99
    assert levels[0]['effects'][0]['effect_group_id'] == 800
    assert levels[0]['effects'][0]['_source']['table'] == 74
    assert 'value' not in levels[0]['effects'][0]
    assert levels[0]['description_status'] == 'unresolved-template'
    assert domain.render_skill_description('<d01>/<d00>/<d99>', {}, []) == '<d01>/<d00>/<d99>'
    assert domain.render_skill_description('<d01>', {}, [{'3': 999, '6': 999}]) == '<d01>'
    assert domain.render_skill_description('<d01>', {}, [{'3': 2}]) == '0'
    assert result['center_skill']['category']['name'] == 'Center category'
    assert [(item['slot'], item['model_resource_id']) for item in costumes] == [
        ('live_initial', 'live-model'), ('story_initial', 'story-model'), ('story_awakened', None)]
    assert [item['_source']['table'] for item in costumes] == [27, 28, 28]
    assert costumes[1]['_card_source']['fields']['costume_id'] == 48
    empty = domain.build_card_gameplay({}, domain.build_card_reference_maps({}))
    assert empty['attribute']['name'] == 'Unknown'
    assert empty['parameters'] == {'visual': None, 'vocal': None, 'dance': None}
    assert empty['skill']['levels'] == []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        result = corpus(data)
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/card-gameplay-baseline.json').read_text())
        # Preserve the historical hash as evidence of the old defect. Verify the
        # corrected real-corpus relations instead of accepting a new snapshot.
        assert hashlib.sha256(data).hexdigest() == expected['summary']['input_sha256']
        assert digest(result) != expected['summary']['output_sha256']
        tables = extract_table_rows(list(iter_top_records(data)), {20, 21, 74})
        skills = {r['1']: r for r in tables[20]}
        for row in result:
            skill = row['gameplay']['skill']
            if skill['id'] in skills:
                assert skill['detail_group_id'] == skills[skill['id']].get('5')
            for level in skill['levels']:
                assert level['_source']['fields']['skill_detail_group_id'] == 2
                assert all(e['_source']['table'] == 74 for e in level['effects'])
        print(json.dumps({'card_rows': len(result), 'corrected_output_sha256': digest(result),
            'historical_baseline_preserved': True,
            'costume_relations': sum(len(row['costumes']) for row in result)}))
    print('Masterdata card gameplay: parameters, ordered effects, unresolved placeholders, costume domains and provenance passed')


if __name__ == '__main__':
    main()
