"""Local resource adapters; JSON interpretation lives in pure projections."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from .compiled_inputs import load_scenario_payloads
from .compiled_projection import summarize_compiled_payload, card_home_voice_files, build_card_home_voice_previews


def load_json_file(path: Path | None) -> Any:
    if not path or not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def load_spine_ids(path: Path | None) -> set[str]:
    data = load_json_file(path)
    if isinstance(data, list):
        return {item for item in data if isinstance(item, str)}
    if isinstance(data, dict):
        for key in ("models", "spines", "items"):
            value = data.get(key)
            if isinstance(value, list):
                return {item for item in value if isinstance(item, str)}
            if isinstance(value, dict):
                return set(value)
    return set()


def load_prefab_models(path: Path | None) -> dict[str, Any]:
    data = load_json_file(path)
    if isinstance(data, dict) and isinstance(data.get("models"), dict):
        return data["models"]
    return {}


def collect_compiled_stems(compiled_dir: Path | None) -> set[str]:
    if not compiled_dir or not compiled_dir.exists():
        return set()
    excluded = {"index", "manifest", "voice_index"}
    return {path.stem for path in compiled_dir.glob("*.json") if path.stem not in excluded}


def summarize_compiled_scenario(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return {}

    return summarize_compiled_payload(data)


def collect_compiled_summaries(compiled_dir: Path | None) -> dict[str, dict[str, Any]]:
    if not compiled_dir or not compiled_dir.exists():
        return {}
    excluded = {"index", "manifest", "voice_index"}
    summaries = {}
    for path in compiled_dir.glob("*.json"):
        if path.stem in excluded:
            continue
        summary = summarize_compiled_scenario(path)
        if summary:
            summaries[path.stem] = summary
    return summaries


def collect_card_home_voice_previews(
    card_voice_cues: list[dict[str, Any]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
) -> dict[str, dict[str, Any]]:
    if not compiled_dir or not compiled_dir.exists():
        return {}

    base_to_file = card_home_voice_files(card_voice_cues, compiled_stems)
    payloads = load_scenario_payloads(compiled_dir, base_to_file.values())
    return build_card_home_voice_previews(base_to_file, payloads)


def collect_voice_stems(voice_dir: Path | None) -> set[str]:
    if not voice_dir or not voice_dir.exists():
        return set()
    return {path.stem for path in voice_dir.rglob("*.m4a")}


def collect_background_stems(bg_dir: Path | None) -> set[str]:
    return {path.stem for path in bg_dir.glob("*.png")} if bg_dir and bg_dir.exists() else set()
