"""Compile summaries and voice previews from supplied payloads, without IO."""
from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any
from .story_resources import compiled_filename


def summarize_compiled_payload(data: dict[str, Any]) -> dict[str, Any]:
    steps = data.get("steps") or []
    step_types: Counter[str] = Counter()
    chara_ids: set[str] = set()
    title = None
    voice_count = 0
    lip_count = 0

    for step in steps:
        if not isinstance(step, dict):
            continue
        step_type = step.get("type")
        if isinstance(step_type, str):
            step_types[step_type] += 1

        dialogue = step.get("dialogue") if isinstance(step.get("dialogue"), dict) else {}
        text = dialogue.get("text")
        if not title and step_type == "title" and isinstance(text, str):
            title = text
        if dialogue.get("voice"):
            voice_count += 1
        if isinstance(dialogue.get("lip"), dict) and dialogue["lip"].get("path"):
            lip_count += 1

        chara_id = step.get("chara_id")
        if isinstance(chara_id, str):
            chara_ids.add(chara_id)
        state = step.get("state") if isinstance(step.get("state"), dict) else {}
        for spine in state.get("spines") or []:
            if isinstance(spine, dict) and isinstance(spine.get("id"), str):
                chara_ids.add(spine["id"])

    if not title:
        for step in steps:
            if not isinstance(step, dict):
                continue
            dialogue = step.get("dialogue") if isinstance(step.get("dialogue"), dict) else {}
            text = dialogue.get("text")
            if isinstance(text, str) and text and text != "【あらすじ】":
                title = text.splitlines()[0]
                break

    return {
        "scenario_id": data.get("scenario_id"),
        "title": title,
        "step_count": len(steps),
        "step_types": dict(sorted(step_types.items())),
        "voice_count": voice_count,
        "lip_count": lip_count,
        "characters": sorted(chara_ids),
    }


def card_home_voice_files(card_voice_cues: list[dict[str, Any]], compiled_stems: set[str]) -> dict[str, str]:
    bases = {
        cue.get("scenario_base")
        for cue in card_voice_cues
        if isinstance(cue.get("scenario_base"), str)
    }
    base_to_file: dict[str, str] = {}
    for base in sorted(bases):
        file_name = compiled_filename(base, compiled_stems)
        if file_name:
            base_to_file[base] = file_name

    return base_to_file


def build_card_home_voice_previews(base_to_file: dict[str, str], payloads: dict[str, Any]) -> dict[str, dict[str, Any]]:
    previews: dict[str, dict[str, Any]] = {}
    for base, file_name in base_to_file.items():
        if file_name not in payloads:
            continue
        data = payloads[file_name]

        for step in data.get("steps") or []:
            if not isinstance(step, dict):
                continue
            dialogue = step.get("dialogue") if isinstance(step.get("dialogue"), dict) else {}
            voice = dialogue.get("voice")
            if not isinstance(voice, str):
                continue
            cue_id = Path(voice).stem
            if not cue_id.startswith(f"{base}_"):
                continue
            previews[cue_id] = {
                "compiled_file": file_name,
                "scenario_id": data.get("scenario_id"),
                "step_id": step.get("step_id"),
                "step_type": step.get("type"),
                "speaker": dialogue.get("speaker"),
                "text": dialogue.get("text"),
                "voice": voice,
                "lip": dialogue.get("lip"),
                "spines": (step.get("state") or {}).get("spines") or [],
                "preview_step": step,
                "_source": {
                    "compiled_file": file_name,
                    "scenario_base": base,
                    "cue": cue_id,
                },
            }

    return previews
