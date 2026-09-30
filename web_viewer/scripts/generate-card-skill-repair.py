"""Rebuild only the mounted skill dictionary from a hash-bound decoded PB.

Candidate outputs stay outside the checkout. Cards, voices, costumes and other
detail dictionaries are preserved; the caller explicitly promotes the result.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata import extract_table_rows, iter_top_records
from sidem_masterdata.card_gameplay import build_card_gameplay, build_card_reference_maps

EXPECTED_PB = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'


def run(decoded_path, detail_path, output):
    output = output.resolve()
    if output.is_relative_to(ROOT.parent) or (output.exists() and any(output.iterdir())):
        raise ValueError('Use a new candidate directory outside the repository')
    raw = decoded_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED_PB:
        raise ValueError('Decoded PB identity changed')
    old_bytes = detail_path.read_bytes()
    payload = json.loads(old_bytes)
    tables = extract_table_rows(list(iter_top_records(raw)), {20, 21, 74, 75})
    references = build_card_reference_maps(tables)
    changes = []
    for key, old_skill in payload['skills_by_id'].items():
        skill_id = int(key)
        if skill_id not in references['skills'] or old_skill['id'] != skill_id:
            raise ValueError(f'Skill identity mismatch: {key}')
        skill = build_card_gameplay({'5': skill_id}, references)['skill']
        if {k: v for k, v in skill.items() if k not in ('levels', 'detail_group_id')} != {
            k: v for k, v in old_skill.items() if k not in ('levels', 'detail_group_id')
        }:
            raise ValueError(f'Unrelated skill source changed: {key}')
        old_levels = old_skill['levels']
        changes.append({'skill_id': skill_id, 'old_levels': len(old_levels), 'new_levels': len(skill['levels']),
            'detail_group_id': skill['detail_group_id'],
            'changed_descriptions': sum(a.get('description') != b.get('description')
                for a, b in zip(old_levels, skill['levels'])),
            'remaining_templates': sum(level['description_status'] == 'unresolved-template'
                for level in skill['levels'])})
        payload['skills_by_id'][key] = skill
    if detail_path.read_bytes() != old_bytes:
        raise ValueError('Mounted input changed during generation')
    output.mkdir(parents=True, exist_ok=False)
    encoded = (json.dumps(payload, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    (output / 'card_detail_index.json').write_bytes(encoded)
    report = {'input_pb_sha256': EXPECTED_PB, 'input_detail_sha256': hashlib.sha256(old_bytes).hexdigest(),
        'output_detail_sha256': hashlib.sha256(encoded).hexdigest(), 'changes': changes,
        'scope': 'skills_by_id only', 'publication_status': 'candidate',
        'description_basis': 'Observed dXY effect ordinal / parameter ordinal in the pinned PB; not a gameplay simulation'}
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'skills': len(changes), 'old_levels': sum(r['old_levels'] for r in changes),
        'new_levels': sum(r['new_levels'] for r in changes),
        'remaining_templates': sum(r['remaining_templates'] for r in changes), 'out': str(output)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path, required=True)
    parser.add_argument('--detail', type=Path, default=ROOT / 'public/data/masterdata/card_detail_index.json')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.decoded_masterdata, args.detail, args.out)))
