"""Regression for group-scope dedup, carried scene, identities and local choices."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('groups', ROOT / 'scripts/recompile-mounted-story-groups.py')
groups = importlib.util.module_from_spec(spec); spec.loader.exec_module(groups)

def record(part, commands):
    return {'name': 'scenario_' + part, 'container_path': f'assets/resources/scenariodata/fixture/scenario_{part}.json',
            'payload': json.dumps({'Command': [{'Type': kind, 'Values': values} for kind, values in commands]}).encode()}

records = [record('fixture_a', [('text_synopsis',['Shared','Intro']), ('text_title',['Chapter','Title']),
                              ('image_bg',['bg_a']), ('text',['Actor','First'])]),
           record('fixture_b', [('text_synopsis',['Shared','Intro']), ('text',['Actor','Second'])]),
           record('fixture_c', [('text_synopsis',['Different','New intro']), ('text_title',['Next','Keep title']),
                              ('text',['Actor','Third'])])]
parent = {'scenario_id':'fixture_group', 'episodes':[{'source_scenario_id':f'fixture_{p}'} for p in 'abc']}
source = {'raw_path':'RAW/asset/scenario_fixture.unity3d','raw_hash':'sha256:'+'1'*64}
with tempfile.TemporaryDirectory() as directory:
    for name in ['LIPSYNC_ROOT','ADV_BACKGROUND_ROOT','AUDIO_ROOT']:
        setattr(groups.ScenarioCompiler,name,directory)
    aggregate, episodes = groups.compile_group_candidates(records,parent,source)
    assert sum(s['type']=='synopsis' for s in aggregate['steps']) == 2
    assert episodes['fixture_b']['steps'][0]['type']=='adv', 'repeated synopsis must not be reintroduced'
    assert episodes['fixture_b']['steps'][0]['entry_snapshot']['bg']=='bg_a', 'group scene carryover must survive split'
    assert episodes['fixture_c']['steps'][0]['type']=='synopsis', 'different synopsis must not be deleted'
    assert any(s['type']=='title' for s in episodes['fixture_c']['steps']), 'formal title remains a distinct step'
    for sid, episode in episodes.items():
        assert episode['scenario_id']==sid and episode['text_catalog_id']=='fixture_group'
        assert [s['step_id'] for s in episode['steps']]==list(range(1,len(episode['steps'])+1))
        for step in episode['steps']:
            assert step['episode_index']==0
            assert step['evidence']['source_part_id']==sid
            for key in ('text_ref','speaker_text_ref'):
                ref=step.get('dialogue',{}).get(key)
                if ref:
                    assert ref['source']['part_id']==sid
                    assert ref['source']['file'].endswith(f'/scenario_{sid}.json')
    # Independent b demonstrably differs; do not fix the Reader with rows.slice(2).
    isolated=groups.ScenarioCompiler(json.loads(records[1]['payload']),'fixture_group','fixture_b',records[1]['container_path']).compile()
    assert isolated['steps'][0]['type']=='synopsis'
    for bad in (records[:2], list(reversed(records))):
        try: groups.compile_group_candidates(bad,parent,source)
        except ValueError: pass
        else: raise AssertionError('partial or reordered group must be rejected')

scenario={'scenario_id':'fixture','steps':[{'step_id':1,'type':'adv'},
    {'step_id':2,'type':'choice','options':[{'step_id':3,'text_ref':{'unit_id':'source-stays'}}]}, {'step_id':3,'type':'adv'}],
    'episodes':[{'source_scenario_id':'fixture_b','start_step_index':1,'end_step_index':2,'start_step_id':2,'end_step_id':3}],
    'jump_points':{'branch':3}}
episode=groups.migration.split_episodes(scenario)['fixture_b']
assert episode['steps'][0]['options'][0]['step_id']==2
assert episode['steps'][0]['options'][0]['text_ref']['unit_id']=='source-stays'
assert episode['jump_points']['branch']==2
bad=copy.deepcopy(scenario);bad['steps'][1]['options'][0]['step_id']=1
try: groups.migration.split_episodes(bad)
except ValueError: pass
else: raise AssertionError('cross-episode target must not be guessed')
print('Mounted group regressions passed: dedup, distinct synopsis/title, scene carryover, RAW refs, complete order and rebased/blocked choices')
