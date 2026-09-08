"""Work story projections from masterdata and explicitly supplied compiled payloads."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from .provenance import source
from .story_resources import compiled_filename


def work_story_files(tables: dict[int, list[dict[str, Any]]], compiled_stems: set[str]) -> list[str]:
    """Only load resources used by valid work entries, in first-use order."""
    files = []
    for table in (54, 55):
        for row in tables.get(table, []):
            if not isinstance(row.get("3"), int) or not isinstance(row.get("5"), str):
                continue
            filename = compiled_filename(row["5"], compiled_stems)
            if filename and filename not in files:
                files.append(filename)
    return files


def build_work_story_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    background_catalog: dict[str, Any],
    scenario_payloads: dict[str, Any],
) -> dict[str, Any]:
    work_types = []
    type_by_relation_id = {}
    for row in tables.get(53, []):
        entry = {
            "id": row.get("1"),
            "name": row.get("2"),
            "scene_relation_id": row.get("3"),
            "story_relation_id": row.get("4"),
            "image_resource_id": row.get("7"),
            "color": row.get("8"),
            "sort_order": row.get("10"),
            "_source": source(53, {
                "id": 1,
                "name": 2,
                "scene_relation_id": 3,
                "story_relation_id": 4,
                "image_resource_id": 7,
                "color": 8,
                "sort_order": 10,
            }, row.get("_offset")),
        }
        work_types.append(entry)
        for relation_id in (entry["scene_relation_id"], entry["story_relation_id"]):
            if isinstance(relation_id, int):
                type_by_relation_id[relation_id] = entry

    backgrounds = background_catalog.get("backgrounds", {})
    idols_by_numeric = idol_unit_dictionary.get("by_numeric_id", {})
    entries_by_idol: dict[int, dict[str, Any]] = {}

    def scenario_details(compiled_file: str | None) -> dict[str, Any]:
        if not compiled_file or compiled_file not in scenario_payloads:
            return {}
        payload = scenario_payloads[compiled_file]
        steps = payload.get("steps") if isinstance(payload.get("steps"), list) else []
        background_id = next((
            step.get("state", {}).get("bg")
            for step in steps
            if isinstance(step, dict) and isinstance(step.get("state"), dict) and step["state"].get("bg")
        ), None)
        model_id = next((
            spine.get("model")
            for step in steps
            if isinstance(step, dict) and isinstance(step.get("state"), dict)
            for spine in (step["state"].get("spines") or [])
            if isinstance(spine, dict) and spine.get("model")
        ), None)
        dialogues = [
            step.get("dialogue", {})
            for step in steps
            if isinstance(step, dict) and step.get("type") in {"adv", "talk", "call"} and isinstance(step.get("dialogue"), dict)
        ]
        background = backgrounds.get(background_id, {}) if background_id else {}
        return {
            "background_resource_id": background_id,
            "background_name": next((name for name in background.get("names", []) if name), None),
            "background_name_source": "masterdata_picture_studio" if background.get("names") else "compiled_resource_only",
            "model_resource_id": model_id,
            "dialogue_count": len(dialogues),
            "dialogue_preview": next((dialogue.get("text_jp") or dialogue.get("text") for dialogue in dialogues if dialogue.get("text_jp") or dialogue.get("text")), None),
            "speakers": list(dict.fromkeys(dialogue.get("speaker") for dialogue in dialogues if dialogue.get("speaker"))),
        }

    for table_id, kind in ((54, "scene_line"), (55, "short_story")):
        for row in tables.get(table_id, []):
            idol_id = row.get("3")
            resource_id = row.get("5")
            if not isinstance(idol_id, int) or not isinstance(resource_id, str):
                continue
            identity = idols_by_numeric.get(str(idol_id)) or idols_by_numeric.get(idol_id) or {}
            idol = entries_by_idol.setdefault(idol_id, {
                "idol_numeric_id": idol_id,
                "idol_code": identity.get("idol_code"),
                "display_name": identity.get("display_name"),
                "color": identity.get("color"),
                "unit_id": identity.get("unit_id"),
                "unit_code": identity.get("unit_code"),
                "unit_name": identity.get("unit_name"),
                "work_type_id": None,
                "work_type_name": None,
                "scene_lines": [],
                "short_stories": [],
            })
            work_type = type_by_relation_id.get(row.get("2"), {})
            if work_type:
                idol["work_type_id"] = work_type.get("id")
                idol["work_type_name"] = work_type.get("name")
            compiled_file = compiled_filename(resource_id, compiled_stems)
            summary = compiled_summaries.get(Path(compiled_file).stem) if compiled_file else None
            entry = {
                "id": row.get("1"),
                "kind": kind,
                "relation_id": row.get("2"),
                "resource_id": resource_id,
                "compiled_file": compiled_file,
                "compiled_exists": bool(compiled_file),
                "title": summary.get("title") if summary else None,
                "step_count": summary.get("step_count") if summary else 0,
                "voice_count": summary.get("voice_count") if summary else 0,
                **scenario_details(compiled_file),
                "_source": source(table_id, {
                    "id": 1,
                    "work_relation_id": 2,
                    "idol_numeric_id": 3,
                    "availability_term": 4,
                    "resource_id": 5,
                }, row.get("_offset")),
            }
            idol["scene_lines" if kind == "scene_line" else "short_stories"].append(entry)

    idols = sorted(entries_by_idol.values(), key=lambda item: item["idol_numeric_id"])
    for idol in idols:
        idol["scene_lines"].sort(key=lambda item: item["resource_id"])
        idol["short_stories"].sort(key=lambda item: item["resource_id"])
    work_types.sort(key=lambda item: item.get("sort_order") or 0)
    all_entries = [
        entry
        for idol in idols
        for entry in idol["scene_lines"] + idol["short_stories"]
    ]
    return {
        "schema_version": 1,
        "work_types": work_types,
        "idols": idols,
        "by_idol_code": {item["idol_code"]: item for item in idols if item.get("idol_code")},
        "meta": {
            "idol_count": len(idols),
            "scene_line_count": sum(len(item["scene_lines"]) for item in idols),
            "short_story_count": sum(len(item["short_stories"]) for item in idols),
            "compiled_resource_count": sum(bool(item["compiled_exists"]) for item in all_entries),
            "missing_resource_count": sum(not item["compiled_exists"] for item in all_entries),
            "named_background_count": sum(bool(item.get("background_name")) for item in all_entries),
            "classification": "work",
        },
    }
