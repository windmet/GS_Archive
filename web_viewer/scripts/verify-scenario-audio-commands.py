"""Compare audio transitions, exceptions and session effects to the old handlers."""
import copy
from pathlib import Path
import runpy
import sys
from itertools import product
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from sidem_scenario import ScenarioCompiler, ScenarioState
from sidem_scenario.audio_commands import apply_audio_state_command, AudioCommandEffect

Legacy = runpy.run_path(str(ROOT/'fixtures/story-runtime/legacy-audio-commands.py'))['LegacyAudioCommands']
names = ['bgm', 'bgm_stop', 'se', 'se_stop', 'environmental', 'environmental_stop',
         'environmental_volume', 'environmental_ducking']
inputs = [[], [''], [None], ['cue'], ['no_bgm'], ['0'], [0], ['0.5'], ['bad'],
          ['cue', '0.2'], ['cue', 'invalid'], ['cue', '', '', '0.25'], ['cue', '', '', 'invalid'],
          ['cue', '', '', {}]]
count = 0
for name in names:
    for values in inputs:
        for ambient in [None, {'cue': 'prior', 'volume': 0.7}]:
            observations = []
            for cls in [Legacy, ScenarioCompiler]:
                compiler = object.__new__(cls)
                compiler.state = ScenarioState()
                compiler.state.environmental = copy.deepcopy(ambient)
                compiler._bgm_from_advbackground = True
                compiler._environmental_from_advbackground = True
                marked = []
                compiler._mark_stage_change = lambda: marked.append(True)
                compiler._safe_float = ScenarioCompiler._safe_float
                arguments = copy.deepcopy(values)
                error = None
                try:
                    getattr(compiler, '_' + name)(arguments)
                except Exception as exc:
                    error = (type(exc).__name__, str(exc))
                observations.append((copy.deepcopy(vars(compiler.state)), marked,
                                     compiler._bgm_from_advbackground,
                                     compiler._environmental_from_advbackground, error))
                assert arguments == values
            assert observations[0] == observations[1], (name, values, ambient)
            count += 1

# The state module can run without constructing a compiler or loading resources.
state = ScenarioState()
effect = apply_audio_state_command(state, 'se', ['cue', '0.2'], lambda value, fallback: float(value))
assert effect == AudioCommandEffect(changed=True)
assert state.se == {'cue': 'cue', 'delay': 0.2}
print(f'Audio command boundary: {count} complete state/session/error parity cases and direct state-only application passed')

LegacyBackground = runpy.run_path(str(ROOT/'fixtures/story-runtime/legacy-audio-commands.py'))['LegacyBackgroundDefaults']
background_cases = 0
for has_metadata, has_bgm, has_ambient, bgm_owned, ambient_owned, bgm_available, ambient_available in product([False, True], repeat=7):
    outcomes = []
    for cls in [LegacyBackground, ScenarioCompiler]:
        compiler = object.__new__(cls)
        compiler.state = ScenarioState()
        compiler.state.bgm = 'prior-music' if has_bgm else None
        compiler.state.bgm_volume = 0.7
        compiler.state.environmental = {'cue': 'prior-rain', 'volume': 0.3} if has_ambient else None
        compiler._bgm_from_advbackground = bgm_owned
        compiler._environmental_from_advbackground = ambient_owned
        requests = []
        def available(kind, cue):
            requests.append((kind, cue))
            return bgm_available if kind == 'bgm' else ambient_available
        metadata = {'imageId': 'bg', 'bgmCueName': 'new-music', 'ambienceCueName': 'new-rain'}
        compiler.resources = SimpleNamespace(background_index=lambda: {'bg': metadata} if has_metadata else {}, audio_exists=available)
        compiler._apply_adv_background_defaults('bg')
        outcomes.append((copy.deepcopy(vars(compiler.state)), compiler._bgm_from_advbackground,
                         compiler._environmental_from_advbackground, requests))
    assert outcomes[0] == outcomes[1]
    background_cases += 1
print(f'Background audio: {background_cases} metadata/current/ownership/availability combinations preserve full state and lookup sequence')
