"""Wait-only cuts become holds on neighbouring steps (sidem_scenario/native_cuts.py).

Fixture-only: compiles inline RAW rows through the real ScenarioCompiler and
checks the holds against the client's cut segmentation.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from sidem_scenario import ScenarioCompiler
from sidem_scenario.native_cuts import is_cut_end, wait_seconds

# Cut boundaries from TextCommandData / EffectCommandData / JumpCommandData.GetCutEnd.
for command in ('text', 'talk_text', 'phone_text', 'text_title', 'wait', 'screen_fadein', 'screen_fadeout',
                'screen_fadecolor', 'jump', 'talk_start', 'talk_end', 'cut_end'):
    assert is_cut_end(command), command
for command in ('text_select', 'text_disable', 'image_icon', 'jump_point', 'image_bg', 'bgm', 'chara_motion',
                'screen_shake', 'voice_file'):
    assert not is_cut_end(command), command
assert wait_seconds(['0.5']) == 0.5 and wait_seconds([]) == 0.0 and wait_seconds(['']) == 0.0
assert wait_seconds(['bad']) == 0.0 and wait_seconds(['-1']) == 0.0


def text(body):
    return {'Type': 'text', 'Values': ['speaker', body, '', '']}


def wait(seconds):
    return {'Type': 'wait', 'Values': [str(seconds)]}


def holds(commands):
    steps = ScenarioCompiler({'Command': commands}, 'fixture').compile()['steps']
    return [(step.get('pre_wait'), step.get('post_wait')) for step in steps if step.get('dialogue')], steps


bg = {'Type': 'image_bg', 'Values': ['bg_fixture']}
# A wait after a line holds that line; consecutive waits add up.
got, _ = holds([bg, text('one'), wait(0.5), text('two'), wait(1), wait(0.25), text('three')])
assert got == [(None, 0.5), (None, 1.25), (None, None)], got
# A wait at the start of a part, or behind a jump label, holds before the next line.
got, _ = holds([wait(0.5), text('one'), {'Type': 'jump_point', 'Values': ['label']}, wait(2), wait(1), text('two')])
assert got == [(0.5, None), (3.0, None)], got
# A wait left at the end of a part holds the last line.
got, _ = holds([bg, text('one'), wait(0.5), {'Type': 'jump_point', 'Values': ['end']}, wait(1.5)])
assert got == [(None, 2.0)], got
# A wait that plays a stage change is that cut's own step, not a hold.
got, steps = holds([text('one'), bg, wait(0.5), text('two')])
got = [(step['type'], step.get('pre_wait'), step.get('post_wait')) for step in steps]
assert got == [('adv', None, None), ('stage', None, None), ('adv', None, None)], got
# A zero or bad wait is no hold.
got, _ = holds([bg, text('one'), wait(0), wait('bad'), text('two')])
assert got == [(None, None), (None, None)], got

# Talk messages hold the same way (the 2_3 chat scenes wait 2 s after each message).
talk = [{'Type': 'talk_start', 'Values': ['1', '1']}, {'Type': 'jump_point', 'Values': ['start']}, wait(0.5),
        {'Type': 'talk_text', 'Values': ['speaker', 'm1', '001tom', '0']}, wait(2),
        {'Type': 'talk_text', 'Values': ['speaker', 'm2', '001tom', '2']}, wait(3),
        {'Type': 'talk_end', 'Values': []}]
steps = ScenarioCompiler({'Command': talk}, 'fixture').compile()['steps']
got = [(step['type'], step.get('pre_wait'), step.get('post_wait')) for step in steps]
assert got == [('talk', 0.5, 2.0), ('talk', None, 3.0)], got

# Each part of a group starts its own cut list: a trailing wait stays in its part.
group = ScenarioCompiler.compile_group([
    {'Command': [bg, text('a1'), wait(0.75)]},
    {'Command': [wait(0.25), text('b1'), wait(0.5), text('b2')]},
], 'fixture_group')
got = [(step.get('pre_wait'), step.get('post_wait')) for step in group['steps'] if step.get('dialogue')]
assert got == [(None, 0.75), (0.25, 0.5), (None, None)], got
# The authoritative contract carries the holds through unchanged.
authoritative = ScenarioCompiler({'Command': [wait(0.5), text('one'), wait(1), text('two')]}, 'fixture').compile(
    output_contract='authoritative', source={'raw_path': 'fixture', 'raw_hash': 'sha256:' + 'a' * 64})
got = [(step.get('pre_wait'), step.get('post_wait')) for step in authoritative['steps']]
assert got == [(0.5, 1.0), (None, None)], got
print('Native cut waits: cut boundaries, post/pre holds, label and part edges passed')
