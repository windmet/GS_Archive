"""Project ScenarioCompiler compatibility output into authoritative Runtime v2.

This is the Python implementation of the output contract.  It deliberately
accepts only compiler-shaped compatibility data and emits no legacy state,
timeline, or display-text aliases.  The JavaScript implementation remains an
independent oracle so the two implementations can be diffed in CI.
"""

from __future__ import annotations

import copy
import math
from typing import Any


def _clone(value: Any) -> Any:
    return copy.deepcopy(value)


def _required(value: Any, label: str) -> Any:
    if value is None or value == "":
        raise ValueError(f"{label} is required for authoritative v2 output")
    return value


def _finite_number(value: Any, fallback: float = 0) -> float | int:
    if value is None:
        return fallback
    if value == "":
        return 0
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if not math.isfinite(number):
        return fallback
    return int(number) if number.is_integer() else number


def _lifecycle(
    *,
    persistence: str = "stateful",
    skippable: bool = True,
    blocks_input: bool = False,
    blocks_auto: bool = True,
    restore_policy: str = "settled",
) -> dict[str, Any]:
    return {
        "persistence": persistence,
        "skippable": skippable,
        "blocks_input": blocks_input,
        "blocks_auto": blocks_auto,
        "restore_policy": restore_policy,
    }


def _stable_camera(camera: Any) -> Any:
    if not camera:
        return None
    result = _clone(camera)
    result["duration"] = 0
    result.pop("delay", None)
    return result


def _stable_screen_overlay(state: dict[str, Any]) -> tuple[bool, Any]:
    slide = state.get("screen_slide")
    if slide:
        if slide.get("type") == "in":
            return True, {
                "kind": "directional-wipe",
                "visible": True,
                "color": slide.get("color") or "#000000",
                "direction": str(slide.get("direction") or "6"),
            }
        return True, None
    fade = state.get("screen_fade")
    if fade:
        if fade.get("type") == "out":
            return True, {
                "kind": "fade",
                "visible": True,
                "color": fade.get("color") or "#000000",
                "alpha": _finite_number(fade.get("alpha"), 1),
            }
        return True, None
    effect = next(
        (
            value
            for value in reversed(state.get("screen_effects") or [])
            if value and value.get("type") in ("fadein", "fadeout")
        ),
        None,
    )
    if effect:
        if effect.get("type") == "fadein":
            return True, {
                "kind": "fade",
                "visible": True,
                "color": effect.get("color") or "#000000",
                "alpha": _finite_number(effect.get("alpha"), 1),
            }
        return True, None
    return False, None


def _strip_transient_state(state: Any) -> dict[str, Any]:
    settled = _clone(state or {})
    settled.update({
        "se": None,
        "se_events": [],
        "screen_fade": None,
        "screen_slide": None,
        "screen_effects": [],
        "bg_transition": None,
        "bg_dof_transition": None,
        "bg_color_transition": None,
        "bgm_stop_fade": None,
        "environmental_duck_target": None,
        "text_disabled": False,
        "camera_zoom": _stable_camera(settled.get("camera_zoom")),
    })
    for effect in settled.get("bg_effects") or []:
        for key in ("action", "delay", "duration"):
            effect.pop(key, None)
    for spine in settled.get("spines") or []:
        for key in ("fade", "idol_color_transition", "neck_anim", "neck_anim_stop"):
            spine.pop(key, None)
    return settled


def _apply_timeline(settled: dict[str, Any], timeline: Any) -> None:
    for event in timeline or []:
        spine = next(
            (item for item in settled.get("spines", []) if item.get("id") == event.get("chara_id")),
            None,
        )
        if not spine:
            continue
        event_type = event.get("type")
        if event_type == "spine_face":
            spine["face"] = event.get("value")
            if event.get("anim_flag"):
                spine["anim_flag"] = event["anim_flag"]
            if "blush_flag" in event:
                spine["blush_flag"] = event["blush_flag"]
            if "sweat_flag" in event:
                spine["sweat_flag"] = event["sweat_flag"]
        elif event_type == "spine_anim":
            spine["anim"] = event.get("value")
            if event.get("no_back"):
                spine["anim_no_back"] = True
            else:
                spine.pop("anim_no_back", None)
        elif event_type == "spine_color":
            spine["idol_color"] = event.get("value")


