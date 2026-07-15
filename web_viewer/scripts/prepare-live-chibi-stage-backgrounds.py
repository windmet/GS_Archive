#!/usr/bin/env python3
"""Compose always-on live-stage layers from Unity song bundles."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SIDEM_ROOT = Path(r"E:\BaiduNetdiskDownload\SideM")
SCRIPT_ROOT = SIDEM_ROOT / "growing stars" / "assets" / "resources" / "liveeffectscript"
RAW_ASSET_ROOT = SIDEM_ROOT / "RAW" / "asset"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "stage-backgrounds"


def dynamic_stage_images() -> set[str]:
    assets: set[str] = set()
    for csv_path in sorted(SCRIPT_ROOT.glob("*.csv")):
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.reader(handle):
                if row and row[0] in {"Image_layer", "Image_layer_2"} and len(row) > 2:
                    if row[2].strip():
                        assets.add(row[2].strip())
    return assets


def cached_metadata(target: Path, bundle: Path, force: bool) -> dict | None:
    if force or not target.exists() or target.stat().st_size <= 0:
        return None
    if target.stat().st_mtime < bundle.stat().st_mtime:
        return None
    try:
        with Image.open(target) as image:
            width, height = image.size
            alpha_extrema = image.getchannel("A").getextrema()
    except OSError:
        return None
    if width <= 0 or height <= 0:
        return None
    return {
        "width": width,
        "height": height,
        "alphaRange": list(alpha_extrema),
        "bytes": target.stat().st_size,
    }


def save_composite(image: Image.Image, target: Path) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f"{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    image.save(temporary, format="PNG", optimize=True)
    with Image.open(temporary) as check:
        width, height = check.size
        alpha_extrema = check.getchannel("A").getextrema()
    if width <= 0 or height <= 0:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Invalid stage background: {target.name}")
    temporary.replace(target)
    return {
        "width": width,
        "height": height,
        "alphaRange": list(alpha_extrema),
        "bytes": target.stat().st_size,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    dynamic_assets = dynamic_stage_images()
    entries: dict[str, dict] = {}
    song_bundles = sorted(RAW_ASSET_ROOT.glob("song_*.unity3d"))
    for bundle in song_bundles:
        code = bundle.stem.removeprefix("song_")
        pattern = re.compile(rf"^stage_{re.escape(code)}_(\d+)$", re.IGNORECASE)
        environment = UnityPy.load(str(bundle))
        layers: list[tuple[int, str, Image.Image]] = []
        for obj in environment.objects:
            if obj.type.name != "Texture2D":
                continue
            texture = obj.read()
            match = pattern.match(texture.m_Name)
            if not match or texture.m_Name in dynamic_assets:
                continue
            layers.append((int(match.group(1)), texture.m_Name, texture.image.convert("RGBA")))

        if not layers:
            continue
        layers.sort(key=lambda item: item[0])
        sizes = {image.size for _, _, image in layers}
        if len(sizes) != 1:
            raise RuntimeError(f"Stage layer sizes differ in {bundle.name}: {sorted(sizes)}")
        target = OUTPUT_ROOT / f"{code}.png"
        metadata = cached_metadata(target, bundle, args.force)
        if metadata is None:
            composite = Image.new("RGBA", layers[0][2].size)
            for _, _, image in layers:
                composite = Image.alpha_composite(composite, image)
            metadata = save_composite(composite, target)
        entries[code] = {
            "id": code,
            "file": f"stage-backgrounds/{target.name}",
            "bundle": bundle.name,
            "layers": [name for _, name, _ in layers],
            **metadata,
        }
        print(f"[{len(entries):02d}] {code}: {', '.join(entries[code]['layers'])}")

    index = {
        "schemaVersion": 1,
        "stats": {
            "songs": len(entries),
            "bytes": sum(entry["bytes"] for entry in entries.values()),
        },
        "songs": entries,
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    temporary_index = OUTPUT_ROOT / "index.tmp.json"
    temporary_index.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_index.replace(OUTPUT_ROOT / "index.json")
    print(f"Prepared {len(entries)} stage backgrounds in {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
