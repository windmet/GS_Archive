"""Read-only extraction reports and archive counts."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any
from .patterns import PATTERNS
from .wire import parse_message
from .story_resources import compiled_exists


def build_table_scan(records: list[tuple[int, int, int, int, Any]]) -> list[dict[str, Any]]:
    stats: dict[int, dict[str, Any]] = {}
    samples: dict[tuple[int, str], list[str]] = defaultdict(list)
    for top_field, start, payload_start, end, payload in records:
        table = stats.setdefault(
            top_field,
            {
                "top_field": top_field,
                "records": 0,
                "lengths": [],
                "strings": 0,
                "field_counts": Counter(),
                "matches": Counter(),
            },
        )
        table["records"] += 1
        table["lengths"].append(end - payload_start)
        if not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload)
        for inner_field, value in parsed.items():
            values = value if isinstance(value, list) else [value]
            table["field_counts"][int(inner_field)] += len(values)
            for item in values:
                if not isinstance(item, str):
                    continue
                table["strings"] += 1
                for name, pattern in PATTERNS.items():
                    if pattern.search(item):
                        table["matches"][name] += 1
                        bucket = samples[(top_field, name)]
                        if len(bucket) < 8:
                            bucket.append(item[:300])

    report = []
    for top_field, table in sorted(stats.items()):
        lengths = table.pop("lengths")
        field_counts = table.pop("field_counts")
        matches = table.pop("matches")
        report.append(
            {
                **table,
                "avg_len": round(sum(lengths) / len(lengths), 1),
                "min_len": min(lengths),
                "max_len": max(lengths),
                "common_inner_fields": field_counts.most_common(12),
                "matches": dict(matches),
                "samples": {
                    name: samples.get((top_field, name), []) for name in PATTERNS
                },
            }
        )
    return report


def build_validation_report(
    story_tables: dict[str, list[dict[str, Any]]],
    card_voice_cues: list[dict[str, Any]],
    card_home_voice_previews: dict[str, dict[str, Any]],
    compiled_stems: set[str],
    voice_stems: set[str],
) -> dict[str, Any]:
    resource_groups = {
        "main_episodes": ("main_episodes", "6"),
        "event_episodes": ("event_episodes", "5"),
        "unit_story_episodes": ("unit_episodes", "6"),
        "idol_story_episodes": ("idol_story_episodes", "6"),
        "card_scenarios": ("card_scenarios", "4"),
        "work_story_resources": ("work_story_resources", "5"),
        "birthday_episodes": ("birthday_episodes", "5"),
        "extra_story_episodes": ("extra_story_episodes", "5"),
    }
    story_coverage = {}
    for label, (group, key) in resource_groups.items():
        rows = story_tables.get(group, [])
        total = 0
        hits = 0
        missing = []
        for row in rows:
            resource_id = row.get(key)
            if not isinstance(resource_id, str) or not re.match(r"^[0-9]_[0-9]{1,2}_", resource_id):
                continue
            total += 1
            if compiled_exists(resource_id, compiled_stems):
                hits += 1
            elif len(missing) < 20:
                missing.append(resource_id)
        story_coverage[label] = {
            "total": total,
            "compiled_hits": hits,
            "coverage": round(hits / total, 4) if total else None,
            "missing_sample": missing,
        }

    cue_total = len(card_voice_cues)
    cue_hits = sum(1 for cue in card_voice_cues if cue.get("cue") in voice_stems)
    return {
        "story_coverage": story_coverage,
        "card_voice_cue_coverage": {
            "total": cue_total,
            "audio_hits": cue_hits,
            "coverage": round(cue_hits / cue_total, 4) if cue_total else None,
        },
        "card_home_voice_preview_coverage": {
            "total": cue_total,
            "preview_hits": sum(1 for cue in card_voice_cues if cue.get("cue") in card_home_voice_previews),
            "coverage": round(
                sum(1 for cue in card_voice_cues if cue.get("cue") in card_home_voice_previews) / cue_total,
                4,
            ) if cue_total else None,
        },
    }


def build_archive_summary(
    story_index: dict[str, Any],
    card_index: dict[str, Any],
    validation_report: dict[str, Any],
) -> dict[str, Any]:
    cards = card_index.get("cards", [])
    rarity_counts = Counter(card.get("rarity") or "UNKNOWN" for card in cards)
    story_counts = {
        "main_groups": len(story_index.get("main", {}).get("groups", [])),
        "main_chapters": len(story_index.get("main", {}).get("chapters", [])),
        "main_episodes": len(story_index.get("main", {}).get("episodes", [])),
        "event_groups": len(story_index.get("event", {}).get("groups", [])),
        "event_episodes": len(story_index.get("event", {}).get("episodes", [])),
        "unit_story_groups": len(story_index.get("unit_story", {}).get("groups", [])),
        "unit_story_chapters": len(story_index.get("unit_story", {}).get("chapters", [])),
        "unit_story_episodes": len(story_index.get("unit_story", {}).get("episodes", [])),
        "idol_story_chapters": len(story_index.get("idol_story", {}).get("chapters", [])),
        "idol_story_episodes": len(story_index.get("idol_story", {}).get("episodes", [])),
        "card_scenarios": len(story_index.get("card_scenarios", [])),
        "work": len(story_index.get("work", [])),
        "birthday": len(story_index.get("birthday", [])),
        "extra_groups": len(story_index.get("extra", {}).get("groups", [])),
        "extra_episodes": len(story_index.get("extra", {}).get("episodes", [])),
    }
    card_counts = {
        "cards": len(cards),
        "characters": len(card_index.get("by_character", {})),
        "rarity": dict(sorted(rarity_counts.items())),
        "with_texts": sum(
            1
            for card in cards
            if any((card.get("texts") or {}).get(key) for key in ("normal", "awakened", "extra"))
        ),
        "with_home_voice": sum(1 for card in cards if card.get("home_voice_cues")),
        "with_scenario_entries": sum(1 for card in cards if card.get("scenario_entries")),
        "with_unmapped_card_only_voice_candidates": sum(
            1
            for card in cards
            if (card.get("voice_candidates") or {}).get("unmapped_card_only")
        ),
    }
    return {
        "generated_from": "client_master_data",
        "story_counts": story_counts,
        "card_counts": card_counts,
        "validation": validation_report,
        "recommended_archive_sources": {
            "main_story": "story_master_index.main",
            "event_story": "story_master_index.event",
            "unit_story": "story_master_index.unit_story",
            "idol_story": "story_master_index.idol_story",
            "card_archive": "card_index.cards",
            "card_phone_or_story": "card_index.cards[].scenario_entries",
            "work_story": "story_master_index.work",
            "birthday": "story_master_index.birthday",
            "extra": "story_master_index.extra",
            "compiled_fallback": "public/data/compiled/index.json",
        },
    }


def build_card_probe(card_index: dict[str, Any], resource_id: str) -> dict[str, Any]:
    card = next(
        (item for item in card_index.get("cards", []) if item.get("resource_id") == resource_id),
        None,
    )
    if not card:
        return {"resource_id": resource_id, "found": False}
    return {
        "resource_id": resource_id,
        "found": True,
        "card_id": card.get("card_id"),
        "character_id": card.get("character_id"),
        "rarity": card.get("rarity"),
        "title": card.get("title"),
        "voice_base": card.get("voice_base"),
        "texts": card.get("texts"),
        "home_voice_cues": [item.get("cue") for item in card.get("home_voice_cues", [])],
        "scenario_entries": [
            {
                "title": item.get("3"),
                "resource_id": item.get("resource_id"),
                "compiled_file": item.get("compiled_file"),
                "compiled_exists": item.get("compiled_exists"),
            }
            for item in card.get("scenario_entries", [])
        ],
        "unmapped_card_only_voice_candidates": (
            card.get("voice_candidates") or {}
        ).get("unmapped_card_only", []),
    }
