"""Announcement evidence and derived gasha relations; no resource or publication IO."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any
from .wire import parse_message
from .provenance import source
from .cards import canonical_cards


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
