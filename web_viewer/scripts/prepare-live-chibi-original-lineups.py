#!/usr/bin/env python3
"""Export native fixed-song and selected-Unit member order, without changing read-models."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import load_archive_sources
from sidem_masterdata import extract_table_rows, iter_top_records

ELF_SHA256 = '9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
OUTPUT = ROOT / 'public/data/stage-original-lineups.json'


def compile_lineups(pb: bytes, schema: bytes) -> dict:
    tables = extract_table_rows(list(iter_top_records(pb)), {2, 24, 46})
    idols = {row['1']: row for row in tables[2]}
    units = {row['1']: row for row in tables[24]}
    unit_orders = {}
    for unit_id, unit in sorted(units.items()):
        members = [r for r in idols.values() if r.get('3') == unit_id]
        if not members:
            continue
        if sorted(r.get('37', 0) for r in members) != list(range(1, len(members) + 1)):
            raise ValueError(f'{unit_id}: incomplete/ambiguous IdolUnitSortOrder')
        unit_orders[unit['3']] = [r['10'] for r in sorted(members, key=lambda r: r['37'])]
    grouped = defaultdict(list)
    for row in tables[46]:
        grouped[row['4']].append(row)
    songs = {}
    for code, rows in sorted(grouped.items()):
        selectors = {(r.get('7', {}).get('1'), r.get('7', {}).get('2')) for r in rows}
        orders = {tuple(r.get(str(i), 0) for i in range(30, 35)) for r in rows
                  if any(r.get(str(i), 0) > 0 for i in range(30, 35))}
        if len(selectors) != 1 or len(orders) > 1:
            raise ValueError(f'{code}: conflicting song source rows')
        category, unit_id = next(iter(selectors))
        # Match the existing resource-level catalog's effective (last) SongData
        # identity. Some earlier alternate difficulty rows have no original list.
        effective = rows[-1]
        explicit = [effective.get(str(i), 0) for i in range(30, 35) if effective.get(str(i), 0) > 0]
        if explicit:
            members = [idols[i] for i in explicit]
            basis = 'table46-explicit'
        elif category == 2:
            members = [r for r in idols.values() if r.get('3') == unit_id]
            if not members or sorted(r.get('37', 0) for r in members) != list(range(1, len(members) + 1)):
                raise ValueError(f'{code}: incomplete/ambiguous IdolUnitSortOrder')
            members.sort(key=lambda r: r['37'])
            basis = 'table2-unit-default'
        else:
            continue  # Free formation / special versions have no fixed original roster.
        codes = [r['10'] for r in members]
        if len(set(codes)) != len(codes) or not 1 <= len(codes) <= 5:
            raise ValueError(f'{code}: invalid original roster')
        songs[code] = {'songId': effective['1'], 'basis': basis, 'codes': codes,
                       'unitCode': units[unit_id]['3'] if category == 2 else None}
    return {'schemaVersion': 2, 'contract': 'native-original-lineups-v2',
            'source': {'masterdataSha256': hashlib.sha256(pb).hexdigest(),
                       'schemaSha256': hashlib.sha256(schema).hexdigest(),
                       'nativeElfSha256': ELF_SHA256,
                       'unitOrderField': 'Growing.Models.Data.IdolData:37',
                       'explicitOrderFields': [30, 31, 32, 33, 34]},
            'songs': songs, 'unitOrders': unit_orders}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--native-elf', type=Path)
    args = parser.parse_args()
    if args.native_elf and hashlib.sha256(args.native_elf.read_bytes()).hexdigest() != ELF_SHA256:
        raise ValueError('Native ELF differs from the audited original-member implementation')
    sources = load_archive_sources()
    schema = (ROOT.parent / 'data_pipeline/schema/il2cpp_protobuf_schema.json').read_bytes()
    model = json.loads(schema)['models_by_full_name']
    assert next(f for f in model['Growing.Models.Data.IdolData']['fields'] if f['number'] == 37)['name'] == 'IdolUnitSortOrder'
    for i in range(30, 35):
        assert next(f for f in model['Growing.Models.Data.SongData']['fields'] if f['number'] == i)['name'] == f'SongOriginalMemberIdolId{i - 29}'
    data = compile_lineups(sources.masterdata_decoded_file.read_bytes(), schema)
    if args.check:
        assert json.loads(OUTPUT.read_text(encoding='utf-8')) == data, 'Original lineup export differs from mounted source'
    else:
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    counts = {basis: sum(r['basis'] == basis for r in data['songs'].values())
              for basis in ['table46-explicit', 'table2-unit-default']}
    print(f'Native original lineups {"verified" if args.check else "exported"}: {counts}; {len(data["unitOrders"])} selected-Unit orders')


if __name__ == '__main__':
    main()