def _make_cue(
    step: dict[str, Any],
    ordinal: int,
    *,
    suffix: str,
    channel: str,
    action: str,
    at: Any = 0,
    duration: Any = 0,
    target: Any = None,
    payload: Any = None,
    lifecycle: dict[str, Any] | None = None,
    legacy_field: str,
) -> dict[str, Any]:
    return {
        "cue_id": f"step-{step.get('step_id', 'unknown')}:{ordinal:03d}:{suffix}",
        "at": max(0, _finite_number(at)),
        "duration": max(0, _finite_number(duration)),
        "channel": channel,
        "action": action,
        "target": target,
        "payload": _clone(payload or {}),
        "lifecycle": _clone(lifecycle or _lifecycle()),
        "evidence": {"confidence": "derived", "legacy_field": legacy_field},
    }


def _timeline_cue(step: dict[str, Any], event: dict[str, Any], ordinal: int) -> dict[str, Any] | None:
    type_map = {
        "spine_face": ("spine.face.set", f"spine:{event.get('chara_id')}:face", "spine-face"),
        "spine_anim": ("spine.body.play", f"spine:{event.get('chara_id')}:body", "spine-body"),
        "spine_neck_anim": ("spine.neck.play", f"spine:{event.get('chara_id')}:neck", "spine-neck"),
        "spine_neck_stop": ("spine.neck.stop", f"spine:{event.get('chara_id')}:neck", "spine-neck-stop"),
        "spine_color": ("spine.visual.tint", f"spine:{event.get('chara_id')}:visual:tint", "spine-tint"),
    }
    mapped = type_map.get(event.get("type"))
    if not mapped:
        return None
    payload = _clone(event)
    for key in ("time", "type", "chara_id"):
        payload.pop(key, None)
    is_neck = event.get("type") in ("spine_neck_anim", "spine_neck_stop")
    return _make_cue(
        step,
        ordinal,
        suffix=mapped[2],
        channel=mapped[1],
        action=mapped[0],
        at=event.get("time"),
        duration=event.get("duration"),
        target=event.get("chara_id"),
        payload=payload,
        lifecycle=_lifecycle(persistence="transient", restore_policy="suppress") if is_neck else _lifecycle(),
        legacy_field=f"timeline.{event.get('type')}",
    )


def _legacy_cues(step: dict[str, Any]) -> list[dict[str, Any]]:
    state = step.get("state") or {}
    cues: list[dict[str, Any]] = []
    ordinal = 0

    def push(cue: dict[str, Any] | None) -> None:
        nonlocal ordinal
        if cue:
            cues.append(cue)
        ordinal += 1

    camera = state.get("camera_zoom")
    if camera and (_finite_number(camera.get("delay")) > 0 or _finite_number(camera.get("duration")) > 0):
        push(_make_cue(
            step, ordinal, suffix="camera-transform", channel="camera", action="camera.transform",
            at=camera.get("delay"), duration=camera.get("duration"), target="stage",
            payload=_stable_camera(camera), legacy_field="state.camera_zoom",
        ))
    transition = state.get("bg_transition")
    if state.get("bg") and transition:
        push(_make_cue(
            step, ordinal, suffix="background-change", channel="background", action="background.change",
            at=transition.get("delay"), duration=transition.get("duration"), target="stage-background",
            payload={"bg": state["bg"], "type": transition.get("type") or "dissolve", "color": transition.get("color") or None},
            legacy_field="state.bg_transition",
        ))
    se_events = state.get("se_events") or ([state.get("se")] if (state.get("se") or {}).get("cue") else [])
    for se in se_events:
        if not se or not se.get("cue"):
            continue
        push(_make_cue(
            step, ordinal, suffix=f"se-{se['cue']}", channel="se", action="se.play",
            at=se.get("delay"), target=se["cue"],
            payload={"cue": se["cue"], "volume": se.get("volume")},
            lifecycle=_lifecycle(persistence="transient", blocks_auto=False, restore_policy="suppress"),
            legacy_field="state.se_events",
        ))
    slide = state.get("screen_slide")
    if slide:
        push(_make_cue(
            step, ordinal, suffix="screen-directional-wipe", channel="screen", action="screen.directional_wipe",
            at=slide.get("delay"), duration=slide.get("duration"), target="screen-overlay",
            payload={"type": slide.get("type") or "in", "color": slide.get("color") or "#000000", "direction": str(slide.get("direction") or "6")},
            lifecycle=_lifecycle(persistence="transient"), legacy_field="state.screen_slide",
        ))
    fade = state.get("screen_fade")
    if fade:
        push(_make_cue(
            step, ordinal, suffix="screen-fade", channel="screen", action="screen.fade",
            at=fade.get("delay"), duration=fade.get("duration"), target="screen-overlay",
            payload={"type": fade.get("type") or "in", "color": fade.get("color") or "#000000", "alpha": fade.get("alpha", 1)},
            lifecycle=_lifecycle(persistence="transient"), legacy_field="state.screen_fade",
        ))
    for effect in state.get("screen_effects") or []:
        if not effect or effect.get("type") not in ("fadein", "fadeout"):
            continue
        push(_make_cue(
            step, ordinal, suffix=f"screen-effect-{effect['type']}", channel="screen", action="screen.fade",
            at=effect.get("delay"), duration=effect.get("duration"), target="screen-overlay",
            payload={"type": "out" if effect["type"] == "fadein" else "in", "color": effect.get("color") or "#000000", "alpha": effect.get("alpha", 1)},
            lifecycle=_lifecycle(persistence="transient"), legacy_field="state.screen_effects",
        ))
    for event in step.get("timeline") or []:
        push(_timeline_cue(step, event, ordinal))
    return cues


