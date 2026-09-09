"""Audio state commands independent of compiler sessions and resource lookup."""
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
        clear_bgm = True
    else:
        state.stop_bgm()
        clear_bgm = True
    changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _bgm_stop(state, vals, safe_float):
    """BGM stop with optional fade duration.
    Values: [fade_duration?, ...]
    """
    changed = clear_bgm = clear_ambient = False
    fade = float(vals[0]) if vals and vals[0] else 0
    state.stop_bgm()
    clear_bgm = True
    state.bgm_stop_fade = fade
    changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _se(state, vals, safe_float):
    """Sound effect — one-shot audio.
    Values: [cue_name, delay?, ...]
    """
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0]:
        event = {"cue": vals[0]}
        if len(vals) > 1 and vals[1]:
            event["delay"] = safe_float(vals[1], 0.0)
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
    """Looping ambient audio — crossfades from previous.
    Values: [main_cue, fade_cue?, ..., volume?, state?, ...]
    vals[0]=main_cue, vals[1]=crossfade_to_cue, vals[3]=volume
    """
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0]:
        env = {"cue": vals[0]}
        if len(vals) > 3 and vals[3]:
            try:
                env["volume"] = float(vals[3])
            except ValueError:
                env["volume"] = None
        state.environmental = env
        clear_ambient = True
        changed = True
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


def _environmental_stop(state, vals, safe_float):
    """Stop ambient with fade.
    Values: [fade_seconds, ...]
    """
    changed = clear_bgm = clear_ambient = False
    state.environmental = None
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
    """Duck/attenuate environmental audio.
    Values: [target_volume?, ...] — 0=full duck (mute), 0.5=half volume.
    Sets environmental_duck_target on state (one-shot, consumed by next snapshot).
    """
    changed = clear_bgm = clear_ambient = False
    if vals and vals[0]:
        try:
            state.environmental_duck_target = float(vals[0])
            changed = True
        except ValueError:
            pass
    return AudioCommandEffect(changed, clear_bgm, clear_ambient)


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
