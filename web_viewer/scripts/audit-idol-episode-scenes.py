"""Compare published idol episode entrances with their independently authored RAW scene.

Read-only by default. --repair FILE recompiles only that aggregate and its episode
files using the current compiler. No assets are copied. Regenerate presentation
and reading projections afterwards. Requires the local extracted scenario root.
"""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('candidate', ROOT / 'scripts/compile-story-migration-candidate.py')
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


def scene(step):
    state = step.get('state', step.get('settled_snapshot', step.get('entry_snapshot', {})))
    return {'bg': state.get('bg'), 'cast': sorted([
        [s['id'], s.get('pos_x', 0), s.get('pos_y', 0)]
        for s in state.get('spines', []) if s.get('visible', True)
    ])}


def first_dialogue(steps):
    return next(s for s in steps if s.get('type') == 'adv' and s.get('dialogue'))


def audit(raw_root, repair=None, repair_legacy=False):
    read = candidate.load_json
    compiled = ROOT / 'public/data/compiled'
    master = read(ROOT / 'public/data/masterdata/story_master_index.json')
    presentation = read(ROOT / 'public/data/masterdata/story_presentation_index.json')['by_file']
    resources = candidate.LocalScenarioResources.from_archive_sources(candidate.load_archive_sources())
    groups = {}
    for row in master['idol_story']['episodes']:
        if row.get('compiled_file'):
            groups.setdefault(row['compiled_file'], []).append(row)
    report = []
    for file, rows in sorted(groups.items()):
        if len(rows) < 2:
            continue
        current = read(compiled / file)
        # These named Small Talks are independent RAW files, not choice branches.
        ids = sorted({r['resource_id'] for r in rows})
        if not all(s[-2] == '_' and s[-1].isalpha() for s in ids):
            continue
        parent = file.removesuffix('.json').removesuffix('_' + ids[0][:-2])
        paths = [raw_root / parent / f'scenario_{sid}.json' for sid in ids]
        if not all(p.is_file() for p in paths):
            report.append({'file': file, 'status': 'raw_missing'})
            continue
        raws = [read(p) for p in paths]
        differences = []
        checked = 0
        for sid, raw in zip(ids, raws):
            if not candidate.ScenarioCompiler._declares_initial_spines(raw):
                continue  # Authored carryover requires a separate continuity audit.
            standalone = candidate.ScenarioCompiler(raw, sid, sid, resources=resources).compile()
            expected = scene(first_dialogue(standalone['steps']))
            entry = next((e for e in presentation[file]['episodes'] if
                (e.get('source_resource_id') or e.get('source_scenario_id')) == sid
                or e.get('episode_part') == sid[-1]), None)
            if entry is None:
                differences.append({'source': sid, 'error': 'missing_boundary'})
                continue
            actual = scene(first_dialogue(current['steps'][entry['start_step_index']:entry['end_step_index'] + 1]))
            checked += 1
            if actual != expected:
                differences.append({'source': sid, 'expected': expected, 'actual': actual})
        report.append({'file': file, 'checked': checked, 'explicit_boundaries': bool(current.get('episodes')), 'differences': differences})
        if repair == file or (repair_legacy and differences and not current.get('episodes')):
            if current.get('schema_version') == 2:
                raise ValueError(f'Use the authoritative publication workflow for {file}; refusing a contract downgrade')
            source_files = [f'scenariodata/{parent}/{p.name}' for p in paths]
            rebuilt = candidate.ScenarioCompiler.compile_group(raws, current['scenario_id'], ids, source_files, resources=resources)
            rebuilt['source'] = candidate.build_source_evidence(paths, source_files)
            voices = candidate.relink_voices(rebuilt, candidate.load_voice_names(compiled / 'voice_index.json'))
            if voices['unresolved']:
                raise ValueError(f'Unresolved voices: {voices}')
            episodes = candidate.split_episodes(rebuilt)
            for sid, raw in zip(ids, raws):
                if candidate.ScenarioCompiler._declares_initial_spines(raw):
                    single = candidate.ScenarioCompiler(raw, sid, sid, resources=resources).compile()
                    assert scene(first_dialogue(episodes[sid]['steps'])) == scene(first_dialogue(single['steps'])), sid
            candidate.save_json(compiled / file, rebuilt)
            for sid, episode in episodes.items():
                candidate.save_json(compiled / 'episodes' / f'{sid}.json', episode)
    if repair and repair not in {r['file'] for r in report if 'checked' in r}:
        raise ValueError(f'Unrecognized repair target: {repair}')
    return {'groups': len(report), 'checked_episodes': sum(r.get('checked', 0) for r in report),
            'affected_groups': sum(bool(r.get('differences')) for r in report), 'entries': report}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-root', type=Path, required=True)
    parser.add_argument('--repair', help='One exact compiled filename; otherwise read-only')
    parser.add_argument('--repair-legacy', action='store_true', help='Repair mismatching legacy groups without explicit boundaries only')
    parser.add_argument('--check-legacy', action='store_true', help='Fail if any legacy entrance differs from RAW')
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.raw_root, args.repair, args.repair_legacy)
    candidate.save_json(args.report, result)
    print(json.dumps({k: v for k, v in result.items() if k != 'entries'}))
    if args.check_legacy and any(r.get('differences') and not r.get('explicit_boundaries') for r in result['entries']):
        raise SystemExit('Legacy idol episode scenes differ from RAW; see report')
