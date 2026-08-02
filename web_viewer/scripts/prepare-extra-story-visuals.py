#!/usr/bin/env python3
"""Extract the seven table-178 Extra Story navigation visuals from RAW.

The command is intentionally bounded: it reads only ExtraStoryChapterData
(table 178), resolves the declared image_story_extra bundle through the tracked
image relation catalog, and exports the banner plus key visual used by the
archive UI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import UnityPy


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PROJECT_ROOT.parent
DATA_PIPELINE_ROOT = REPOSITORY_ROOT / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources
from masterdata_extract import iter_top_records, parse_message


DEFAULT_RELATION_CATALOG = (
    PROJECT_ROOT / "public" / "data" / "image_bundle_relation_catalog.json"
)
DEFAULT_OUTPUT_ROOT = (
    PROJECT_ROOT
    / ".analysis"
    / "raw-migration"
    / "extra-story-visuals"
    / "candidate"
)
DEFAULT_INDEX_OUTPUT = (
    PROJECT_ROOT
    / ".analysis"
    / "raw-migration"
    / "extra-story-visuals"
    / "extra_story_visual_index.json"
)
PUBLIC_URL_ROOT = "/assets/stories/extra"
ROLES = ("banner", "key_visual")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def extra_story_rows(masterdata_path: Path) -> list[dict[str, Any]]:
    rows = []
    for table_id, start, _, _, payload in iter_top_records(masterdata_path.read_bytes()):
        if table_id != 178 or not isinstance(payload, bytes):
            continue
        row = parse_message(payload, nested=True)
        row["_offset"] = start
        rows.append(row)
    rows.sort(key=lambda row: int(row.get("7") or 0), reverse=True)
    if len(rows) != 7:
        raise ValueError(f"expected 7 ExtraStoryChapterData rows, found {len(rows)}")
    return rows


def relation_by_id(catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(entry.get("id")): entry
        for entry in catalog.get("entries") or []
        if str(entry.get("id", "")).startswith("image_story_extra_")
    }


def role_object(relation: dict[str, Any], resource_id: str, role: str) -> dict[str, Any]:
    suffix = {
        "banner": f"/image_extra_banner_{resource_id}.png",
        "key_visual": f"/image_extra_kv_story_{resource_id}.png",
    }[role]
    matches = [
        item
        for item in (relation.get("unity") or {}).get("container_entries") or []
        if item.get("type") == "Texture2D" and str(item.get("path") or "").endswith(suffix)
    ]
    if len(matches) != 1:
        raise ValueError(
            f"{relation.get('id')} must expose exactly one Texture2D for {role}; "
            f"found {len(matches)}"
        )
    return matches[0]


def extract_textures(
    bundle_path: Path,
    requests: dict[int, tuple[str, Path]],
) -> dict[str, dict[str, Any]]:
    environment = UnityPy.load(str(bundle_path))
    exported: dict[str, dict[str, Any]] = {}
    for obj in environment.objects:
        if obj.type.name != "Texture2D" or int(obj.path_id) not in requests:
            continue
        role, output_path = requests[int(obj.path_id)]
        data = obj.read()
        image = data.image
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)
        exported[role] = {
            "filename": output_path.name,
            "url": f"{PUBLIC_URL_ROOT}/{output_path.name}",
            "width": int(image.width),
            "height": int(image.height),
            "bytes": output_path.stat().st_size,
            "sha256": sha256_file(output_path),
            "texture_name": str(data.m_Name),
            "path_id": str(obj.path_id),
        }
    missing = sorted(set(ROLES) - set(exported))
    if missing:
        raise ValueError(f"{bundle_path.name} did not export roles: {', '.join(missing)}")
    return exported


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--relation-catalog", type=Path, default=DEFAULT_RELATION_CATALOG)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--index-output", type=Path, default=DEFAULT_INDEX_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    masterdata_path = sources.masterdata_input("decoded")
    if not masterdata_path.is_file():
        raise FileNotFoundError(masterdata_path)
    if (
        sources.masterdata_decoded_sha256
        and sha256_file(masterdata_path) != sources.masterdata_decoded_sha256
    ):
        raise ValueError("configured decoded masterdata SHA-256 does not match")

    relation_catalog_path = args.relation_catalog.resolve()
    relations = relation_by_id(read_json(relation_catalog_path))
    output_root = args.output_root.resolve()
    entries = []

    for row in extra_story_rows(masterdata_path):
        entry_id = str(row.get("1") or "")
        chapter_id = str(row.get("3") or "")
        resource_id = str(row.get("4") or "")
        logo_resource_id = str(row.get("5") or "")
        relation_id = f"image_story_extra_{resource_id}"
        relation = relations.get(relation_id)
        if relation is None:
            raise ValueError(f"missing tracked image relation: {relation_id}")

        raw = relation.get("raw") or {}
        bundle_path = sources.raw_root / str(raw.get("relative_path") or "")
        if not bundle_path.is_file():
            raise FileNotFoundError(bundle_path)
        if sha256_file(bundle_path) != str(raw.get("sha256") or ""):
            raise ValueError(f"RAW bundle SHA-256 mismatch: {bundle_path}")

        requests: dict[int, tuple[str, Path]] = {}
        source_objects = {}
        for role in ROLES:
            source_object = role_object(relation, resource_id, role)
            filename = Path(str(source_object["path"])).name
            path_id = int(source_object["path_id"])
            requests[path_id] = (role, output_root / filename)
            source_objects[role] = {
                "path": source_object["path"],
                "path_id": str(source_object["path_id"]),
            }

        assets = extract_textures(bundle_path, requests)
        term = row.get("6") if isinstance(row.get("6"), dict) else {}
        entries.append({
            "extra_story_entry_id": entry_id,
            "chapter_id": chapter_id,
            "resource_id": resource_id,
            "logo_resource_id": logo_resource_id,
            "archive_term": {
                "start_at": int(term.get("1") or 0),
                "end_at": int(term.get("2") or 0),
            },
            "sort_order": int(row.get("7") or 0),
            "source": {
                "table": 178,
                "offset": int(row["_offset"]),
                "fields": {
                    "id": 1,
                    "chapter_id": 3,
                    "resource_id": 4,
                    "logo_resource_id": 5,
                    "archive_term": 6,
                    "sort_order": 7,
                },
            },
            "raw_bundle": {
                "relation_id": relation_id,
                "relative_path": raw["relative_path"],
                "bytes": int(raw["bytes"]),
                "sha256": raw["sha256"],
            },
            "source_objects": source_objects,
            "assets": assets,
        })

    by_chapter_id = {entry["chapter_id"]: entry["extra_story_entry_id"] for entry in entries}
    index = {
        "schema_version": 1,
        "authority": {
            "semantic_relation": "client masterdata table 178 ExtraStoryChapterData",
            "physical_payload": "RAW asset/image_story_extra_<ResourceId>.unity3d",
            "subresource_identity": "Unity Texture2D PathID",
        },
        "source": {
            "masterdata_sha256": sha256_file(masterdata_path),
            "image_relation_catalog": relation_catalog_path.relative_to(PROJECT_ROOT).as_posix(),
            "image_relation_catalog_sha256": sha256_file(relation_catalog_path),
        },
        "entries": entries,
        "by_chapter_id": by_chapter_id,
        "meta": {
            "entry_count": len(entries),
            "banner_count": sum("banner" in entry["assets"] for entry in entries),
            "key_visual_count": sum("key_visual" in entry["assets"] for entry in entries),
            "published_bytes": sum(
                asset["bytes"]
                for entry in entries
                for asset in entry["assets"].values()
            ),
        },
    }
    index_output = args.index_output.resolve()
    index_output.parent.mkdir(parents=True, exist_ok=True)
    index_output.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Extra Story visuals prepared: {len(entries)} entries / "
        f"{index['meta']['published_bytes']} bytes"
    )
    print(f"assets: {output_root}")
    print(f"index: {index_output}")


if __name__ == "__main__":
    main()
