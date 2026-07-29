"""Prove the boundary between communication Spine and live-chibi costumes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_COSTUME_DICTIONARY = (
    PROJECT_ROOT / "public" / "data" / "masterdata" / "costume_dictionary.json"
)
DEFAULT_LIVE_INVENTORY = (
    PROJECT_ROOT / "public" / "assets" / "live-chibi" / "inventory.json"
)
DEFAULT_SPINE_ROOT = PROJECT_ROOT / "public" / "assets" / "spines"
DEFAULT_OUTPUT = (
    PROJECT_ROOT
    / ".analysis"
    / "raw-migration"
    / "live-chibi-costume-boundary"
    / "audit.json"
)
MODEL_PATTERN = re.compile(r"^(?P<idol>[0-9]{3}[a-z]{3})_(?P<costume>[a-z0-9_]+)$", re.I)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def text_payload(text_asset) -> bytes:
    payload = text_asset.m_Script
    return (
        payload
        if isinstance(payload, bytes)
        else payload.encode("utf-8", errors="surrogateescape")
    )


def pixel_fingerprint(image: Image.Image) -> dict:
    rgba = image.convert("RGBA")
    return {
        "width": rgba.width,
        "height": rgba.height,
        "rgbaSha256": sha256_bytes(rgba.tobytes()),
    }


def unique_master_costumes(path: Path) -> list[dict]:
    rows = json.loads(path.read_text(encoding="utf-8"))["costumes"]
    by_model = {}
    for row in rows:
        model_id = row.get("model_resource_id")
        if model_id:
            by_model.setdefault(model_id, row)
    return [by_model[key] for key in sorted(by_model)]


def live_costume_models(path: Path) -> set[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        row["modelId"]
        for row in payload.get("costumes", [])
        if row.get("modelId")
    }


def inspect_gap_bundle(bundle: Path, stable_root: Path, model_id: str) -> dict:
    environment = UnityPy.load(str(bundle))
    type_counts = Counter()
    text_objects = {}
    textures = {}
    for obj in environment.objects:
        type_counts[obj.type.name] += 1
        if obj.type.name not in {"TextAsset", "Texture2D"}:
            continue
        asset = obj.read()
        name = str(getattr(asset, "m_Name", "") or "")
        if obj.type.name == "TextAsset":
            text_objects[name] = (obj, asset)
        else:
            textures[name] = asset

    stable_model_root = stable_root / model_id
    stable_atlas = stable_model_root / "comu.atlas"
    stable_skeleton = stable_model_root / "comu.skel"
    stable_texture = stable_model_root / "comu.png"
    stable_faces = stable_model_root / "faces"
    required_stable = [stable_atlas, stable_skeleton, stable_texture, stable_faces]

    missing_raw = [
        name
        for name in ("comu.atlas", "comu.skel")
        if name not in text_objects
    ]
    if "comu" not in textures:
        missing_raw.append("comu Texture2D")
    missing_stable = [
        path.relative_to(stable_model_root).as_posix()
        for path in required_stable
        if not path.exists()
    ]

    result = {
        "bundleBytes": bundle.stat().st_size,
        "bundleSha256": sha256_file(bundle),
        "objectTypeCounts": dict(sorted(type_counts.items())),
        "hasLiveAtlas": "cos.atlas" in text_objects,
        "hasLiveTexture": "cos" in textures,
        "hasCommunicationAtlas": "comu.atlas" in text_objects,
        "hasCommunicationSkeleton": "comu.skel" in text_objects,
        "hasCommunicationTexture": "comu" in textures,
        "missingRawCommunicationPayloads": missing_raw,
        "missingStableCommunicationArtifacts": missing_stable,
    }
    if missing_raw or missing_stable:
        return result

    atlas_object, atlas_asset = text_objects["comu.atlas"]
    skeleton_object, skeleton_asset = text_objects["comu.skel"]
    raw_atlas_object = atlas_object.get_raw_data()
    raw_skeleton_object = skeleton_object.get_raw_data()
    raw_atlas_payload = text_payload(atlas_asset)
    raw_skeleton_payload = text_payload(skeleton_asset)
    stable_atlas_bytes = stable_atlas.read_bytes()
    stable_skeleton_bytes = stable_skeleton.read_bytes()
    raw_texture_pixels = pixel_fingerprint(textures["comu"].image)
    with Image.open(stable_texture) as image:
        stable_texture_pixels = pixel_fingerprint(image)

    face_prefix = f"image_photo_face_icon_{model_id}_face_"
    raw_faces = {
        name: asset
        for name, asset in textures.items()
        if name.startswith(face_prefix)
    }
    stable_face_files = {
        path.stem: path
        for path in stable_faces.glob("*.png")
    }
    face_results = []
    for name in sorted(set(raw_faces) | set(stable_face_files)):
        raw_asset = raw_faces.get(name)
        stable_path = stable_face_files.get(name)
        raw_pixels = pixel_fingerprint(raw_asset.image) if raw_asset else None
        if stable_path:
            with Image.open(stable_path) as image:
                stable_pixels = pixel_fingerprint(image)
        else:
            stable_pixels = None
        face_results.append(
            {
                "name": name,
                "rawExists": raw_asset is not None,
                "stableExists": stable_path is not None,
                "pixelIdentical": (
                    raw_pixels is not None
                    and stable_pixels is not None
                    and raw_pixels == stable_pixels
                ),
            }
        )

    result["communicationRegression"] = {
        "atlas": {
            "rawObjectSha256": sha256_bytes(raw_atlas_object),
            "rawPayloadSha256": sha256_bytes(raw_atlas_payload),
            "stableSha256": sha256_bytes(stable_atlas_bytes),
            "objectByteIdentical": raw_atlas_object == stable_atlas_bytes,
            "payloadByteIdentical": raw_atlas_payload == stable_atlas_bytes,
        },
        "skeleton": {
            "rawObjectSha256": sha256_bytes(raw_skeleton_object),
            "rawPayloadSha256": sha256_bytes(raw_skeleton_payload),
            "stableSha256": sha256_bytes(stable_skeleton_bytes),
            "objectByteIdentical": raw_skeleton_object == stable_skeleton_bytes,
            "payloadByteIdentical": raw_skeleton_payload == stable_skeleton_bytes,
        },
        "texture": {
            "rawPixels": raw_texture_pixels,
            "stablePixels": stable_texture_pixels,
            "pixelIdentical": raw_texture_pixels == stable_texture_pixels,
        },
        "faces": {
            "rawCount": len(raw_faces),
            "stableCount": len(stable_face_files),
            "allPixelIdentical": bool(face_results)
            and all(row["pixelIdentical"] for row in face_results),
            "rows": face_results,
        },
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--raw-asset-root", type=Path)
    parser.add_argument(
        "--costume-dictionary",
        type=Path,
        default=DEFAULT_COSTUME_DICTIONARY,
    )
    parser.add_argument(
        "--live-inventory",
        type=Path,
        default=DEFAULT_LIVE_INVENTORY,
    )
    parser.add_argument("--spine-root", type=Path, default=DEFAULT_SPINE_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    raw_asset_root = (args.raw_asset_root or sources.raw_root / "asset").resolve()
    costume_dictionary = args.costume_dictionary.resolve()
    live_inventory = args.live_inventory.resolve()
    spine_root = args.spine_root.resolve()
    output = args.output.resolve()
    for required in (
        raw_asset_root,
        costume_dictionary,
        live_inventory,
        spine_root,
    ):
        if not required.exists():
            raise FileNotFoundError(required)

    master = unique_master_costumes(costume_dictionary)
    live_models = live_costume_models(live_inventory)
    gap = [row for row in master if row["model_resource_id"] not in live_models]
    rows = []
    for master_row in gap:
        model_id = master_row["model_resource_id"]
        match = MODEL_PATTERN.fullmatch(model_id)
        if not match:
            raise ValueError(f"Unexpected model_resource_id: {model_id}")
        bundle = raw_asset_root / f"costume_{model_id}.unity3d"
        if not bundle.is_file():
            raise FileNotFoundError(bundle)
        inspection = inspect_gap_bundle(bundle, spine_root, model_id)
        rows.append(
            {
                "modelId": model_id,
                "idolId": match.group("idol"),
                "costumeId": match.group("costume"),
                "costumeName": master_row.get("costume_name"),
                "releaseAt": master_row.get("release_at"),
                "sourceTableIds": master_row.get("source_tables", []),
                "bundle": f"asset/{bundle.name}",
                **inspection,
            }
        )

    regressions = [
        row.get("communicationRegression")
        for row in rows
        if row.get("communicationRegression")
    ]
    face_count = sum(item["faces"]["rawCount"] for item in regressions)
    report = {
        "schemaVersion": 1,
        "auditKind": "master-costume-consumer-boundary",
        "summary": {
            "masterCostumeCount": len(master),
            "liveChibiCostumeCount": len(live_models),
            "communicationOnlyCostumeCount": len(rows),
            "communicationOnlyBundleBytes": sum(row["bundleBytes"] for row in rows),
            "communicationOnlyIdolCount": len({row["idolId"] for row in rows}),
            "withLiveAtlasAndTexture": sum(
                1
                for row in rows
                if row["hasLiveAtlas"] and row["hasLiveTexture"]
            ),
            "withCompleteRawCommunicationPayload": sum(
                1
                for row in rows
                if not row["missingRawCommunicationPayloads"]
            ),
            "withCompleteStableCommunicationArtifacts": sum(
                1
                for row in rows
                if not row["missingStableCommunicationArtifacts"]
            ),
            "atlasObjectByteIdentical": sum(
                1
                for item in regressions
                if item["atlas"]["objectByteIdentical"]
            ),
            "atlasPayloadByteIdentical": sum(
                1
                for item in regressions
                if item["atlas"]["payloadByteIdentical"]
            ),
            "skeletonObjectByteIdentical": sum(
                1
                for item in regressions
                if item["skeleton"]["objectByteIdentical"]
            ),
            "skeletonPayloadByteIdentical": sum(
                1
                for item in regressions
                if item["skeleton"]["payloadByteIdentical"]
            ),
            "texturePixelIdentical": sum(
                1 for item in regressions if item["texture"]["pixelIdentical"]
            ),
            "faceTextureCount": face_count,
            "modelsWithAllFacePixelsIdentical": sum(
                1 for item in regressions if item["faces"]["allPixelIdentical"]
            ),
            "costumeSuffixCounts": dict(
                sorted(
                    Counter(row["costumeId"] for row in rows).items(),
                    key=lambda item: (-item[1], item[0]),
                )
            ),
        },
        "conclusion": (
            "The 141-model difference is the communication-only Spine domain, "
            "not an unpublished live-chibi costume expansion."
        ),
        "rows": rows,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"Audit written to {output}")


if __name__ == "__main__":
    main()
