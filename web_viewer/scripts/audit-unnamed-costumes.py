"""Reverse unnamed story costumes through verified field identities and local scripts.

Read-only: absent source names stay absent; matching numeric values alone are not links.
"""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata.named_schema import EXPECTED_PB_SHA, FULL_SCHEMA
from sidem_masterdata.wire import iter_top_records, parse_message

pb = ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb'
data = pb.read_bytes()
assert hashlib.sha256(data).hexdigest() == EXPECTED_PB_SHA, 'PB snapshot drift'
models = json.loads(FULL_SCHEMA.read_text('utf-8-sig'))['models_by_full_name']
dictionary = json.loads((ROOT / 'public/data/masterdata/costume_dictionary.json').read_text('utf-8'))
unnamed = {r['model_resource_id']: r for r in dictionary['costumes'] if not (r.get('costume_name') or '').strip()}
costume_ids = {r['costume_id']: rid for rid, r in unnamed.items()}
card_spec = models['Growing.Models.Data.CardData']
card_refs = {str(f['number']): f['name'] for f in card_spec['fields'] if 'StoryCostumeId' in f['name']}
costume_specs = {27: models['Growing.Models.Data.LiveCostumeData'], 28: models['Growing.Models.Data.StoryCostumeData']}
result = {rid: {'modelId': rid, 'costumeId': row['costume_id'], 'sourceName': row.get('costume_name'),
    'nameStatus': 'source-name-not-recorded', 'rawCostumeRows': [], 'cardReferences': [], 'compiledReferences': []}
    for rid, row in unnamed.items()}
for table, offset, _, _, payload in iter_top_records(data):
    if table not in (1, 27, 28):
        continue
    row = parse_message(payload)
    if table in costume_specs:
        spec = costume_specs[table]
        projected = {f['name']: row.get(str(f['number'])) for f in spec['fields']}
        rid = projected.get('ResourceId')
        if rid in result:
            result[rid]['rawCostumeRows'].append({'table': table, 'offset': offset, 'fields': projected})
            if isinstance(projected.get('Name'), str) and projected['Name'].strip():
                result[rid]['nameStatus'] = 'raw-source-name-found'
                result[rid]['sourceNameCandidate'] = projected['Name'].strip()
    else:
        for field, name in card_refs.items():
            rid = costume_ids.get(row.get(field))
            if rid:
                result[rid]['cardReferences'].append({'cardId': row.get('1'), 'field': name, 'offset': offset})
pattern = re.compile(r'\d{3}[a-z]{3}_\d{3}_\d{2}')
for file in (ROOT / 'public/data/compiled').glob('*.json'):
    for rid in set(pattern.findall(file.read_text('utf-8'))).intersection(result):
        result[rid]['compiledReferences'].append(file.name)
output = ROOT / '.analysis/archive-general-localization/unnamed-costumes.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'pbSha256': EXPECTED_PB_SHA, 'entries': list(result.values())}, ensure_ascii=False, indent=2) + '\n', 'utf-8')
print(json.dumps({'unnamed': len(result), 'sample': result.get('040ren_004_00'), 'output': str(output)}, ensure_ascii=False))
