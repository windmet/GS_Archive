#!/usr/bin/env python3
"""Compose always-on live-stage layers from Unity song bundles."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "stage-backgrounds"


def dynamic_stage_images(script_root: Path) -> set[str]:
    assets: set[str] = set()
    for csv_path in sorted(script_root.glob("*.csv")):
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
    add_sources_config_argument(parser)
    parser.add_argument("--script-root", type=Path)
    parser.add_argument("--raw-asset-root", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--song-code",
        action="append",
        default=[],
        help="Only prepare this song code. Repeat for multiple songs.",
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

    dynamic_assets = dynamic_stage_images(script_root)
    selected = set(args.song_code)
    entries: dict[str, dict] = {}
    all_song_bundles = sorted(raw_asset_root.glob("song_*.unity3d"))
    bundle_codes = {
        bundle.stem.removeprefix("song_"): bundle for bundle in all_song_bundles
    }
    unknown = sorted(selected - bundle_codes.keys())
    if unknown:
        raise ValueError(f"Unknown RAW song bundle codes: {unknown}")
    song_bundles = [
        bundle
        for code, bundle in bundle_codes.items()
        if not selected or code in selected
    ]
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
        target = output_root / f"{code}.png"
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

    index_path = output_root / "index.json"
    if selected and index_path.is_file():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
        merged_entries = existing.get("songs", {})
        for code in selected:
            if code in entries:
                merged_entries[code] = entries[code]
            else:
                merged_entries.pop(code, None)
        entries = merged_entries

    index = {
        "schemaVersion": 1,
        "stats": {
            "songs": len(entries),
            "bytes": sum(entry["bytes"] for entry in entries.values()),
        },
        "songs": entries,
    }
    output_root.mkdir(parents=True, exist_ok=True)
    temporary_index = output_root / "index.tmp.json"
    temporary_index.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_index.replace(index_path)
    print(f"Prepared {len(entries)} stage backgrounds in {output_root}")


if __name__ == "__main__":
    main()
