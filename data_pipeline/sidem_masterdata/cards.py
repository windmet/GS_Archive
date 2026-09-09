"""Card domain projections from explicit masterdata and resource evidence."""
from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from pathlib import Path
from typing import Any
from .provenance import source
from .story_resources import compiled_filename, compiled_exists
from .card_gameplay import build_card_reference_maps, build_card_gameplay, build_card_costume_relations
from .card_voices import classify_card_operational_voices


def card_preference_score(card: dict[str, Any]) -> int:
    """Shared selection policy for resource-keyed summaries and details."""
    tutorial = bool(re.match(r"^チュートリアル", str(card.get("title") or ""))) or int(card.get("card_id") or 0) >= 90000000
    return (0 if tutorial else 100) + len(card.get("home_voice_cues") or []) + len(card.get("scenario_entries") or [])


def canonical_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_resource_id: dict[str, dict[str, Any]] = {}
    for card in cards:
        resource_id = card.get("resource_id")
        if not isinstance(resource_id, str) or not resource_id:
            continue
        score = card_preference_score(card)
        current = by_resource_id.get(resource_id)
        if not current or score > current["_canonical_score"]:
            by_resource_id[resource_id] = {**card, "_canonical_score": score}
    return [
        {key: value for key, value in card.items() if key != "_canonical_score"}
        for card in by_resource_id.values()
    ]


