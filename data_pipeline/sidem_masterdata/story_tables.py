"""Decode story table identities with raw field provenance."""
from __future__ import annotations

from typing import Any
from .wire import parse_message, length_delimited_field_bytes


def extract_scenario_titles(records: list[tuple[int, int, int, int, Any]]) -> dict[str, list[dict[str, Any]]]:
    tables: dict[str, list[dict[str, Any]]] = {
        "main_groups": [],
        "main_chapters": [],
        "main_episodes": [],
        "event_groups": [],
        "event_episodes": [],
        "unit_groups": [],
        "unit_chapters": [],
        "unit_episodes": [],
        "idol_story_chapters": [],
        "idol_story_episodes": [],
        "card_scenarios": [],
        "work_story_resources": [],
        "birthday_chapters": [],
        "birthday_sections": [],
        "birthday_episodes": [],
        "birthday_characters": [],
        "birthday_announcements": [],
        "extra_story_groups": [],
        "extra_story_episodes": [],
    }
    mapping = {
        4: "main_groups",
        5: "main_chapters",
        6: "main_episodes",
        11: "event_groups",
        12: "event_episodes",
        13: "unit_groups",
        14: "unit_chapters",
        15: "unit_episodes",
        8: "idol_story_chapters",
        9: "idol_story_episodes",
        43: "card_scenarios",
        54: "work_story_resources",
        55: "work_story_resources",
        76: "birthday_chapters",
        77: "birthday_sections",
        78: "birthday_episodes",
        80: "birthday_characters",
        86: "birthday_announcements",
        144: "extra_story_groups",
        145: "extra_story_episodes",
    }
    for top_field, start, payload_start, end, payload in records:
        name = mapping.get(top_field)
        if not name or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload)
        if top_field == 80:
            character_bytes = length_delimited_field_bytes(payload, 2)
            if character_bytes:
                parsed["2"] = int.from_bytes(character_bytes, byteorder="little")
        parsed["_top_field"] = top_field
        parsed["_offset"] = start
        tables[name].append(parsed)
    return tables
