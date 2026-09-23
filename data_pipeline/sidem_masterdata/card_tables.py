"""Card wire records and cue identities."""
from __future__ import annotations

from typing import Any
from .wire import parse_message
from .patterns import PATTERNS


def extract_card_parameters(records: list[tuple[int, int, int, int, Any]]) -> list[dict[str, Any]]:
    cards = []
    for top_field, start, payload_start, end, payload in records:
        if top_field != 1 or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=True)
        resource_id = parsed.get("14")
        if isinstance(resource_id, str) and PATTERNS["card_resource"].match(resource_id):
            parsed["_offset"] = start
            parsed["_end"] = end
            cards.append(parsed)
    return cards


def extract_card_voice_cues(records: list[tuple[int, int, int, int, Any]]) -> list[dict[str, Any]]:
    cues = []
    for top_field, start, payload_start, end, payload in records:
        if top_field != 91 or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=True)
        nested = parsed.get("4")
        if isinstance(nested, dict):
            cues.append(
                {
                    "id": parsed.get("1"),
                    "card_id": parsed.get("2"),
                    "scenario_base": nested.get("1"),
                    "cue": nested.get("2"),
                    "start_time": nested.get("5"),
                    "end_time": nested.get("6"),
                }
            )
    return cues
