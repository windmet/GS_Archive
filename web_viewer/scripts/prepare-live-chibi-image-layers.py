#!/usr/bin/env python3
"""Export CSV-referenced live-stage image layers from their Unity song bundles."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "image-layers"


def referenced_images(script_root: Path) -> set[str]:
    images: set[str] = set()
    for csv_path in sorted(script_root.glob("*.csv")):
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.reader(handle):
                if row and row[0] in {"Image_layer", "Image_layer_2"} and len(row) > 2:
                    if row[2].strip():
                        images.add(row[2].strip())
    return images


def song_code(asset_name: str) -> str:
    if not asset_name.startswith("stage_") or "_" not in asset_name[6:]:
        raise ValueError(f"Unsupported stage image name: {asset_name}")
    return asset_name[6:].split("_", 1)[0]


def cached_metadata(target: Path, bundle: Path, force: bool) -> dict | None:
    if force or not target.exists() or target.stat().st_size <= 0:
        return None
    if target.stat().st_mtime < bundle.stat().st_mtime:
        return None
    try:
        with Image.open(target) as image:
            width, height = image.size
            mode = image.mode
            alpha_extrema = image.getchannel("A").getextrema() if "A" in image.getbands() else None
    except OSError:
        return None
    if width <= 0 or height <= 0:
        return None
    return {
        "width": width,
        "height": height,
        "mode": mode,
        "alphaRange": list(alpha_extrema) if alpha_extrema else None,
        "bytes": target.stat().st_size,
    }


def export_texture(image, target: Path) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f"{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    image.save(temporary, format="PNG", optimize=True)
    with Image.open(temporary) as check:
        width, height = check.size
        mode = check.mode
        alpha_extrema = check.getchannel("A").getextrema() if "A" in check.getbands() else None
    if width <= 0 or height <= 0:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Invalid exported image: {target.name}")
    temporary.replace(target)
    return {
        "width": width,
        "height": height,
        "mode": mode,
        "alphaRange": list(alpha_extrema) if alpha_extrema else None,
        "bytes": target.stat().st_size,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--script-root", type=Path)
    parser.add_argument("--raw-asset-root", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--asset",
        action="append",
        default=[],
        help="Only prepare this referenced image-layer asset. Repeat for multiple assets.",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    if args.script_root:
        script_root = args.script_root.resolve()
    elif sources.legacy_root:
        script_root = (
            sources.legacy_root
            / "growing stars"
            / "assets"
            / "resources"
            / "liveeffectscript"
        ).resolve()
    else:
        raise ValueError(
            "legacy_root or --script-root is required for liveeffectscript CSVs"
        )
    raw_asset_root = (args.raw_asset_root or sources.raw_root / "asset").resolve()
    output_root = args.output_root.resolve()
    if not script_root.is_dir():
        raise FileNotFoundError(f"Missing liveeffectscript root: {script_root}")
    if not raw_asset_root.is_dir():
        raise FileNotFoundError(f"Missing RAW asset root: {raw_asset_root}")

    all_assets = referenced_images(script_root)
    selected = set(args.asset)
    unknown = sorted(selected - all_assets)
    if unknown:
        raise ValueError(f"Unknown image-layer asset IDs: {unknown}")
    assets = sorted(selected or all_assets)
    by_song: dict[str, list[str]] = {}
    for asset in assets:
        by_song.setdefault(song_code(asset), []).append(asset)

    entries: dict[str, dict] = {}
    completed = 0
    for code, song_assets in sorted(by_song.items()):
        bundle = raw_asset_root / f"song_{code}.unity3d"
        if not bundle.exists():
            raise FileNotFoundError(f"Missing song bundle: {bundle}")
        environment = UnityPy.load(str(bundle))
        sprites = {}
        for obj in environment.objects:
            if obj.type.name != "Sprite":
                continue
            sprite = obj.read()
            if sprite.m_Name in song_assets:
                sprites[sprite.m_Name] = sprite

        missing = sorted(set(song_assets) - set(sprites))
        if missing:
            raise FileNotFoundError(f"Missing sprites in {bundle.name}: {missing}")

        for asset in song_assets:
            sprite = sprites[asset]
            texture = sprite.m_RD.texture.read()
            target = output_root / f"{asset}.png"
            metadata = cached_metadata(target, bundle, args.force)
            if metadata is None:
                metadata = export_texture(texture.image, target)
            rect = sprite.m_Rect
            offset = sprite.m_RD.textureRectOffset
            entries[asset] = {
                "id": asset,
                "file": f"image-layers/{target.name}",
                "bundle": bundle.name,
                "spriteRect": {
                    "x": round(float(rect.x), 4),
                    "y": round(float(rect.y), 4),
                    "width": round(float(rect.width), 4),
                    "height": round(float(rect.height), 4),
                },
                "textureRectOffset": {
                    "x": round(float(offset.x), 4),
                    "y": round(float(offset.y), 4),
                },
                **metadata,
            }
            completed += 1
            print(f"[{completed:02d}/{len(assets):02d}] {asset}")

    index_path = output_root / "index.json"
    if selected and index_path.is_file():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
        merged_entries = existing.get("assets", {})
        merged_entries.update(entries)
        entries = merged_entries

    index = {
        "schemaVersion": 1,
        "stats": {
            "assets": len(entries),
            "bytes": sum(entry["bytes"] for entry in entries.values()),
        },
        "assets": entries,
    }
    output_root.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Prepared {len(assets)} selected stage image layers in {output_root}")


if __name__ == "__main__":
    main()
