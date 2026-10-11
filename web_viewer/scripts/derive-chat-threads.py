"""Project RAW talk_start/end identity onto an explicit compiled candidate."""
import argparse
import copy
import hashlib
import json
from pathlib import Path


def derive(compiled, raw_root, dictionary, dictionary_hash):
    result = copy.deepcopy(compiled)
    units = {str(u['unit_id']): u['unit_code'] for u in dictionary['units']}
    parts = {}
    for step in result['steps']:
        ref = step.get('dialogue', {}).get('text_ref') or next((o.get('text_ref') for o in step.get('options', []) if o.get('text_ref')), None)
        source = (ref or {}).get('source', {})
        part, index = source.get('part_id'), source.get('command_index')
        if part is None or index is None or step['type'] not in {'talk', 'talk_stamp', 'choice'}:
            continue
        if part not in parts:
            data = (raw_root / f'scenario_{part}.json').read_bytes()
            parts[part] = (json.loads(data)['Command'], 'sha256:' + hashlib.sha256(data).hexdigest())
        commands, raw_hash = parts[part]
        thread = None
        for i, command in enumerate(commands[:index + 1]):
            if command['Type'] == 'talk_end':
                thread = None
            elif command['Type'] == 'talk_start':
                values = command['Values']
                kind = {'1': 'private', '2': 'group'}.get(values[0])
                if kind is None:
                    thread = None
                    continue
                thread = {'id': f'{part}:talk-{i}', 'kind': kind,
                    'unit_code': units.get(values[1]) if kind == 'group' else None,
                    'contact_id': None, 'provenance': {'kind': 'raw-talk-start',
                    'source_file': source['file'], 'command_index': i, 'values': values[:2],
                    'raw_sha256': raw_hash, 'dictionary_sha256': dictionary_hash}}
        if thread:
            step.setdefault('presentation_context', {})['thread'] = thread
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['raw-scenario-root', 'compiled', 'dictionary', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.out.resolve() == args.compiled.resolve():
        raise ValueError('Candidate output must differ from input')
    data = args.dictionary.read_bytes()
    result = derive(json.loads(args.compiled.read_text('utf-8')), args.raw_scenario_root,
                    json.loads(data), 'sha256:' + hashlib.sha256(data).hexdigest())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Thread identities projected from RAW; text references retained')
