"""Event table decoding and reward projections with explicit evidence provenance."""
from __future__ import annotations

from collections import defaultdict
from typing import Any
from .wire import parse_message
from .provenance import source

EVENT_TABLE_IDS = {10, 70, 112, 113, 114, 124, 126}


def extract_event_tables(records: list[tuple[int, int, int, int, Any]]) -> dict[int, list[dict[str, Any]]]:
    tables: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for top_field, start, payload_start, end, payload in records:
        if top_field not in EVENT_TABLE_IDS or not isinstance(payload, bytes):
            continue
        row = parse_message(payload, nested=True)
        row["_offset"] = start
        tables[top_field].append(row)

    return dict(tables)


def build_event_index(
    tables: dict[int, list[dict[str, Any]]],
    story_tables: dict[str, list[dict[str, Any]]],
    card_index: dict[str, Any],
) -> dict[str, Any]:
    """Normalize event periods and card reward provenance from masterdata."""
    tables = {table_id: tables.get(table_id, []) for table_id in EVENT_TABLE_IDS}

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
