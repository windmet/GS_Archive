"""Identity dictionary semantics and optional decoded-corpus output baseline."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from sidem_masterdata import extract_table_rows, iter_top_records
from sidem_masterdata import identities
import masterdata_extract as legacy

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def outputs(tables, api=identities):
    idols = api.build_idol_unit_dictionary(tables)
    return {'idols': idols, 'speakers': api.build_speaker_dictionary(tables, idols),
            'costumes_unknown': api.build_costume_dictionary(tables, idols, set(), {}),
            'costumes_indexed': api.build_costume_dictionary(tables, idols, {'001tom_001_00'}, {'001tom_001_00': {}}),
            'faces': api.build_face_dictionary(tables)}

def verify():
    for name in ['build_idol_unit_dictionary', 'build_speaker_dictionary', 'build_costume_dictionary', 'build_face_dictionary']:
        assert getattr(legacy, name) is getattr(identities, name)
    tables = {
        2: [{'1': 1, '10': '001tom', '12': 'source-name', '32': 1, '_offset': 12}, {'1': 'invalid'}],
        24: [{'1': 1, '2': 'unit', '3': '01jup', '_offset': 24}],
        29: [{'1': 3, '2': 'group label', '_offset': 29}],
        100: [{'1': 7, '2': 'npc fallback', '_offset': 100}, {'1': 8, '2': 'npc', '4': 'named-npc'}],
        28: [{'1': 10, '5': '001tom_001_00', '3': 'older', '_offset': 28}],
        27: [{'1': 11, '5': '001tom_001_00', '3': 'newer', '_offset': 27}, {'5': '999xxx_001_00'}],
        176: [{'3': 'face_default', '4': 'face_evolution', '_offset': 176}],
    }
    original = copy.deepcopy(tables)
    result = outputs(tables)
    assert tables == original
    idol = result['idols']['by_idol_code']['001tom']
    assert idol['unit_id'] is None and idol['unit_relation_candidate_f32'] == 1
    assert idol['_source']['offset'] == 12
    assert {'001tom', 'group:3', 'npc:7', 'named-npc'} == set(result['speakers']['speakers'])
    unknown = result['costumes_unknown']['by_model_resource_id']['001tom_001_00']
    assert unknown['costume_name'] == 'newer'
    assert unknown['source_tables'] == [27, 28]
    assert [entry['offset'] for entry in unknown['_sources']] == [28, 27]
    assert unknown['_source'] == unknown['_sources'][-1]
    assert unknown['spine_exists'] is None and unknown['prefab_meta_exists'] is None
    indexed = result['costumes_indexed']['by_model_resource_id']
    assert indexed['001tom_001_00']['spine_exists'] is True
    assert indexed['999xxx_001_00']['spine_exists'] is False
    assert indexed['999xxx_001_00']['idol_name'] is None
    assert result['faces']['faces']['face_default']['_source']['table'] == 176
    assert outputs({})['idols']['meta'] == {'idol_count': 0, 'unit_count': 0}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        data = args.decoded_masterdata.read_bytes()
        tables = extract_table_rows(list(iter_top_records(data)), {2, 24, 27, 28, 29, 100, 176})
        result = outputs(tables)
        actual = {'input_sha256': hashlib.sha256(data).hexdigest(), 'hashes': {key: digest(value) for key, value in result.items()}}
        expected = json.loads((ROOT/'fixtures/masterdata-wire/identity-baseline.json').read_text())
        assert actual == expected['summary']
        print(json.dumps({key: value['meta'] for key, value in result.items()}))
    print('Masterdata identities: field provenance, unconfirmed membership, NPC fallback, costume precedence and unknown resource availability passed')

if __name__ == '__main__':
    main()
