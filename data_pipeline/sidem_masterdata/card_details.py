"""Explicit card summary/detail split, with the legacy mutation isolated."""
from __future__ import annotations

from copy import deepcopy
from typing import Any


def split_card_index(card_index: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return independent summary and detail outputs without consuming the input."""
    summary = deepcopy(card_index)
    details = extract_card_details_in_place(summary)
    return summary, details


def extract_card_details_in_place(card_index: dict[str, Any]) -> dict[str, Any]:
    """Legacy destructive split; new callers should use split_card_index."""
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
