"""Pure episodes projections; resource evidence is supplied by the caller."""
from __future__ import annotations

from collections import defaultdict
from typing import Any
from .provenance import source
from .story_resources import compiled_filename, normalize_release_condition


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
