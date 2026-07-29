"""Extract one card AssetBundle from RAW into an isolated migration candidate.

The output is intentionally written outside ``public/`` so it cannot replace
the published card assets by accident. The Vite development server exposes the
candidate only through its explicit ``/assets/card-candidate/`` route.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import UnityPy
from PIL import Image, ImageChops, ImageStat

from archive_paths import add_sources_config_argument, load_archive_sources



def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_cards(card_index: Path, resource_id: str) -> list[dict[str, Any]]:
    payload = json.loads(card_index.read_text(encoding="utf-8"))
    matches = [
        card
        for card in payload.get("cards", [])
        if card.get("resource_id") == resource_id
    ]
    if not matches:
        raise ValueError(f"no master-data card found for {resource_id}")
    return sorted(matches, key=lambda card: int(card.get("card_id") or 0))


def expected_photo_path(photo_root: Path, texture_name: str) -> Path | None:
    if texture_name.startswith("image_card_icon_"):
        return photo_root / "image_card_icon" / f"{texture_name}.png"
    if texture_name.startswith("image_card_piece_icon_"):
        return photo_root / "image_card_piece" / f"{texture_name}.png"
    if texture_name.startswith("image_card_portrait_"):
        return photo_root / "image_card_portrait" / f"{texture_name}.png"
    if texture_name.startswith("image_card_landscape_"):
        return photo_root / "image_card_landscape" / f"{texture_name}.png"
    if texture_name.startswith("image_card_cutin_"):
        return photo_root / "image_card_cutin" / f"{texture_name}.png"
    return None


def reset_png_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for path in output_dir.glob("*.png"):
        path.unlink()


def image_record(
    *,
    name: str,
    object_type: str,
    image: Image.Image,
    output_path: Path,
    resource_id: str,
) -> dict[str, Any]:
    image.save(output_path)
    return {
        "name": name,
        "object_type": object_type,
        "width": image.width,
        "height": image.height,
        "bytes": output_path.stat().st_size,
        "sha256": sha256_file(output_path),
        "candidate_url": f"/assets/card-candidate/{resource_id}/{output_path.name}",
    }


def extract_bundle_images(
    bundle_path: Path,
    textures_dir: Path,
    sprites_dir: Path,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    environment = UnityPy.load(str(bundle_path))
    reset_png_dir(textures_dir)
    reset_png_dir(sprites_dir)
    resource_id = bundle_path.stem.removeprefix("card_")
    textures: list[dict[str, Any]] = []
    sprites: list[dict[str, Any]] = []
    seen_names: dict[str, set[str]] = {"Texture2D": set(), "Sprite": set()}

    for obj in environment.objects:
        object_type = obj.type.name
        if object_type not in seen_names:
            continue
        data = obj.read()
        name = str(data.m_Name or "").strip()
        if not name or name in seen_names[object_type]:
            raise ValueError(
                f"missing or duplicate {object_type} name in {bundle_path}: {name!r}"
            )
        seen_names[object_type].add(name)
        output_dir = textures_dir if object_type == "Texture2D" else sprites_dir
        record = image_record(
            name=name,
            object_type=object_type,
            image=data.image,
            output_path=output_dir / f"{name}.png",
            resource_id=resource_id,
        )
        if object_type == "Texture2D":
            textures.append(record)
        else:
            sprite_rect = data.m_RD.textureRect
            record["sprite_rect"] = {
                "x": float(sprite_rect.x),
                "y": float(sprite_rect.y),
                "width": float(sprite_rect.width),
                "height": float(sprite_rect.height),
            }
            textures_name = getattr(data.m_RD.texture.read(), "m_Name", "")
            record["source_texture"] = str(textures_name)
            sprites.append(record)

    if not textures:
        raise ValueError(f"no Texture2D objects found in {bundle_path}")
    if not sprites:
        raise ValueError(f"no Sprite objects found in {bundle_path}")
    return (
        sorted(textures, key=lambda record: record["name"]),
        sorted(sprites, key=lambda record: record["name"]),
    )


def build_resolved_assets(
    textures: list[dict[str, Any]],
    sprites: list[dict[str, Any]],
    textures_dir: Path,
    sprites_dir: Path,
    resolved_dir: Path,
    resource_id: str,
) -> list[dict[str, Any]]:
    reset_png_dir(resolved_dir)
    texture_by_name = {record["name"]: record for record in textures}
    sprite_by_name = {record["name"]: record for record in sprites}
    records = []
    for name in sorted(texture_by_name.keys() | sprite_by_name.keys()):
        source_record = sprite_by_name.get(name) or texture_by_name[name]
        source_dir = sprites_dir if name in sprite_by_name else textures_dir
        output_path = resolved_dir / f"{name}.png"
        shutil.copy2(source_dir / f"{name}.png", output_path)
        records.append(
            {
                **source_record,
                "resolution": "sprite_preferred"
                if name in sprite_by_name
                else "texture_fallback",
                "bytes": output_path.stat().st_size,
                "sha256": sha256_file(output_path),
                "candidate_url": f"/assets/card-candidate/{resource_id}/{output_path.name}",
            }
        )
    return records


def add_comparison_evidence(
    records: list[dict[str, Any]],
    resolved_dir: Path,
    photo_root: Path | None,
) -> None:
    if not photo_root:
        return
    for record in records:
        expected = expected_photo_path(photo_root, record["name"])
        if not expected:
            continue
        comparison: dict[str, Any] = {
            "exists": expected.exists(),
        }
        if expected.exists():
            candidate = Image.open(resolved_dir / f"{record['name']}.png").convert("RGBA")
            organized = Image.open(expected).convert("RGBA")
            comparison["byte_identical"] = sha256_file(expected) == record["sha256"]
            comparison["same_dimensions"] = candidate.size == organized.size
            comparison["organized_dimensions"] = list(organized.size)
            if candidate.size == organized.size:
                rgba_stat = ImageStat.Stat(ImageChops.difference(candidate, organized))
                white = Image.new("RGBA", candidate.size, "white")
                candidate_white = Image.alpha_composite(white, candidate).convert("RGB")
                organized_white = Image.alpha_composite(white, organized).convert("RGB")
                white_stat = ImageStat.Stat(
                    ImageChops.difference(candidate_white, organized_white)
                )
                comparison["rgba_rms"] = [
                    round(value, 6) for value in rgba_stat.rms
                ]
                comparison["composited_white_rms"] = [
                    round(value, 6) for value in white_stat.rms
                ]
        record["organized_export"] = comparison


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("resource_id")
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--card-index", type=Path)
    parser.add_argument("--output-root", type=Path)
    parser.add_argument(
        "--organized-photo-root",
        type=Path,
        help="Optional ALL_PHOTOS image_card directory used only for equality evidence.",
    )
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    args.raw_root = (args.raw_root or sources.raw_root).resolve()
    args.card_index = (
        args.card_index
        or sources.published_path("data", "masterdata", "card_index.json")
    ).resolve()
    args.output_root = (
        args.output_root or sources.inventory_path("card")
    ).resolve()

    resource_id = args.resource_id.strip()
    if not resource_id or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789_" for character in resource_id.lower()):
        raise ValueError(f"invalid resource_id: {resource_id!r}")

    raw_root = args.raw_root.resolve()
    bundle_path = raw_root / "asset" / f"card_{resource_id}.unity3d"
    if not bundle_path.is_file():
        raise FileNotFoundError(f"RAW card bundle not found: {bundle_path}")

    card_index = args.card_index.resolve()
    cards = load_cards(card_index, resource_id)
    card = cards[0]
    output_root = args.output_root.resolve() / resource_id
    textures_dir = output_root / "textures"
    sprites_dir = output_root / "sprites"
    resolved_dir = output_root / "resolved"
    textures, sprites = extract_bundle_images(
        bundle_path,
        textures_dir,
        sprites_dir,
    )
    records = build_resolved_assets(
        textures,
        sprites,
        textures_dir,
        sprites_dir,
        resolved_dir,
        resource_id,
    )
    add_comparison_evidence(
        records,
        resolved_dir,
        args.organized_photo_root.resolve() if args.organized_photo_root else None,
    )

    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "resource_id": resource_id,
        "masterdata": {
            "card_ids": [row.get("card_id") for row in cards],
            "character_id": card.get("character_id"),
            "rarity": card.get("rarity"),
            "title": card.get("title"),
            "row_count": len(cards),
        },
        "raw_source": {
            "relative_path": bundle_path.relative_to(raw_root).as_posix(),
            "bytes": bundle_path.stat().st_size,
            "sha256": sha256_file(bundle_path),
        },
        "textures": textures,
        "sprites": sprites,
        "resolved_assets": records,
        "summary": {
            "texture_count": len(textures),
            "sprite_count": len(sprites),
            "resolved_asset_count": len(records),
            "sprite_preferred_count": sum(
                1 for record in records if record["resolution"] == "sprite_preferred"
            ),
            "organized_export_byte_identical": sum(
                1
                for record in records
                if record.get("organized_export", {}).get("byte_identical")
            ),
            "organized_export_checked": sum(
                1 for record in records if "organized_export" in record
            ),
            "organized_export_same_dimensions": sum(
                1
                for record in records
                if record.get("organized_export", {}).get("same_dimensions")
            ),
        },
    }
    output_root.mkdir(parents=True, exist_ok=True)
    manifest_path = output_root / "candidate.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest["summary"], ensure_ascii=False))
    print(f"candidate: {manifest_path}")


if __name__ == "__main__":
    main()
