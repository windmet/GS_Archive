"""Add bounded RAW-proven phone fork/join metadata without rewriting text units.

Uses an explicit extracted scenariodata directory and explicit compiled inputs.
Writes candidates only; caller reviews and promotes them separately.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path


def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def derive(compiled, raw_root):
    result = copy.deepcopy(compiled)
    result.pop('reading_control_flow', None)
    base = (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode()
    steps = result['steps']
    forks = []
    for choice_index, choice in enumerate(steps):
        if choice['type'] != 'choice' or len(choice.get('options', [])) < 2:
            continue
        refs = [o.get('text_ref', {}).get('source', {}) for o in choice['options']]
        part = refs[0].get('part_id')
        if not part or any(r.get('part_id') != part for r in refs):
            continue
        path = raw_root / f'scenario_{part}.json'
        data = path.read_bytes()
        commands = json.loads(data)['Command']
        indices = [r['command_index'] for r in refs]
        if any(commands[i]['Type'] != 'phone_select' or commands[i]['Values'][:2] != [o['label'], o['text']]
               for i, o in zip(indices, choice['options'])):
            continue
        labels = {}
        for i, cmd in enumerate(commands):
            if cmd['Type'] == 'jump_point':
                label = cmd['Values'][0]
                if label in labels:
                    raise ValueError('Repeated RAW label: ' + label)
                labels[label] = i

        def walk(label):
            i = labels[label]
            seen, texts = set(), []
            while i < len(commands):
                if i in seen:
                    raise ValueError('Cyclic branch')
                seen.add(i)
                cmd = commands[i]
                if cmd['Type'] == 'phone_end':
                    return texts
                if cmd['Type'] == 'jump':
                    target = labels[cmd['Values'][0]]
                    if target <= i:
                        raise ValueError('Non-forward jump')
                    i = target
                    continue
                if cmd['Type'] == 'phone_text':
                    texts.append(i)
                elif cmd['Type'] == 'se' and cmd['Values'][0] == 'phone_off':
                    pass
                elif cmd['Type'] not in {'jump_point', 'wait', 'voice', 'phone_voice'}:
                    raise ValueError('Unsupported branch command: ' + cmd['Type'])
                i += 1
            raise ValueError('No explicit phone_end')

        paths = [walk(o['label']) for o in choice['options']]
        shared = set(paths[0]).intersection(*map(set, paths[1:]))
        if not shared:
            raise ValueError('No common branch join')
        join_command = next(i for i in paths[0] if i in shared)
        suffix = paths[0][paths[0].index(join_command):]
        if any(p[p.index(join_command):] != suffix for p in paths):
            raise ValueError('Conflicting joins')
        by_command = {}
        for i, s in enumerate(steps):
            r = s.get('dialogue', {}).get('text_ref', {}).get('source', {})
            if r.get('part_id') == part:
                by_command[r['command_index']] = i
        join_index = by_command[join_command]
        branches = []
        for i, p in enumerate(paths):
            exclusive = p[:p.index(join_command)]
            positions = [by_command[c] for c in exclusive]
            if not positions or steps[positions[0]]['step_id'] != choice['options'][i]['step_id']:
                raise ValueError('Compiled entry differs from RAW')
            for cmd_index, position in zip(exclusive, positions):
                if steps[position]['dialogue']['text'] != commands[cmd_index]['Values'][1]:
                    raise ValueError('Compiled text differs from RAW')
            branches.append({'option_index': i, 'label': choice['options'][i]['label'],
                'step_indices': positions, 'exit_index': positions[-1], 'command_indices': exclusive})
        forks.append({'choice_index': choice_index, 'choice_step_id': choice['step_id'],
            'join_index': join_index, 'join_step_id': steps[join_index]['step_id'],
            'source_file': refs[0]['file'], 'raw_sha256': digest(data),
            'choice_commands': indices, 'join_command': join_command, 'branches': branches})
    if forks:
        result['reading_control_flow'] = {'version': 1, 'base_compiled_sha256': digest(base), 'forks': forks}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-scenario-root', type=Path, required=True)
    parser.add_argument('--compiled', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.resolve() == args.compiled.resolve():
        raise ValueError('Candidate output must differ from input')
    candidate = derive(json.loads(args.compiled.read_text('utf-8')), args.raw_scenario_root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'file': str(args.out), 'forks': len(candidate.get('reading_control_flow', {}).get('forks', []))}))
