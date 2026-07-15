#!/usr/bin/env python3
"""Export CSV-referenced live-stage image layers from their Unity song bundles."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SIDEM_ROOT = Path(r"E:\BaiduNetdiskDownload\SideM")
SCRIPT_ROOT = SIDEM_ROOT / "growing stars" / "assets" / "resources" / "liveeffectscript"
RAW_ASSET_ROOT = SIDEM_ROOT / "RAW" / "asset"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "image-layers"


def referenced_images() -> set[str]:
    images: set[str] = set()
    for csv_path in sorted(SCRIPT_ROOT.glob("*.csv")):
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
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    assets = sorted(referenced_images())
    by_song: dict[str, list[str]] = {}
    for asset in assets:
        by_song.setdefault(song_code(asset), []).append(asset)

    entries: dict[str, dict] = {}
    completed = 0
    for code, song_assets in sorted(by_song.items()):
        bundle = RAW_ASSET_ROOT / f"song_{code}.unity3d"
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
            target = OUTPUT_ROOT / f"{asset}.png"
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

    index = {
        "schemaVersion": 1,
        "stats": {
            "assets": len(entries),
            "bytes": sum(entry["bytes"] for entry in entries.values()),
        },
        "assets": entries,
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Prepared {len(entries)} stage image layers in {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
