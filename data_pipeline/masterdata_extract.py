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


DEFAULT_KEY = b"DefaultPassPhrase"

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


def read_varint(data: bytes, pos: int, end: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while pos < end:
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7
    raise EOFError("truncated varint")


def xor_decode(data: bytes, key: bytes = DEFAULT_KEY) -> bytes:
    return bytes(byte ^ key[i % len(key)] for i, byte in enumerate(data))


def iter_top_records(data: bytes):
    pos = 0
    end = len(data)
    while pos < end:
        start = pos
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 2:
            length, pos = read_varint(data, pos, end)
            payload_start = pos
            pos += length
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        elif wire_type == 0:
            value, pos = read_varint(data, pos, end)
            yield field_no, start, pos, pos, value
        elif wire_type == 1:
            payload_start = pos
            pos += 8
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        elif wire_type == 5:
            payload_start = pos
            pos += 4
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        else:
            raise ValueError(f"unsupported top-level wire type {wire_type} at {start:#x}")


def decode_string(raw: bytes) -> str | None:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not text:
        return ""
    printable = sum(ch.isprintable() or ch in "\r\n\t" for ch in text) / len(text)
    return text if printable > 0.85 else None


def parse_message(data: bytes, nested: bool = False) -> dict[str, Any]:
    pos = 0
    end = len(data)
    out: dict[str, Any] = {}
    multi: dict[str, list[Any]] = {}

    def put(field_no: int, value: Any) -> None:
        key = str(field_no)
        if key in out:
            if key not in multi:
                multi[key] = [out[key]]
            multi[key].append(value)
            out[key] = multi[key]
        else:
            out[key] = value

    while pos < end:
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 0:
            value, pos = read_varint(data, pos, end)
            put(field_no, value)
        elif wire_type == 2:
            length, pos = read_varint(data, pos, end)
            raw = data[pos : pos + length]
            pos += length
            text = decode_string(raw)
            if text is not None:
                put(field_no, text)
            elif nested:
                put(field_no, parse_message(raw, nested=False))
            else:
                put(field_no, raw.hex())
        elif wire_type == 1:
            put(field_no, data[pos : pos + 8].hex())
            pos += 8
        elif wire_type == 5:
            put(field_no, data[pos : pos + 4].hex())
            pos += 4
        else:
            put(field_no, f"unsupported_wire_{wire_type}")
            break
    return out


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
        "birthday_episodes": [],
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
        78: "birthday_episodes",
        144: "extra_story_groups",
        145: "extra_story_episodes",
    }
    for top_field, start, payload_start, end, payload in records:
        name = mapping.get(top_field)
        if not name or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload)
        parsed["_top_field"] = top_field
        parsed["_offset"] = start
        tables[name].append(parsed)
    return tables


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


def extract_table_rows(
    records: list[tuple[int, int, int, int, Any]],
    table_ids: set[int],
    *,
    nested: bool = True,
) -> dict[int, list[dict[str, Any]]]:
    tables: dict[int, list[dict[str, Any]]] = {table_id: [] for table_id in table_ids}
    for top_field, start, payload_start, end, payload in records:
        if top_field not in table_ids or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=nested)
        parsed["_top_field"] = top_field
        parsed["_offset"] = start
        tables[top_field].append(parsed)
    return tables


def source(table: int, fields: dict[str, int], offset: int | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"table": table, "fields": fields}
    if offset is not None:
        out["offset"] = offset
    return out


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


