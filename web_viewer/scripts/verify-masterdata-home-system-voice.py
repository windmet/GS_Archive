"""Home stand projection: ScriptName names the script, ScriptLabel its jump point (a step_id)."""
import copy
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata import home_system_voice as module
from sidem_masterdata.home_system_voice import build_home_system_voice_index, jump_step, script_file, system_scenario


def scenario(name, label, **fields):
    payload = {'1': name, '2': label, '3': 1, '4': 12, '5': '00:00:00', '6': '00:00:00', '13': 1, '14': 500}
    payload.update(fields)
    return payload


def verify():
    # The jump point holds a step_id; step ids start at 1, so it is not a list index.
    script = {'scenario_id': 'x', 'jump_points': {'3_1_001_00': 2, '3_1_001_01': 3},
              'steps': [{'step_id': 1, 'type': 'fadeout'},
                        {'step_id': 2, 'type': 'adv', 'dialogue': {'voice': '3_1_001_00.m4a', 'text': 'A'}, 'state': {}},
                        {'step_id': 3, 'type': 'adv', 'dialogue': {'voice': '3_1_001_01.m4a', 'text': 'B'}, 'state': {}}]}
    assert jump_step(script, '3_1_001_01')[1]['dialogue']['text'] == 'B'
    assert jump_step(script, 'absent') == (None, None)
    # ScriptName must resolve to one stem; a second stem ending the same way is ambiguous.
    assert script_file('3_1_001', {'3_x_001tom_3_1_001', '1_2_001tom_01'}) == '3_x_001tom_3_1_001.json'
    assert script_file('3_1_001', {'a_3_1_001', 'b_3_1_001'}) is None
    assert system_scenario({'1': 'n'})['param2'] == 0 and system_scenario({})['open_time'] == ''

    tables = {
        2: [], 24: [],
        90: [{'1': 1, '2': 1, '3': scenario('3_1_001', '3_1_001_00'), '_offset': 10},
             {'1': 2, '2': 1, '3': scenario('3_1_001', '3_1_001_01', **{'3': 12, '4': 2, '5': '19:00:00', '6': '02:00:00', '14': 450})},
             {'1': 3, '2': 1, '3': scenario('3_1_001', '3_1_001_01', **{'13': 4})}],
        91: [{'1': 7, '2': 1001, '3': 2, '4': scenario('2_1_001_01_00', '2_1_001_01_00_01', **{'15': 1})},
             {'1': 8, '2': 1001, '4': scenario('2_1_001_01_00', '2_1_001_01_00_01', **{'13': 2})}],
    }
    before = copy.deepcopy(tables)
    with patch.object(module, 'load_scenario_payloads', return_value={'3_x_001tom_3_1_001.json': script}) as loader:
        result = build_home_system_voice_index(tables, Path('compiled'), {'3_x_001tom_3_1_001'},
                                               {'by_numeric_id': {'1': {'idol_code': '001tom', 'display_name': 'Idol'}}})
    assert tables == before
    assert loader.call_args.args[1] == ['3_x_001tom_3_1_001.json']
    rows = result['idols'][0]['scenarios']
    assert [row['script_label'] for row in rows] == ['3_1_001_00', '3_1_001_01'], 'only HomeStand rows in the home pool'
    # The IdolDetail row is the profile view's self-introduction, kept apart from the home pool.
    assert [row['id'] for row in result['idols'][0]['idol_detail']] == [3] and result['meta']['idol_detail_count'] == 1
    assert rows[1]['voice'] == '3_1_001_01.m4a' and rows[1]['jump_step_id'] == 3
    assert (rows[1]['open_month'], rows[1]['close_month'], rows[1]['close_time'], rows[1]['param1']) == (12, 2, '02:00:00', 450)
    assert result['idols'][0]['idol_code'] == '001tom' and rows[0]['_source']['offset'] == 10
    card = result['card_home_stand']['1001']
    assert len(card) == 1 and card[0]['override_idol_system_scenario_id'] == 2 and card[0]['param2'] == 1
    assert result['meta']['idol_type_counts'] == {'1': 2, '4': 1} and result['meta']['card_type_counts'] == {'1': 1, '2': 1}
    assert result['meta']['unresolved_count'] == 0

    # A label whose jump point lands on another voice is reported, never published as that voice.
    broken = copy.deepcopy(script)
    broken['jump_points']['3_1_001_01'] = 2
    with patch.object(module, 'load_scenario_payloads', return_value={'3_x_001tom_3_1_001.json': broken}):
        failed = build_home_system_voice_index(tables, None, {'3_x_001tom_3_1_001'}, {})
    assert failed['meta']['unresolved_count'] == 2 and {row['voice'] for row in failed['unresolved']} == {'3_1_001_00.m4a'}


if __name__ == '__main__':
    verify()
    print('Masterdata home system voice: script/jump-point resolution, HomeStand filters, card override and Param2, unresolved reporting passed')
