"""Read-only audit of card identity versus Carnival reward ownership.

Wire-number matches are candidates, not semantic joins. No public data changes.
"""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata.wire import iter_top_records
from sidem_masterdata.named_wire import fields
from sidem_masterdata.named_schema import FULL_SCHEMA, EXPECTED_PB_SHA, verified_schema

NUMBERS = {1301007, 1325006, 1237003, 20013, 41625, 41626}
RESOURCES = {b'001tom_sr07', b'025suz_sr06', b'037jir_r03'}


def candidates(payload, path=(), depth=0):
    try:
        values = fields(payload)
    except ValueError:
        return []
    result = []
    for field in values:
        key = path + (field.number,)
        if field.wire_type == 0 and field.value in NUMBERS:
            result.append({'path': list(key), 'value': field.value})
        elif field.wire_type == 2:
            if field.value in RESOURCES:
                result.append({'path': list(key), 'value': field.value.decode('ascii')})
            elif depth < 5:
                result.extend(candidates(field.value, key, depth + 1))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pb', type=Path, default=ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb')
    parser.add_argument('--output', type=Path, default=ROOT / '.analysis/event-resource-20261002/carnival-pb-reference-audit.json')
    args = parser.parse_args()
    verified_schema()
    data = args.pb.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED_PB_SHA:
        raise ValueError('PB source changed; review before reusing this audit')
    schema_bytes = FULL_SCHEMA.read_bytes()
    models = json.loads(schema_bytes)['models_by_full_name']
    registry = {f['number']: f['name'] for f in models['Growing.Models.Data.Masterdata']['fields']}
    names = {1: 'CardData', 16: 'ItemData', 91: 'CardSystemScenarioData',
             112: 'EventData', 118: 'EventCollectionData', 180: 'MobileReleaseConditionData'}
    records = list(iter_top_records(data))
    hits = []
    for table, offset, _start, _end, payload in records:
        if not isinstance(payload, bytes):
            continue
        matches = candidates(payload)
        if not matches:
            continue
        model = models.get('Growing.Models.Data.' + names.get(table, ''))
        field_names = {f['number']: f['name'] for f in model['fields']} if model else {}
        for match in matches:
            match['topField'] = field_names.get(match['path'][0])
        ident = next((f.value for f in fields(payload) if f.number == 1 and f.wire_type == 0), None)
        hits.append({'table': table, 'tableName': registry.get(table), 'rowId': ident,
                     'offset': offset, 'matches': matches})
    report = {
        'pbSha256': digest, 'fullSchemaSha256': hashlib.sha256(schema_bytes).hexdigest(),
        'recordCount': len(records), 'tableCount': len(Counter(r[0] for r in records)),
        'masterdataExchangeFields': [name for name in registry.values() if 'Exchange' in name],
        'exchangeResponseModel': 'Growing.Services.ShopEventExchangeListReply',
        'exchangeRowFields': [{'number': f['number'], 'name': f['name']}
                              for f in models['Growing.Models.Data.EventExchangeData']['fields']],
        'hits': hits,
        'conclusion': 'PB has card identities and event currencies; no direct exchange reward edge found in this pinned Masterdata.',
        'limits': ['Numeric/nested-wire matches are candidate references, not typed reward ownership.',
                   'Nested candidate scan limited to depth 5; schema registry separately confirms no EventExchanges master table.',
                   'Does not prove absence from other PBs, server responses, or unexamined archives.'],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{len(records)} PB records / {report['tableCount']} tables / {len(hits)} candidate rows; no Masterdata exchange table")


if __name__ == '__main__':
    main()
