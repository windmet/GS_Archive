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
    """Values: [cueSheet, cueName, startTime]. 'no_bgm' stops the music.

    An empty cue sheet never reaches here: apply_audio_state_command substitutes the
    current background's BGM or drops the command (StoryView.PlayView).
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

    An empty cue sheet is resolved to the background's ambience before this runs.
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

_BACKGROUND_DEFAULTS = {'bgm': 'bgm', 'environmental': 'ambient'}


def apply_audio_state_command(state, command, values, safe_float, background_audio=None):
    """Apply one command. `background_audio` is the current background's available
    {'bgm': cue, 'ambient': cue}: client StoryView.PlayView plays it for a bgm or
    environmental row with an empty cue sheet, and does nothing when it has none.
    The background change itself never touches audio."""
    kind = _BACKGROUND_DEFAULTS.get(command)
    if kind and not (values and values[0]):
        cue = (background_audio or {}).get(kind)
        if not cue:
            return AudioCommandEffect()
        values = [cue, *list(values or [])[1:]]
    return _HANDLERS[command](state, values, safe_float)


# Compile units with no bgm (or no environmental) row keep the archive's background-
# default rule for that channel: their audio comes from the calling screen or from a
# non-StoryView playback path (card/idol communications, home stories) not analysed yet.
def apply_unscripted_background_bgm(state, cue, inherited, audio_exists):
    """Preserve explicit music; replace or stop background-owned music."""
    if audio_exists('bgm', cue) and (not state.bgm or inherited):
        state.set_bgm(cue)
        return True
    if inherited and not audio_exists('bgm', cue):
        state.stop_bgm()
        return False
    return inherited


def apply_unscripted_background_ambient(state, cue, inherited, audio_exists):
    """Preserve explicit ambience and its volume until background-owned."""
    if audio_exists('ambient', cue) and (not state.environmental or inherited):
        state.environmental = {'cue': cue}
        return True
    if inherited and not audio_exists('ambient', cue):
        state.environmental = None
        return False
    return inherited


def authors_story_audio(raw_data_list, command_type):
    """True when any part has a `command_type` row ('bgm' or 'environmental').

    BGM and ambience are decided separately: a scenario without any bgm row plays
    whatever the previous screen left playing (event/season/birthday views call
    SoundManager.PlayBgmIfDifferent), which is approximated by the background default
    until that menu context is mapped from masterdata."""
    return any(cmd.get("Type") == command_type
               for data in raw_data_list for cmd in (data or {}).get("Command", []) or [])
