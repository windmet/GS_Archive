"""Extract one ADV background from RAW into an isolated browser candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import UnityPy
from PIL import Image, ImageChops, ImageStat


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW_ROOT = REPO_ROOT / "RAW"
DEFAULT_BACKGROUND_CATALOG = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "background_catalog.json"
)
DEFAULT_PUBLIC_BG_ROOT = REPO_ROOT / "web_viewer" / "public" / "assets" / "bg"
DEFAULT_OUTPUT_ROOT = (
    REPO_ROOT / "web_viewer" / ".analysis" / "raw-migration" / "background"
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset_png_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for image_path in path.glob("*.png"):
        image_path.unlink()


def comparison(candidate_path: Path, published_path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {"exists": published_path.exists()}
    if not published_path.exists():
        return result
    candidate = Image.open(candidate_path).convert("RGBA")
    published = Image.open(published_path).convert("RGBA")
    result["byte_identical"] = sha256_file(candidate_path) == sha256_file(published_path)
    result["same_dimensions"] = candidate.size == published.size
    result["published_dimensions"] = list(published.size)
    if candidate.size == published.size:
        rgba_stat = ImageStat.Stat(ImageChops.difference(candidate, published))
        white = Image.new("RGBA", candidate.size, "white")
        candidate_white = Image.alpha_composite(white, candidate).convert("RGB")
        published_white = Image.alpha_composite(white, published).convert("RGB")
        white_stat = ImageStat.Stat(
            ImageChops.difference(candidate_white, published_white)
        )
        result["rgba_rms"] = [round(value, 6) for value in rgba_stat.rms]
        result["composited_white_rms"] = [
            round(value, 6) for value in white_stat.rms
        ]
    return result


def scenario_reference_evidence(
    scenario_path: Path | None,
    background_id: str,
) -> dict[str, Any] | None:
    if not scenario_path:
        return None
    payload = json.loads(scenario_path.read_text(encoding="utf-8"))
    references = []
    for index, step in enumerate(payload.get("steps", [])):
        snapshots = {
            key: step.get(key) or {}
            for key in ("state", "entry_snapshot", "settled_snapshot")
        }
        matched_snapshots = [
            key for key, snapshot in snapshots.items() if snapshot.get("bg") == background_id
        ]
        if matched_snapshots:
            references.append(
                {
                    "step_index": index,
                    "step_id": step.get("step_id"),
                    "step_type": step.get("type"),
                    "snapshots": matched_snapshots,
                }
            )
    return {
        "scenario_id": payload.get("scenario_id"),
        "relative_path": scenario_path.name,
        "reference_count": len(references),
        "references": references,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("background_id")
    parser.add_argument("--raw-root", type=Path, default=DEFAULT_RAW_ROOT)
    parser.add_argument(
        "--background-catalog",
        type=Path,
        default=DEFAULT_BACKGROUND_CATALOG,
    )
    parser.add_argument("--public-bg-root", type=Path, default=DEFAULT_PUBLIC_BG_ROOT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--scenario", type=Path)
    args = parser.parse_args()

    background_id = args.background_id.strip()
    if not background_id or any(
        character not in "abcdefghijklmnopqrstuvwxyz0123456789_"
        for character in background_id.lower()
    ):
        raise ValueError(f"invalid background_id: {background_id!r}")

    raw_root = args.raw_root.resolve()
    bundle_path = raw_root / "asset" / f"adv_background_{background_id}.unity3d"
    if not bundle_path.is_file():
        raise FileNotFoundError(f"RAW background bundle not found: {bundle_path}")

    output_root = args.output_root.resolve() / background_id
    textures_dir = output_root / "textures"
    sprites_dir = output_root / "sprites"
    resolved_dir = output_root / "resolved"
    for directory in (textures_dir, sprites_dir, resolved_dir):
        reset_png_dir(directory)

    environment = UnityPy.load(str(bundle_path))
    textures = []
    sprites = []
    for obj in environment.objects:
        if obj.type.name not in {"Texture2D", "Sprite"}:
            continue
        data = obj.read()
        name = str(data.m_Name or "").strip()
        if not name:
            continue
        image = data.image
        directory = textures_dir if obj.type.name == "Texture2D" else sprites_dir
        output_path = directory / f"{name}.png"
        image.save(output_path)
        record = {
            "name": name,
            "object_type": obj.type.name,
            "width": image.width,
            "height": image.height,
            "bytes": output_path.stat().st_size,
            "sha256": sha256_file(output_path),
        }
        if obj.type.name == "Sprite":
            texture_rect = data.m_RD.textureRect
            record["sprite_rect"] = {
                "x": float(texture_rect.x),
                "y": float(texture_rect.y),
                "width": float(texture_rect.width),
                "height": float(texture_rect.height),
            }
            sprites.append(record)
        else:
            textures.append(record)

    sprite_by_name = {record["name"]: record for record in sprites}
    texture_by_name = {record["name"]: record for record in textures}
    source_record = sprite_by_name.get(background_id) or texture_by_name.get(background_id)
    if not source_record:
        raise ValueError(
            f"bundle does not contain a main Sprite or Texture2D named {background_id}"
        )
    source_dir = (
        sprites_dir if source_record["object_type"] == "Sprite" else textures_dir
    )
    candidate_path = resolved_dir / f"{background_id}.png"
    Image.open(source_dir / f"{background_id}.png").save(candidate_path)

    catalog_payload = json.loads(
        args.background_catalog.resolve().read_text(encoding="utf-8")
    )
    catalog_record = (catalog_payload.get("backgrounds") or {}).get(background_id)
    scenario_path = args.scenario.resolve() if args.scenario else None
    scenario_evidence = scenario_reference_evidence(scenario_path, background_id)
    published_path = args.public_bg_root.resolve() / f"{background_id}.png"

    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "background_id": background_id,
        "raw_source": {
            "relative_path": bundle_path.relative_to(raw_root).as_posix(),
            "bytes": bundle_path.stat().st_size,
            "sha256": sha256_file(bundle_path),
        },
        "identity_evidence": {
            "background_catalog_entry": catalog_record,
            "scenario_reference": scenario_evidence,
        },
        "textures": sorted(textures, key=lambda record: record["name"]),
        "sprites": sorted(sprites, key=lambda record: record["name"]),
        "resolved_asset": {
            **source_record,
            "resolution": "sprite_preferred"
            if source_record["object_type"] == "Sprite"
            else "texture_fallback",
            "candidate_url": f"/assets/bg-candidate/{background_id}.png",
            "bytes": candidate_path.stat().st_size,
            "sha256": sha256_file(candidate_path),
            "published_comparison": comparison(candidate_path, published_path),
        },
    }
    output_root.mkdir(parents=True, exist_ok=True)
    manifest_path = output_root / "candidate.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "background_id": background_id,
                "textures": len(textures),
                "sprites": len(sprites),
                "scenario_references": (
                    scenario_evidence["reference_count"] if scenario_evidence else None
                ),
                "catalog_entry": bool(catalog_record),
                "published_same_dimensions": manifest["resolved_asset"][
                    "published_comparison"
                ].get("same_dimensions"),
            },
            ensure_ascii=False,
        )
    )
    print(f"candidate: {manifest_path}")


if __name__ == "__main__":
    main()
