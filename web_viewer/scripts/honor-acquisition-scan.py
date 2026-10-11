"""Offline honor reverse lookup: schema keywords, PB evidence and honest gaps.

Writes audit candidates only. Does not change public data or readmodel releases.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata.archive_domains import build_all
from sidem_masterdata.domain_common import EVENT_TYPES, clean, index
from sidem_masterdata.named_schema import (
    EXPECTED_PB_SHA, FULL_SCHEMA, TABLE_IDS, project_named_tables, verified_schema,
)
from sidem_masterdata.named_wire import decode, fields
from sidem_masterdata.wire import iter_top_records

KEYWORDS = ('Mission', 'Achievement', 'Reward', 'Product', 'Unlock', 'Honor',
            'Login', 'ReleaseCondition', 'Exchange')
PREFIX = 'Growing.Models.Data.'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def unique_rows(rows, key):
    out = {}
    for row in rows:
        ident = row[key]
        if ident in out:
            raise ValueError(f'Duplicate evidence identity: {ident}')
        out[ident] = row
    return out


def schema_scan(full, compact, counts):
    models = full['models_by_full_name']
    anchors = defaultdict(set)
    for name, spec in compact['models'].items():
        full_fields = {str(f['number']): f for f in models[PREFIX + name]['fields']}
        for number, field in spec['fields'].items():
            anchors[full_fields[number].get('backing_type_index')].add(field['type'])
    entries = []
    for name, model in sorted(models.items()):
        hits = [k for k in KEYWORDS if k.lower() in name.lower()
                or any(k.lower() in f['name'].lower() for f in model['fields'])]
        if not hits:
            continue
        projected = []
        for field in model['fields']:
            number = str(field['number'])
            rule = compact['models'].get(model['type_name'], {}).get('fields', {}).get(number)
            interpretations = sorted(anchors.get(field.get('backing_type_index'), []))
            projected.append({
                'number': field['number'], 'name': field['name'],
                'backingTypeIndex': field.get('backing_type_index'),
                'fieldType': {'clrType': None,
                    'verifiedCompactWireRule': rule['type'] if rule else None,
                    'equivalentBackingIndexWireRules': interpretations,
                    'status': 'CLR-type-unresolved-wire-rules-are-separate-evidence'},
                'references': [{'model': PREFIX + r.split('/', 1)[1],
                    'basis': 'compact-rule' if rule and rule['type'] == r else 'equivalent-backing-type-index'}
                    for r in interpretations if r.startswith(('m/', 'rm/'))],
            })
        entries.append({'fullName': name, 'keywordHits': hits, 'fields': projected})
    root_fields = models[PREFIX + 'Masterdata']['fields']
    roots = [{'number': f['number'], 'name': f['name'], 'rowCount': counts[f['number']],
              'backingTypeIndex': f.get('backing_type_index')}
             for f in root_fields]
    return {'kind': 'gs-honor-acquisition-schema-scan', 'models': entries,
            'masterdataRootTables': roots,
            'keywordModelCounts': {k: sum(k in m['keywordHits'] for m in entries) for k in KEYWORDS},
            'limitations': ['Field constants prove identity, not CLR types or enum meanings.',
                'No root Mission table means no mission definitions in this PB; API schemas alone are not rewards.']}


def product_probe(records, full, compact):
    """Scan declared Product/HonorId fields; never byte-search nested ID coincidences."""
    rules = dict(compact['models'])
    table_models = {int(k): v for k, v in compact['table_models'].items()}
    # Explicit additions, isolated from the production decoder. Names/sets checked
    # against full metadata; Product uses the existing strict ProductData rule.
    for table, model in [('SongRewards', 'SongRewardData'),
                         ('ContinuousLoginBonusProducts', 'ContinuousLoginBonusProductData')]:
        fs = full['models_by_full_name'][PREFIX + model]['fields']
        expected = ['Id', 'GroupId', 'Product'] + (['PresentMessageId'] if table.startswith('Continuous') else [])
        expected_backing = [30746, 30746, 33600] + ([30746] if len(expected) == 4 else [])
        if ([f['name'] for f in fs] != expected
                or [f['number'] for f in fs] != list(range(1, len(fs) + 1))
                or [f.get('backing_type_index') for f in fs] != expected_backing):
            raise ValueError('Probe schema drift: ' + model)
        rules[model] = {'fields': {str(f['number']): {'name': f['name'],
            'type': 'm/ProductData' if f['name'] == 'Product' else 'u'} for f in fs}}
        table_models[TABLE_IDS[table]] = model
    probes, hits = [], []
    for table, model in sorted(table_models.items()):
        product_fields = {int(n): f for n, f in rules[model]['fields'].items()
            if (f['type'] in ('m/ProductData', 'rm/ProductData') or f['name'] == 'HonorId')
            and 'cost' not in f['name'].lower()}
        if not product_fields:
            continue
        selected = [r for r in records if r[0] == table]
        hit_count = 0
        for record in selected:
            raw_fields = fields(record[4])
            ids = [f.value for f in raw_fields if f.number == 1 and f.wire_type == 0]
            if len(ids) != 1:
                raise ValueError(f'Missing/ambiguous row ID in product table {table}')
            for number, spec in product_fields.items():
                matches = [f for f in raw_fields if f.number == number]
                if len(matches) > 1 and spec['type'] != 'rm/ProductData':
                    raise ValueError('Duplicate singular product field')
                for ordinal, f in enumerate(matches):
                    if spec['name'] == 'HonorId':
                        if f.wire_type != 0:
                            raise ValueError('HonorId wire mismatch')
                        product = {'type': 6, 'productId': f.value, 'amount': 1}
                        basis = 'explicit-HonorId-not-encoded-Product'
                    else:
                        if f.wire_type != 2:
                            raise ValueError('Product wire mismatch')
                        product = decode(f.value, 'ProductData', rules)
                        if product.get('_unknownFields'):
                            raise ValueError('Unknown Product field')
                        basis = 'encoded-Product'
                    if product.get('type') != 6:
                        continue
                    if not product.get('productId'):
                        raise ValueError('Honor product without canonical target')
                    hit_count += 1
                    hits.append({'honorId': product['productId'], 'table': table, 'model': model,
                        'rowId': ids[0], 'field': spec['name'][0].lower() + spec['name'][1:],
                        'fieldNumber': number, 'ordinal': ordinal, 'product': clean(product), 'basis': basis,
                        'topOffset': record[1], 'recordSha256': sha(record[4]),
                        'fieldOffsetWithinRecord': f.offset})
        probes.append({'table': table, 'model': model, 'rowsScanned': len(selected),
            'productFieldNumbers': sorted(product_fields), 'honorReferenceCount': hit_count})
    return probes, hits


def acquisition_catalog(outputs, tables, records, product_hits):
    honors = index(outputs['honor_catalog.json']['entries'])
    rewards = unique_rows(outputs['reward_catalog.json']['entries'], 'key')
    raw_rows = {}
    for r in records:
        ids = [f.value for f in fields(r[4]) if f.number == 1 and f.wire_type == 0]
        if len(ids) == 1:
            # Multiple records with the same primary key are never silently joined.
            ident = (r[0], ids[0])
            if ident in raw_rows:
                raise ValueError(f'Duplicate PB primary key {ident}')
            raw_rows[ident] = r
    by_honor, covered = defaultdict(list), set()

    def row_evidence(table, row_id):
        record = raw_rows[(table, row_id)]
        row = next(row for row in tables[table] if row['id'] == row_id)
        return {'table': table, 'rowId': row_id, 'topOffset': record[1],
                'recordSha256': sha(record[4]), 'namedRow': clean(row)}

    for reward in rewards.values():
        product = reward['product']
        if product.get('kind') != 'honor':
            continue
        honor_id = product['productId']
        if honor_id not in honors or product['referenceStatus'] != 'resolved-entity':
            raise ValueError('Missing honor target')
        ident = (reward['sourceTable'], reward['sourceRowId'])
        record = raw_rows[ident]
        scope = reward.get('scope')
        source_type = 'ranking' if scope in ('ranking', 'idol-ranking') else 'event' if 'eventId' in reward else 'unknown'
        condition = {k: v for k, v in reward.items() if k not in
            ('key', 'sourceTable', 'sourceRowId', 'sourceField', 'product')}
        chain = [{'role': 'reward', **row_evidence(*ident)}]
        if 'eventId' in reward:
            event = next(row for row in tables[TABLE_IDS['Events']] if row['id'] == reward['eventId'])
            detail_table = EVENT_TYPES[event['type']][1]
            chain.extend([{'role': 'event', **row_evidence(TABLE_IDS['Events'], event['id'])},
                {'role': 'event-detail', **row_evidence(detail_table, event['eventDetailId'])}])
        by_honor[honor_id].append({'type': source_type, 'sourceId': reward.get('eventId'),
            'status': 'resolved' if source_type != 'unknown' else 'reward-only',
            'condition': condition, 'rewardKey': reward['key'], 'product': product,
            'rawEvidence': {'table': ident[0], 'rowId': ident[1], 'sourceField': reward['sourceField'],
                'topOffset': record[1], 'recordSha256': sha(record[4]),
                'rewardRecord': reward,
                'chain': chain}})
        covered.add((ident[0], ident[1], reward['sourceField'], honor_id))
    for hit in product_hits:
        if hit['honorId'] not in honors:
            raise ValueError('Probe references missing honor')
        if (hit['table'], hit['rowId'], hit['field'], hit['honorId']) not in covered:
            by_honor[hit['honorId']].append({'type': 'unknown', 'sourceId': None,
                'status': 'reward-only', 'condition': None, 'product': hit['product'], 'rawEvidence': hit})
    entries = [{'id': h['id'], 'key': h['key'], 'nameJa': h['nameJa'],
        'status': ('known-source' if any(s['status'] == 'resolved' for s in by_honor[h['id']])
                   else 'reward-only' if by_honor[h['id']] else 'unknown'),
        'sources': by_honor[h['id']]} for h in honors.values()]
    return {'kind': 'gs-honor-acquisition-catalog', 'entries': entries,
        'coverage': 'selected-client-PB-only-not-complete-server-acquisition-library'}


def run(decoded):
    raw = decoded.read_bytes()
    if sha(raw) != EXPECTED_PB_SHA:
        raise ValueError('Decoded PB differs from reviewed baseline')
    full_bytes = FULL_SCHEMA.read_bytes()
    full = json.loads(full_bytes)
    compact, proof = verified_schema()
    records = list(iter_top_records(raw))
    tables, _ = project_named_tables(records)
    outputs, _ = build_all(tables, {})
    blocking = [issue for issue in outputs['validation_report.json']['issues']
                if issue['kind'] != 'unresolved-product']
    if blocking:
        raise ValueError('Existing domain joins failed: ' + str(blocking))
    scan = schema_scan(full, compact, Counter(r[0] for r in records))
    probes, hits = product_probe(records, full, compact)
    catalog = acquisition_catalog(outputs, tables, records, hits)
    unknown = [h for h in catalog['entries'] if h['status'] != 'known-source']
    endpoints = [m for m in scan['models'] if m['fullName'].startswith('Growing.Services.')
                 and any(k in m['fullName'] for k in ('Mission', 'ProductRoute', 'Exchange'))]
    queue = {'kind': 'gs-honor-reverse-lookup-keywords', 'purpose': 'search-existing-local-response-archives-only',
        'sourceKeywords': [m['fullName'] for m in endpoints],
        'fieldKeywords': ['Products', 'ProductId', 'Type', 'RequiredCount', 'MissionCategoryId',
            'PanelMissionGroupId', 'TransitionType', 'TransitionParamA', 'ProductWithRoute',
            'ProductRoutes', 'ParamA', 'ParamB', 'GroupId', 'DayCount', 'Term'],
        'unknownHonors': [{'honorId': h['id'], 'nameJa': h['nameJa'],
            'keywords': [str(h['id']), h['nameJa'], honors_resource(tables, h['id'])],
            'expectedTypedProduct': {'type': 6, 'productId': h['id']},
            'status': 'search-hints-only-not-source-evidence'} for h in unknown],
        'nextGate': 'Find real archived Mission*ListReply / ProductRouteReply payloads; decode and prove typed Product + condition + unique source identity.'}
    summary = {'honors': len(catalog['entries']), 'knownSourceHonors': len(catalog['entries']) - len(unknown),
        'unknownHonors': len(unknown), 'sourceTypeCounts': dict(Counter(s['type'] for h in catalog['entries'] for s in h['sources'])),
        'schemaModels': len(scan['models']), 'keywordModelCounts': scan['keywordModelCounts'],
        'rootProductProbes': probes, 'honorProductHits': len(hits),
        'honorReferenceBasisCounts': dict(Counter(h['basis'] for h in hits)),
        'rewardOnlySources': sum(s['status'] == 'reward-only' for h in catalog['entries'] for s in h['sources']),
        'publicationReady': False, 'frontendChanged': False, 'nextGate': queue['nextGate']}
    source = {'decodedPbSha256': sha(raw), 'fullSchemaSha256': sha(full_bytes),
        'compactSchemaSha256': proof['compactSchemaSha256'], 'generatorVersion': 'honor-acquisition-scan-v1',
        'generatorSha256': sha(Path(__file__).read_bytes())}
    result = {'honor_acquisition_catalog.json': catalog, 'protobuf_keyword_scan.json': scan,
              'reverse_lookup_keyword_queue.json': queue, 'validation_report.json': summary}
    for value in result.values():
        value.update(schemaVersion=1, source=source)
    return result


def honors_resource(tables, ident):
    return next(row.get('resourceId', '') for row in tables[TABLE_IDS['Honors']] if row['id'] == ident)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path, default=ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb')
    parser.add_argument('--out', type=Path, default=ROOT / '.analysis/honor-acquisition-v1')
    args = parser.parse_args()
    out = args.out.resolve()
    audit_root = (ROOT / '.analysis').resolve()
    if not out.is_relative_to(audit_root) or out == audit_root:
        raise ValueError('Output must be an audit subdirectory within this checkout .analysis')
    result = run(args.decoded_masterdata)
    out.mkdir(parents=True, exist_ok=True)
    for name, value in result.items():
        (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result['validation_report.json'].items()
                      if k not in ('rootProductProbes', 'source')}, ensure_ascii=False))
    print(str(out))


if __name__ == '__main__':
    main()