def build_card_index(
    cards: list[dict[str, Any]],
    card_voice_cues: list[dict[str, Any]],
    card_home_voice_previews: dict[str, dict[str, Any]],
    story_tables: dict[str, list[dict[str, Any]]],
    catalog_tables: dict[int, list[dict[str, Any]]],
    voice_stems: set[str],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    curated_card_voices: dict[str, Any],
) -> dict[str, Any]:
    cards_by_release_title: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
    for card in cards:
        release_at = card.get("18")
        title = card.get("40") or card.get("13")
        resource_id = card.get("14")
        if isinstance(release_at, int) and isinstance(title, str) and isinstance(resource_id, str):
            cards_by_release_title[(release_at, title)].append(card)

    release_series_by_card_id: dict[int, dict[str, Any]] = {}
    release_series_count = 0
    for (release_at, title), batch in cards_by_release_title.items():
        resource_ids = sorted({row.get("14") for row in batch if isinstance(row.get("14"), str)})
        if len(resource_ids) < 2:
            continue
        character_ids = sorted({resource_id[:6] for resource_id in resource_ids})
        digest = hashlib.sha1(title.encode("utf-8")).hexdigest()[:10]
        relation = {
            "series_id": f"release_{release_at}_{digest}",
            "title": title,
            "release_at": release_at,
            "card_count": len(resource_ids),
            "character_count": len(character_ids),
            "relation_type": "exact_release_timestamp_and_title",
            "_source": source(1, {"release_at": 18, "title": 40}),
        }
        release_series_count += 1
        for row in batch:
            card_id = row.get("1")
            if isinstance(card_id, int):
                release_series_by_card_id[card_id] = relation

    cues_by_card: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for cue in card_voice_cues:
        card_id = cue.get("card_id")
        if isinstance(card_id, int):
            enriched = dict(cue)
            preview = card_home_voice_previews.get(str(cue.get("cue")))
            if preview:
                enriched["preview"] = preview
                enriched["compiled_file"] = preview.get("compiled_file")
                enriched["compiled_exists"] = True
            elif isinstance(cue.get("scenario_base"), str):
                enriched["compiled_file"] = compiled_filename(cue["scenario_base"], compiled_stems)
                enriched["compiled_exists"] = bool(enriched["compiled_file"])
            cues_by_card[card_id].append(enriched)

    scenario_rows_by_card: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in story_tables.get("card_scenarios", []):
        row_id = row.get("1")
        if not isinstance(row_id, int):
            continue
        card_id = row_id // 100
        resource_id = row.get("4")
        entry = dict(row)
        if isinstance(resource_id, str):
            entry["resource_id"] = resource_id
            entry["compiled_file"] = compiled_filename(resource_id, compiled_stems)
            entry["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
            if resource_id.endswith("_09_a"):
                entry["communication_type"] = "limitbreak_phone"
                entry["communication_label"] = "限界突破4回後"
            elif resource_id.endswith("_09_b"):
                entry["communication_type"] = "awakened_phone"
                entry["communication_label"] = "チェンジ！後"
            if entry["compiled_file"]:
                summary = compiled_summaries.get(Path(entry["compiled_file"]).stem)
                if summary:
                    entry["compiled_summary"] = summary
        scenario_rows_by_card[card_id].append(entry)

    card_link_talks_by_resource: dict[str, dict[str, Any]] = {}
    for row in catalog_tables.get(32, []):
        resource_id = row.get("10")
        if not isinstance(resource_id, str):
            continue
        entry = dict(row)
        entry.update({
            "resource_id": resource_id,
            "compiled_file": compiled_filename(resource_id, compiled_stems),
            "compiled_exists": compiled_exists(resource_id, compiled_stems),
            "display_title": "スカウト後トーク",
            "communication_type": "scout_talk",
            "communication_label": "スカウト後",
            "_source": source(32, {
                "id": 1,
                "raw_title": 3,
                "base_resource_id": 9,
                "resource_id": 10,
            }, row.get("_offset")),
        })
        if entry["compiled_file"]:
            summary = compiled_summaries.get(Path(entry["compiled_file"]).stem)
            if summary:
                entry["compiled_summary"] = summary
        card_link_talks_by_resource[resource_id] = entry

    curated_cards = curated_card_voices.get("cards", {}) if isinstance(curated_card_voices, dict) else {}
    card_references = build_card_reference_maps(catalog_tables)

    indexed_cards = []
    by_character: dict[str, list[str]] = defaultdict(list)
    for card in cards:
        card_id = card.get("1")
        resource_id = card.get("14")
        if not isinstance(card_id, int) or not isinstance(resource_id, str):
            continue

        character_id = resource_id[:6]
        rarity_match = re.search(r"_(n|r|sr|ssr)(\d+)$", resource_id)
        rarity = rarity_match.group(1).upper() if rarity_match else ""
        ordinal = int(rarity_match.group(2)) if rarity_match else None

        home_cues = sorted(cues_by_card.get(card_id, []), key=lambda item: item.get("cue") or "")
        home_cue_names = {item.get("cue") for item in home_cues}
        scenario_entries = sorted(
            scenario_rows_by_card.get(card_id, []),
            key=lambda item: item.get("1") if isinstance(item.get("1"), int) else 0,
        )
        scenario_resources = {
            item.get("resource_id") for item in scenario_entries if isinstance(item.get("resource_id"), str)
        }

        voice_base = None
        for cue in home_cues:
            base = cue.get("scenario_base")
            if isinstance(base, str) and base.endswith("_00"):
                voice_base = base[:-3]
                break
        if not voice_base:
            for resource in scenario_resources:
                if isinstance(resource, str):
                    voice_base = re.sub(r"_09_[a-z]$", "", resource)
                    break

        if voice_base:
            scout_talk = card_link_talks_by_resource.get(f"{voice_base}_09_c")
            if scout_talk and not any(
                item.get("resource_id") == scout_talk.get("resource_id") for item in scenario_entries
            ):
                scenario_entries.append(scout_talk)
                scenario_entries.sort(key=lambda item: (
                    0 if item.get("communication_type") == "scout_talk" else 1,
                    item.get("1") if isinstance(item.get("1"), int) else 0,
                ))
                scenario_resources.add(scout_talk["resource_id"])

        operational_voices = classify_card_operational_voices(
            card,
            resource_id,
            voice_base,
            voice_stems,
            curated_cards,
        )
        classified_voice_names = {item["cue"] for item in operational_voices}
        card_text_voice_names = {
            f"{voice_base}_01_01",
            f"{voice_base}_01_09",
        } if voice_base else set()

        all_card_voice_candidates: list[str] = []
        unmapped_voice_candidates: list[str] = []
        if voice_base:
            all_card_voice_candidates = sorted(
                stem for stem in voice_stems if stem.startswith(f"{voice_base}_")
            )
            mapped_prefixes = set(home_cue_names)
            for resource in scenario_resources:
                if isinstance(resource, str):
                    mapped_prefixes.add(resource)
            for stem in all_card_voice_candidates:
                if stem in home_cue_names:
                    continue
                if stem in card_text_voice_names or stem in classified_voice_names:
                    continue
                if any(stem.startswith(f"{prefix}") for prefix in scenario_resources if isinstance(prefix, str)):
                    continue
                unmapped_voice_candidates.append(stem)

        entry = {
            "card_id": card_id,
            "resource_id": resource_id,
            "character_id": character_id,
            "rarity": rarity,
            "ordinal": ordinal,
            "title_full": card.get("13"),
            "title": card.get("40") or card.get("13"),
            "release_at": card.get("18"),
            "limitbreak_item_id": card.get("23"),
            "limitbreak_item": None,
            "release_series": release_series_by_card_id.get(card_id),
            "gameplay": build_card_gameplay(card, card_references),
            "costume_relations": build_card_costume_relations(card, card_references),
            "texts": {
                "normal": card.get("19"),
                "awakened": card.get("22"),
                "extra": card.get("36"),
            },
            "voice_base": voice_base,
            "home_voice_cues": home_cues,
            "scenario_entries": scenario_entries,
            "operational_voice_cues": operational_voices,
            "voice_candidates": {
                "all": all_card_voice_candidates,
                "unmapped_card_only": unmapped_voice_candidates,
            },
            "_source": source(1, {
                "card_id": 1,
                "character_numeric_id": 2,
                "rarity_enum": 3,
                "title_full": 13,
                "resource_id": 14,
                "release_at": 18,
                "normal_text": 19,
                "awakened_text": 22,
                "limitbreak_item_id": 23,
                "extra_text": 36,
                "title": 40,
            }, card.get("_offset")),
        }
        limitbreak_item = card_references["items"].get(card.get("23"), {})
        if limitbreak_item:
            entry["limitbreak_item"] = {
                "id": limitbreak_item.get("1"),
                "name": limitbreak_item.get("6"),
                "description": limitbreak_item.get("7"),
                "resource_id": limitbreak_item.get("4"),
                "short_name": limitbreak_item.get("12"),
                "_source": source(16, {
                    "item_id": 1,
                    "resource_id": 4,
                    "name": 6,
                    "description": 7,
                    "short_name": 12,
                }, limitbreak_item.get("_offset")),
            }
        indexed_cards.append(entry)
        by_character[character_id].append(resource_id)

    indexed_cards.sort(key=lambda item: (item["character_id"], item["card_id"]))
    return {
        "cards": indexed_cards,
        "by_character": {key: sorted(value) for key, value in sorted(by_character.items())},
        "meta": {
            "card_count": len(indexed_cards),
            "home_voice_cue_count": len(card_voice_cues),
            "release_series_count": release_series_count,
            "gameplay_card_count": sum(1 for card in indexed_cards if card.get("gameplay")),
            "card_link_talk_count": sum(
                1
                for card in indexed_cards
                for entry in card.get("scenario_entries", [])
                if entry.get("communication_type") == "scout_talk"
            ),
            "operational_voice_count": sum(len(card.get("operational_voice_cues", [])) for card in indexed_cards),
            "costume_relation_count": sum(len(card.get("costume_relations", [])) for card in indexed_cards),
        },
    }
