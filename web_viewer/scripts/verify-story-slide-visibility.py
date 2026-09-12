"""RAW command visibility transitions, independently of browser asset loading."""
from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'data_pipeline'))
from sidem_scenario import ScenarioCompiler

compiler = ScenarioCompiler({'Command': []}, 'slide-visibility')
for actor in ('040ren', '038tak'):
    compiler.state.spawn_spine(actor, f'{actor}_002_00')
compiler.state.set_spine_visible('038tak', True)
compiler._idol_position(['040ren', '-400', '0'])
compiler._idol_slide(['040ren', '0', '0.2', '-200', '0'])
assert not compiler.state.find_spine('040ren')['visible'], 'ordinary move cannot resurrect hidden actor'
compiler._idol_fadein(['040ren', '0', '0.2'])
compiler._idol_fadeout(['040ren', '0', '0.3'])
compiler._emit_step('stage', None, None, None, None)
assert not compiler.state.find_spine('040ren')['visible']
compiler._process({'Type': 'idol_slidein', 'Values': ['040ren', '0.3', '0.2', '-200', '0']}, 132)
roster = compiler.state.snapshot()['spines']
assert {actor['id'] for actor in roster} == {'040ren', '038tak'}
assert compiler.state.find_spine('040ren')['pos_x'] == -200
compiler._emit_step('stage', None, None, None, None)
assert compiler.state.find_spine('040ren')['visible'], 'entry persists after settlement'
compiler._process({'Type': 'idol_slideout', 'Values': ['040ren', '0', '0.2', '-500', '0']}, 140)
assert compiler.state.find_spine('040ren')['visible'], 'exit remains in transition snapshot'
compiler._emit_step('stage', None, None, None, None)
assert not compiler.state.find_spine('040ren')['visible'], 'exit disappears from later snapshots'
compiler._idol_fadeout(['040ren', '0', '0.2'])
compiler._idol_slidein(['040ren', '0', '0.2', '-200', '0'])
compiler._emit_step('stage', None, None, None, None)
assert compiler.state.find_spine('040ren')['visible'], 'entry supersedes pending exit'
assert compiler.state.find_spine('038tak')['visible'], 'another actor is never replaced'
print('Slide visibility verified: move/in/out distinction, fadeout then reentry, settlement and roster preservation')

if '--published' in sys.argv:
    root = Path(__file__).resolve().parents[1] / 'public/data/compiled'
    aggregate = json.loads((root / '1_1_013the_03_1_1_013_03.json').read_text(encoding='utf-8'))
    for part, first, last in [('e', 30, 36), ('f', 15, 16)]:
        episode = json.loads((root / f'episodes/1_1_013_03_{part}.json').read_text(encoding='utf-8'))
        group = [step for step in aggregate['steps'] if step.get('episode_part') == part]
        for index, step in enumerate(episode['steps']):
            assert step['state']['spines'] == group[index]['state']['spines']
            if first <= index + 1 <= last:
                actors = {actor['id']: actor['pos_x'] for actor in step['state']['spines']}
                assert actors == {'040ren': -200, '038tak': 200}, (part, index + 1)
    f = json.loads((root / 'episodes/1_1_013_03_f.json').read_text(encoding='utf-8'))
    assert {actor['id'] for actor in f['steps'][26]['state']['spines']} == {'040ren', '038tak'}
    assert all(actor['fade']['type'] == 'in' for actor in f['steps'][26]['state']['spines'])
    print('Published e/f verified: exact failing beats, aggregate parity, unchanged two-person fadein control')
