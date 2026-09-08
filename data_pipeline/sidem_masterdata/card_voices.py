"""Card domain projections from explicit masterdata and resource evidence."""
from __future__ import annotations

from typing import Any
from .provenance import source


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
