"""Pure story resources projections; resource evidence is supplied by the caller."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from .provenance import source


def normalize_compiled_resource(resource_id: str) -> str:
    match = re.match(r"^((?:1_1|1_2|1_4)_\d{3}_\d{2})_[a-z]$", resource_id)
    if match:
        return match.group(1)
    match = re.match(r"^(1_3_\d{5}_\d{2})_[a-z]$", resource_id)
    if match:
        return match.group(1)
    match = re.match(r"^((?:5_\d{2})_\d{3}_\d{2})_[a-z]$", resource_id)
    if match:
        return match.group(1)
    return resource_id


def compiled_exists(resource_id: str, compiled_stems: set[str]) -> bool:
    normalized = normalize_compiled_resource(resource_id)
    return normalized in compiled_stems or any(
        stem.endswith(f"_{normalized}") or re.search(rf"_{re.escape(normalized)}_[a-z]$", stem)
        for stem in compiled_stems
    )


def compiled_filename(resource_id: str, compiled_stems: set[str]) -> str | None:
    normalized = normalize_compiled_resource(resource_id)
    if normalized in compiled_stems:
        return f"{normalized}.json"
    matches = sorted(
        stem for stem in compiled_stems
        if stem.endswith(f"_{normalized}") or re.search(rf"_{re.escape(normalized)}_[a-z]$", stem)
    )
    return f"{matches[0]}.json" if matches else None


def enrich_resource_row(
    row: dict[str, Any],
    table_id: int,
    resource_field: str,
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    field_map: dict[str, int],
) -> dict[str, Any]:
    out = dict(row)
    resource_id = row.get(resource_field)
    if isinstance(resource_id, str):
        out["resource_id"] = resource_id
        out["compiled_resource_id"] = normalize_compiled_resource(resource_id)
        out["compiled_file"] = compiled_filename(resource_id, compiled_stems)
        out["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
        if out["compiled_file"]:
            summary = compiled_summaries.get(Path(out["compiled_file"]).stem)
            if summary:
                out["compiled_summary"] = summary
    out["_source"] = source(table_id, field_map, row.get("_offset"))
    return out


def normalize_release_condition(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    condition_type = payload.get("1")
    labels = {
        1: "term_or_default_release",
        2: "scenario_title_mission",
        203: "idol_story_episode_finished",
        1602: "card_acquired",
        1603: "card_awakened",
        1604: "card_limit_break",
    }
    return {
        "type": condition_type,
        "kind": labels.get(condition_type, "unknown"),
        "param_a": payload.get("2"),
        "param_b": payload.get("3"),
        "raw": payload,
    }


def normalize_term(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    return {"start_at": payload.get("1"), "end_at": payload.get("2")}
