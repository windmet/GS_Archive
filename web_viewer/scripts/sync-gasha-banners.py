#!/usr/bin/env python3
"""Copy the gasha announcement banners referenced by the normalized index."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Root containing extracted announcement images")
    parser.add_argument(
        "--index",
        type=Path,
        default=Path("public/data/masterdata/gasha_index.json"),
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("public/assets/gasha"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    index = json.loads(args.index.read_text(encoding="utf-8"))
    expected = {item["banner_file"] for item in index.get("gashas", []) if item.get("banner_file")}
    available: dict[str, list[Path]] = {}
    for path in args.source.rglob("image_home_announce_gasha_*_01.png"):
        available.setdefault(path.name, []).append(path)

    duplicates = {name: paths for name, paths in available.items() if name in expected and len(paths) > 1}
    if duplicates:
        names = ", ".join(sorted(duplicates)[:10])
        raise SystemExit(f"duplicate source banners: {names}")

    missing = sorted(name for name in expected if name not in available)
    if missing:
        raise SystemExit(f"missing {len(missing)} banners: {', '.join(missing[:10])}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for name in sorted(expected):
        destination = args.out_dir / name
        source = available[name][0]
        if not destination.exists() or destination.stat().st_size != source.stat().st_size:
            shutil.copy2(source, destination)
            copied += 1

    unexpected = [path for path in args.out_dir.glob("image_home_announce_gasha_*_01.png") if path.name not in expected]
    print(f"gasha banners: {len(expected)} referenced, {copied} copied, {len(unexpected)} unrelated retained")


if __name__ == "__main__":
    main()
