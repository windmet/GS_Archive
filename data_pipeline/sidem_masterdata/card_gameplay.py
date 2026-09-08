"""Card attributes, skill effects, parameters and costume relationships from supplied tables."""
from __future__ import annotations

from collections import defaultdict
from typing import Any
from .provenance import source


IDOL_TYPE_NAMES = {
    1: "Physical",
    2: "Intelligence",
    3: "Mental",
    4: "All",
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
