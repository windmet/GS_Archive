"""Audit/apply only the compiler visibility delta to published chapter 3 e/f.

Compiled media is ignored by Git. Keep existing step numbering, text, voice,
episode boundaries and all non-roster fields; fail if the baseline has drifted.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_scenario import ScenarioCompiler


class BeforeVisibilityFix(ScenarioCompiler):
    _idol_slidein = ScenarioCompiler._idol_slide
    _idol_slideout = ScenarioCompiler._idol_slide


def repair(raw_dir, apply=False):
    compiled = ROOT / 'public/data/compiled'
    aggregate_path = compiled / '1_1_013the_03_1_1_013_03.json'
    aggregate = json.loads(aggregate_path.read_text(encoding='utf-8'))
    outputs = {}
    report = []
    for part in 'ef':
        raw_bytes = (raw_dir / f'scenario_1_1_013_03_{part}.json').read_bytes()
        raw = json.loads(raw_bytes)
        before = BeforeVisibilityFix(raw, f'1_1_013_03_{part}').compile()['steps']
        after = ScenarioCompiler(raw, f'1_1_013_03_{part}').compile()['steps']
        path = compiled / f'episodes/1_1_013_03_{part}.json'
        published = json.loads(path.read_text(encoding='utf-8'))
        group = [step for step in aggregate['steps'] if step.get('episode_part') == part]
        # Current compiler includes the raw synopsis omitted by this publication.
        if len(before) == len(published['steps']) + 1 and before[0]['type'] == 'synopsis':
            before, after = before[1:], after[1:]
        assert len(before) == len(after) == len(published['steps']) == len(group)
        changed = []
        for index, (old, new, episode, merged) in enumerate(zip(before, after, published['steps'], group)):
            for target in (episode, merged):
                assert old['type'] == new['type'] == target['type']
                assert old.get('dialogue', {}).get('text') == target.get('dialogue', {}).get('text')
                assert target['state']['spines'] in (old['state']['spines'], new['state']['spines']), (part, index)
                target['state']['spines'] = copy.deepcopy(new['state']['spines'])
            if old['state']['spines'] != new['state']['spines']:
                changed.append(index + 1)
        outputs[path] = published
        report.append({'part': part, 'raw_sha256': hashlib.sha256(raw_bytes).hexdigest(), 'steps': changed})
    outputs[aggregate_path] = aggregate
    if apply:
        for path, data in outputs.items():
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps({'applied': args.apply, 'changes': repair(args.raw_dir, args.apply)}, ensure_ascii=False, indent=2))
