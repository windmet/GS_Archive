"""Build home/photo costume categories from native tables 2/24/27/28 (check-only by default)."""
import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import load_archive_sources
from sidem_masterdata.wire import iter_top_records, parse_message

PB_SHA = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'
OUTPUT = ROOT / 'src/data/costumeCategories.json'


def build():
    payload = load_archive_sources(None).masterdata_decoded_file.read_bytes()
    assert hashlib.sha256(payload).hexdigest() == PB_SHA, 'Unreviewed native source'
    tables = defaultdict(list)
    for field, _, _, _, value in iter_top_records(payload):
        if field in (2, 24, 27, 28):
            tables[field].append(parse_message(value))
    idols = {r['1']: r for r in tables[2]}
    unit_members = defaultdict(set)
    for idol in idols.values():
        unit_members[idol['3']].add(idol['1'])
    by_name = defaultdict(list)
    for row in tables[27]:
        by_name[row['3']].append(row)
    families = defaultdict(list)
    for row in tables[27]:
        name = row['3']
        normal = [r for r in by_name.get(name[:-1], []) if r['2'] == row['2']]
        related = (row.get('8') and name.endswith('+') and len(normal) == 1
                   and all(row.get(str(f), 0) == normal[0].get(str(f), 0) for f in (9, 10)))
        families[name[:-1] if related else name].append(row)
    groups = {key: [] for key in ('all', 'unit', 'attribute', 'cross', 'personal', 'story')}
    for name, rows in families.items():
        normal = [r for r in rows if r['3'] == name and not r.get('8')]
        owners = {r['2'] for r in normal or rows}
        attributes = {idols[i]['7'] for i in owners}
        scope = ('all' if owners == set(idols) else 'unit' if owners in unit_members.values()
                 else 'attribute' if len(owners) > 1 and len(attributes) == 1
                 else 'cross' if len(owners) > 1 else 'personal')
        groups[scope].extend(r['5'] for r in rows)
    live = {r['5'] for r in tables[27]}
    story = {r['5'] for r in tables[28]}
    groups['story'] = sorted(story - live)
    for values in groups.values():
        values.sort()
    all_models = [model for values in groups.values() for model in values]
    assert len(live) == 549 and len(all_models) == len(set(all_models)) == 690
    dictionary = json.loads((ROOT / 'public/data/masterdata/costume_dictionary.json').read_text(encoding='utf-8'))
    assert set(all_models) == set(dictionary['by_model_resource_id']), 'Dictionary/native coverage mismatch'
    return {'schemaVersion': 1, 'source': {'decodedPbSha256': PB_SHA, 'tables': [2, 24, 27, 28],
            'classification': 'derived-from-native-membership-v1'}, 'groups': groups}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    text = json.dumps(build(), ensure_ascii=False, separators=(',', ':')) + '\n'
    if args.write:
        OUTPUT.write_text(text, encoding='utf-8', newline='\n')
    else:
        assert OUTPUT.read_text(encoding='utf-8') == text, 'Costume category index needs regeneration'
    print('Costume categories: 690 native models; 549 Live +141 story-only')
