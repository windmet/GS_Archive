"""Read-only RAW/Reader spot checks for translation-preflight findings.

Uses explicit bundle + TextAsset identities. Candidate compiler output stays in
memory; never writes compiled/public files or promotes reconstructed identities.
"""
import argparse
from collections import Counter
import hashlib
import json
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_raw import extract_text_asset_records
from scenario_compiler import ScenarioCompiler

CASES = [
    ('1_4_001_03', '1_4_001_03_h', '1_4_001_03_h'),
    ('2_4_025_03', '2_4_025_03_09_b', '025suz_403_2_4_025_03_09_b'),
    ('2_4_033_02', '2_4_033_02_09_a', '033shr_402_2_4_033_02_09_a'),
    ('1_2_005_01', '1_2_005_01_a', '1_2_005_01_a'),
    ('1_3_30013_01', '1_3_30013_01_j', '1_3_30013_01_j'),
    ('5_00_017_23', '5_00_017_23', '5_00_017_23_5_00_017_23'),
    ('1_2_001_12', '1_2_001_12', None),
    ('1_2_001_12', '1_2_001_12_a', None),
    ('1_2_001_12', '1_2_001_12_b', None),
    ('1_2_001_12', '1_2_001_12_c', None),
]

def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def text_slots(compiled):
    for step in compiled['steps']:
        d = step.get('dialogue') or {}
        pairs = [(d.get('source_text', d.get('text_jp', d.get('text'))), d.get('text_ref'))]
        if step['type'] in ('title', 'synopsis'):
            pairs.append((d.get('speaker_source_text', d.get('speaker')), d.get('speaker_text_ref')))
        time = step.get('text_time') or {}
        pairs.append((time.get('source_text', time.get('text')), time.get('text_ref')))
        for o in step.get('options', []):
            pairs.extend([(o.get('source_text', o.get('text')), o.get('text_ref')),
                          (o.get('detail_source_text', o.get('detail')), o.get('detail_text_ref'))])
        for text, ref in pairs:
            if isinstance(text, str) and text:
                yield {'text': text, 'ref': ref, 'step_id': step['step_id']}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-root', type=Path, default=ROOT.parent / 'RAW')
    parser.add_argument('--out', type=Path, default=ROOT / '.analysis/translation-preflight/raw-samples.json')
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(ROOT / 'public'):
        parser.error('Report must remain outside public')
    manifest = json.loads((ROOT / 'public/data/reading/manifest.json').read_text('utf-8'))
    docs = {e['document_id']: e for e in manifest['entries']}
    all_readings = [(e, json.loads((ROOT / 'public/data/reading' / e['file']).read_text('utf-8'))) for e in manifest['entries']]
    normalized_index = {}
    for e, doc in all_readings:
        for row in doc['rows']:
            normalized_index.setdefault(re.sub(r'\s+', '', row['source_text']), set()).add(e['document_id'])
    cache, results = {}, []
    for bundle_id, part, document_id in CASES:
        bundle = args.raw_root / 'asset' / f'scenario_{bundle_id}.unity3d'
        if bundle_id not in cache:
            cache[bundle_id] = extract_text_asset_records(bundle)
        records = [r for r in cache[bundle_id] if r['name'] == f'scenario_{part}']
        if len(records) != 1:
            raise ValueError(f'Expected one exact TextAsset: {bundle_id}/{part}')
        record = records[0]
        raw = json.loads(record['payload'])
        # The candidate catalog ID is explicit but not approved for publication.
        candidate = ScenarioCompiler(raw, bundle_id, part, record['container_path']).compile()
        slots = list(text_slots(candidate))
        entry = docs.get(document_id)
        reading = json.loads((ROOT / 'public/data/reading' / entry['file']).read_text('utf-8')) if entry else None
        published = Counter(r['source_text'] for r in reading['rows'] if r['source_text']) if reading else Counter()
        rebuilt = Counter(s['text'] for s in slots)
        results.append({
            'bundle': str(bundle), 'bundle_sha256': digest(bundle.read_bytes()),
            'container': record['container_path'], 'payload_sha256': digest(record['payload']),
            'part': part, 'document_id': document_id, 'reader_exists': bool(reading),
            'raw_commands': len(raw['Command']), 'candidate_text_slots': len(slots),
            'candidate_slots_with_ref': sum(bool(s['ref']) for s in slots),
            'reader_text_rows': sum(published.values()),
            'candidate_text_absent_from_reader': list((rebuilt - published).elements()),
            'candidate_only_evidence': [s for s in slots if s['text'] in (rebuilt - published)],
            'manifest_matches_for_part': [e['document_id'] for e, d in all_readings
                                          if any(r['anchor'].get('source_part_id') == part for r in d['rows'])],
            'exact_text_matches_elsewhere': [{'text': t, 'documents': [e['document_id'] for e, d in all_readings
                                             if any(r['source_text'] == t for r in d['rows'])]}
                                            for t in (rebuilt - published)],
            'whitespace_insensitive_matches': [{'text': t, 'documents': sorted(normalized_index.get(re.sub(r'\s+', '', t), []))}
                                               for t in (rebuilt - published)],
            'reader_text_absent_from_candidate': list((published - rebuilt).elements()),
            'candidate_choice_targets': [{'step_id': s['step_id'], 'options': s.get('options')}
                                         for s in candidate['steps'] if s['type'] == 'choice'],
            'raw_control_commands': [{'index': i, **c} for i, c in enumerate(raw['Command'])
                                     if any(t in c['Type'] for t in ['select', 'label', 'jump', 'fade'])],
        })
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({'scope': '10 explicit source parts; not all-corpus RAW parity', 'samples': results}, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    for r in results:
        print(r['part'], 'candidate=', r['candidate_text_slots'], 'reader=', r['reader_text_rows'],
              'candidate-only=', len(r['candidate_text_absent_from_reader']), 'reader-only=', len(r['reader_text_absent_from_candidate']))

if __name__ == '__main__':
    main()
