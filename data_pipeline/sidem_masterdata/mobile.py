"""Pure mobile projections; resource evidence is supplied by the caller."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any
from .provenance import source
from .identities import idol_id_from_resource
from .story_resources import (compiled_filename, compiled_exists, normalize_compiled_resource,
                              enrich_resource_row, normalize_release_condition, normalize_term)


def build_mobile_archive_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
) -> dict[str, Any]:
    idols = idol_unit_dictionary.get("by_numeric_id", {})
    units = idol_unit_dictionary.get("by_unit_id", {})

    personal_rooms = {}
    for row in tables.get(94, []):
        idol = idols.get(str(row.get("2")), {})
        room = row.get("4") if isinstance(row.get("4"), dict) else {}
        personal_rooms[row.get("1")] = {
            "id": row.get("1"), "idol_id": row.get("2"),
            "idol_code": idol.get("idol_code"), "idol_name": idol.get("display_name"),
            "profile_text": row.get("3"),
            "background_resource_id": room.get("1"), "icon_resource_id": room.get("2"),
            "postname_color": room.get("3"), "header_color": room.get("4"),
            "talkroom_color": room.get("5"),
            "_source": source(94, {"id": 1, "idol_id": 2, "profile_text": 3, "room": 4}, row.get("_offset")),
        }

    unit_rooms = {}
    for row in tables.get(96, []):
        unit = units.get(str(row.get("2")), {})
        room = row.get("3") if isinstance(row.get("3"), dict) else {}
        unit_rooms[row.get("1")] = {
            "id": row.get("1"), "unit_id": row.get("2"),
            "unit_code": unit.get("unit_code"), "unit_name": unit.get("unit_name"),
            "background_resource_id": room.get("1"), "icon_resource_id": room.get("2"),
            "postname_color": room.get("3"), "header_color": room.get("4"),
            "talkroom_color": room.get("5"),
            "_source": source(96, {"id": 1, "unit_id": 2, "room": 3}, row.get("_offset")),
        }

    group_rooms = {}
    for row in tables.get(98, []):
        room = row.get("3") if isinstance(row.get("3"), dict) else {}
        group_rooms[row.get("1")] = {
            "id": row.get("1"), "group_id": row.get("2"),
            "background_resource_id": room.get("1"), "icon_resource_id": room.get("2"),
            "postname_color": room.get("3"), "header_color": room.get("4"),
            "talkroom_color": room.get("5"), "raw_room": row.get("3"),
            "_source": source(98, {"id": 1, "group_id": 2, "room": 3}, row.get("_offset")),
        }

    specs = {
        1: (32, "idol_talk", personal_rooms, "8", "9", "10"),
        2: (34, "unit_talk", unit_rooms, "8", "9", "10"),
        101: (43, "idol_phone", personal_rooms, "5", "4", None),
    }
    scenario_rows = {table_id: {row.get("1"): row for row in tables.get(table_id, [])} for table_id in (32, 34, 36, 43)}
    conditions = {row.get("2"): row for row in tables.get(180, [])}
    priorities = {row.get("5"): row for row in tables.get(44, [])}
    scenarios = []
    by_idol_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_unit_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_kind: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for relation in tables.get(63, []):
        spec = specs.get(relation.get("3"))
        if not spec:
            continue
        table_id, kind, rooms, room_key, base_key, label_key = spec
        row = scenario_rows[table_id].get(relation.get("4"))
        if not row:
            continue
        room = rooms.get(row.get(room_key), {})
        base_resource_id = row.get(base_key)
        scenario_label = row.get(label_key) if label_key else None
        compiled_file = compiled_filename(base_resource_id, compiled_stems) if isinstance(base_resource_id, str) else None
        condition_row = conditions.get(relation.get("7"), {})
        priority_row = priorities.get(relation.get("2"), {})
        entry = {
            "id": relation.get("1"), "group_id": relation.get("2"),
            "mobile_type": relation.get("3"), "kind": kind,
            "scenario_id": row.get("1"), "title": row.get("3"),
            "room_id": row.get(room_key), "idol_code": room.get("idol_code"),
            "idol_name": room.get("idol_name"), "unit_code": room.get("unit_code"),
            "unit_name": room.get("unit_name"), "base_resource_id": base_resource_id,
            "scenario_label_resource_id": scenario_label,
            "release_order": relation.get("5"), "term": normalize_term(relation.get("6")),
            "release_condition_group_id": relation.get("7"),
            "release_condition": normalize_release_condition(condition_row.get("3")),
            "priority": priority_row.get("4"),
            "compiled_file": compiled_file, "compiled_exists": bool(compiled_file),
            "_source": {
                "scenario": source(table_id, {"id": 1, "title": 3, "base_resource_id": int(base_key), "room_id": int(room_key)}, row.get("_offset")),
                "relation": source(63, {"id": 1, "group_id": 2, "mobile_type": 3, "scenario_id": 4, "release_order": 5, "term": 6, "condition_group_id": 7}, relation.get("_offset")),
                "condition": source(180, {"id": 1, "group_id": 2, "release_condition": 3}, condition_row.get("_offset")) if condition_row else None,
            },
        }
        scenarios.append(entry)
        by_kind[kind].append(entry["id"])
        if entry["idol_code"]:
            by_idol_code[entry["idol_code"]].append(entry["id"])
        if entry["unit_code"]:
            by_unit_code[entry["unit_code"]].append(entry["id"])

    talk_rooms = {row.get("1"): row for row in tables.get(103, [])}
    random_topics = []
    for row in tables.get(104, []):
        talk_room = talk_rooms.get(row.get("2"), {})
        mobile_room = personal_rooms.get(talk_room.get("3"), {})
        resource_id = row.get("3")
        compiled_file = compiled_filename(resource_id, compiled_stems) if isinstance(resource_id, str) else None
        random_topics.append({
            "id": row.get("1"), "talk_room_id": row.get("2"),
            "idol_code": mobile_room.get("idol_code"), "idol_name": mobile_room.get("idol_name"),
            "script_name": resource_id, "script_label": row.get("4"),
            "open_time": row.get("5"), "close_time": row.get("6"),
            "weight": row.get("7"), "interval_day": row.get("8"),
            "intro_weights": [row.get(str(field)) for field in range(9, 25)],
            "compiled_file": compiled_file, "compiled_exists": bool(compiled_file),
            "_source": source(104, {"id": 1, "talk_room_id": 2, "script_name": 3, "script_label": 4, "open_time": 5, "close_time": 6, "weight": 7, "interval_day": 8}, row.get("_offset")),
        })

    random_intros = [{
        "id": row.get("1"), "talk_room_id": row.get("2"), "intro_id": row.get("3"),
        "script_name": row.get("4"), "script_label": row.get("5"),
        "join_probability": row.get("6"), "open_time": row.get("7"), "close_time": row.get("8"),
        "_source": source(105, {"id": 1, "talk_room_id": 2, "intro_id": 3, "script_name": 4, "script_label": 5, "join_probability": 6, "open_time": 7, "close_time": 8}, row.get("_offset")),
    } for row in tables.get(105, [])]

    return {
        "schema_version": 1,
        "rooms": {
            "personal": list(personal_rooms.values()),
            "unit": list(unit_rooms.values()),
            "group": list(group_rooms.values()),
        },
        "scenarios": scenarios,
        "by_kind": dict(by_kind),
        "by_idol_code": dict(by_idol_code),
        "by_unit_code": dict(by_unit_code),
        "random_talk": {
            "rooms": list(talk_rooms.values()),
            "topics": random_topics,
            "intros": random_intros,
            "segments": tables.get(106, []),
        },
        "meta": {
            "scenario_count": len(scenarios),
            "kind_counts": {key: len(value) for key, value in by_kind.items()},
            "compiled_scenario_count": sum(1 for item in scenarios if item["compiled_exists"]),
            "personal_room_count": len(personal_rooms),
            "unit_room_count": len(unit_rooms),
            "group_room_count": len(group_rooms),
            "random_topic_count": len(random_topics),
            "random_intro_count": len(random_intros),
            "user_state_note": "Read, favorite, received and actual unlock state belong to User* service data and are not reconstructed from static masterdata.",
        },
    }


def build_home_interaction_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rows = []
    specs = [
        (32, "idol_talk_scenario", "10", {"id": 1, "title": 3, "base_resource_id": 9, "resource_id": 10}),
        (34, "idol_unit_talk_scenario", "10", {"id": 1, "title": 3, "base_resource_id": 9, "resource_id": 10}),
        (104, "home_time_slot_resource", "4", {"id": 1, "base_resource_id": 3, "resource_id": 4, "start_time": 5, "end_time": 6}),
        (105, "home_schedule_time_slot", "5", {"id": 1, "base_resource_id": 4, "resource_id": 5, "start_time": 7, "end_time": 8}),
    ]
    for table_id, family, resource_key, field_map in specs:
        for row in tables.get(table_id, []):
            resource_id = row.get(resource_key)
            base_id = row.get("9") or row.get("3") or row.get("4")
            entry = enrich_resource_row(row, table_id, resource_key, compiled_stems, compiled_summaries, field_map)
            entry.update({
                "family": family,
                "title": row.get("3") if table_id in (32, 34) else None,
                "base_resource_id": base_id if isinstance(base_id, str) else None,
                "idol_numeric_id": idol_id_from_resource(resource_id) if isinstance(resource_id, str) else None,
            })
            rows.append(entry)

    by_family: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_idol: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_family[row["family"]].append(row)
        if row.get("idol_numeric_id") is not None:
            by_idol[str(row["idol_numeric_id"]).zfill(3)].append(row)
    return {
        "interactions": rows,
        "by_family": dict(by_family),
        "by_idol_numeric_id": dict(by_idol),
        "meta": {"interaction_count": len(rows)},
    }


def build_short_adv_profile_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rows = []
    for row in tables.get(90, []):
        nested = row.get("3") if isinstance(row.get("3"), dict) else {}
        resource_id = nested.get("2") if isinstance(nested, dict) else None
        entry = dict(row)
        entry["resource_id"] = resource_id
        if isinstance(resource_id, str):
            entry["compiled_resource_id"] = normalize_compiled_resource(resource_id)
            entry["compiled_file"] = compiled_filename(resource_id, compiled_stems)
            entry["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
            if entry["compiled_file"]:
                summary = compiled_summaries.get(Path(entry["compiled_file"]).stem)
                if summary:
                    entry["compiled_summary"] = summary
        entry["base_resource_id"] = nested.get("1") if isinstance(nested, dict) else None
        entry["idol_numeric_id"] = row.get("2")
        entry["cue_payload"] = nested
        entry["_source"] = source(90, {"id": 1, "idol_numeric_id": 2, "nested_payload": 3}, row.get("_offset"))
        rows.append(entry)
    return {"entries": rows, "meta": {"entry_count": len(rows)}}
