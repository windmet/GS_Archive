"""Build isolated RAW group -> strict parent/episode candidates. Never publish.

Mounted episode boundaries own order and container identity. Each group uses one
compiler; duplicate synopsis, carried state and local targets are not row patches.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from scenario_compiler import ScenarioCompiler
from sidem_raw import extract_text_asset_records

spec = importlib.util.spec_from_file_location('migration_candidate', ROOT / 'scripts/compile-story-migration-candidate.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)

def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def compile_group_candidates(records, parent, source, compiler_version='local-raw-group-text-audit-v2', *, resources=None):
    ids = [e['source_scenario_id'] for e in parent['episodes']]
    if not ids or len(ids) != len(set(ids)) or [r['name'].removeprefix('scenario_') for r in records] != ids:
        raise ValueError('RAW parts must match the complete mounted episode order')
    compiled = ScenarioCompiler.compile_group(
        [json.loads(r['payload']) for r in records], parent['scenario_id'], ids,
        [r['container_path'] for r in records], source=source, resources=resources)
    episodes = migration.split_episodes(compiled)
    return (ScenarioCompiler.to_authoritative(compiled, compiler_version),
            {sid: ScenarioCompiler.to_authoritative(data, compiler_version) for sid, data in episodes.items()})

def run(raw_root, output, part_ledger):
    output = output.resolve()
    if output == ROOT or output.is_relative_to(ROOT / 'public'):
        raise ValueError('Group candidates must stay outside public')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Use an empty candidate output; never mix compilation scopes')
    output.mkdir(parents=True, exist_ok=True)
    read = lambda p: json.loads(p.read_bytes())
    manifest_bytes = (ROOT / 'public/data/reading/manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    ledger_bytes = part_ledger.read_bytes()
    ledger = json.loads(ledger_bytes)
    by_part = {}
    for entry in ledger['entries']:
        if entry.get('candidate'):
            by_part.setdefault(entry['part'], []).append(entry)
    parents = sorted({e['parent_file'] for e in manifest['entries']
        if e['source_file'].startswith('episodes/') and
        any(r.get('source_text') and not r.get('text_ref') for r in read(ROOT / 'public/data/reading' / e['file'])['rows'])})
    result = {'schema_version': 1, 'compilation_scope': 'mounted-group', 'publication_status': 'candidate-only',
        'manifest_sha256': digest(manifest_bytes), 'part_ledger_sha256': digest(ledger_bytes), 'groups': []}
    cache = {}
    resources = migration.LocalScenarioResources.from_archive_sources(migration.load_archive_sources())
    for filename in parents:
        if not re.fullmatch(r'[A-Za-z0-9_-]+\.json', filename):
            raise ValueError('Unsafe parent artifact filename')
        parent_bytes = (ROOT / 'public/data/compiled' / filename).read_bytes()
        parent = json.loads(parent_bytes)
        row = {'parent_file': filename, 'parent_sha256': digest(parent_bytes), 'sources': []}
        result['groups'].append(row)
        try:
            records, bundle_names = [], set()
            for episode in parent['episodes']:
                sid = episode['source_scenario_id']
                if not re.fullmatch(r'[A-Za-z0-9_-]+', sid):
                    raise ValueError('Unsafe episode artifact identity')
                matches = [c for c in by_part.get(sid, []) if filename in
                    (f"{Path(c['container_path']).parent.name}_{c['part']}.json",
                     f"{Path(c['container_path']).parent.name}_{c['candidate_scenario_id']}.json",
                     f"{Path(c['bundle']).stem.removeprefix('scenario_')}.json")]
                if len(matches) != 1:
                    raise ValueError(f'No unique RAW owner for {filename}/{sid}: {len(matches)}')
                c = matches[0]
                if c['bundle'] not in cache:
                    bundle = raw_root / 'asset' / c['bundle']
                    cache[c['bundle']] = (digest(bundle.read_bytes()), extract_text_asset_records(bundle))
                bundle_hash, extracted = cache[c['bundle']]
                if bundle_hash != c['bundle_sha256']:
                    raise ValueError('RAW bundle hash drift')
                found = [r for r in extracted if r['container_path'] == c['container_path']
                         and r['name'] == f'scenario_{sid}' and digest(r['payload']) == c['payload_sha256']]
                if len(found) != 1:
                    raise ValueError('RAW container/payload identity drift or ambiguity')
                records.append(found[0]); bundle_names.add(c['bundle'])
                row['sources'].append({k: c[k] for k in ('bundle','bundle_sha256','container_path','part','payload_sha256')})
            if len(bundle_names) != 1:
                raise ValueError('Multi-bundle group needs explicit provenance contract')
            bundle_name = next(iter(bundle_names))
            # Mounted boundaries cannot silently omit an authored lettered part.
            owners = {str(Path(r['container_path']).parent) for r in records}
            bundle_id = Path(bundle_name).stem.removeprefix('scenario_')
            authored = [r['name'].removeprefix('scenario_') for r in cache[bundle_name][1]
                if str(Path(r['container_path']).parent) in owners and
                re.fullmatch(re.escape(bundle_id) + r'_[a-z]', r['name'].removeprefix('scenario_'))]
            expected = [e['source_scenario_id'] for e in parent['episodes']]
            if len(owners)!=1 or sorted(authored)!=sorted(expected):
                raise ValueError('Mounted boundaries do not cover the complete authored owner group')
            source = {'raw_path': f'RAW/asset/{bundle_name}', 'raw_hash': cache[bundle_name][0]}
            aggregate, episodes = compile_group_candidates(records, parent, source, resources=resources)
            row['artifacts'] = []
            for file, data in [(filename, aggregate), *[(f'episodes/{sid}.json', data) for sid, data in episodes.items()]]:
                encoded = (json.dumps(data, ensure_ascii=False, indent=2)+'\n').encode('utf-8')
                target = output / 'candidates' / file
                if target.exists():
                    raise ValueError(f'Duplicate output ownership: {file}')
                target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(encoded)
                row['artifacts'].append({'file': file, 'sha256': digest(encoded), 'steps': len(data['steps'])})
            row['status'] = 'group-candidate'
        except Exception as error:
            row.update(status='blocked', error=str(error))
    result['summary'] = {'groups': len(result['groups']), 'statuses': dict(Counter(r['status'] for r in result['groups'])),
        'episodes': sum(len(r.get('artifacts', []))-1 for r in result['groups'] if r['status']=='group-candidate')}
    (output / 'ledger.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    return result['summary']

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-root', type=Path, default=ROOT.parent / 'RAW')
    parser.add_argument('--output', type=Path, default=ROOT / '.analysis/local-story-group-v2-r1')
    parser.add_argument('--part-ledger', type=Path, default=ROOT / '.analysis/local-story-strict-v2-r2/ledger.json')
    args = parser.parse_args()
    summary = run(args.raw_root.resolve(), args.output, args.part_ledger)
    print(json.dumps(summary, indent=2))
    raise SystemExit(1 if summary['statuses'].get('blocked') else 0)
