"""Recompile every published story scenario from RAW into a candidate tree.

Never writes to public. Each top-level public/data/compiled/<file>.json is matched back to
its RAW parts (aggregates through their episode source ids, single files through the
"<raw dir>_<part>.json" name) and recompiled with the published file's output contract and
provenance. A file whose published text_ref points into a bundle container, or whose
source is a RAW/asset bundle, is compiled from that bundle's TextAssets: the publication
release ledger names the bundle, its hash and the container of every part. The rest go
through compile-story-migration-candidate.py's compile_candidate on the legacy JSON.
Voice fields stay as the compiler writes them, as in the published corpus: the player
resolves them (AssetResolver), and the report checks playback through that resolver.
A ledger records the owner, status and output hash of every artifact;
report-story-recompile-candidate.py diffs the tree against public.

  python scripts/recompile-story-corpus-candidate.py --output <dir outside web_viewer> \\
      [--compiled-dir <published compiled corpus>] [--only a,b]

A domain worktree tracks only part of the corpus; point --compiled-dir at the main
checkout's public/data/compiled (read only).
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import sys
import tempfile
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
COMPILER_VERSION = 'scenario-compiler-python-v2-corpus-20261020'

spec = importlib.util.spec_from_file_location('migration_candidate', ROOT / 'scripts/compile-story-migration-candidate.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
from scenario_compiler import ScenarioCompiler  # noqa: E402  (sys.path set by the migration module)
from sidem_raw import extract_text_asset_records  # noqa: E402


def digest(data: bytes) -> str:
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def load_release_sources(compiled: Path) -> dict[str, dict]:
    """Story id -> the RAW bundle and TextAsset containers its publication release records."""
    sources = {}
    for path in sorted((compiled.parent / 'publication' / 'releases').glob('*.json')):
        for entry in json.loads(path.read_bytes()).get('entries', []):
            source = entry.get('source') or {}
            if entry.get('domain') == 'story' and str(source.get('archive_relative_path', '')).startswith('asset/'):
                sources[entry['logical_id'].split(':', 1)[1]] = source
    return sources


def published_text_file(data: dict) -> str:
    for step in data.get('steps', []):
        ref = (step.get('dialogue') or {}).get('text_ref')
        if ref:
            return ref['source']['file']
    return ''


def bundle_provenance(data: dict, stem: str, parts: list[str], releases: dict[str, dict]) -> dict | None:
    """Bundle, hash and part containers when the published file came from a RAW bundle."""
    raw_path = (data.get('source') or {}).get('raw_path', '')
    if not raw_path.startswith('RAW/asset/') and not published_text_file(data).startswith('assets/'):
        return None
    release = releases.get(stem)
    if not release:
        raise ValueError('published from a bundle but no release records it')
    containers = {o['name'].removeprefix('scenario_'): o['container_path'] for o in release['objects']}
    if sorted(containers) != sorted(parts):
        raise ValueError(f'release objects {sorted(containers)} do not match parts {parts}')
    return {'bundle': release['archive_relative_path'].removeprefix('asset/'),
            'bundle_sha256': 'sha256:' + release['sha256'], 'containers': [containers[p] for p in parts]}


def plan_file(name: str, compiled: Path, raw_root: Path, raw_dirs: list[str], releases: dict[str, dict]) -> dict:
    """Owner of one published file: its RAW dir, parts, output contract and provenance."""
    data = json.loads((compiled / name).read_bytes())
    stem = name[:-5]
    contract = 'authoritative' if data.get('schema_version') == 2 else 'compatibility'
    parts = [e['source_scenario_id'] for e in data.get('episodes') or [] if e.get('source_scenario_id')]
    if parts:
        dirs = {d for d in raw_dirs for p in parts if (raw_root / d / f'scenario_{p}.json').is_file()}
        if len(dirs) != 1:
            return {'file': name, 'status': 'blocked', 'error': f'episode parts live in {len(dirs)} RAW dirs'}
        prefixes = {p.rsplit('_', 1)[0] for p in parts}
        if len(prefixes) != 1:
            return {'file': name, 'status': 'blocked', 'error': f'episode parts span groups {sorted(prefixes)}'}
        job = {'file': name, 'mode': 'group', 'contract': contract, 'raw_dir': dirs.pop(), 'group_id': prefixes.pop(),
               'scenario_id': stem, 'parts': parts}
    else:
        owners = [d for d in raw_dirs if stem.startswith(d + '_') and (raw_root / d / f'scenario_{stem[len(d) + 1:]}.json').is_file()]
        if len(owners) != 1:
            return {'file': name, 'status': 'blocked', 'error': f'{len(owners)} RAW owners for a single-part file'}
        part = stem[len(owners[0]) + 1:]
        job = {'file': name, 'mode': 'standalone', 'contract': contract, 'raw_dir': owners[0], 'group_id': part,
               'scenario_id': data.get('scenario_id') or stem, 'parts': [part]}
    try:
        return {**job, **(bundle_provenance(data, stem, job['parts'], releases) or {})}
    except ValueError as error:
        return {**job, 'status': 'blocked', 'error': str(error)}


_bundles: dict[str, tuple[str, list[dict[str, Any]]]] = {}
_resources = None


def compile_from_bundle(job: dict) -> tuple[dict, dict[str, dict]]:
    """The published source is a RAW/asset bundle: compile its TextAssets, not the legacy JSON."""
    global _resources
    archive = migration.load_archive_sources()
    if job['bundle'] not in _bundles:
        path = archive.raw_root / 'asset' / job['bundle']
        _bundles[job['bundle']] = (digest(path.read_bytes()), extract_text_asset_records(path))
    bundle_hash, records = _bundles[job['bundle']]
    if bundle_hash != job['bundle_sha256']:
        raise ValueError(f"RAW bundle drift: {job['bundle']}")
    picked = []
    for part, container in zip(job['parts'], job['containers']):
        found = [r for r in records if r['container_path'] == container and r['name'] == f'scenario_{part}']
        if len(found) != 1:
            raise ValueError(f'{len(found)} TextAssets for {container}')
        picked.append(found[0])
    _resources = _resources or migration.LocalScenarioResources.from_archive_sources(archive)
    payloads = [json.loads(r['payload']) for r in picked]
    containers = [r['container_path'] for r in picked]
    if job['mode'] == 'group':
        scenario = ScenarioCompiler.compile_group(payloads, job['scenario_id'], job['parts'], containers, resources=_resources)
    else:
        scenario = ScenarioCompiler(payloads[0], job['scenario_id'], job['parts'][0], containers[0], resources=_resources).compile()
    scenario['source'] = {'raw_path': f"RAW/asset/{job['bundle']}", 'raw_hash': bundle_hash}
    episodes = migration.split_episodes(scenario) if job['mode'] == 'group' else {}
    if job['contract'] == 'authoritative':
        scenario = ScenarioCompiler.to_authoritative(scenario, COMPILER_VERSION)
        episodes = {k: ScenarioCompiler.to_authoritative(v, COMPILER_VERSION) for k, v in episodes.items()}
    return scenario, episodes


def compile_one(job: dict, raw_root: str, scratch: str) -> dict:
    work = Path(tempfile.mkdtemp(dir=scratch))
    try:
        if job.get('bundle'):
            scenario, episodes = compile_from_bundle(job)
            produced = {job['file']: scenario, **{f'episodes/{k}.json': v for k, v in episodes.items()}}
            for file, data in produced.items():
                migration.save_json(work / file, data)
            return {**job, 'status': 'candidate', 'artifacts': {file: str(work / file) for file in produced}, 'work': str(work)}
        raw_dir = Path(raw_root) / job['raw_dir']
        args = argparse.Namespace(
            sources_config=None, output_dir=str(work / 'out'), group_id=job['group_id'], scenario_id=job['scenario_id'],
            output_contract=job['contract'], compiler_version=COMPILER_VERSION, voice_index=None,
            raw_group_dir=str(raw_dir) if job['mode'] == 'group' else None,
            raw_file=str(raw_dir / f"scenario_{job['parts'][0]}.json") if job['mode'] == 'standalone' else None,
            expected_parts=','.join(p.rsplit('_', 1)[1] for p in job['parts']) if job['mode'] == 'group' else '',
        )
        manifest = migration.compile_candidate(args)
        produced = {job['file']: work / 'out' / manifest['aggregate_file']}
        if job['mode'] == 'group':
            produced.update({f'episodes/{p}.json': work / 'out' / 'episodes' / f'{p}.json' for p in job['parts']})
        return {**job, 'status': 'candidate', 'artifacts': {k: str(v) for k, v in produced.items()}, 'work': str(work)}
    except Exception as error:  # recorded per file; the ledger is the result
        shutil.rmtree(work, ignore_errors=True)
        return {**job, 'status': 'blocked', 'error': f'{type(error).__name__}: {error}'}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--raw-root', type=Path, default=None, help='Legacy scenariodata dir (default: legacy_root/scripts/scenariodata).')
    parser.add_argument('--compiled-dir', type=Path, default=ROOT / 'public/data/compiled')
    parser.add_argument('--only', default='', help='Comma-separated published file names, for spot checks.')
    parser.add_argument('--jobs', type=int, default=6)
    args = parser.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents:
        raise SystemExit('Candidate output must be outside the web_viewer workspace')
    if output.exists() and any(output.iterdir()):
        raise SystemExit('Use an empty candidate output directory')
    raw_root = (args.raw_root or migration.load_archive_sources().legacy_root / 'scripts' / 'scenariodata').resolve()
    compiled = args.compiled_dir.resolve()
    raw_dirs = sorted((p.name for p in raw_root.iterdir() if p.is_dir()), key=len, reverse=True)

    names = sorted(p.name for p in compiled.glob('*.json'))
    if args.only:
        wanted = set(args.only.split(','))
        names = [n for n in names if n in wanted]
    releases = load_release_sources(compiled)
    jobs, ledger = [], []
    for name in names:
        try:
            head = json.loads((compiled / name).read_bytes())
        except ValueError:
            continue
        if not isinstance(head, dict) or 'steps' not in head:
            continue
        plan = plan_file(name, compiled, raw_root, raw_dirs, releases)
        (ledger if plan.get('status') == 'blocked' else jobs).append(plan)

    candidates = output / 'candidates'
    scratch = output / '.work'
    scratch.mkdir(parents=True)
    owners: dict[str, str] = {}
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for result in pool.map(compile_one, jobs, [str(raw_root)] * len(jobs), [str(scratch)] * len(jobs), chunksize=4):
            if result['status'] == 'candidate':
                hashes = {}
                for file, source in result.pop('artifacts').items():
                    if file in owners:
                        result.update(status='blocked', error=f'{file} also produced by {owners[file]}')
                        break
                    owners[file] = result['file']
                    target = candidates / file
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(source, target)
                    hashes[file] = digest(target.read_bytes())
                result['artifacts'] = hashes
                shutil.rmtree(result.pop('work'), ignore_errors=True)
            ledger.append(result)
    shutil.rmtree(scratch, ignore_errors=True)

    ledger.sort(key=lambda row: row['file'])
    summary = {
        'files': len(ledger),
        'statuses': dict(Counter(row['status'] for row in ledger)),
        'artifacts': sum(len(row.get('artifacts', {})) for row in ledger),
        'provenance': dict(Counter('bundle' if row.get('bundle') else 'legacy-json' for row in ledger if row['status'] == 'candidate')),
    }
    (output / 'ledger.json').write_text(json.dumps({
        'schema_version': 1, 'publication_status': 'candidate-only', 'compiler_version': COMPILER_VERSION,
        'raw_root': str(raw_root), 'compiled_dir': str(compiled), 'summary': summary, 'files': ledger,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