def maybe_resource_id(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def idol_id_from_resource(resource_id: str | None) -> int | None:
    if not resource_id:
        return None
    match = re.match(r"^(\d{3})[a-z0-9]{3}", resource_id)
    return int(match.group(1)) if match else None


def build_idol_unit_dictionary(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    units_by_id: dict[int, dict[str, Any]] = {}
    for row in tables.get(24, []):
        unit_id = row.get("1")
        if not isinstance(unit_id, int):
            continue
        units_by_id[unit_id] = {
            "unit_id": unit_id,
            "unit_name": row.get("2"),
            "unit_code": row.get("3"),
            "unit_color": row.get("4"),
            "unit_kana": row.get("7"),
            "description": row.get("8"),
            "representative_bg": row.get("9"),
            "_source": source(24, {
                "unit_id": 1,
                "unit_name": 2,
                "unit_code": 3,
                "unit_color": 4,
                "unit_kana": 7,
                "description": 8,
                "representative_bg": 9,
            }, row.get("_offset")),
        }

    idols = []
    idols_by_code: dict[str, dict[str, Any]] = {}
    idols_by_numeric_id: dict[str, dict[str, Any]] = {}
    for row in tables.get(2, []):
        idol_id = row.get("1")
        idol_code = row.get("10")
        if not isinstance(idol_id, int) or not isinstance(idol_code, str):
            continue
        unit_relation_candidate = row.get("32") if isinstance(row.get("32"), int) else None
        entry = {
            "idol_id": idol_id,
            "idol_code": idol_code,
            "display_name": row.get("12") or row.get("13") or row.get("14"),
            "name_fields": {
                "f12": row.get("12"),
                "f13": row.get("13"),
                "f14": row.get("14"),
                "kana": row.get("15"),
            },
            "age": row.get("16"),
            "height": row.get("18"),
            "weight": row.get("19"),
            "birthplace": row.get("20"),
            "cv": row.get("21"),
            "hobby": row.get("23"),
            "specialty": row.get("25"),
            "color": row.get("26") or row.get("39"),
            "birthday": row.get("29"),
            "zodiac": row.get("30"),
            "former_job": row.get("31"),
            "unit_relation_candidate_f32": unit_relation_candidate,
            "unit_id": None,
            "unit_code": None,
            "unit_name": None,
            "representative_bg": row.get("38"),
            "_source": source(2, {
                "idol_id": 1,
                "idol_code": 10,
                "display_name": 12,
                "kana": 15,
                "age": 16,
                "height": 18,
                "weight": 19,
                "birthplace": 20,
                "cv": 21,
                "hobby": 23,
                "specialty": 25,
                "color": 26,
                "birthday": 29,
                "zodiac": 30,
                "former_job": 31,
                "unit_relation_candidate_f32": 32,
                "representative_bg": 38,
            }, row.get("_offset")),
        }
        idols.append(entry)
        idols_by_code[idol_code] = entry
        idols_by_numeric_id[str(idol_id)] = entry

    return {
        "idols": idols,
        "units": list(units_by_id.values()),
        "by_idol_code": idols_by_code,
        "by_numeric_id": idols_by_numeric_id,
        "by_unit_id": {str(key): value for key, value in units_by_id.items()},
        "meta": {"idol_count": len(idols), "unit_count": len(units_by_id)},
    }


def build_speaker_dictionary(tables: dict[int, list[dict[str, Any]]], idol_dictionary: dict[str, Any]) -> dict[str, Any]:
    speakers: dict[str, dict[str, Any]] = {}
    for idol in idol_dictionary.get("idols", []):
        code = idol.get("idol_code")
        if not code:
            continue
        speakers[code] = {
            "speaker_id": code,
            "speaker_type": "idol",
            "display_name": idol.get("display_name"),
            "kana": (idol.get("name_fields") or {}).get("kana"),
            "idol_id": idol.get("idol_id"),
            "unit_name": idol.get("unit_name"),
            "_source": idol.get("_source"),
        }

    for row in tables.get(29, []):
        label_id = row.get("1")
        label = row.get("2")
        if label_id is None or not isinstance(label, str):
            continue
        key = f"group:{label_id}"
        speakers[key] = {
            "speaker_id": key,
            "speaker_type": "group_label",
            "display_name": label,
            "_source": source(29, {"label_id": 1, "display_name": 2}, row.get("_offset")),
        }

    for row in tables.get(100, []):
        npc_id = row.get("1")
        name = row.get("2")
        code = row.get("4")
        if npc_id is None or not isinstance(name, str):
            continue
        key = code if isinstance(code, str) and code else f"npc:{npc_id}"
        speakers[key] = {
            "speaker_id": key,
            "speaker_type": "npc",
            "npc_id": npc_id,
            "display_name": name,
            "npc_code": code,
            "category": row.get("5"),
            "birthday": row.get("9"),
            "_source": source(100, {"npc_id": 1, "display_name": 2, "npc_code": 4, "category": 5, "birthday": 9}, row.get("_offset")),
        }

    return {"speakers": speakers, "meta": {"speaker_count": len(speakers)}}


def build_costume_dictionary(
    tables: dict[int, list[dict[str, Any]]],
    idol_dictionary: dict[str, Any],
    spine_ids: set[str],
    prefab_models: dict[str, Any],
) -> dict[str, Any]:
    idols_by_numeric = idol_dictionary.get("by_numeric_id", {})
    costumes_by_model: dict[str, dict[str, Any]] = {}
    table_counts = Counter()
    for table_id in (28, 27):
        for row in tables.get(table_id, []):
            model_resource_id = maybe_resource_id(row.get("5"))
            if not model_resource_id:
                continue
            idol_num = row.get("2") if isinstance(row.get("2"), int) else idol_id_from_resource(model_resource_id)
            idol = idols_by_numeric.get(str(idol_num)) if idol_num is not None else None
            existing = costumes_by_model.get(model_resource_id)
            sources = list(existing.get("_sources", [])) if existing else []
            sources.append(source(table_id, {
                "costume_id": 1,
                "idol_numeric_id": 2,
                "costume_name": 3,
                "description": 4,
                "model_resource_id": 5,
                "release_at": 6,
                "relation_id": 7,
            }, row.get("_offset")))
            costumes_by_model[model_resource_id] = {
                "costume_id": row.get("1"),
                "idol_numeric_id": idol_num,
                "idol_code": idol.get("idol_code") if idol else model_resource_id[:6],
                "idol_name": idol.get("display_name") if idol else None,
                "unit_name": idol.get("unit_name") if idol else None,
                "costume_name": row.get("3"),
                "description": row.get("4"),
                "model_resource_id": model_resource_id,
                "release_at": row.get("6"),
                "relation_id": row.get("7"),
                "spine_exists": model_resource_id in spine_ids if spine_ids else None,
                "prefab_meta_exists": model_resource_id in prefab_models if prefab_models else None,
                "source_tables": sorted({s["table"] for s in sources}),
                "_source": sources[-1],
                "_sources": sources,
            }
            table_counts[table_id] += 1

    return {
        "costumes": sorted(costumes_by_model.values(), key=lambda item: item["model_resource_id"]),
        "by_model_resource_id": costumes_by_model,
        "meta": {
            "costume_count": len(costumes_by_model),
            "source_row_counts": {str(key): value for key, value in sorted(table_counts.items())},
            "spine_index_available": bool(spine_ids),
            "prefab_meta_available": bool(prefab_models),
        },
    }


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


def build_idol_episode_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
) -> dict[str, Any]:
    idols = idol_unit_dictionary.get("by_numeric_id", {})
    products_by_group: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in tables.get(68, []):
        product = row.get("3") if isinstance(row.get("3"), dict) else {}
        products_by_group[row.get("2")].append({
            "id": row.get("1"),
            "group_id": row.get("2"),
            "product_type": product.get("1"),
            "product_id": product.get("2"),
            "amount": product.get("3"),
            "sort_order": row.get("4"),
            "_source": source(68, {
                "id": 1, "group_id": 2, "product": 3, "sort_order": 4,
            }, row.get("_offset")),
        })

    episodes_by_section: dict[int, list[dict[str, Any]]] = defaultdict(list)
    by_episode_id: dict[str, dict[str, Any]] = {}
    compiled_episode_count = 0
    for row in tables.get(9, []):
        resource_id = row.get("6")
        compiled_file = compiled_filename(resource_id, compiled_stems) if isinstance(resource_id, str) else None
        episode = {
            "id": row.get("1"),
            "section_id": row.get("2"),
            "name": row.get("3"),
            "release_condition": normalize_release_condition(row.get("4")),
            "open_at": row.get("5"),
            "resource_id": resource_id,
            "sort_order": row.get("7"),
            "product_group_id": row.get("8"),
            "character_set_id": row.get("9"),
            "products": products_by_group.get(row.get("8"), []),
            "compiled_file": compiled_file,
            "compiled_exists": bool(compiled_file),
            "_source": source(9, {
                "id": 1, "section_id": 2, "name": 3, "release_condition": 4,
                "open_at": 5, "resource_id": 6, "sort_order": 7,
                "product_group_id": 8, "character_set_id": 9,
            }, row.get("_offset")),
        }
        episodes_by_section[row.get("2")].append(episode)
        by_episode_id[str(row.get("1"))] = {
            "id": row.get("1"),
            "section_id": row.get("2"),
            "resource_id": resource_id,
            "compiled_file": compiled_file,
        }
        if compiled_file:
            compiled_episode_count += 1

    sections_by_chapter: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in tables.get(8, []):
        section_episodes = sorted(
            episodes_by_section.get(row.get("1"), []),
            key=lambda item: item.get("sort_order") or 0,
        )
        section = {
            "id": row.get("1"),
            "chapter_id": row.get("2"),
            "name": row.get("3"),
            "release_condition": normalize_release_condition(row.get("4")),
            "open_at": row.get("5"),
            "background_resource_id": row.get("6"),
            "sort_order": row.get("7"),
            "product_group_id": row.get("8"),
            "scenario_title": row.get("9"),
            "products": products_by_group.get(row.get("8"), []),
            "episodes": section_episodes,
            "_source": source(8, {
                "id": 1, "chapter_id": 2, "name": 3, "release_condition": 4,
                "open_at": 5, "background_resource_id": 6, "sort_order": 7,
                "product_group_id": 8, "scenario_title": 9,
            }, row.get("_offset")),
        }
        sections_by_chapter[row.get("2")].append(section)

    chapters = []
    by_idol_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in tables.get(7, []):
        idol = idols.get(str(row.get("2")), {})
        chapter_sections = sorted(
            sections_by_chapter.get(row.get("1"), []),
            key=lambda item: item.get("sort_order") or 0,
        )
        chapter = {
            "id": row.get("1"),
            "idol_id": row.get("2"),
            "idol_code": idol.get("idol_code"),
            "idol_name": idol.get("display_name") or row.get("3"),
            "name": row.get("3"),
            "release_condition": normalize_release_condition(row.get("4")),
            "open_at": row.get("5"),
            "resource_id": row.get("6"),
            "sort_order": row.get("7"),
            "bgm_resource_id": row.get("8"),
            "sections": chapter_sections,
            "_source": source(7, {
                "id": 1, "idol_id": 2, "name": 3, "release_condition": 4,
                "open_at": 5, "resource_id": 6, "sort_order": 7, "bgm_resource_id": 8,
            }, row.get("_offset")),
        }
        chapters.append(chapter)
        if chapter["idol_code"]:
            by_idol_code[chapter["idol_code"]].append(chapter)

    return {
        "schema_version": 1,
        "chapters": sorted(chapters, key=lambda item: item.get("sort_order") or 0),
        "by_idol_code": dict(by_idol_code),
        "by_episode_id": by_episode_id,
        "meta": {
            "chapter_count": len(chapters),
            "section_count": sum(len(item["sections"]) for item in chapters),
            "episode_count": len(by_episode_id),
            "product_count": sum(len(items) for items in products_by_group.values()),
            "compiled_episode_count": compiled_episode_count,
        },
    }


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


def build_seasonal_communication_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rows = []
    family_by_table = {159: "valentine_idol", 162: "valentine_support", 165: "white_day_idol", 168: "white_day_support"}
    for table_id, family in family_by_table.items():
        for row in tables.get(table_id, []):
            entry = enrich_resource_row(
                row,
                table_id,
                "5",
                compiled_stems,
                compiled_summaries,
                {"id": 1, "group_or_year": 2, "speaker_or_idol": 3, "episode_no": 4, "resource_id": 5, "title": 9},
            )
            entry.update({
                "family": family,
                "season": "valentine" if family.startswith("valentine") else "white_day",
                "participant_type": "support" if family.endswith("support") else "idol",
                "participant_numeric_id": row.get("3"),
                "title": row.get("9"),
            })
            rows.append(entry)
    return {"communications": rows, "meta": {"communication_count": len(rows)}}


def build_seasonal_campaign_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    speaker_dictionary: dict[str, Any],
) -> dict[str, Any]:
    event_rows = {
        row.get("1"): row
        for row in tables.get(112, [])
        if row.get("1") in {40001, 40002, 50001, 50002}
    }
    idols = idol_unit_dictionary.get("by_numeric_id", {})
    speakers = speaker_dictionary.get("speakers", {})
    speaker_by_npc = {
        entry.get("npc_id"): entry
        for entry in speakers.values()
        if isinstance(entry, dict) and isinstance(entry.get("npc_id"), int)
    }
    # Seasonal ids use 101/102 even though the president's generic NPC id is 901.
    support_by_seasonal_id = {
        101: speakers.get("101ken"),
        102: speakers.get("102sha"),
    }
    support_by_seasonal_id.update({key: value for key, value in speaker_by_npc.items() if key in {101, 102}})

    family_tables = {
        "valentine": ((159, "idol"), (162, "support")),
        "white_day": ((165, "idol"), (168, "support")),
    }
    participant_levels: dict[tuple[int, str, int], int] = {}
    for row in tables.get(147, []):
        participant_levels[(row.get("2"), "idol", row.get("3"))] = row.get("4")
    for row in tables.get(148, []):
        participant_levels[(row.get("2"), "support", row.get("3"))] = row.get("4")

    campaigns = []
    by_code = {}
    for detail_id in (1, 2):
        year = 2021 + detail_id
        for season, event_code in (("valentine", 40000 + detail_id), ("white_day", 50000 + detail_id)):
            event = event_rows.get(event_code, {})
            participant_rows: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
            introduction = []
            for table_id, participant_type in family_tables[season]:
                for row in tables.get(table_id, []):
                    if row.get("2") != detail_id:
                        continue
                    resource_id = row.get("5")
                    compiled_file = compiled_filename(resource_id, compiled_stems) if isinstance(resource_id, str) else None
                    episode = {
                        "id": row.get("1"),
                        "episode_no": row.get("4"),
                        "title": row.get("9"),
                        "required_valentine_level": row.get("6"),
                        "reward": row.get("7") or row.get("8"),
                        "resource_id": resource_id,
                        "playback_entity_id": normalize_compiled_resource(resource_id) if isinstance(resource_id, str) else None,
                        "compiled_file": compiled_file,
                        "compiled_exists": bool(compiled_file),
                        "compiled_summary": compiled_summaries.get(Path(compiled_file).stem) if compiled_file else None,
                        "_source": source(table_id, {
                            "id": 1,
                            "campaign_detail_id": 2,
                            "participant_numeric_id": 3,
                            "episode_no": 4,
                            "resource_id": 5,
                            "required_valentine_level": 6,
                            "reward": 7 if season == "valentine" else 8,
                            "title": 9,
                        }, row.get("_offset")),
                    }
                    participant_id = row.get("3")
                    if not isinstance(participant_id, int):
                        introduction.append(episode)
                    else:
                        participant_rows[(participant_type, participant_id)].append(episode)

            participants = []
            for (participant_type, participant_id), episodes in sorted(participant_rows.items(), key=lambda item: item[0][1]):
                identity = idols.get(str(participant_id)) or idols.get(participant_id) if participant_type == "idol" else support_by_seasonal_id.get(participant_id)
                identity = identity if isinstance(identity, dict) else {}
                participants.append({
                    "participant_type": participant_type,
                    "participant_numeric_id": participant_id,
                    "participant_code": identity.get("idol_code") or identity.get("speaker_id"),
                    "display_name": identity.get("display_name"),
                    "level_group_id": participant_levels.get((detail_id, participant_type, participant_id)),
                    "episodes": episodes,
                    "playback_entity_count": len({item["playback_entity_id"] for item in episodes if item["playback_entity_id"]}),
                })

            campaign = {
                "id": f"{season}_{year}",
                "year": year,
                "season": season,
                "event_code": event_code,
                "campaign_detail_id": detail_id,
                "name": event.get("2"),
                "term": event.get("5"),
                "archive_term": event.get("6"),
                "bgm_resource_id": event.get("14"),
                "paired_campaign_id": f"{'white_day' if season == 'valentine' else 'valentine'}_{year}",
                "introduction": introduction,
                "participants": participants,
                "level_groups": [row for row in tables.get(149, []) if row.get("2") in {
                    participant.get("level_group_id") for participant in participants
                }],
                "ranking_reward_rules": [row for row in tables.get(150, []) if season == "valentine" and row.get("2") == detail_id],
                "playback_entity_count": len({
                    episode["playback_entity_id"]
                    for participant in participants
                    for episode in participant["episodes"]
                    if episode["playback_entity_id"]
                }) + len({item["playback_entity_id"] for item in introduction if item["playback_entity_id"]}),
                "_source": source(112, {
                    "event_code": 1,
                    "name": 2,
                    "campaign_type": 3,
                    "campaign_detail_id": 4,
                    "term": 5,
                    "archive_term": 6,
                    "bgm_resource_id": 14,
                }, event.get("_offset")),
            }
            campaigns.append(campaign)
            by_code[str(event_code)] = campaign["id"]

    cycles = [
        {
            "year": year,
            "valentine_campaign_id": f"valentine_{year}",
            "white_day_campaign_id": f"white_day_{year}",
            "relation_source": source(153, {"white_day_detail_id": 1, "valentine_detail_id": 2}, row.get("_offset")),
        }
        for row in tables.get(153, [])
        for year in [2021 + row.get("1")]
    ]
    return {
        "schema_version": 1,
        "campaigns": campaigns,
        "by_id": {item["id"]: item for item in campaigns},
        "by_event_code": by_code,
        "cycles": cycles,
        "meta": {
            "campaign_count": len(campaigns),
            "cycle_count": len(cycles),
            "raw_episode_count": sum(
                len(item["introduction"]) + sum(len(participant["episodes"]) for participant in item["participants"])
                for item in campaigns
            ),
            "playback_entity_count": sum(item["playback_entity_count"] for item in campaigns),
            "classification": "seasonal_campaign",
        },
    }


