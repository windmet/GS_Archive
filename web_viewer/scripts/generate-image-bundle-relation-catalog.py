#!/usr/bin/env python3
"""Catalog RAW image_* Unity bundles without exporting their image payloads."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

import UnityPy


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PROJECT_ROOT.parent
DATA_PIPELINE_ROOT = REPOSITORY_ROOT / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "data" / "image_bundle_relation_catalog.json"
MASTERDATA_ROOT = PROJECT_ROOT / "public" / "data" / "masterdata"
SPEAKER_DICTIONARY = MASTERDATA_ROOT / "speaker_dictionary.json"
EVENT_INDEX = MASTERDATA_ROOT / "event_index.json"
GASHA_INDEX = MASTERDATA_ROOT / "gasha_index.json"
SEASONAL_CAMPAIGN_INDEX = MASTERDATA_ROOT / "seasonal_campaign_index.json"
CHARACTER_PROMOTIONS = (
    PROJECT_ROOT
    / "public"
    / "data"
    / "assets"
    / "raw_character_image_promotions.json"
)
IMAGE_OBJECT_TYPES = {"Sprite", "Texture2D"}

CONSUMERS = {
    "bg": "background-surface",
    "campaign": "seasonal-campaign",
    "chara": "character-surface",
    "emojis": "mobile-communication",
    "gasha": "archive-gasha",
    "home": "archive-home",
    "homelogo": "archive-home",
    "honor": "honor-profile",
    "idol": "idol-profile",
    "item": "inventory-item",
    "live": "live-ui",
    "loginbonus": "seasonal-campaign",
    "logos": "title-ui",
    "main": "story-ui",
    "mobile": "mobile-communication",
    "picturestudio": "picture-studio",
    "shop": "shop",
    "shoplineup": "shop",
    "story": "story-ui",
    "tips": "support-ui",
    "title": "title-ui",
    "tutorial": "support-ui",
    "unit": "unit-idol-ui",
    "work": "work-ui",
}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized_number(value: object) -> int | float | None:
    if not isinstance(value, (int, float)):
        return None
    parsed = float(value)
    return int(parsed) if parsed.is_integer() else parsed


def family_for(stem: str) -> str:
    parts = stem.split("_")
    return parts[1] if len(parts) > 1 else "other"


def tracked_png_index() -> dict[str, list[str]]:
    result = subprocess.run(
        ["git", "ls-files", "web_viewer/public/assets/**/*.png"],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="strict",
        check=True,
    )
    by_basename: dict[str, list[str]] = defaultdict(list)
    for relative_path in result.stdout.splitlines():
        if relative_path:
            by_basename[PurePosixPath(relative_path).name.lower()].append(relative_path)
    return {
        basename: sorted(paths)
        for basename, paths in sorted(by_basename.items())
    }


def masterdata_identities() -> list[tuple[str, str, str]]:
    speakers = read_json(SPEAKER_DICTIONARY).get("speakers") or {}
    events = read_json(EVENT_INDEX).get("events") or []
    gashas = read_json(GASHA_INDEX).get("gashas") or []
    campaigns = read_json(SEASONAL_CAMPAIGN_INDEX).get("campaigns") or []
    identities = [
        ("speaker_dictionary.speakers", str(key), "alphanumeric")
        for key in speakers
    ]
    identities.extend(
        ("event_index.events", str(row["event_code"]), "numeric")
        for row in events
        if row.get("event_code") is not None
    )
    for row in gashas:
        for field in ("id", "code"):
            if row.get(field) is not None:
                identities.append(
                    (f"gasha_index.gashas.{field}", str(row[field]), "numeric")
                )
    for row in campaigns:
        if row.get("event_code") is not None:
            identities.append(
                (
                    "seasonal_campaign_index.campaigns",
                    str(row["event_code"]),
                    "numeric",
                )
            )
    return sorted(set(identities))


def character_promotions() -> dict[str, list[dict[str, Any]]]:
    registry = read_json(CHARACTER_PROMOTIONS)
    if registry.get("schema_version") != 1:
        raise ValueError("Character-image promotion registry must use schema_version 1")
    by_raw_path: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in registry.get("entries") or []:
        raw_source = entry.get("raw_source") or {}
        unity_object = entry.get("unity_object") or {}
        output = entry.get("output") or {}
        raw_path = str(raw_source.get("relative_path") or "")
        if not raw_path.startswith("RAW/asset/"):
            raise ValueError(f"Invalid promoted RAW path: {raw_path!r}")
        by_raw_path[raw_path.removeprefix("RAW/")].append(
            {
                "kind": entry.get("kind"),
                "idol_code": entry.get("idol_code"),
                "asset_url": entry.get("asset_url"),
                "raw_source": {
                    "relative_path": raw_path,
                    "bytes": raw_source.get("bytes"),
                    "sha256": raw_source.get("sha256"),
                },
                "unity_object": {
                    "path_id": str(unity_object.get("path_id")),
                    "object_type": unity_object.get("object_type"),
                    "asset_name": unity_object.get("asset_name"),
                    "container_path": unity_object.get("container_path"),
                },
                "output": {
                    "bytes": output.get("bytes"),
                    "width": output.get("width"),
                    "height": output.get("height"),
                    "sha256": output.get("sha256"),
                },
            }
        )
    return {
        raw_path: sorted(
            rows,
            key=lambda row: (str(row["kind"]), str(row["idol_code"])),
        )
        for raw_path, rows in sorted(by_raw_path.items())
    }


def contains_identity(context: str, key: str, boundary: str) -> bool:
    escaped = re.escape(key)
    if boundary == "numeric":
        return re.search(rf"(?<![0-9]){escaped}(?![0-9])", context) is not None
    return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", context) is not None


def object_name(data: object) -> str | None:
    value = getattr(data, "m_Name", getattr(data, "name", None))
    return str(value) if value not in (None, "") else None


def image_object_record(
    obj: object,
    container_paths: list[str],
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "type": obj.type.name,
        "path_id": str(obj.path_id),
        "name": None,
        "container_paths": container_paths,
        "dimensions": None,
        "texture_path_id": None,
        "probe_state": "read",
    }
    try:
        data = obj.read()
        record["name"] = object_name(data)
        if obj.type.name == "Texture2D":
            width = normalized_number(
                getattr(data, "m_Width", getattr(data, "width", None))
            )
            height = normalized_number(
                getattr(data, "m_Height", getattr(data, "height", None))
            )
        else:
            rect = getattr(data, "m_Rect", None)
            width = normalized_number(getattr(rect, "width", None))
            height = normalized_number(getattr(rect, "height", None))
            render_data = getattr(data, "m_RD", None)
            texture = getattr(render_data, "texture", None)
            texture_path_id = int(
                getattr(texture, "m_PathID", getattr(texture, "path_id", 0)) or 0
            )
            if texture_path_id:
                record["texture_path_id"] = str(texture_path_id)
        if width is not None and height is not None:
            record["dimensions"] = {"width": width, "height": height}
    except Exception:
        record["probe_state"] = "read-failed"
    return record


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    raw_asset_root = (sources.raw_root / "asset").resolve()
    if not raw_asset_root.is_dir():
        raise FileNotFoundError(f"Missing RAW asset root: {raw_asset_root}")

    files = sorted(
        raw_asset_root.glob("image_*.unity3d"),
        key=lambda path: path.name.lower(),
    )
    public_pngs = tracked_png_index()
    identities = masterdata_identities()
    promotions_by_raw_path = character_promotions()
    entries = []

    for index, path in enumerate(files, start=1):
        print(f"[{index:04d}/{len(files)}] {path.stem}", flush=True)
        with path.open("rb") as stream:
            magic = stream.read(7).decode("ascii", errors="replace")
        if magic != "UnityFS":
            raise ValueError(f"Unexpected Unity bundle magic for {path.name}: {magic!r}")

        env = UnityPy.load(str(path))
        object_type_counts = Counter(obj.type.name for obj in env.objects)
        paths_by_id: dict[int, list[str]] = defaultdict(list)
        container_entries = []
        for container_path, pointer in env.container.items():
            normalized_path = str(container_path).replace("\\", "/")
            path_id = int(pointer.path_id)
            paths_by_id[path_id].append(normalized_path)
            container_entries.append(
                {
                    "path": normalized_path,
                    "type": pointer.type.name,
                    "path_id": str(path_id),
                }
            )
        container_entries.sort(
            key=lambda row: (row["path"], row["type"], int(row["path_id"]))
        )
        for path_id in paths_by_id:
            paths_by_id[path_id] = sorted(set(paths_by_id[path_id]))

        image_objects = [
            image_object_record(obj, paths_by_id.get(int(obj.path_id), []))
            for obj in env.objects
            if obj.type.name in IMAGE_OBJECT_TYPES
        ]
        image_objects.sort(
            key=lambda row: (
                row["type"],
                row["name"] or "",
                int(row["path_id"]),
            )
        )

        context_parts = [path.stem]
        context_parts.extend(row["path"] for row in container_entries)
        context_parts.extend(
            row["name"] for row in image_objects if row["name"] is not None
        )
        context = "\n".join(context_parts).lower()
        masterdata_tokens = [
            {
                "catalog": catalog,
                "key": key,
                "evidence": "exact delimiter-bounded identity in bundle or Unity object metadata",
            }
            for catalog, key, boundary in identities
            if contains_identity(context, key.lower(), boundary)
        ]

        organizer_candidates = []
        for image_object in image_objects:
            basenames = {
                PurePosixPath(container_path).name.lower()
                for container_path in image_object["container_paths"]
            }
            if image_object["name"]:
                basenames.add(f"{image_object['name']}.png".lower())
            tracked_paths = sorted(
                {
                    public_path
                    for basename in basenames
                    for public_path in public_pngs.get(basename, [])
                }
            )
            if tracked_paths:
                organizer_candidates.append(
                    {
                        "object_path_id": image_object["path_id"],
                        "object_name": image_object["name"],
                        "tracked_public_paths": tracked_paths,
                        "state": "basename-candidate",
                    }
                )
        organizer_candidates.sort(
            key=lambda row: (int(row["object_path_id"]), row["object_name"] or "")
        )

        family = family_for(path.stem)
        consumer = CONSUMERS.get(family, "unclassified-image-surface")
        relative_raw_path = f"asset/{path.name}"
        stable_promotions = promotions_by_raw_path.get(relative_raw_path, [])
        images_by_path_id = {
            image_object["path_id"]: image_object
            for image_object in image_objects
        }
        for promotion in stable_promotions:
            unity_object = promotion["unity_object"]
            image_object = images_by_path_id.get(unity_object["path_id"])
            if (
                image_object is None
                or image_object["type"] != unity_object["object_type"]
                or image_object["name"] != unity_object["asset_name"]
                or unity_object["container_path"] not in image_object["container_paths"]
            ):
                raise ValueError(
                    f"Promotion registry Unity evidence drifted for "
                    f"{path.name}:{unity_object['path_id']}"
                )
        stat = path.stat()
        raw_sha256 = sha256_file(path)
        for promotion in stable_promotions:
            raw_source = promotion["raw_source"]
            if (
                raw_source.get("bytes") != stat.st_size
                or raw_source.get("sha256") != raw_sha256
            ):
                raise ValueError(
                    f"Promotion registry RAW evidence drifted for {path.name}"
                )

        if stable_promotions:
            mapping_state = "stable-promotion"
        elif organizer_candidates:
            mapping_state = "organizer-export-candidate"
        elif masterdata_tokens:
            mapping_state = "masterdata-candidate"
        elif consumer != "unclassified-image-surface":
            mapping_state = "filename-candidate"
        else:
            mapping_state = "unresolved"
        entries.append(
            {
                "id": path.stem,
                "family": family,
                "raw": {
                    "relative_path": relative_raw_path,
                    "filename": path.name,
                    "bytes": stat.st_size,
                    "sha256": raw_sha256,
                    "container": "unityfs",
                    "magic": magic,
                },
                "unity": {
                    "object_type_counts": dict(sorted(object_type_counts.items())),
                    "container_entries": container_entries,
                    "image_objects": image_objects,
                },
                "masterdata_tokens": masterdata_tokens,
                "consumer_candidates": [
                    {
                        "consumer": consumer,
                        "state": "filename-candidate",
                        "evidence": f"image_{family} filename family",
                    }
                ],
                "organizer_export_candidates": organizer_candidates,
                "stable_promotions": stable_promotions,
                "mapping": {
                    "state": mapping_state,
                    "evidence": (
                        "Exact stable promotion is proven by the committed character-image "
                        "promotion registry."
                        if stable_promotions
                        else "Catalog relation only; no image payload was exported or published."
                    ),
                },
            }
        )

    family_counts = Counter(entry["family"] for entry in entries)
    mapping_counts = Counter(entry["mapping"]["state"] for entry in entries)
    object_type_counts = Counter()
    for entry in entries:
        object_type_counts.update(entry["unity"]["object_type_counts"])
    payload = {
        "schema_version": 1,
        "sources": {
            "raw_asset_root": "RAW/asset",
            "tracked_public_assets": "git:web_viewer/public/assets/**/*.png",
            "stable_promotion_registry": (
                "web_viewer/public/data/assets/raw_character_image_promotions.json"
            ),
            "masterdata_catalogs": [
                "web_viewer/public/data/masterdata/event_index.json",
                "web_viewer/public/data/masterdata/gasha_index.json",
                "web_viewer/public/data/masterdata/seasonal_campaign_index.json",
                "web_viewer/public/data/masterdata/speaker_dictionary.json",
            ],
        },
        "summary": {
            "bundles": len(entries),
            "total_bytes": sum(entry["raw"]["bytes"] for entry in entries),
            "unity_objects": sum(object_type_counts.values()),
            "container_entries": sum(
                len(entry["unity"]["container_entries"]) for entry in entries
            ),
            "image_objects": sum(
                len(entry["unity"]["image_objects"]) for entry in entries
            ),
            "sprite_objects": object_type_counts["Sprite"],
            "texture_objects": object_type_counts["Texture2D"],
            "direct_sprite_texture_links": sum(
                1
                for entry in entries
                for obj in entry["unity"]["image_objects"]
                if obj["type"] == "Sprite" and obj["texture_path_id"] is not None
            ),
            "families": dict(sorted(family_counts.items())),
            "mapping_states": dict(sorted(mapping_counts.items())),
        },
        "entries": entries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        "Image bundle relation catalog written: "
        f"{payload['summary']['bundles']} bundles / "
        f"{payload['summary']['image_objects']} image objects",
        flush=True,
    )


if __name__ == "__main__":
    main()
