"""Effective vocabulary parity and dispatch ordering without scene resources."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from sidem_scenario import ScenarioCompiler, ScenarioState
from sidem_scenario.commands import COMMAND_HANDLERS, SELECTION_COMMANDS

baseline = json.loads((ROOT/'fixtures/story-runtime/command-dispatch-baseline.json').read_text())
assert dict(COMMAND_HANDLERS) == baseline
try:
    COMMAND_HANDLERS['image_icon'] = None
except TypeError:
    pass
else:
    raise AssertionError('shared vocabulary must be immutable')

for command, handler in [*baseline.items(), ('unknown_fixture', None), ('', None)]:
    compiler = object.__new__(ScenarioCompiler)
    compiler._pending_selection = True
    compiler._current_command_index = -1
    calls = []
    compiler._flush_selection = lambda: calls.append(('flush', compiler._current_raw_type, compiler._current_command_index))
    values = ['fixture', None, 7]
    if handler:
        assert callable(getattr(ScenarioCompiler, handler))
        setattr(compiler, handler, lambda received: calls.append(('handler', received)))
    compiler._process({'Type': command, 'Values': values}, 12)
    expected = [] if command in SELECTION_COMMANDS else [('flush', command, 12)]
    if handler:
        expected.append(('handler', values))
        assert calls[-1][1] is values
    assert calls == expected, command

compiler = object.__new__(ScenarioCompiler)
compiler._pending_selection = False
compiler._current_command_index = 9
received = []
compiler._image_icon = received.append
compiler._process({'Type': 'image_Icon'})
assert received == [[]]
assert compiler._current_command_index == 9
compiler._image_icon = None
compiler._process({'Type': 'image_icon'})
assert received == [[]]
assert COMMAND_HANDLERS['image_icon'] == '_image_icon'
print(f'Command vocabulary: {len(baseline)} frozen mappings, aliases, no-ops, unknowns, flush order, parameter identity and late handler binding passed')

# effect_bgstart follows the client's EffectCommandData: [effectName, startTime, alpha].
def bgstart(values, prior=None):
    compiler = object.__new__(ScenarioCompiler)
    compiler.state = ScenarioState()
    compiler.state.bg_effects = [dict(prior)] if prior else []
    compiler._pending_bg_effect_end_ids = set()
    compiler._extend_pending_text_disable_duration = lambda seconds: extended.append(seconds)
    compiler._mark_stage_change = lambda: None
    compiler._safe_float = ScenarioCompiler._safe_float
    compiler._effect_bgstart(values)
    return compiler.state.bg_effects
extended = []
assert bgstart(['cameraflare', '0.5', '0.6']) == [{'id': 'cameraflare', 'visible': True, 'action': 'start', 'delay': 0.5, 'duration': 0.0, 'alpha': 0.6}]
assert extended == [0.5], 'alpha is not a duration and cannot extend the text-disable window'
assert bgstart(['cameraflare', '', '']) == [{'id': 'cameraflare', 'visible': True, 'action': 'start', 'delay': 0.0, 'duration': 0.0}]
assert bgstart(['cameraflare', '0', '-1'])[0].get('alpha') is None, 'negative alpha defers to the background lightAlpha'
assert 'alpha' not in bgstart(['fx_adv_rain', '0', ''], {'id': 'fx_adv_rain', 'visible': False, 'alpha': 0.3})[0]
print('effect_bgstart: client [effectName, startTime, alpha] with no fade-in passed')
