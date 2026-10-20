"""Field-level diff of a story recompile candidate against the published corpus.

Reads the ledger written by recompile-story-corpus-candidate.py and compares every
candidate artifact with the published file of the same path. Steps are aligned by their
type and text before comparing, so one inserted step does not shift every later one.
Paths are normalised (list indices become []) and counted per change kind, so a
promotion decision can be made per field rather than per file. Each field gets a tier:

  safe    additions only (new evidence and identity fields, null defaults), and voice
          spellings the player resolves to the same file
  review  changed playback state, new text bindings, inserted steps
  risky   removed fields or steps, changed text or text bindings, and voice changes the
          player resolves to a different file or to silence

Voice changes are judged by playback: both values go through the player's own
resolveVoiceFilenameCandidates (src/utils/AssetResolver.js) against public/assets/voice.

  python scripts/report-story-recompile-candidate.py --candidate <dir> [--examples 3]
"""
from __future__ import annotations

import argparse
import difflib
import json
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IGNORED = {('compiler_version',)}
VOICE_PATH = 'steps[].dialogue.voice'
PLAYBACK = '''
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [resolver, voiceDir] = process.argv.slice(1)
const { resolveVoiceFilenameCandidates } = await import(pathToFileURL(resolver).href)
const disk = new Set(readdirSync(voiceDir))
const play = (voice, scenarioId) => voice ? resolveVoiceFilenameCandidates(voice, scenarioId).find(name => disk.has(name)) ?? null : null
const pairs = JSON.parse(readFileSync(0, 'utf8'))
process.stdout.write(JSON.stringify(pairs.map(([a, sa, b, sb]) => [play(a, sa), play(b, sb)])))
'''


def step_key(step):
    return (step.get('type'), (step.get('dialogue') or {}).get('text'))


def walk(old, new, path, out):
    if type(old) is not type(new) and not (isinstance(old, (int, float)) and isinstance(new, (int, float))):
        out.append(('changed', path, old, new))
    elif isinstance(old, dict):
        for key in old.keys() | new.keys():
            if key not in new:
                out.append(('removed', path + (key,), old[key], None))
            elif key not in old:
                out.append(('added', path + (key,), None, new[key]))
            elif path == () and key == 'steps' and isinstance(old[key], list) and isinstance(new[key], list):
                walk_steps(old[key], new[key], out)
            else:
                walk(old[key], new[key], path + (key,), out)
    elif isinstance(old, list):
        if len(old) != len(new):
            out.append(('length', path, len(old), len(new)))
        for a, b in zip(old, new):
            walk(a, b, path + ('[]',), out)
    elif old != new:
        out.append(('changed', path, old, new))


def walk_steps(old, new, out):
    matcher = difflib.SequenceMatcher(None, [step_key(s) for s in old], [step_key(s) for s in new], autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ('equal', 'replace'):
            for a, b in zip(old[i1:i2], new[j1:j2]):
                walk(a, b, ('steps', '[]'), out)
        for step in old[i1 + (j2 - j1 if tag == 'replace' else 0):i2] if tag in ('delete', 'replace') else []:
            out.append(('step-removed', ('steps',), step_key(step), None))
        for step in new[j1 + (i2 - i1 if tag == 'replace' else 0):j2] if tag in ('insert', 'replace') else []:
            out.append(('step-added', ('steps',), None, step_key(step)))


def tier(kind: str, path: str) -> str:
    if kind in ('removed', 'step-removed') or 'text_ref' in path and kind != 'added':
        return 'risky'
    if kind == 'changed' and path.rsplit('.', 1)[-1] in {'text', 'text_jp', 'speaker', 'source_text'}:
        return 'risky'
    if kind == 'added':
        return 'review' if path.endswith('text_ref') else 'safe'
    return 'review'


def voice_playback(pairs: list[list], compiled: Path) -> list[list]:
    if not pairs:
        return []
    result = subprocess.run(
        ['node', '--input-type=module', '-e', PLAYBACK, str(ROOT / 'src/utils/AssetResolver.js'),
         str(compiled.parents[1] / 'assets' / 'voice')],
        input=json.dumps(pairs), capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)


def short(value):
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= 80 else text[:77] + '...'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--examples', type=int, default=3)
    args = parser.parse_args()
    ledger = json.loads((args.candidate / 'ledger.json').read_text(encoding='utf-8'))
    compiled = Path(ledger['compiled_dir'])
    occurrences, files, examples = Counter(), defaultdict(set), defaultdict(list)
    voices = []
    identical = changed = missing = 0

    def record(key, file, example):
        occurrences[key] += 1
        files[key].add(file)
        if len(examples[key]) < args.examples:
            examples[key].append(f'{file}: {example}')

    for row in ledger['files']:
        for file in row.get('artifacts', {}):
            published = compiled / file
            if not published.is_file():
                missing += 1
                record(('new-file', ''), file, '')
                continue
            old = json.loads(published.read_bytes())
            new = json.loads((args.candidate / 'candidates' / file).read_bytes())
            out = []
            walk(old, new, (), out)
            diffs = [d for d in out if d[1] not in IGNORED]
            if not diffs:
                identical += 1
                continue
            changed += 1
            for kind, path, before, after in diffs:
                key = (kind, '.'.join(path).replace('.[]', '[]'))
                if key == ('changed', VOICE_PATH):
                    voices.append((file, before, old.get('scenario_id'), after, new.get('scenario_id')))
                else:
                    record(key, file, f'{short(before)} -> {short(after)}')

    played = voice_playback([[b, sb, a, sa] for _, b, sb, a, sa in voices], compiled)
    for (file, before, _, after, _), (plays_before, plays_after) in zip(voices, played):
        outcome = ('same-file' if plays_before else 'silent') if plays_before == plays_after else (
            'now-plays' if not plays_before else 'now-silent' if not plays_after else 'other-file')
        record(('voice:' + outcome, VOICE_PATH), file, f'{before} ({plays_before}) -> {after} ({plays_after})')

    def field_tier(kind, path):
        if kind.startswith('voice:'):
            return 'safe' if kind == 'voice:same-file' else 'risky'
        return 'new-file' if kind == 'new-file' else tier(kind, path)

    fields = [
        {'tier': field_tier(kind, path), 'kind': kind, 'path': path, 'occurrences': count,
         'files': len(files[(kind, path)]), 'examples': examples[(kind, path)]}
        for (kind, path), count in sorted(occurrences.items(), key=lambda item: (-len(files[item[0]]), -item[1]))
    ]
    tiers = {}
    for name in ('safe', 'review', 'risky', 'new-file'):
        picked = [f for f in fields if f['tier'] == name]
        tiers[name] = {'fields': len(picked), 'files': len(set().union(set(), *[files[(f['kind'], f['path'])] for f in picked]))}
    report = {
        'summary': {'artifacts': identical + changed + missing, 'identical': identical, 'changed': changed,
                    'new_files': missing, 'tiers': tiers, 'ledger': ledger['summary']},
        'fields': fields,
    }
    (args.candidate / 'diff-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['summary'], ensure_ascii=False))
    for name in ('risky', 'review', 'safe'):
        for field in [f for f in fields if f['tier'] == name][:30]:
            print(f"{name:6s} {field['files']:5d} files {field['occurrences']:7d}x {field['kind']:15s} {field['path']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
