"""Rebuild stage-only costume families from native tables 2/24/27; default is check-only."""
import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata.wire import iter_top_records, parse_message
from archive_paths import load_archive_sources

PB_SHA = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'
OUTPUT = ROOT / 'src/data/stageCostumeFamilies.json'


def build():
    config = load_archive_sources(None)
    payload = config.masterdata_decoded_file.read_bytes()
    assert hashlib.sha256(payload).hexdigest() == PB_SHA, 'Unreviewed native source'
    tables = defaultdict(list)
    for field, _, _, _, value in iter_top_records(payload):
        if field in (2, 24, 27):
            tables[field].append(parse_message(value))
    units = {row['1']: row for row in tables[24]}
    idols = {row['1']: {'id': row['10'], 'unitCode': units[row['3']]['3'],
                          'attribute': row['7']} for row in tables[2]}
    unit_members = defaultdict(set)
    for row in idols.values():
        unit_members[row['unitCode']].add(row['id'])
    live = tables[27]
    by_name = defaultdict(list)
    for row in live:
        by_name[row['3']].append(row)
    families = defaultdict(list)
    for row in live:
        name = row['3']
        # A recolor joins only when the native flag and that idol's unique
        # normal source row agree. No costume-number or translated-name match.
        normal = [r for r in by_name.get(name[:-1], []) if r['2'] == row['2']]
        related = (row.get('8') and name.endswith('+') and len(normal) == 1
                   and all(row.get(str(f), 0) == normal[0].get(str(f), 0) for f in (9, 10)))
        families[name[:-1] if related else name].append(row)
    result = []
    for name, rows in sorted(families.items()):
        normal = [r for r in rows if r['3'] == name and not r.get('8')]
        owners = {idols[r['2']]['id'] for r in normal or rows}
        unit = next((code for code, members in unit_members.items() if owners == members), None)
        attributes = {idols[r['2']]['attribute'] for r in normal or rows}
        scope = ('all' if owners == {i['id'] for i in idols.values()} else 'unit' if unit
                 else 'attribute' if len(owners) > 1 and len(attributes) == 1
                 else 'cross' if len(owners) > 1 else 'personal')
        variants = []
        for source_name in sorted({r['3'] for r in rows}, key=lambda s: (s != name, s)):
            members = {}
            variant_rows = [r for r in rows if r['3'] == source_name]
            for row in variant_rows:
                idol = idols[row['2']]['id']
                assert row['5'].startswith(idol + '_') and idol not in members
                members[idol] = row['5'][len(idol) + 1:]
            variants.append({'sourceName': source_name, 'another': bool(variant_rows[0].get('8')),
                             'members': dict(sorted(members.items())),
                             'songIds': sorted({r.get(str(f), 0) for r in variant_rows for f in (9, 10)} - {0})})
        result.append({'id': hashlib.sha256(name.encode()).hexdigest()[:16], 'name': name,
                       'scope': scope, 'unitCode': unit, 'variants': variants})
    manifest = json.loads((ROOT / 'public/assets/live-chibi/manifest.json').read_text(encoding='utf-8'))
    actual = {c['id'] + '_' + s['id']: s['label'].removesuffix(' · ' + s['id'])
              for c in manifest['characters'] for s in c['costumes']}
    expected = {r['5']: r['3'] for r in live}
    assert actual == expected and len(expected) == 549, 'Native/manifest mismatch'
    return {'schemaVersion': 1, 'source': {'decodedPbSha256': PB_SHA,
            'tables': [2, 24, 27], 'classification': 'derived-from-native-membership-v1'},
            'idols': sorted(idols.values(), key=lambda i: i['id']), 'families': result}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    text = json.dumps(build(), ensure_ascii=False, separators=(',', ':')) + '\n'
    if args.write:
        OUTPUT.write_text(text, encoding='utf-8', newline='\n')
    else:
        assert OUTPUT.read_text(encoding='utf-8') == text, 'Stage costume families need regeneration'
    print('Stage costume families: 549 native Live models; source and manifest agree')
