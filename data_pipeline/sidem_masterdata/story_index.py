"""Story master projection over supplied compiled resource evidence."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from .provenance import source
from .story_resources import normalize_compiled_resource, compiled_filename, compiled_exists


def build_story_master_index(
    story_tables: dict[str, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    def row_with_file(row: dict[str, Any], resource_key: str = "6") -> dict[str, Any]:
        resource_id = row.get(resource_key)
        out = dict(row)
        table_id = row.get("_top_field")
        if isinstance(table_id, int):
            out["_source"] = source(table_id, {"resource_id": int(resource_key)}, row.get("_offset"))
        if isinstance(resource_id, str):
            out["resource_id"] = resource_id
            out["compiled_resource_id"] = normalize_compiled_resource(resource_id)
            out["compiled_file"] = compiled_filename(resource_id, compiled_stems)
            out["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
            if out["compiled_file"]:
                summary = compiled_summaries.get(Path(out["compiled_file"]).stem)
                if summary:
                    out["compiled_summary"] = summary
        return out

    return {
        "main": {
            "groups": story_tables.get("main_groups", []),
            "chapters": story_tables.get("main_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("main_episodes", [])],
        },
        "event": {
            "groups": story_tables.get("event_groups", []),
            "episodes": [row_with_file(row, "5") for row in story_tables.get("event_episodes", [])],
        },
        "unit_story": {
            "groups": story_tables.get("unit_groups", []),
            "chapters": story_tables.get("unit_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("unit_episodes", [])],
        },
        "idol_story": {
            "chapters": story_tables.get("idol_story_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("idol_story_episodes", [])],
        },
        "card_scenarios": [
            row_with_file(row, "4") for row in story_tables.get("card_scenarios", [])
        ],
        "work": [
            row_with_file(row, "5") for row in story_tables.get("work_story_resources", [])
        ],
        "birthday": [
            row_with_file(row, "5") for row in story_tables.get("birthday_episodes", [])
        ],
        "extra": {
            "groups": story_tables.get("extra_story_groups", []),
            "episodes": [row_with_file(row, "5") for row in story_tables.get("extra_story_episodes", [])],
        },
    }
