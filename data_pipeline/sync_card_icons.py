"""Sync card icon images from extracted GS resources into the web viewer.

The web viewer keeps large binary assets out of git. Run this after extracting
`ALL_PHOTOS` to populate `public/assets/cards/icons`.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


DEFAULT_SOURCE = Path(
    r"E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS"
    r"\assets\resources\image\image_card\image_card_icon"
)
DEFAULT_DESTINATION = Path(__file__).resolve().parents[1] / "web_viewer" / "public" / "assets" / "cards" / "icons"


def sync_card_icons(source: Path, destination: Path) -> tuple[int, int]:
    if not source.exists():
        raise FileNotFoundError(f"source directory not found: {source}")
    destination.mkdir(parents=True, exist_ok=True)

    count = 0
    total_bytes = 0
    for path in source.glob("*.png"):
        target = destination / path.name
        shutil.copy2(path, target)
        count += 1
        total_bytes += path.stat().st_size
    return count, total_bytes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument(
        "--destination",
        type=Path,
        default=DEFAULT_DESTINATION,
    )
    args = parser.parse_args()

    count, total_bytes = sync_card_icons(args.source, args.destination)
    print(f"synced {count} card icons ({total_bytes:,} bytes) -> {args.destination}")


if __name__ == "__main__":
    main()
