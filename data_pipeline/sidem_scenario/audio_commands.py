"""Audio state commands independent of compiler sessions and resource lookup.

Column meanings follow the client's SoundCommandData.SetCommandData (2.6.10 decompile,
see web_viewer/.analysis/ghidra-il2cpp/scenario_command_columns.json):
  bgm [cueSheet, cueName, startTime]          bgm_stop [startTime]
  se [cue, startTime, volume=1.0, "loop", acb]
  environmental [cueSheet, cueName, "loop", startTime, "on"=duckingCompleted]
  environmental_stop [startTime]              environmental_ducking [startTime]
Times are waits from the cut start (StoryView.WaitSound), not fade durations or volumes.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class AudioCommandEffect:
    changed: bool = False
    clear_bgm_inheritance: bool = False
    clear_ambient_inheritance: bool = False


def _bgm(state, vals, safe_float):
    """Values: [cue_id, ...] — empty vals means stop.
    'no_bgm' is a special keyword meaning no BGM should play.
    """
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0] and vals[0] != 'no_bgm':
        state.set_bgm(vals[0])
        state.bgm_delay = _optional_time(vals, 2, safe_float)
        clear_bgm = True
    else:
        state.stop_bgm()
        clear_bgm = True
    changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _bgm_stop(state, vals, safe_float):
    """Stop BGM after vals[0] seconds (StopBGMCoroutine: WaitSound(time), StopBgm)."""
    changed = clear_bgm = clear_ambient = False
    state.stop_bgm()
    clear_bgm = True
    state.bgm_stop_delay = _optional_time(vals, 0, safe_float)
    changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _optional_time(vals, index, safe_float):
    if len(vals) > index and vals[index] not in (None, ''):
        value = safe_float(vals[index], 0.0)
        return value if value > 0 else None
    return None


def _se(state, vals, safe_float):
    """Sound effect. Values: [cue, startTime, volume (default 1.0), "loop", acb]."""
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0]:
        event = {"cue": vals[0]}
        if len(vals) > 1 and vals[1]:
            event["delay"] = safe_float(vals[1], 0.0)
        if len(vals) > 2 and vals[2] not in (None, ''):
            event["volume"] = safe_float(vals[2], 1.0)
        state.se = event
        state.se_events.append(event)
        changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _se_stop(state, vals, safe_float):
    """Stop SE playback (not commonly used, but supported)."""
    changed = clear_bgm = clear_ambient = False
    state.se = None
    state.se_events = []
    changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _environmental(state, vals, safe_float):
    """Ambience. Values: [cueSheet, cueName, "loop", startTime, "on"=duckingCompleted].

    A row without a cue sheet is left as-is: the client's handling of an empty sheet is
    in CoPlayAmbienceSound and is not modelled yet.
    """
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0]:
        env = {"cue": vals[0]}
        if len(vals) > 1 and vals[1]:
            env["cue_name"] = vals[1]
        if len(vals) > 2 and vals[2] == "loop":
            env["loop"] = True
        delay = _optional_time(vals, 3, safe_float)
        if delay is not None:
            env["delay"] = delay
        if len(vals) > 4 and vals[4] == "on":
            env["ducking_completed"] = True
        state.environmental = env
        clear_ambient = True
        changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _environmental_stop(state, vals, safe_float):
    """Stop ambience after vals[0] seconds (StopAmbienceCoroutine: WaitSound(time))."""
    changed = clear_bgm = clear_ambient = False
    state.environmental = None
    state.environmental_stop_delay = _optional_time(vals, 0, safe_float)
    clear_ambient = True
    changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _environmental_volume(state, vals, safe_float):
    """Set ambient volume directly.
    Values: [volume?, ...]
    """
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0]:
        try:
            vol = float(vals[0])
            if state.environmental:
                state.environmental["volume"] = vol
                changed = True
        except ValueError:
            pass
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _environmental_ducking(state, vals, safe_float):
    """Duck ambience after vals[0] seconds. vals[0] is a time, not a target volume;
    the ducked level comes from StoryView's serialized curves (not extracted yet)."""
    state.environmental_ducking_delay = _optional_time(vals, 0, safe_float) or 0.0
    return AudioCommandEffect(changed=True)


_HANDLERS = {
    'bgm': _bgm,
    'bgm_stop': _bgm_stop,
    'se': _se,
    'se_stop': _se_stop,
    'environmental': _environmental,
    'environmental_stop': _environmental_stop,
    'environmental_volume': _environmental_volume,
    'environmental_ducking': _environmental_ducking,
}

def apply_audio_state_command(state, command, values, safe_float):
    return _HANDLERS[command](state, values, safe_float)


def apply_background_bgm(state, cue, inherited, audio_exists):
    """Preserve explicit music; replace or stop background-owned music."""
    if audio_exists('bgm', cue) and (not state.bgm or inherited):
        state.set_bgm(cue)
        return True
    if inherited and not audio_exists('bgm', cue):
        state.stop_bgm()
        return False
    return inherited


def apply_background_ambient(state, cue, inherited, audio_exists):
    """Preserve explicit ambience and its volume until background-owned."""
    if audio_exists('ambient', cue) and (not state.environmental or inherited):
        state.environmental = {'cue': cue}
        return True
    if inherited and not audio_exists('ambient', cue):
        state.environmental = None
        return False
    return inherited
