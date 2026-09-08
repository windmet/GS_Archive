"""Extract useful records from SideM Growing Stars client_master_data.

The iOS cache file is XOR-obfuscated with the repeating ASCII phrase
``DefaultPassPhrase``. The decoded payload is a protobuf stream where each
top-level field number behaves like a table id.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

if __package__:
    from .story_catalog import build_story_catalog
    from .sidem_masterdata.provenance import source
    from .sidem_masterdata.story_tables import extract_scenario_titles
    from .sidem_masterdata.birthday import build_birthday_semantic_catalog
    from .sidem_masterdata.story_index import build_story_master_index
    from .sidem_masterdata.work import build_work_story_index as project_work_story_index, work_story_files
    from .sidem_masterdata.compiled_inputs import load_scenario_payloads
    from .sidem_masterdata.story_resources import (normalize_compiled_resource, compiled_exists, compiled_filename, enrich_resource_row, normalize_release_condition, normalize_term)
    from .sidem_masterdata.episodes import (build_idol_episode_index)
    from .sidem_masterdata.mobile import (build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index)
    from .sidem_masterdata.seasonal import (build_seasonal_communication_index, build_seasonal_campaign_index)
    from .sidem_masterdata.music import build_music_catalog
    from .sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
    from .sidem_masterdata.identities import (maybe_resource_id, idol_id_from_resource, build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary)
else:
    from story_catalog import build_story_catalog
    from sidem_masterdata.provenance import source
    from sidem_masterdata.story_tables import extract_scenario_titles
    from sidem_masterdata.birthday import build_birthday_semantic_catalog
    from sidem_masterdata.story_index import build_story_master_index
    from sidem_masterdata.work import build_work_story_index as project_work_story_index, work_story_files
    from sidem_masterdata.compiled_inputs import load_scenario_payloads
    from sidem_masterdata.story_resources import (normalize_compiled_resource, compiled_exists, compiled_filename, enrich_resource_row, normalize_release_condition, normalize_term)
    from sidem_masterdata.episodes import (build_idol_episode_index)
    from sidem_masterdata.mobile import (build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index)
    from sidem_masterdata.seasonal import (build_seasonal_communication_index, build_seasonal_campaign_index)
    from sidem_masterdata.music import build_music_catalog
    from sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
    from sidem_masterdata.identities import (maybe_resource_id, idol_id_from_resource, build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary)


# Preserve imports used by existing tooling while new wire consumers use the package.
if __package__:
    from .sidem_masterdata import (DEFAULT_KEY, read_varint, xor_decode, decode_masterdata_input,
                                  iter_top_records, decode_string, parse_message,
                                  length_delimited_field_bytes, extract_table_rows)
else:
    from sidem_masterdata import (DEFAULT_KEY, read_varint, xor_decode, decode_masterdata_input,
                                 iter_top_records, decode_string, parse_message,
                                 length_delimited_field_bytes, extract_table_rows)

IDOL_TYPE_NAMES = {
    1: "Physical",
    2: "Intelligence",
    3: "Mental",
    4: "All",
}

OPERATIONAL_VOICE_SUFFIXES = {
    "02_00": ("gasha_change", "スカウト・チェンジ！"),
    "03_01": ("unit_formation", "ユニット編成 1"),
    "03_02": ("unit_formation", "ユニット編成 2"),
    "03_03": ("unit_formation", "ユニット編成 3"),
    "04_01": ("live_start", "ライブ開始"),
    "04_02": ("special_appeal_normal", "スペシャルアピール（通常）"),
    "04_03": ("special_appeal_unit", "スペシャルアピール（ユニット）"),
    "04_04": ("skill_activation", "スキル発動"),
}


PATTERNS = {
    "card_resource": re.compile(r"\b\d{3}[a-z]{3}_(?:n|r|sr|ssr)\d+\b"),
    "costume_or_card": re.compile(r"\b\d{3}[a-z]{3}_\d{3}_\d{2}\b"),
    "scenario_resource": re.compile(r"\b[1259]_[0-9]_[0-9]{3}_[0-9]{2}(?:_[0-9a-z]+)?\b"),
    "asset": re.compile(r"\b(?:bg\d{3}|bgm_|card_|live_|skill_movie_|song3_|system_)"),
    "timecode": re.compile(r"\b\d{2}:\d{2}:\d{2}\b"),
    "jp_text": re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]"),
}


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


def extract_gasha_announcements(
    records: list[tuple[int, int, int, int, Any]],
) -> dict[str, Any]:
    announcements = []
    for top_field, start, payload_start, end, payload in records:
        if top_field != 173 or not isinstance(payload, bytes):
            continue
        row = parse_message(payload, nested=True)
        asset_prefix = row.get("5")
        period = row.get("3")
        if not isinstance(asset_prefix, str) or "announce_gasha_" not in asset_prefix:
            continue
        if not isinstance(period, dict):
            period = {}
        code_match = re.search(r"announce_gasha_(\d+)_", asset_prefix)
        announcements.append({
            "announcement_id": row.get("1"),
            "destination_id": row.get("4"),
            "gasha_code": code_match.group(1) if code_match else "",
            "asset_prefix": asset_prefix,
            "start_at": period.get("1"),
            "end_at": period.get("2"),
            "announcement_type": row.get("6"),
            "_source": source(173, {
                "announcement_id": 1,
                "period": 3,
                "destination_id": 4,
                "asset_prefix": 5,
                "announcement_type": 6,
            }, start),
        })

    announcements.sort(key=lambda item: (item.get("start_at") or 0, item.get("announcement_id") or 0))
    return {
        "announcements": announcements,
        "meta": {
            "count": len(announcements),
            "source_table": 173,
            "relation_note": "Card pickup relations are inferred from LimitbreakItemId (card field 23) plus an exact gasha start timestamp.",
        },
    }


def build_event_index(
    records: list[tuple[int, int, int, int, Any]],
    story_tables: dict[str, list[dict[str, Any]]],
    card_index: dict[str, Any],
) -> dict[str, Any]:
    """Normalize event periods and card reward provenance from masterdata."""
    table_ids = {10, 70, 112, 113, 114, 124, 126}
    tables: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for top_field, start, payload_start, end, payload in records:
        if top_field not in table_ids or not isinstance(payload, bytes):
            continue
        row = parse_message(payload, nested=True)
        row["_offset"] = start
        tables[top_field].append(row)

    cards_by_id = {
        int(card["card_id"]): card
        for card in card_index.get("cards", [])
        if card.get("card_id")
    }
    chapters_by_event_code = {
        int(row["2"]): row
        for row in tables[10]
        if row.get("2")
    }
    story_sections_by_chapter = defaultdict(list)
    for section in story_tables.get("event_groups", []):
        story_sections_by_chapter[int(section.get("2") or 0)].append(section)
    episodes_by_section = defaultdict(list)
    for episode in story_tables.get("event_episodes", []):
        episodes_by_section[int(episode.get("2") or 0)].append(episode)
    story_products_by_group = defaultdict(list)
    for row in tables[70]:
        story_products_by_group[int(row.get("2") or 0)].append(row)

    theater_by_id = {int(row.get("1") or 0): row for row in tables[113]}
    tour_by_id = {int(row.get("1") or 0): row for row in tables[124]}
    theater_rewards = defaultdict(list)
    tour_rewards = defaultdict(list)
    for row in tables[114]:
        theater_rewards[int(row.get("2") or 0)].append(row)
    for row in tables[126]:
        tour_rewards[int(row.get("2") or 0)].append(row)

    def card_product(product: Any) -> dict[str, Any] | None:
        if not isinstance(product, dict):
            return None
        product_type = int(product.get("1") or 0)
        if product_type not in {7, 30}:
            return None
        card_id = int(product.get("2") or 0)
        card = cards_by_id.get(card_id)
        if not card:
            return None
        return {
            "product_type": product_type,
            "reward_kind": "card" if product_type == 7 else "card_fragment",
            "card_id": card_id,
            "card_resource_id": card.get("resource_id"),
            "character_id": card.get("character_id"),
            "rarity": card.get("rarity"),
            "card_title": card.get("title"),
            "amount": int(product.get("3") or 0),
        }

    events = []
    for row in tables[112]:
        event_code = int(row.get("1") or 0)
        event_type = int(row.get("3") or 0)
        detail_id = int(row.get("4") or 0)
        detail = theater_by_id.get(detail_id) if event_type == 1 else tour_by_id.get(detail_id)
        reward_group_id = 0
        point_rows: list[dict[str, Any]] = []
        if event_type == 1 and detail:
            reward_group_id = int(detail.get("4") or 0)
            point_rows = theater_rewards.get(reward_group_id, [])
        elif event_type == 3 and detail:
            reward_group_id = int(detail.get("6") or 0)
            point_rows = tour_rewards.get(reward_group_id, [])

        point_reward_cards = []
        for reward in point_rows:
            product = card_product(reward.get("5"))
            if product:
                point_reward_cards.append({
                    **product,
                    "source": "event_point_reward",
                    "required_points": int(reward.get("3") or 0),
                    "is_limited": bool(reward.get("4")),
                    "_source": source(114 if event_type == 1 else 126, {
                        "id": 1,
                        "group_id": 2,
                        "total_point": 3,
                        "is_limited": 4,
                        "product": 5,
                    }, reward.get("_offset")),
                })

        chapter = chapters_by_event_code.get(event_code)
        story_reward_cards = []
        chapter_id = int(chapter.get("1") or 0) if chapter else 0
        story_sections = story_sections_by_chapter.get(chapter_id, [])
        for story_section in story_sections:
            for episode in episodes_by_section.get(int(story_section.get("1") or 0), []):
                for field, availability in (("7", "archive"), ("9", "in_event_term")):
                    group_id = int(episode.get(field) or 0)
                    for reward in story_products_by_group.get(group_id, []):
                        product = card_product(reward.get("3"))
                        if product:
                            story_reward_cards.append({
                                **product,
                                "source": "event_story_read_reward",
                                "availability": availability,
                                "episode_id": episode.get("1"),
                                "episode_title": episode.get("3"),
                                "episode_resource_id": episode.get("5"),
                                "sort_order": reward.get("4"),
                                "_source": source(70, {
                                    "id": 1,
                                    "group_id": 2,
                                    "product": 3,
                                    "sort_order": 4,
                                }, reward.get("_offset")),
                            })

        term = row.get("5") if isinstance(row.get("5"), dict) else {}
        display_term = row.get("6") if isinstance(row.get("6"), dict) else {}
        events.append({
            "event_code": str(event_code),
            "name": row.get("2") or "",
            "event_type": event_type,
            "event_type_label": {
                1: "theater",
                2: "carnival",
                3: "tour",
                4: "valentine",
                5: "whiteday",
            }.get(event_type, "unknown"),
            "event_detail_id": detail_id,
            "start_at": term.get("1"),
            "end_at": term.get("2"),
            "display_end_at": display_term.get("2"),
            "bgm_resource_id": row.get("14") or "",
            "story_chapter_id": chapter.get("1") if chapter else None,
            "reward_group_id": reward_group_id or None,
            "point_reward_cards": point_reward_cards,
            "story_reward_cards": story_reward_cards,
            "reward_card_ids": sorted({
                item["card_resource_id"]
                for item in point_reward_cards + story_reward_cards
            }),
            "_source": source(112, {
                "event_code": 1,
                "name": 2,
                "event_type": 3,
                "event_detail_id": 4,
                "term": 5,
                "display_term": 6,
                "bgm_resource_id": 14,
            }, row.get("_offset")),
        })

    events.sort(key=lambda event: (event.get("start_at") or 0, event["event_code"]))
    return {
        "schema_version": 1,
        "events": events,
        "by_code": {event["event_code"]: event for event in events},
        "meta": {
            "event_count": len(events),
            "with_point_reward_cards": sum(bool(event["point_reward_cards"]) for event in events),
            "with_story_reward_cards": sum(bool(event["story_reward_cards"]) for event in events),
            "source_tables": [10, 70, 112, 113, 114, 124, 126],
        },
    }


def canonical_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_resource_id: dict[str, dict[str, Any]] = {}
    for card in cards:
        resource_id = card.get("resource_id")
        if not isinstance(resource_id, str) or not resource_id:
            continue
        tutorial = bool(re.match(r"^チュートリアル", str(card.get("title") or ""))) or int(card.get("card_id") or 0) >= 90000000
        score = (0 if tutorial else 100) + len(card.get("home_voice_cues") or []) + len(card.get("scenario_entries") or [])
        current = by_resource_id.get(resource_id)
        if not current or score > current["_canonical_score"]:
            by_resource_id[resource_id] = {**card, "_canonical_score": score}
    return [
        {key: value for key, value in card.items() if key != "_canonical_score"}
        for card in by_resource_id.values()
    ]


def build_gasha_index(
    announcement_index: dict[str, Any],
    card_index: dict[str, Any],
    curated_titles: dict[str, Any],
) -> dict[str, Any]:
    title_entries = curated_titles.get("entries_by_code", {}) if isinstance(curated_titles, dict) else {}
    title_sources = curated_titles.get("sources", {}) if isinstance(curated_titles, dict) else {}

    def resolved_title_entry(code: str) -> dict[str, Any]:
        entry = title_entries.get(code, {}) if isinstance(title_entries, dict) else {}
        if not isinstance(entry, dict):
            return {}
        source = title_sources.get(entry.get("source_ref"), {}) if isinstance(title_sources, dict) else {}
        return {
            **entry,
            "source_type": "curated",
            "source_label": source.get("label", ""),
            "source_url": source.get("url", ""),
            "verified_at": source.get("retrieved_at", ""),
        }

    cards = canonical_cards(card_index.get("cards", []))
    announcements = announcement_index.get("announcements", [])
    announcements_by_start: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for announcement in announcements:
        start_at = announcement.get("start_at")
        if isinstance(start_at, int):
            announcements_by_start[start_at].append(announcement)

    relations_by_card: dict[str, dict[str, Any]] = {}
    relations_by_gasha: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for card in cards:
        if not isinstance(card.get("limitbreak_item_id"), int):
            continue
        matches = announcements_by_start.get(card.get("release_at"), [])
        if len(matches) != 1:
            continue
        announcement = matches[0]
        code = str(announcement.get("gasha_code") or "")
        title_entry = resolved_title_entry(code)
        relation = {
            "card_id": card.get("card_id"),
            "card_resource_id": card.get("resource_id"),
            "character_id": card.get("character_id"),
            "rarity": card.get("rarity"),
            "card_title": card.get("title"),
            "limitbreak_item_id": card.get("limitbreak_item_id"),
            "announcement_id": announcement.get("announcement_id"),
            "destination_id": announcement.get("destination_id"),
            "gasha_code": code,
            "title": title_entry.get("title", ""),
            "title_source": title_entry.get("source_type", "") if title_entry else "",
            "asset_prefix": announcement.get("asset_prefix"),
            "start_at": announcement.get("start_at"),
            "end_at": announcement.get("end_at"),
            "relation_type": "limitbreak_item_and_exact_gasha_start_timestamp",
            "evidence_level": "derived",
        }
        resource_id = card.get("resource_id")
        if isinstance(resource_id, str):
            relations_by_card[resource_id] = relation
        relations_by_gasha[str(announcement.get("announcement_id"))].append(relation)

    for relations in relations_by_gasha.values():
        relations.sort(key=lambda item: (str(item.get("character_id") or ""), int(item.get("card_id") or 0)))

    gashas = []
    for announcement in announcements:
        announcement_id = str(announcement.get("announcement_id"))
        code = str(announcement.get("gasha_code") or "")
        title_entry = resolved_title_entry(code)
        title = title_entry.get("title", "") if isinstance(title_entry, dict) else ""
        banner_file = f"{announcement.get('asset_prefix') or ''}01.png"
        gashas.append({
            "id": announcement_id,
            "code": code,
            "title": title,
            "display_name": title or f"ガシャ {code}",
            "name_known": bool(title),
            "name_source": title_entry if title else {"source_type": "internal_code_fallback"},
            "category": title_entry.get("category", "standard_pickup"),
            "logical_id": title_entry.get("logical_id", f"gasha_{code}"),
            "phase": title_entry.get("phase", "primary"),
            "primary_code": title_entry.get("primary_code", code),
            "is_reprint": bool(title_entry.get("is_reprint", False)),
            "reprint_of": title_entry.get("reprint_of", ""),
            "series": title_entry.get("series", ""),
            "card_set_type": title_entry.get("card_set_type", "new_pickup"),
            "announcement_id": announcement.get("announcement_id"),
            "destination_id": announcement.get("destination_id"),
            "start_at": announcement.get("start_at"),
            "end_at": announcement.get("end_at"),
            "announcement_type": announcement.get("announcement_type"),
            "asset_prefix": announcement.get("asset_prefix"),
            "banner_file": banner_file,
            "banner_url": f"/assets/gasha/{banner_file}",
            "derived_pickup_cards": relations_by_gasha.get(announcement_id, []),
            "pickup_relation_type": "limitbreak_item_and_exact_gasha_start_timestamp",
            "_source": announcement.get("_source"),
        })

    gashas.sort(key=lambda item: (int(item.get("start_at") or 0), int(item.get("announcement_id") or 0)))
    logical_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for gasha in gashas:
        logical_groups[gasha["logical_id"]].append(gasha)

    for logical_id, members in logical_groups.items():
        logical_cards_by_id: dict[str, dict[str, Any]] = {}
        for member in members:
            for card in member.get("derived_pickup_cards", []):
                resource_id = card.get("card_resource_id")
                if isinstance(resource_id, str):
                    logical_cards_by_id[resource_id] = card
        logical_cards = sorted(
            logical_cards_by_id.values(),
            key=lambda item: (str(item.get("character_id") or ""), int(item.get("card_id") or 0)),
        )
        member_codes = [member["code"] for member in members]
        for member in members:
            member["logical_member_codes"] = member_codes
            related_cards = (
                logical_cards if len(members) > 1 and not member.get("derived_pickup_cards") else []
            )
            member["related_pickup_card_ids"] = [
                card["card_resource_id"] for card in related_cards
            ]
            member["related_pickup_count"] = len(related_cards)
            member["related_pickup_source"] = (
                "logical_primary"
                if related_cards
                else ""
            )

    gashas_by_code = {item["code"]: item for item in gashas if item.get("code")}
    for gasha in gashas:
        reprint_source = gashas_by_code.get(gasha.get("reprint_of"))
        if gasha.get("is_reprint") and reprint_source and not gasha.get("derived_pickup_cards"):
            related_cards = reprint_source.get("derived_pickup_cards", [])
            gasha["related_pickup_card_ids"] = [
                card["card_resource_id"] for card in related_cards
            ]
            gasha["related_pickup_count"] = len(related_cards)
            gasha["related_pickup_source"] = "reprint"

    category_counts = Counter(item["category"] for item in gashas if item.get("phase") == "primary")
    phase_counts = Counter(item["phase"] for item in gashas)
    return {
        "schema_version": 2,
        "gashas": gashas,
        "by_id": {item["id"]: item for item in gashas},
        "by_code": gashas_by_code,
        "by_logical_id": {
            logical_id: [item["id"] for item in members]
            for logical_id, members in logical_groups.items()
        },
        "relations_by_card": relations_by_card,
        "relations_by_gasha": dict(relations_by_gasha),
        "meta": {
            "gasha_count": len(gashas),
            "logical_gasha_count": len(logical_groups),
            "named_count": sum(1 for item in gashas if item.get("name_known")),
            "derived_pickup_count": len(relations_by_card),
            "category_counts": dict(sorted(category_counts.items())),
            "phase_counts": dict(sorted(phase_counts.items())),
            "raw_source": "client_master_data table 173 announcement rows",
            "instance_gap": "GashaData values were delivered by GashaListReply and are not present in the saved container.",
        },
    }


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


def build_work_story_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    background_catalog: dict[str, Any],
) -> dict[str, Any]:
    """Compatibility orchestration; the work domain consumes supplied payloads."""
    payloads = load_scenario_payloads(compiled_dir, work_story_files(tables, compiled_stems))
    return project_work_story_index(
        tables, compiled_stems, compiled_summaries, idol_unit_dictionary, background_catalog, payloads
    )


def build_background_catalog(tables: dict[int, list[dict[str, Any]]], bg_dir: Path | None = None) -> dict[str, Any]:
    bg_files = {path.stem for path in bg_dir.glob("*.png")} if bg_dir and bg_dir.exists() else set()
    backgrounds: dict[str, dict[str, Any]] = {}
    for row in tables.get(107, []):
        bg_id = row.get("5")
        if not isinstance(bg_id, str):
            continue
        backgrounds.setdefault(bg_id, {
            "bg_resource_id": bg_id,
            "names": [],
            "descriptions": [],
            "picture_studio_spots": [],
            "asset_exists": bg_id in bg_files if bg_files else None,
            "_sources": [],
        })
        entry = backgrounds[bg_id]
        if row.get("2") not in entry["names"]:
            entry["names"].append(row.get("2"))
        if row.get("7") not in entry["descriptions"]:
            entry["descriptions"].append(row.get("7"))
        entry["picture_studio_spots"].append(row.get("1"))
        entry["_sources"].append(source(107, {"spot_name": 2, "bg_resource_id": 5, "description": 7}, row.get("_offset")))
    for row in tables.get(108, []):
        bg_id = row.get("6")
        if not isinstance(bg_id, str):
            continue
        backgrounds.setdefault(bg_id, {
            "bg_resource_id": bg_id,
            "names": [],
            "descriptions": [],
            "picture_studio_scenes": [],
            "effects": [],
            "asset_exists": bg_id in bg_files if bg_files else None,
            "_sources": [],
        })
        entry = backgrounds[bg_id]
        entry.setdefault("picture_studio_scenes", []).append({"id": row.get("1"), "variant": row.get("3")})
        if row.get("8") not in entry["descriptions"]:
            entry["descriptions"].append(row.get("8"))
        if isinstance(row.get("7"), str):
            entry.setdefault("effects", []).append(row.get("7"))
        entry["_sources"].append(source(108, {"scene_variant": 3, "bg_resource_id": 6, "effect": 7, "description": 8}, row.get("_offset")))
    for row in tables.get(110, []):
        bg_id = row.get("2")
        if not isinstance(bg_id, str):
            continue
        backgrounds.setdefault(bg_id, {
            "bg_resource_id": bg_id,
            "names": [],
            "descriptions": [],
            "asset_exists": bg_id in bg_files if bg_files else None,
            "_sources": [],
        })
        backgrounds[bg_id]["_sources"].append(source(110, {"bg_resource_id": 2}, row.get("_offset")))
    for entry in backgrounds.values():
        entry["_source"] = entry["_sources"][0] if entry["_sources"] else None
    return {"backgrounds": backgrounds, "meta": {"background_count": len(backgrounds), "asset_probe_available": bool(bg_files)}}


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

    previews: dict[str, dict[str, Any]] = {}
    for base, file_name in base_to_file.items():
        path = compiled_dir / file_name
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            continue

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


def collect_voice_stems(voice_dir: Path | None) -> set[str]:
    if not voice_dir or not voice_dir.exists():
        return set()
    return {path.stem for path in voice_dir.rglob("*.m4a")}


def build_card_parameter(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or not isinstance(raw.get("1"), int):
        return None
    initial = raw.get("1")
    awakening_step = raw.get("2") if isinstance(raw.get("2"), int) else 0
    limitbreak_step = raw.get("3") if isinstance(raw.get("3"), int) else 0
    idol_limitbreak_step = raw.get("4") if isinstance(raw.get("4"), int) else 0
    return {
        "initial": initial,
        "max_unlimit": initial + awakening_step,
        "max_limitbreak": initial + awakening_step + limitbreak_step * 4,
        "awakening_step": awakening_step,
        "limitbreak_step": limitbreak_step,
        "idol_limitbreak_step": idol_limitbreak_step,
    }


def render_skill_description(template: str, level: dict[str, Any], effects: list[dict[str, Any]]) -> str:
    replacements = {
        "interval": level.get("11"),
        "calc_rate": level.get("10"),
        "period": level.get("12"),
    }
    if effects and isinstance(effects[0].get("4"), int):
        replacements["d01"] = effects[0]["4"]
    rendered = template
    for key, value in replacements.items():
        if value is not None:
            rendered = rendered.replace(f"<{key}>", str(value))
    return rendered


def build_card_reference_maps(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    skill_levels: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in tables.get(21, []):
        if isinstance(row.get("2"), int):
            skill_levels[row["2"]].append(row)
    skill_effects: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in tables.get(40, []):
        if isinstance(row.get("2"), int):
            skill_effects[row["2"]].append(row)
    return {
        "idols": {row.get("1"): row for row in tables.get(2, []) if isinstance(row.get("1"), int)},
        "skills": {row.get("1"): row for row in tables.get(20, []) if isinstance(row.get("1"), int)},
        "centers": {row.get("1"): row for row in tables.get(23, []) if isinstance(row.get("1"), int)},
        "items": {row.get("1"): row for row in tables.get(16, []) if isinstance(row.get("1"), int)},
        "skill_categories": {
            row.get("1"): row for row in tables.get(75, []) if isinstance(row.get("1"), int)
        },
        "center_skill_categories": {
            row.get("1"): row for row in tables.get(130, []) if isinstance(row.get("1"), int)
        },
        "skill_levels": skill_levels,
        "skill_effects": skill_effects,
        "live_costumes": {row.get("1"): row for row in tables.get(27, []) if isinstance(row.get("1"), int)},
        "story_costumes": {row.get("1"): row for row in tables.get(28, []) if isinstance(row.get("1"), int)},
    }


def build_card_gameplay(card: dict[str, Any], references: dict[str, Any]) -> dict[str, Any]:
    idol_rows = references["idols"]
    skill_rows = references["skills"]
    center_rows = references["centers"]
    skill_levels = references["skill_levels"]
    skill_effects = references["skill_effects"]
    skill_categories = references["skill_categories"]
    center_skill_categories = references["center_skill_categories"]

    idol = idol_rows.get(card.get("2"), {})
    idol_type = idol.get("7")
    parameters = {
        "visual": build_card_parameter(card.get("9")),
        "vocal": build_card_parameter(card.get("10")),
        "dance": build_card_parameter(card.get("11")),
    }
    appeal = {
        key: sum(parameter.get(key, 0) for parameter in parameters.values() if parameter)
        for key in ("initial", "max_unlimit", "max_limitbreak")
    }

    skill_id = card.get("5")
    skill_row = skill_rows.get(skill_id, {})
    skill_category_id = skill_row.get("8")
    skill_category = skill_categories.get(skill_category_id, {})
    level_entries = []
    for level in sorted(skill_levels.get(skill_id, []), key=lambda item: item.get("3") or 0):
        effect_group_id = level.get("8")
        effects = sorted(
            skill_effects.get(effect_group_id, []),
            key=lambda item: (item.get("9") or 0, item.get("1") or 0),
        )
        template = skill_row.get("3") if isinstance(skill_row.get("3"), str) else ""
        level_entries.append({
            "level": level.get("3"),
            "rate": level.get("10"),
            "interval": level.get("11"),
            "duration": level.get("12"),
            "effect_group_id": effect_group_id,
            "description": render_skill_description(template, level, effects),
            "effects": [
                {
                    "id": effect.get("1"),
                    "value": effect.get("4"),
                }
                for effect in effects
            ],
            "_source": source(21, {
                "skill_id": 2,
                "level": 3,
                "effect_group_id": 8,
                "rate": 10,
                "interval": 11,
                "duration": 12,
            }, level.get("_offset")),
        })

    center_id = card.get("6")
    center = center_rows.get(center_id, {})
    return {
        "attribute": {
            "id": idol_type,
            "name": IDOL_TYPE_NAMES.get(idol_type, "Unknown"),
            "_source": source(2, {"idol_id": 1, "idol_type": 7}, idol.get("_offset")),
        },
        "life": card.get("12"),
        "parameters": parameters,
        "appeal": appeal,
        "skill": {
            "id": skill_id,
            "name": skill_row.get("2"),
            "description_template": skill_row.get("3"),
            "category": {
                "id": skill_category_id,
                "name": skill_category.get("2"),
                "color": skill_category.get("3"),
                "icon": skill_category.get("4"),
                "_source": source(75, {
                    "category_id": 1,
                    "name": 2,
                    "color": 3,
                    "icon": 4,
                }, skill_category.get("_offset")),
            },
            "levels": level_entries,
            "_source": source(20, {
                "skill_id": 1,
                "name": 2,
                "description_template": 3,
                "skill_level_group_id": 4,
                "skill_detail_group_id": 5,
                "category_id": 8,
            }, skill_row.get("_offset")),
        },
        "center_skill": {
            "id": center_id,
            "name": center.get("2"),
            "description": center.get("3"),
            "category": {
                "id": center.get("9"),
                "name": center_skill_categories.get(center.get("9"), {}).get("2"),
                "_source": source(130, {
                    "category_id": 1,
                    "name": 2,
                }, center_skill_categories.get(center.get("9"), {}).get("_offset")),
            },
            "_source": source(23, {
                "center_skill_id": 1,
                "name": 2,
                "description": 3,
                "category_id": 9,
            }, center.get("_offset")),
        },
        "_source": source(1, {
            "skill_id": 5,
            "center_skill_id": 6,
            "visual": 9,
            "vocal": 10,
            "dance": 11,
            "life": 12,
        }, card.get("_offset")),
    }


def build_card_costume_relations(card: dict[str, Any], references: dict[str, Any]) -> list[dict[str, Any]]:
    live_costumes = references["live_costumes"]
    story_costumes = references["story_costumes"]
    specs = [
        ("live_initial", "Live 普通", 45, 27, live_costumes),
        ("live_awakened", "Live 特训", 46, 27, live_costumes),
        ("live_limitbreak", "Live 突破", 47, 27, live_costumes),
        ("story_initial", "剧情普通", 48, 28, story_costumes),
        ("story_awakened", "剧情特训", 49, 28, story_costumes),
        ("story_limitbreak", "剧情突破", 50, 28, story_costumes),
        ("home_initial", "主页默认", 51, 28, story_costumes),
        ("home_awakened", "主页特训", 52, 28, story_costumes),
    ]
    relations = []
    for slot, label, card_field, table_id, lookup in specs:
        costume_id = card.get(str(card_field))
        if not isinstance(costume_id, int):
            continue
        costume = lookup.get(costume_id, {})
        relations.append({
            "slot": slot,
            "label": label,
            "costume_id": costume_id,
            "name": costume.get("3"),
            "description": costume.get("4"),
            "model_resource_id": costume.get("5"),
            "release_at": costume.get("6"),
            "_source": source(table_id, {
                "costume_id": 1,
                "idol_numeric_id": 2,
                "name": 3,
                "description": 4,
                "model_resource_id": 5,
                "release_at": 6,
            }, costume.get("_offset")),
            "_card_source": source(1, {"costume_id": card_field}, card.get("_offset")),
        })
    return relations


def classify_card_operational_voices(
    card: dict[str, Any],
    resource_id: str,
    voice_base: str | None,
    voice_stems: set[str],
    curated_cards: dict[str, Any],
) -> list[dict[str, Any]]:
    if not voice_base:
        return []
    curated_card = curated_cards.get(resource_id, {}) if isinstance(curated_cards, dict) else {}
    curated_voices = curated_card.get("voices", {}) if isinstance(curated_card, dict) else {}
    entries = []
    for suffix, (category, label) in OPERATIONAL_VOICE_SUFFIXES.items():
        cue = f"{voice_base}_{suffix}"
        if cue not in voice_stems:
            continue
        curated = curated_voices.get(cue, {}) if isinstance(curated_voices, dict) else {}
        raw_text = card.get("36") if suffix == "02_00" and isinstance(card.get("36"), str) else ""
        text = raw_text or (curated.get("text") if isinstance(curated, dict) else "") or ""
        text_source = "masterdata" if raw_text else ("curated" if text else "audio_only")
        entry = {
            "cue": cue,
            "category": category,
            "label": label,
            "text": text,
            "text_source": text_source,
            "audio_exists": True,
        }
        if text_source == "masterdata":
            entry["_source"] = source(1, {"gasha_voice_text": 36}, card.get("_offset"))
        elif text_source == "curated":
            entry["source_url"] = curated_card.get("source_url")
            entry["verified_at"] = curated_card.get("verified_at")
            entry["mapping_basis"] = curated_card.get("mapping_basis")
        entries.append(entry)
    return entries


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


def build_card_detail_index(card_index: dict[str, Any]) -> dict[str, Any]:
    details: dict[str, dict[str, Any]] = {}
    skills: dict[str, dict[str, Any]] = {}
    center_skills: dict[str, dict[str, Any]] = {}
    costumes: dict[str, dict[str, Any]] = {}
    items: dict[str, dict[str, Any]] = {}

    for card in card_index.get("cards", []):
        resource_id = card.get("resource_id")
        if not isinstance(resource_id, str):
            continue
        gameplay = card.pop("gameplay", {})
        limitbreak_item = card.pop("limitbreak_item", None)
        if isinstance(limitbreak_item, dict) and isinstance(limitbreak_item.get("id"), int):
            items[str(limitbreak_item["id"])] = limitbreak_item
        skill = gameplay.pop("skill", {}) if isinstance(gameplay, dict) else {}
        center_skill = gameplay.pop("center_skill", {}) if isinstance(gameplay, dict) else {}
        skill_id = skill.get("id") if isinstance(skill, dict) else None
        center_skill_id = center_skill.get("id") if isinstance(center_skill, dict) else None
        if isinstance(skill_id, int):
            skills[str(skill_id)] = skill
            gameplay["skill_id"] = skill_id
        if isinstance(center_skill_id, int):
            center_skills[str(center_skill_id)] = center_skill
            gameplay["center_skill_id"] = center_skill_id

        costume_refs = []
        for relation in card.pop("costume_relations", []):
            costume_id = relation.get("costume_id")
            table_id = (relation.get("_source") or {}).get("table")
            if not isinstance(costume_id, int) or table_id not in (27, 28):
                continue
            domain = "live" if table_id == 27 else "story"
            costume_key = f"{domain}:{costume_id}"
            costumes[costume_key] = {
                key: value
                for key, value in relation.items()
                if key not in {"slot", "label", "_card_source"}
            }
            costume_refs.append({
                "slot": relation.get("slot"),
                "label": relation.get("label"),
                "costume_key": costume_key,
                "_source": relation.get("_card_source"),
            })

        operational_voices = card.pop("operational_voice_cues", [])
        details[resource_id] = {
            "gameplay": gameplay,
            "costume_relations": costume_refs,
            "operational_voice_cues": operational_voices,
        }
        card["detail_available"] = True

    return {
        "cards_by_resource_id": details,
        "skills_by_id": skills,
        "center_skills_by_id": center_skills,
        "items_by_id": items,
        "costumes_by_key": costumes,
        "meta": {
            "card_count": len(details),
            "skill_count": len(skills),
            "center_skill_count": len(center_skills),
            "item_count": len(items),
            "costume_count": len(costumes),
            "operational_voice_count": sum(
                len(item.get("operational_voice_cues", [])) for item in details.values()
            ),
            "costume_relation_count": sum(
                len(item.get("costume_relations", [])) for item in details.values()
            ),
        },
    }


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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "--input-state",
        choices=("xor", "decoded"),
        default="xor",
        help=(
            "State of the positional input. The historical default is 'xor'; "
            "use 'decoded' for client_master_data.xor_DefaultPassPhrase.pb."
        ),
    )
    parser.add_argument("--out-dir", type=Path, default=Path(".analysis/masterdata"))
    parser.add_argument("--public-out-dir", type=Path)
    parser.add_argument("--compiled-dir", type=Path)
    parser.add_argument("--voice-dir", type=Path)
    parser.add_argument("--spines-index", type=Path)
    parser.add_argument("--prefab-meta", type=Path)
    parser.add_argument("--bg-dir", type=Path)
    parser.add_argument(
        "--seasonal-campaign-only",
        action="store_true",
        help="Generate only seasonal_campaign_index.json with its local identity relations.",
    )
    parser.add_argument(
        "--work-story-only",
        action="store_true",
        help="Generate only work_story_index.json with scene lines and short stories.",
    )
    parser.add_argument(
        "--idol-communication-only",
        action="store_true",
        help="Generate only idol_episode_index.json, mobile_archive_index.json and the corrected home interaction index.",
    )
    parser.add_argument(
        "--birthday-semantic-only",
        action="store_true",
        help=(
            "Generate only birthday_story_semantic_index.json from tables "
            "76/77/78/80/86."
        ),
    )
    parser.add_argument(
        "--music-catalog-only",
        action="store_true",
        help="Generate only music_catalog.json, including complete table-133 relations.",
    )
    parser.add_argument(
        "--movie-announce-only",
        action="store_true",
        help="Generate only movie_announce_index.json from table 175.",
    )
    parser.add_argument(
        "--card-skill-movie-only",
        action="store_true",
        help=(
            "Generate only card_skill_movie_index.json from CardData table 1 "
            "records whose HasSkillCutinResource field is true."
        ),
    )
    parser.add_argument(
        "--song-movie-only",
        action="store_true",
        help=(
            "Generate only song_movie_index.json from SongData table 46 "
            "MovieOffset and enabled MvliveOpenAt records."
        ),
    )
    parser.add_argument(
        "--curated-card-voices",
        type=Path,
        default=Path(__file__).resolve().parent / "curated" / "card_voice_transcripts.json",
    )
    parser.add_argument(
        "--curated-gasha-titles",
        type=Path,
        default=Path(__file__).resolve().parent / "curated" / "gasha_titles.json",
    )
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    decoded = decode_masterdata_input(args.input.read_bytes(), args.input_state)
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)

    records = list(iter_top_records(decoded))
    compiled_stems = collect_compiled_stems(args.compiled_dir)
    compiled_summaries = collect_compiled_summaries(args.compiled_dir)
    if args.birthday_semantic_only:
        birthday_tables = extract_scenario_titles(records)
        birthday_semantic_index = build_birthday_semantic_catalog(birthday_tables)
        filename = "birthday_story_semantic_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(birthday_semantic_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(birthday_semantic_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {birthday_semantic_index.get('meta', {})}")
        return
    if args.movie_announce_only:
        movie_tables = extract_table_rows(records, {175})
        movie_announce_index = build_movie_announce_index(movie_tables)
        filename = "movie_announce_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(movie_announce_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(movie_announce_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {movie_announce_index['meta']}")
        return
    if args.card_skill_movie_only:
        card_tables = extract_table_rows(records, {1})
        card_skill_movie_index = build_card_skill_movie_index(card_tables)
        filename = "card_skill_movie_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(card_skill_movie_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(card_skill_movie_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {card_skill_movie_index['meta']}")
        return
    if args.song_movie_only:
        song_tables = extract_table_rows(records, {46})
        song_movie_index = build_song_movie_index(song_tables)
        filename = "song_movie_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(song_movie_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(song_movie_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {song_movie_index['meta']}")
        return
    if args.music_catalog_only:
        music_tables = extract_table_rows(records, {46, 112, 133})
        music_catalog = build_music_catalog(music_tables)
        filename = "music_catalog.json"
        (args.out_dir / filename).write_text(
            json.dumps(music_catalog, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(music_catalog, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {music_catalog['meta']}")
        return
    if args.idol_communication_only:
        communication_tables = extract_table_rows(
            records,
            {
                2, 7, 8, 9, 20, 21, 23, 24, 32, 34, 36, 43, 44, 63, 68,
                94, 96, 98, 103, 104, 105, 106, 180,
            },
        )
        communication_idols = build_idol_unit_dictionary(communication_tables)
        selected_outputs = {
            "idol_episode_index.json": build_idol_episode_index(
                communication_tables, compiled_stems, compiled_summaries, communication_idols
            ),
            "mobile_archive_index.json": build_mobile_archive_index(
                communication_tables, compiled_stems, compiled_summaries, communication_idols
            ),
            "home_interaction_index.json": build_home_interaction_index(
                communication_tables, compiled_stems, compiled_summaries
            ),
        }
        for filename, data in selected_outputs.items():
            (args.out_dir / filename).write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            for filename, data in selected_outputs.items():
                (args.public_out_dir / filename).write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
                )
        print(f"decoded: {decoded_path}")
        for filename, data in selected_outputs.items():
            print(f"{filename}: {data.get('meta', {})}")
        return
    if args.seasonal_campaign_only:
        seasonal_tables = extract_table_rows(
            records,
            {2, 20, 21, 100, 112, 146, 147, 148, 149, 150, 153, 159, 162, 165, 168},
        )
        seasonal_idols = build_idol_unit_dictionary(seasonal_tables)
        seasonal_speakers = build_speaker_dictionary(seasonal_tables, seasonal_idols)
        seasonal_campaign_index = build_seasonal_campaign_index(
            seasonal_tables,
            compiled_stems,
            compiled_summaries,
            seasonal_idols,
            seasonal_speakers,
        )
        filename = "seasonal_campaign_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(seasonal_campaign_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(seasonal_campaign_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {len(seasonal_campaign_index['campaigns'])} campaigns")
        return
    if args.work_story_only:
        work_tables = extract_table_rows(records, {2, 20, 21, 53, 54, 55, 107, 108, 110})
        work_idols = build_idol_unit_dictionary(work_tables)
        work_backgrounds = build_background_catalog(work_tables, args.bg_dir)
        work_story_index = build_work_story_index(
            work_tables,
            args.compiled_dir,
            compiled_stems,
            compiled_summaries,
            work_idols,
            work_backgrounds,
        )
        filename = "work_story_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(work_story_index, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(work_story_index, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {len(work_story_index['idols'])} idols")
        return
    voice_stems = collect_voice_stems(args.voice_dir)
    spine_ids = load_spine_ids(args.spines_index)
    prefab_models = load_prefab_models(args.prefab_meta)
    curated_card_voices = load_json_file(args.curated_card_voices) or {}
    curated_gasha_titles = load_json_file(args.curated_gasha_titles) or {}
    card_parameters = extract_card_parameters(records)
    story_tables = extract_scenario_titles(records)
    gasha_announcement_index = extract_gasha_announcements(records)
    card_voice_cues = extract_card_voice_cues(records)
    card_home_voice_previews = collect_card_home_voice_previews(
        card_voice_cues,
        args.compiled_dir,
        compiled_stems,
    )
    catalog_tables = extract_table_rows(
        records,
        {
            2, 7, 8, 9, 16, 20, 21, 23, 24, 27, 28, 29, 32, 34, 36, 40, 43, 44,
            46, 53, 54, 55, 63, 68, 90, 94, 96, 98, 100, 101, 103, 104,
            75, 105, 106, 107, 108, 110, 112, 130, 133, 146, 147, 148, 149, 150,
            153, 159, 162, 165, 168, 175, 176, 180,
        },
    )
    idol_unit_dictionary = build_idol_unit_dictionary(catalog_tables)
    speaker_dictionary = build_speaker_dictionary(catalog_tables, idol_unit_dictionary)
    costume_dictionary = build_costume_dictionary(catalog_tables, idol_unit_dictionary, spine_ids, prefab_models)
    idol_episode_index = build_idol_episode_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
    )
    mobile_archive_index = build_mobile_archive_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
    )
    home_interaction_index = build_home_interaction_index(catalog_tables, compiled_stems, compiled_summaries)
    short_adv_profile_index = build_short_adv_profile_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_communication_index = build_seasonal_communication_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_campaign_index = build_seasonal_campaign_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
        speaker_dictionary,
    )
    background_catalog = build_background_catalog(catalog_tables, args.bg_dir)
    work_story_index = build_work_story_index(
        catalog_tables,
        args.compiled_dir,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
        background_catalog,
    )
    music_catalog = build_music_catalog(catalog_tables)
    movie_announce_index = build_movie_announce_index(catalog_tables)
    card_skill_movie_index = build_card_skill_movie_index(catalog_tables)
    song_movie_index = build_song_movie_index(catalog_tables)
    face_dictionary = build_face_dictionary(catalog_tables)
    story_master_index = build_story_master_index(story_tables, compiled_stems, compiled_summaries)
    birthday_story_semantic_index = build_birthday_semantic_catalog(story_tables)
    card_index = build_card_index(
        card_parameters,
        card_voice_cues,
        card_home_voice_previews,
        story_tables,
        catalog_tables,
        voice_stems,
        compiled_stems,
        compiled_summaries,
        curated_card_voices,
    )
    card_detail_index = build_card_detail_index(card_index)
    gasha_index = build_gasha_index(gasha_announcement_index, card_index, curated_gasha_titles)
    event_index = build_event_index(records, story_tables, card_index)
    validation_report = build_validation_report(
        story_tables,
        card_voice_cues,
        card_home_voice_previews,
        compiled_stems,
        voice_stems,
    )
    outputs = {
        "story_catalog.json": build_story_catalog(story_master_index),
        "masterdata_table_scan.json": build_table_scan(records),
        "card_parameter_field1_extract.json": card_parameters,
        "story_related_tables_extract.json": story_tables,
        "card_voice_cue_field91_extract.json": card_voice_cues,
        "card_home_voice_preview_extract.json": card_home_voice_previews,
        "story_master_index.json": story_master_index,
        "birthday_story_semantic_index.json": birthday_story_semantic_index,
        "gasha_announcement_index.json": gasha_announcement_index,
        "gasha_index.json": gasha_index,
        "event_index.json": event_index,
        "card_index.json": card_index,
        "card_detail_index.json": card_detail_index,
        "idol_unit_dictionary.json": idol_unit_dictionary,
        "speaker_dictionary.json": speaker_dictionary,
        "costume_dictionary.json": costume_dictionary,
        "idol_episode_index.json": idol_episode_index,
        "mobile_archive_index.json": mobile_archive_index,
        "home_interaction_index.json": home_interaction_index,
        "short_adv_profile_index.json": short_adv_profile_index,
        "seasonal_communication_index.json": seasonal_communication_index,
        "seasonal_campaign_index.json": seasonal_campaign_index,
        "work_story_index.json": work_story_index,
        "background_catalog.json": background_catalog,
        "music_catalog.json": music_catalog,
        "movie_announce_index.json": movie_announce_index,
        "card_skill_movie_index.json": card_skill_movie_index,
        "song_movie_index.json": song_movie_index,
        "face_dictionary.json": face_dictionary,
        "masterdata_validation_report.json": validation_report,
        "archive_summary.json": build_archive_summary(
            story_master_index,
            card_index,
            validation_report,
        ),
        "040ren_ssr03_probe.json": build_card_probe(card_index, "040ren_ssr03"),
    }
    for filename, data in outputs.items():
        (args.out_dir / filename).write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    if args.public_out_dir:
        args.public_out_dir.mkdir(parents=True, exist_ok=True)
        for filename in (
            "story_master_index.json",
            "story_catalog.json",
            "gasha_announcement_index.json",
            "gasha_index.json",
            "event_index.json",
            "card_index.json",
            "card_detail_index.json",
            "idol_unit_dictionary.json",
            "speaker_dictionary.json",
            "costume_dictionary.json",
            "idol_episode_index.json",
            "mobile_archive_index.json",
            "home_interaction_index.json",
            "short_adv_profile_index.json",
            "seasonal_communication_index.json",
            "seasonal_campaign_index.json",
            "work_story_index.json",
            "background_catalog.json",
            "music_catalog.json",
            "movie_announce_index.json",
            "card_skill_movie_index.json",
            "song_movie_index.json",
            "face_dictionary.json",
            "masterdata_validation_report.json",
        ):
            (args.public_out_dir / filename).write_text(
                json.dumps(outputs[filename], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    print(f"decoded: {decoded_path}")
    for filename, data in outputs.items():
        if isinstance(data, list):
            count = len(data)
        elif isinstance(data, dict):
            count = len(data)
        else:
            count = 1
        print(f"{filename}: {count} records")


if __name__ == "__main__":
    main()
