"""Card domain composition and non-consuming summary/detail split."""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import masterdata_extract as legacy
from sidem_masterdata.cards import build_card_index, canonical_cards
from sidem_masterdata.card_details import split_card_index
from sidem_masterdata.card_voices import classify_card_operational_voices
from sidem_masterdata import iter_top_records, extract_table_rows


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def corpus(data, api=legacy, split=split_card_index):
    records = list(iter_top_records(data))
    cards = legacy.extract_card_parameters(records)
    cues = legacy.extract_card_voice_cues(records)
    stories = legacy.extract_scenario_titles(records)
    tables = extract_table_rows(records, {2, 16, 20, 21, 23, 27, 28, 32, 40, 75, 130})
    # Controlled evidence exercises audio classification and compiled lookup without media IO.
    bases = {cue['scenario_base'][:-3] for cue in cues
             if isinstance(cue.get('scenario_base'), str) and cue['scenario_base'].endswith('_00')}
    voices = {base + suffix for base in bases for suffix in ('_02_00', '_03_01', '_unknown')}
    stems = {cue['scenario_base'] for cue in cues if isinstance(cue.get('scenario_base'), str)}
    stems.update(row['4'] for row in stories['card_scenarios'] if isinstance(row.get('4'), str))
    summaries = {stem: {'title': 'fixture', 'step_count': 2} for stem in stems}
    args = [cards, cues, {}, stories, tables, voices, stems, summaries, {}]
    before = copy.deepcopy(args)
    full = api.build_card_index(*args)
    assert args == before
    saved = copy.deepcopy(full)
    summary, details = split(full)
    assert full == saved
    return {'full': full, 'summary': summary, 'details': details,
            'canonical': api.canonical_cards(summary['cards'])}


def verify():
    assert legacy.build_card_index is build_card_index
    assert legacy.canonical_cards is canonical_cards
    assert legacy.classify_card_operational_voices is classify_card_operational_voices
    full = {'cards': [{'resource_id': 'card', 'gameplay': {
        'attribute': {'name': 'Physical'}, 'skill': {'id': 1, 'name': 'Skill'},
        'center_skill': {'id': 2, 'name': 'Center'}},
        'limitbreak_item': {'id': 3}, 'costume_relations': [
            {'costume_id': 7, 'slot': 'live', '_source': {'table': 27}, '_card_source': {'fields': {'costume_id': 45}}},
            {'costume_id': 7, 'slot': 'story', '_source': {'table': 28}}],
        'operational_voice_cues': [{'cue': 'voice', 'text': 'line'}]},
        {'resource_id': None, 'gameplay': {'untouched': True}}], 'meta': {'card_count': 2}}
    saved = copy.deepcopy(full)
    summary, details = split_card_index(full)
    assert full == saved
    assert split_card_index(full) == (summary, details)  # Reusable input; no lost second-call details.
    old_input = copy.deepcopy(full)
    old_details = legacy.build_card_detail_index(old_input)
    assert (summary, details) == (old_input, old_details)
    assert 'gameplay' not in summary['cards'][0]
    assert summary['cards'][0]['detail_available'] is True
    assert summary['cards'][1] == full['cards'][1]
    assert set(details['costumes_by_key']) == {'live:7', 'story:7'}
    assert details['cards_by_resource_id']['card']['gameplay']['skill_id'] == 1
    details['skills_by_id']['1']['name'] = 'changed'
    details['cards_by_resource_id']['card']['operational_voice_cues'][0]['text'] = 'changed'
    summary['meta']['card_count'] = 99
    assert full == saved
    tutorial = {'resource_id': 'same', 'card_id': 90000001, 'title': 'チュートリアル'}
    normal = {'resource_id': 'same', 'card_id': 1, 'title': 'Normal'}
    assert canonical_cards([tutorial, normal]) == [normal]
    assert canonical_cards([normal, {**normal, 'title': 'tie'}]) == [normal]
    curated = {'card': {'source_url': 'source', 'verified_at': 'date', 'mapping_basis': 'manual',
                        'voices': {'base_02_00': {'text': 'curated'}, 'base_03_01': {'text': 'unit'}}}}
    rows = classify_card_operational_voices({'36': '0', '_offset': 9}, 'card', 'base',
                                            {'base_02_00', 'base_03_01', 'base_04_01'}, curated)
    assert [(row['text'], row['text_source']) for row in rows] == [('0', 'masterdata'), ('unit', 'curated'), ('', 'audio_only')]
    assert rows[0]['_source']['offset'] == 9 and rows[1]['source_url'] == 'source'
    assert classify_card_operational_voices({}, 'card', None, set(), curated) == []
    # The actual writer must bind both returned outputs, never rely on compatibility mutation.
    tree = ast.parse((ROOT.parent / 'data_pipeline/masterdata_extract.py').read_text(encoding='utf-8'))
    main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
    calls = [node for node in ast.walk(main) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)]
    assert not any(node.func.id == 'build_card_detail_index' for node in calls)
    assert any(isinstance(node, ast.Assign) and isinstance(node.value, ast.Call)
               and isinstance(node.value.func, ast.Name) and node.value.func.id == 'split_card_index'
               and ast.unparse(node.targets[0]) == '(card_index, card_detail_index)' for node in ast.walk(main))


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
        expected = json.loads((ROOT / 'fixtures/masterdata-wire/cards-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({'index': result['summary']['meta'], 'details': result['details']['meta']}))
    print('Masterdata cards: explicit split, repeatability, input ownership, canonical selection, voice provenance and writer migration passed')


if __name__ == '__main__':
    main()