def _normalized_snapshots(step: dict[str, Any], previous: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    state = step.get("state") or {}
    entry = _clone(state)
    entry["screen_overlay"] = _clone((previous or {}).get("screen_overlay"))
    if state.get("bg") and state.get("bg_transition"):
        entry["bg"] = (previous or {}).get("bg") or state["bg"]
    camera = state.get("camera_zoom")
    if camera and (_finite_number(camera.get("delay")) > 0 or _finite_number(camera.get("duration")) > 0):
        entry["camera_zoom"] = _stable_camera((previous or {}).get("camera_zoom")) or {
            "zoom": 1, "offset_x": 0, "offset_y": 0, "duration": 0,
        }
    else:
        entry["camera_zoom"] = _stable_camera(entry.get("camera_zoom"))
    entry["se"] = None
    entry["se_events"] = []

    settled = _strip_transient_state(state)
    has_overlay, overlay = _stable_screen_overlay(state)
    settled["screen_overlay"] = _clone(overlay if has_overlay else (previous or {}).get("screen_overlay"))
    _apply_timeline(settled, step.get("timeline"))
    return entry, settled


def _project_evidence(
    evidence: Any,
    fallback: Any = None,
    *,
    confidence: str | None = None,
    parser_rule: str | None = None,
) -> dict[str, Any]:
    source = evidence if isinstance(evidence, dict) else {}
    base = fallback if isinstance(fallback, dict) else {}
    start = source.get("command_start", source.get("command_index", base.get("command_start", base.get("command_index"))))
    end = source.get("command_end", source.get("command_index", base.get("command_end", base.get("command_index"))))
    output = {
        "source_file": _required(source.get("source_file", base.get("source_file")), "evidence.source_file"),
        "source_part_id": _required(source.get("source_part_id", base.get("source_part_id")), "evidence.source_part_id"),
        "command_start": int(start),
        "command_end": int(end),
        "raw_type": _required(source.get("raw_type", base.get("raw_type")), "evidence.raw_type"),
        "confidence": confidence or source.get("confidence") or base.get("confidence") or "exact",
    }
    raw_values = source.get("raw_values", base.get("raw_values"))
    if isinstance(raw_values, list):
        output["raw_values"] = _clone(raw_values)
    rule = source.get("parser_rule") or base.get("parser_rule") or parser_rule
    if rule:
        output["parser_rule"] = str(rule)
    return output


def _project_dialogue(dialogue: dict[str, Any]) -> dict[str, Any]:
    output = {
        "speaker_identity": _clone(_required(dialogue.get("speaker_identity"), "dialogue.speaker_identity")),
        "source_text": str(dialogue.get("source_text") or ""),
        "text_ref": _clone(_required(dialogue.get("text_ref"), "dialogue.text_ref")),
    }
    if dialogue.get("speaker_text_ref"):
        output["speaker_source_text"] = str(dialogue.get("speaker_source_text", dialogue.get("speaker", "")) or "")
        output["speaker_text_ref"] = _clone(dialogue["speaker_text_ref"])
    if "voice" in dialogue:
        output["voice"] = dialogue.get("voice") or None
    if "lip" in dialogue:
        output["lip"] = _clone(dialogue.get("lip"))
    return output


def _project_option(option: dict[str, Any]) -> dict[str, Any]:
    target = option.get("target_step_id", option.get("step_id"))
    output = {
        "option_id": _required(option.get("option_id"), "choice option.option_id"),
        "source_text": str(option.get("source_text") or ""),
        "text_ref": _clone(_required(option.get("text_ref"), "choice option.text_ref")),
        "target_step_id": int(_required(target, "choice option.target_step_id")),
    }
    if option.get("detail_source_text") is not None or option.get("detail_text_ref"):
        output["detail_source_text"] = str(option.get("detail_source_text") or "")
        output["detail_text_ref"] = _clone(_required(option.get("detail_text_ref"), "choice option.detail_text_ref"))
    return output


def _project_step(step: dict[str, Any], previous: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    evidence = _project_evidence(step.get("evidence"))
    entry, settled = _normalized_snapshots(step, previous)
    cues = _legacy_cues(step)
    for cue in cues:
        legacy_field = cue["evidence"].get("legacy_field")
        cue["evidence"] = _project_evidence(
            cue.get("evidence"), evidence, confidence=cue["evidence"].get("confidence", "derived"),
            parser_rule=f"legacy:{legacy_field}" if legacy_field else "scenario-normalizer-v2",
        )
    output = {
        "step_id": step["step_id"],
        "type": step["type"],
        "entry_snapshot": entry,
        "settled_snapshot": settled,
        "snapshot_format": "story-snapshot-v2",
        "cues": cues,
        "flow": {
            "advance": "choice" if step.get("type") == "choice" else ("automatic" if step.get("auto_advance") else "user"),
            "blocks_skip": step.get("type") == "choice",
            "choice_id": (step.get("choice_id") or f"step-{step['step_id']}") if step.get("type") == "choice" else None,
        },
        "evidence": evidence,
    }
    for key in ("episode_index", "episode_part", "chara_id", "auto_advance", "duration", "hide_dialogue", "lipSync"):
        if key in step:
            output[key] = _clone(step[key])
    if step.get("dialogue"):
        output["dialogue"] = _project_dialogue(step["dialogue"])
    if isinstance(step.get("options"), list):
        output["options"] = [_project_option(option) for option in step["options"]]
    if step.get("choice_id"):
        output["choice_id"] = step["choice_id"]
    if step.get("text_time"):
        output["text_time"] = {
            "source_text": str(step["text_time"].get("source_text") or ""),
            "text_ref": _clone(_required(step["text_time"].get("text_ref"), "text_time.text_ref")),
        }
    if step.get("stamp"):
        output["stamp"] = _clone(step["stamp"])
    return output, settled


def compile_authoritative_scenario(
    compatibility: dict[str, Any],
    *,
    compiler_version: str = "scenario-compiler-python-v2",
) -> dict[str, Any]:
    """Return strict v2 output for one ScenarioCompiler compatibility result."""
    source = _required(compatibility.get("source"), "scenario.source")
    steps = []
    previous = None
    for step in compatibility.get("steps") or []:
        projected, previous = _project_step(step, previous)
        steps.append(projected)
    output: dict[str, Any] = {
        "schema_version": 2,
        "compiler_version": _required(compiler_version, "compiler_version"),
        "runtime_contract": "story-runtime-v2",
        "scenario_id": _required(compatibility.get("scenario_id"), "scenario.scenario_id"),
        "text_catalog_id": _required(compatibility.get("text_catalog_id"), "scenario.text_catalog_id"),
        "text_contract_version": 1,
        "source": {
            "raw_path": _required(source.get("raw_path"), "scenario.source.raw_path"),
            "raw_hash": _required(source.get("raw_hash"), "scenario.source.raw_hash"),
        },
        "steps": steps,
    }
    for key in ("masterdata_ids", "compiled_at"):
        if key in source:
            output["source"][key] = _clone(source[key])
    if isinstance(compatibility.get("capabilities"), list):
        output["capabilities"] = _clone(compatibility["capabilities"])
    if compatibility.get("resource_manifest"):
        output["resource_manifest"] = _clone(compatibility["resource_manifest"])
    if compatibility.get("episodes"):
        output["episodes"] = [
            {
                "episode_index": int(episode.get("episode_index", 0)),
                **({"source_scenario_id": str(episode["source_scenario_id"])} if episode.get("source_scenario_id") else {}),
                **({"episode_part": str(episode["episode_part"])} if episode.get("episode_part") is not None else {}),
                "start_step_id": int(episode["start_step_id"]),
                "end_step_id": int(episode["end_step_id"]),
            }
            for episode in compatibility["episodes"]
        ]
    jump_points = compatibility.get("jump_points")
    if jump_points:
        output["jump_points"] = (
            _clone(jump_points)
            if isinstance(jump_points, list)
            else [{"jump_id": key, "target_step_id": int(value)} for key, value in jump_points.items()]
        )
    return output
