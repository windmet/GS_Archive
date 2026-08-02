#!/usr/bin/env python3
"""Normalize table-46 field 7 without treating category-3 values as unit IDs.

The committed music catalog is a derived masterdata projection.  Category 2
uses field 7 value 2 as an exact unit id; category 3 uses the same physical
slot as a non-unit selector.  This deterministic migration keeps both raw
numbers while exposing that semantic distinction explicitly.
"""

from __future__ import annotations

import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"


def normalize_selector(song: dict) -> dict:
    legacy = song.pop("unit_mapping", None)
    current = song.get("performance_selector")
    source = current or legacy or {}
    category = source.get("category")
    selector_id = source.get("selector_id", source.get("unit_id"))
    if category not in {2, 3} or not isinstance(selector_id, int):
        raise ValueError(f"invalid table-46 field-7 selector: {source!r}")
    if category == 2:
        normalized = {
            "category": 2,
            "kind": "unit",
            "selector_id": selector_id,
            "unit_id": selector_id,
        }
    else:
        normalized = {
            "category": 3,
            "kind": "collective_or_special",
            "selector_id": selector_id,
            "unit_id": None,
        }
    song["performance_selector"] = normalized
    fields = song.get("_source", {}).get("fields", {})
    if "unit_mapping" in fields:
        fields["performance_selector"] = fields.pop("unit_mapping")
    return normalized


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    songs = catalog.get("songs") or {}
    if len(songs) != 61:
        raise ValueError(f"expected 61 music catalog songs, found {len(songs)}")
    counts = {"unit": 0, "collective_or_special": 0}
    for song in songs.values():
        selector = normalize_selector(song)
        counts[selector["kind"]] += 1
    if counts != {"unit": 47, "collective_or_special": 14}:
        raise ValueError(f"unexpected selector counts: {counts}")
    meta = catalog.setdefault("meta", {})
    meta.pop("unresolved_special_selector_song_count", None)
    meta["collective_or_special_song_count"] = counts["collective_or_special"]
    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Normalized 61 selectors: 47 unit / 14 collective-or-special")


if __name__ == "__main__":
    main()
