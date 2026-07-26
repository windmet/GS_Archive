"""Audit RAW costume, idol-setting, and character-image resources.

The report intentionally separates semantic authority (master data) from
physical authority (Unity bundles) and current browser exports. It does not
write into ``public``; generated evidence stays under the ignored
``web_viewer/.analysis`` tree.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

import UnityPy


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW_ROOT = REPO_ROOT / "RAW"
DEFAULT_COSTUME_DICTIONARY = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "costume_dictionary.json"
)
DEFAULT_IDOL_DICTIONARY = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "idol_unit_dictionary.json"
)
DEFAULT_PUBLIC_ASSETS = REPO_ROOT / "web_viewer" / "public" / "assets"
DEFAULT_IDOL_SETTINGS = (
    REPO_ROOT / "web_viewer" / "public" / "data" / "idolsetting"
)
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "web_viewer"
    / ".analysis"
    / "raw-migration"
    / "character"
    / "coverage.json"
)
DEFAULT_SOURCE_MANIFEST = (
    REPO_ROOT
    / "web_viewer"
    / ".analysis"
    / "raw-migration"
    / "source"
    / "files.jsonl"
)
CHARACTER_IMAGE_PATTERN = "image_chara*.unity3d"
SPINE_CORE_FILES = ("comu.atlas", "comu.png", "comu.skel")


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def normalize_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: normalize_json(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [normalize_json(item) for item in value]
    return value


def load_source_manifest(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    records = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        relative_path = str(row.get("relative_path") or "")
        if relative_path:
            records[relative_path] = row
    return records


def source_evidence(
    path: Path, raw_root: Path, manifest: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    relative_path = path.relative_to(raw_root).as_posix()
    row = manifest.get(relative_path)
    return {
        "relative_path": f"RAW/{relative_path}",
        "size": path.stat().st_size,
        "sha256": row.get("sha256") if row else None,
        "manifest_record_present_and_size_equal": bool(
            row
            and row.get("size") == path.stat().st_size
            and row.get("sha256")
        ),
    }


def text_asset_json(obj: Any) -> tuple[str, Any]:
    data = obj.read()
    script = data.m_Script
    if isinstance(script, bytes):
        script = script.decode("utf-8")
    return str(data.m_Name), json.loads(script)


def texture_rgba_evidence(obj: Any, public_path: Path | None = None) -> dict[str, Any]:
    data = obj.read()
    image = data.image.convert("RGBA")
    raw_pixels = image.tobytes()
    evidence: dict[str, Any] = {
        "width": image.width,
        "height": image.height,
        "raw_rgba_sha256": sha256_bytes(raw_pixels),
    }
    if public_path is not None:
        evidence["public_path"] = relative(public_path)
        evidence["public_exists"] = public_path.is_file()
        if public_path.is_file():
            from PIL import Image

            with Image.open(public_path) as public_image:
                normalized = public_image.convert("RGBA")
                evidence.update(
                    {
                        "public_width": normalized.width,
                        "public_height": normalized.height,
                        "public_rgba_sha256": sha256_bytes(normalized.tobytes()),
                        "pixel_equal": (
                            normalized.size == image.size
                            and normalized.tobytes() == raw_pixels
                        ),
                    }
                )
    return evidence


def audit_costumes(
    raw_root: Path,
    raw_asset_root: Path,
    costume_dictionary_path: Path,
    public_assets_root: Path,
    candidate_model: str,
    source_manifest: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    dictionary = json.loads(costume_dictionary_path.read_text(encoding="utf-8"))
    costumes = dictionary.get("costumes", [])
    master_ids = {
        str(row["model_resource_id"])
        for row in costumes
        if row.get("model_resource_id")
    }
    bundle_paths = sorted(raw_asset_root.glob("costume_*.unity3d"))
    raw_ids = {path.stem.removeprefix("costume_") for path in bundle_paths}
    spine_root = public_assets_root / "spines"
    silhouette_root = public_assets_root / "silhouette"
    public_spine_ids = {
        path.name for path in spine_root.iterdir() if path.is_dir()
    } if spine_root.is_dir() else set()

    classifications: Counter[str] = Counter()
    records = []
    serialized_core_matches = 0
    serialized_core_mismatches = []
    silhouette_pixel_matches = 0
    candidate_evidence: dict[str, Any] | None = None

    for path in bundle_paths:
        model_id = path.stem.removeprefix("costume_")
        env = UnityPy.load(str(path))
        type_counts = Counter(obj.type.name for obj in env.objects)
        container_entries = [
            {"path": name, "type": obj.type.name, "path_id": obj.path_id}
            for name, obj in sorted(env.container.items(), key=lambda item: item[0])
        ]
        silhouette_entries = [
            (name, obj)
            for name, obj in env.container.items()
            if "/silhouette/" in name and obj.type.name in {"Sprite", "Texture2D"}
        ]
        text_assets = [
            obj for obj in env.objects if obj.type.name == "TextAsset"
        ]
        text_asset_by_name = {}
        for obj in text_assets:
            name = str(obj.read().m_Name)
            text_asset_by_name[name] = obj
        texture_by_name = {}
        for obj in env.objects:
            if obj.type.name != "Texture2D":
                continue
            texture_by_name[str(obj.read().m_Name)] = obj

        if (
            "comu.atlas" in text_asset_by_name
            and "comu.skel" in text_asset_by_name
            and "comu" in texture_by_name
        ):
            classification = "full_spine"
        elif silhouette_entries and not text_assets:
            classification = "silhouette_only"
        else:
            classification = "ambiguous"
        classifications[classification] += 1

        public_spine_dir = spine_root / model_id
        public_core = {
            name: (public_spine_dir / name).is_file() for name in SPINE_CORE_FILES
        }
        serialized_matches = {}
        for name in ("comu.atlas", "comu.skel"):
            raw_obj = text_asset_by_name.get(name)
            public_path = public_spine_dir / name
            if raw_obj is None or not public_path.is_file():
                serialized_matches[name] = None
                continue
            raw_serialized = bytes(raw_obj.get_raw_data())
            equal = raw_serialized == public_path.read_bytes()
            serialized_matches[name] = equal
            if equal:
                serialized_core_matches += 1
            else:
                serialized_core_mismatches.append(
                    {
                        "model_id": model_id,
                        "file": name,
                        "raw_serialized_sha256": sha256_bytes(raw_serialized),
                        "public_sha256": sha256_file(public_path),
                    }
                )

        silhouette_evidence = None
        if silhouette_entries:
            _, texture_obj = next(
                (
                    entry
                    for entry in silhouette_entries
                    if entry[1].type.name == "Sprite"
                ),
                silhouette_entries[0],
            )
            silhouette_evidence = texture_rgba_evidence(
                texture_obj, silhouette_root / f"{model_id}.png"
            )
            silhouette_evidence["raw_layer"] = texture_obj.type.name
            if silhouette_evidence.get("pixel_equal"):
                silhouette_pixel_matches += 1

        record = {
            "model_id": model_id,
            "source": source_evidence(path, raw_root, source_manifest),
            "classification": classification,
            "in_masterdata": model_id in master_ids,
            "object_type_counts": dict(sorted(type_counts.items())),
            "container_entries": container_entries,
            "public_spine_directory": public_spine_dir.is_dir(),
            "public_core_files": public_core,
            "serialized_text_asset_equal": serialized_matches,
            "silhouette": silhouette_evidence,
        }
        records.append(record)

        if model_id == candidate_model:
            texture_evidence = None
            if "comu" in texture_by_name:
                texture_evidence = texture_rgba_evidence(
                    texture_by_name["comu"], public_spine_dir / "comu.png"
                )
            candidate_evidence = {
                "model_id": model_id,
                "classification": classification,
                "serialized_text_asset_equal": serialized_matches,
                "texture": texture_evidence,
            }

    full_spine_ids = {
        row["model_id"] for row in records if row["classification"] == "full_spine"
    }
    silhouette_only_ids = {
        row["model_id"]
        for row in records
        if row["classification"] == "silhouette_only"
    }
    ambiguous_ids = {
        row["model_id"] for row in records if row["classification"] == "ambiguous"
    }
    public_core_complete_ids = {
        model_id
        for model_id in public_spine_ids
        if all((spine_root / model_id / name).is_file() for name in SPINE_CORE_FILES)
    }

    return {
        "summary": {
            "masterdata_costume_rows": len(costumes),
            "masterdata_model_ids": len(master_ids),
            "raw_costume_bundles": len(raw_ids),
            "masterdata_matched_raw": len(master_ids & raw_ids),
            "masterdata_missing_raw": len(master_ids - raw_ids),
            "raw_outside_masterdata": len(raw_ids - master_ids),
            "full_spine_bundles": len(full_spine_ids),
            "silhouette_only_bundles": len(silhouette_only_ids),
            "ambiguous_bundles": len(ambiguous_ids),
            "public_spine_directories": len(public_spine_ids),
            "public_core_complete_directories": len(public_core_complete_ids),
            "raw_public_model_set_equal": raw_ids == public_spine_ids,
            "serialized_atlas_skel_matches": serialized_core_matches,
            "serialized_atlas_skel_mismatches": len(serialized_core_mismatches),
            "silhouette_pixel_matches": silhouette_pixel_matches,
        },
        "missing_raw_model_ids": sorted(master_ids - raw_ids),
        "raw_outside_masterdata_model_ids": sorted(raw_ids - master_ids),
        "raw_without_public_spine_directory": sorted(raw_ids - public_spine_ids),
        "public_spine_directory_without_raw": sorted(public_spine_ids - raw_ids),
        "full_spine_ids_missing_public_core": sorted(
            full_spine_ids - public_core_complete_ids
        ),
        "silhouette_only_model_ids": sorted(silhouette_only_ids),
        "ambiguous_model_ids": sorted(ambiguous_ids),
        "serialized_core_mismatches": serialized_core_mismatches,
        "candidate": candidate_evidence,
        "records": records,
    }


def motion_index_entry(payload: Any) -> dict[str, dict[str, str]]:
    return {
        str(row["motionAnimationName"]): {
            "pose": str(row.get("poseAnimationName") or ""),
            "back": str(row.get("backAnimationName") or ""),
        }
        for row in payload.get("motions", [])
    }


def audit_idol_settings(
    raw_root: Path,
    raw_asset_root: Path,
    idol_dictionary_path: Path,
    public_settings_root: Path,
    source_manifest: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    dictionary = json.loads(idol_dictionary_path.read_text(encoding="utf-8"))
    master_ids = {
        str(row["idol_code"])
        for row in dictionary.get("idols", [])
        if row.get("idol_code")
    }
    bundle_paths = sorted(raw_asset_root.glob("idol_settings_*.unity3d"))
    raw_ids = {path.stem.removeprefix("idol_settings_") for path in bundle_paths}
    motion_index_path = public_settings_root / "motion" / "idol_motion_index.json"
    motion_index_payload = (
        json.loads(motion_index_path.read_text(encoding="utf-8"))
        if motion_index_path.is_file()
        else {}
    )
    public_motion = motion_index_payload.get("entries", {})

    kind_counts: Counter[str] = Counter()
    semantic_matches: Counter[str] = Counter()
    raw_asset_ids: dict[str, set[str]] = defaultdict(set)
    missing_public = []
    mismatches = []
    records = []
    for path in bundle_paths:
        idol_id = path.stem.removeprefix("idol_settings_")
        env = UnityPy.load(str(path))
        assets = []
        for obj in env.objects:
            if obj.type.name != "TextAsset":
                continue
            name, payload = text_asset_json(obj)
            if name.startswith("idol_motion_stg_"):
                kind = "motion"
                asset_id = name.removeprefix("idol_motion_stg_")
                expected = motion_index_entry(payload)
                public_path = motion_index_path
                public_payload = public_motion.get(asset_id)
            elif name.startswith("idol_mouth_stg_"):
                kind = "mouth"
                asset_id = name.removeprefix("idol_mouth_stg_")
                public_path = public_settings_root / "mouth" / f"{name}.json"
                public_payload = (
                    json.loads(public_path.read_text(encoding="utf-8"))
                    if public_path.is_file()
                    else None
                )
                expected = payload
            elif name.startswith("idol_other_stg_"):
                kind = "other"
                asset_id = name.removeprefix("idol_other_stg_")
                public_path = public_settings_root / "other" / f"{name}.json"
                public_payload = (
                    json.loads(public_path.read_text(encoding="utf-8"))
                    if public_path.is_file()
                    else None
                )
                expected = payload
            else:
                kind = "unknown"
                asset_id = name
                public_path = None
                public_payload = None
                expected = payload
            kind_counts[kind] += 1
            raw_asset_ids[kind].add(asset_id)
            public_exists = public_payload is not None
            semantic_equal = (
                public_exists
                and normalize_json(expected) == normalize_json(public_payload)
            )
            if semantic_equal:
                semantic_matches[kind] += 1
            elif not public_exists:
                missing_public.append(
                    {"idol_id": idol_id, "kind": kind, "asset_name": name}
                )
            else:
                mismatches.append(
                    {
                        "idol_id": idol_id,
                        "kind": kind,
                        "asset_name": name,
                        "public_path": relative(public_path)
                        if public_path is not None
                        else None,
                    }
                )
            assets.append({
                "asset_name": name,
                "asset_id": asset_id,
                "public_path": relative(public_path)
                if public_path is not None
                else None,
                "public_exists": public_exists,
                "semantic_equal": semantic_equal,
                "kind": kind,
            })
        records.append(
            {
                "idol_id": idol_id,
                "source": source_evidence(path, raw_root, source_manifest),
                "in_masterdata": idol_id in master_ids,
                "assets": assets,
            }
        )

    public_mouth_ids = {
        path.stem.removeprefix("idol_mouth_stg_")
        for path in (public_settings_root / "mouth").glob("idol_mouth_stg_*.json")
    }
    public_other_ids = {
        path.stem.removeprefix("idol_other_stg_")
        for path in (public_settings_root / "other").glob("idol_other_stg_*.json")
    }
    public_motion_ids = set(public_motion)

    return {
        "summary": {
            "masterdata_idols": len(master_ids),
            "raw_idol_setting_bundles": len(raw_ids),
            "masterdata_matched_raw": len(master_ids & raw_ids),
            "masterdata_missing_raw": len(master_ids - raw_ids),
            "raw_outside_masterdata": len(raw_ids - master_ids),
            "raw_text_assets": sum(kind_counts.values()),
            "raw_text_assets_by_kind": dict(sorted(kind_counts.items())),
            "semantic_matches_by_kind": dict(sorted(semantic_matches.items())),
            "missing_public_assets": len(missing_public),
            "semantic_mismatches": len(mismatches),
            "public_motion_ids": len(public_motion_ids),
            "public_mouth_ids": len(public_mouth_ids),
            "public_other_ids": len(public_other_ids),
        },
        "masterdata_missing_raw_ids": sorted(master_ids - raw_ids),
        "raw_outside_masterdata_ids": sorted(raw_ids - master_ids),
        "raw_missing_public_motion": sorted(
            raw_asset_ids["motion"] - public_motion_ids
        ),
        "raw_missing_public_mouth": sorted(
            raw_asset_ids["mouth"] - public_mouth_ids
        ),
        "raw_missing_public_other": sorted(
            raw_asset_ids["other"] - public_other_ids
        ),
        "public_motion_without_raw": sorted(
            public_motion_ids - raw_asset_ids["motion"]
        ),
        "public_mouth_without_raw": sorted(
            public_mouth_ids - raw_asset_ids["mouth"]
        ),
        "public_other_without_raw": sorted(
            public_other_ids - raw_asset_ids["other"]
        ),
        "missing_public_assets": missing_public,
        "semantic_mismatches": mismatches,
        "records": records,
    }


def build_public_basename_index(public_assets_root: Path) -> dict[str, list[str]]:
    index: dict[str, list[str]] = defaultdict(list)
    if not public_assets_root.is_dir():
        return index
    for path in public_assets_root.rglob("*"):
        if path.is_file():
            index[path.name.lower()].append(relative(path))
    return index


def audit_character_images(
    raw_root: Path,
    raw_asset_root: Path,
    public_assets_root: Path,
    source_manifest: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    bundle_paths = sorted(raw_asset_root.glob(CHARACTER_IMAGE_PATTERN))
    public_by_basename = build_public_basename_index(public_assets_root)
    object_types: Counter[str] = Counter()
    container_types: Counter[str] = Counter()
    container_paths = []
    unique_container_matches: dict[str, list[str]] = {}
    matched_container_paths = 0
    unmatched_container_paths = 0
    bundle_records = []
    for path in bundle_paths:
        env = UnityPy.load(str(path))
        bundle_object_types = Counter(obj.type.name for obj in env.objects)
        object_types.update(bundle_object_types)
        entries = []
        for container_path, obj in sorted(
            env.container.items(), key=lambda item: item[0]
        ):
            leaf = PurePosixPath(container_path).name.lower()
            matches = public_by_basename.get(leaf, [])
            if matches:
                matched_container_paths += 1
            else:
                unmatched_container_paths += 1
            container_types[obj.type.name] += 1
            row = {
                "path": container_path,
                "type": obj.type.name,
                "public_basename_matches": matches,
            }
            entries.append(row)
            container_paths.append(row)
            unique_container_matches.setdefault(container_path, matches)
        bundle_records.append(
            {
                "bundle": path.name,
                "source": source_evidence(path, raw_root, source_manifest),
                "object_type_counts": dict(sorted(bundle_object_types.items())),
                "container_entries": entries,
            }
        )
    return {
        "summary": {
            "raw_character_image_bundles": len(bundle_paths),
            "unity_objects": sum(object_types.values()),
            "container_entries": len(container_paths),
            "unique_container_paths": len(unique_container_matches),
            "container_entries_with_public_basename": matched_container_paths,
            "container_entries_without_public_basename": unmatched_container_paths,
            "unique_container_paths_with_public_basename": sum(
                1 for matches in unique_container_matches.values() if matches
            ),
            "unique_container_paths_without_public_basename": sum(
                1 for matches in unique_container_matches.values() if not matches
            ),
        },
        "object_type_counts": dict(sorted(object_types.items())),
        "container_type_counts": dict(sorted(container_types.items())),
        "unmatched_container_entries": [
            row for row in container_paths if not row["public_basename_matches"]
        ],
        "bundles": bundle_records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=DEFAULT_RAW_ROOT)
    parser.add_argument(
        "--costume-dictionary", type=Path, default=DEFAULT_COSTUME_DICTIONARY
    )
    parser.add_argument(
        "--idol-dictionary", type=Path, default=DEFAULT_IDOL_DICTIONARY
    )
    parser.add_argument(
        "--public-assets", type=Path, default=DEFAULT_PUBLIC_ASSETS
    )
    parser.add_argument(
        "--public-idol-settings", type=Path, default=DEFAULT_IDOL_SETTINGS
    )
    parser.add_argument("--candidate-model", default="001tom_002_00")
    parser.add_argument(
        "--source-manifest", type=Path, default=DEFAULT_SOURCE_MANIFEST
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    raw_root = args.raw_root.resolve()
    raw_asset_root = raw_root / "asset"
    public_assets_root = args.public_assets.resolve()
    source_manifest_path = args.source_manifest.resolve()
    source_manifest = load_source_manifest(source_manifest_path)
    report = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "raw_asset_root": relative(raw_asset_root),
            "costume_dictionary": relative(args.costume_dictionary),
            "idol_dictionary": relative(args.idol_dictionary),
            "public_assets": relative(public_assets_root),
            "public_idol_settings": relative(args.public_idol_settings),
            "source_manifest": relative(source_manifest_path),
            "source_manifest_loaded": bool(source_manifest),
        },
        "costumes": audit_costumes(
            raw_root,
            raw_asset_root,
            args.costume_dictionary.resolve(),
            public_assets_root,
            args.candidate_model,
            source_manifest,
        ),
        "idol_settings": audit_idol_settings(
            raw_root,
            raw_asset_root,
            args.idol_dictionary.resolve(),
            args.public_idol_settings.resolve(),
            source_manifest,
        ),
        "character_images": audit_character_images(
            raw_root,
            raw_asset_root,
            public_assets_root,
            source_manifest,
        ),
    }
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("costumes:", json.dumps(report["costumes"]["summary"], ensure_ascii=False))
    print(
        "idol_settings:",
        json.dumps(report["idol_settings"]["summary"], ensure_ascii=False),
    )
    print(
        "character_images:",
        json.dumps(report["character_images"]["summary"], ensure_ascii=False),
    )
    print(f"report: {output}")


if __name__ == "__main__":
    main()
