"""Background identity projection over supplied asset stems."""
from __future__ import annotations

from typing import Any
from .provenance import source


def build_background_catalog(tables: dict[int, list[dict[str, Any]]], bg_files: set[str]) -> dict[str, Any]:
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
