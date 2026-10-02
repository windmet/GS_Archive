"""One named table registry and fail-closed archive field identity gate.

The compact rules describe wire interpretations. The full IL2CPP schema proves
field numbers/names/sets, not enum or gameplay semantics. Legacy wire stays intact.
"""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
from .named_wire import decode

SCHEMA_ROOT = Path(__file__).resolve().parents[1] / 'schema'
FULL_SCHEMA = SCHEMA_ROOT / 'il2cpp_protobuf_schema.json'
DOMAIN_SCHEMA = SCHEMA_ROOT / 'archive_domain_fields.v1.json'
EXPECTED_PB_SHA = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'
_root = json.loads(FULL_SCHEMA.read_text('utf-8-sig'))['models_by_full_name']['Growing.Models.Data.Masterdata']
TABLE_IDS = {field['name']: field['number'] for field in _root['fields']}


def schema_mismatches(compact, full):
    models = full.get('models_by_full_name', {})
    registry = {str(f['number']): f['name'] for f in models.get('Growing.Models.Data.Masterdata', {}).get('fields', [])}
    errors = []
    for number, name in compact['table_registry'].items():
        if registry.get(number) != name:
            errors.append({'model': 'Masterdata', 'field': number, 'expected': name, 'actual': registry.get(number)})
    for model, spec in compact['models'].items():
        fields = {str(f['number']): f['name'] for f in models.get('Growing.Models.Data.' + model, {}).get('fields', [])}
        for number, field in spec['fields'].items():
            if fields.get(number) != field['name']:
                errors.append({'model': model, 'field': number, 'expected': field['name'], 'actual': fields.get(number)})
        if spec['field_set_complete'] and set(fields) != set(spec['fields']):
            errors.append({'model': model, 'error': 'field-set-drift'})
    return errors


@lru_cache(maxsize=1)
def verified_schema():
    compact_bytes, full_bytes = DOMAIN_SCHEMA.read_bytes(), FULL_SCHEMA.read_bytes()
    compact, full = json.loads(compact_bytes), json.loads(full_bytes)
    mismatch = schema_mismatches(compact, full)
    if mismatch:
        raise ValueError('Archive domain schema mismatch: ' + json.dumps(mismatch))
    return compact, {'status': 'verified-full-local-schema',
        'sha256': hashlib.sha256(full_bytes).hexdigest(),
        'compactSchemaSha256': hashlib.sha256(compact_bytes).hexdigest()}


def project_named_tables(records, selected_names=None):
    schema, verification = verified_schema()
    selected = set(schema['table_models']) if selected_names is None else {str(TABLE_IDS[name]) for name in selected_names}
    if selected - set(schema['table_models']):
        raise ValueError('No named wire rules for selected tables')
    tables = {int(number): [] for number in selected}
    for number, offset, _start, _end, payload in records:
        key = str(number)
        if key not in selected:
            continue
        if not isinstance(payload, bytes):
            raise ValueError(f'Named table {number} must contain message bytes')
        model = schema['table_models'][key]
        row = decode(payload, model, schema['models'])
        if schema['models'][model]['field_set_complete'] and row.get('_unknownFields'):
            raise ValueError(f'Unknown fields in complete model {model}: {row["_unknownFields"]}')
        row['_source'] = {'table': number, 'topOffset': offset, 'recordBytes': len(payload)}
        tables[number].append(row)
    return tables, verification
