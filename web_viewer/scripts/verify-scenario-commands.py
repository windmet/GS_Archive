"""Effective vocabulary parity and dispatch ordering without scene resources."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from sidem_scenario import ScenarioCompiler
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