def build_work_story_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    background_catalog: dict[str, Any],
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
        if not compiled_file or not compiled_dir:
            return {}
        path = compiled_dir / compiled_file
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            return {}
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


def build_music_catalog(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {}
    bgm = {}
    for row in tables.get(46, []):
        code = row.get("4")
        if not isinstance(code, str):
            continue
        songs[code] = {
            "song_code": code,
            "title": row.get("5"),
            "kana": row.get("6"),
            "credits": row.get("8"),
            "links": [value for value in (row.get("9"), row.get("10")) if isinstance(value, str)],
            "_source": source(46, {"song_code": 4, "title": 5, "kana": 6, "credits": 8, "links": 9}, row.get("_offset")),
        }
    for row in tables.get(112, []):
        resource = row.get("14")
        if not isinstance(resource, str):
            continue
        bgm[resource] = {
            "bgm_resource_id": resource,
            "title": row.get("2"),
            "event_id": row.get("1"),
            "_source": source(112, {"event_id": 1, "title": 2, "bgm_resource_id": 14}, row.get("_offset")),
        }
    for row in tables.get(133, []):
        for field in ("3", "4", "5", "6"):
            resource = row.get(field)
            if not isinstance(resource, str):
                continue
            bgm.setdefault(resource, {
                "bgm_resource_id": resource,
                "title": None,
                "seasonal_variants": [],
                "_source": source(133, {"bgm_resource_id": int(field)}, row.get("_offset")),
            })
            bgm[resource].setdefault("seasonal_variants", []).append({
                "table_id": 133,
                "row_id": row.get("1"),
                "field": int(field),
            })
    return {"songs": songs, "bgm": bgm, "meta": {"song_count": len(songs), "bgm_count": len(bgm)}}


def build_face_dictionary(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    faces = {}
    for row in tables.get(176, []):
        base = row.get("3")
        evolved = row.get("4")
        if not isinstance(base, str):
            continue
        faces[base] = {
            "base_face": base,
            "evolution_face": evolved,
            "_source": source(176, {"base_face": 3, "evolution_face": 4}, row.get("_offset")),
        }
    return {"faces": faces, "meta": {"face_count": len(faces)}}


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
            "levels": level_entries,
            "_source": source(20, {
                "skill_id": 1,
                "name": 2,
                "description_template": 3,
                "skill_level_group_id": 4,
                "skill_detail_group_id": 5,
            }, skill_row.get("_offset")),
        },
        "center_skill": {
            "id": center_id,
            "name": center.get("2"),
            "description": center.get("3"),
            "_source": source(23, {"center_skill_id": 1, "name": 2, "description": 3}, center.get("_offset")),
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

    for card in card_index.get("cards", []):
        resource_id = card.get("resource_id")
        if not isinstance(resource_id, str):
            continue
        gameplay = card.pop("gameplay", {})
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
        "costumes_by_key": costumes,
        "meta": {
            "card_count": len(details),
            "skill_count": len(skills),
            "center_skill_count": len(center_skills),
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
    decoded = xor_decode(args.input.read_bytes())
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)

    records = list(iter_top_records(decoded))
    compiled_stems = collect_compiled_stems(args.compiled_dir)
    compiled_summaries = collect_compiled_summaries(args.compiled_dir)
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
            2, 7, 8, 9, 20, 21, 23, 24, 27, 28, 29, 32, 34, 36, 40, 43, 44,
            46, 53, 54, 55, 63, 68, 90, 94, 96, 98, 100, 101, 103, 104,
            105, 106, 107, 108, 110, 112, 133, 146, 147, 148, 149, 150,
            153, 159, 162, 165, 168, 176, 180,
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
    face_dictionary = build_face_dictionary(catalog_tables)
    story_master_index = build_story_master_index(story_tables, compiled_stems, compiled_summaries)
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
        "masterdata_table_scan.json": build_table_scan(records),
        "card_parameter_field1_extract.json": card_parameters,
        "story_related_tables_extract.json": story_tables,
        "card_voice_cue_field91_extract.json": card_voice_cues,
        "card_home_voice_preview_extract.json": card_home_voice_previews,
        "story_master_index.json": story_master_index,
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
