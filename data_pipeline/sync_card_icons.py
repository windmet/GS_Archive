"""Sync card icon images from extracted GS resources into the web viewer.

The web viewer keeps large binary assets out of git. Run this after extracting
`ALL_PHOTOS` to populate `public/assets/cards/icons`.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


DEFAULT_SOURCE = Path(
    r"E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS"
    r"\assets\resources\image\image_card\image_card_icon"
)
DEFAULT_DESTINATION = Path(__file__).resolve().parents[1] / "web_viewer" / "public" / "assets" / "cards" / "icons"
DEFAULT_CARD_INDEX = Path(__file__).resolve().parents[1] / "web_viewer" / "public" / "data" / "masterdata" / "card_index.json"


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


def validate_card_icon_coverage(card_index: Path, destination: Path) -> dict[str, object]:
    data = json.loads(card_index.read_text(encoding="utf-8"))
    cards = data.get("cards") or []
    normal = 0
    awakened = 0
    missing = []

    for card in cards:
        resource_id = card.get("resource_id")
        if not resource_id:
            continue
        normal_exists = (destination / f"image_card_icon_{resource_id}.png").exists()
        awakened_exists = (destination / f"image_card_icon_{resource_id}p.png").exists()
        if normal_exists:
            normal += 1
        if awakened_exists:
            awakened += 1
        if not normal_exists and not awakened_exists:
            missing.append(resource_id)

    return {
        "cards": len(cards),
        "normal": normal,
        "awakened": awakened,
        "any": len(cards) - len(missing),
        "missing": missing,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument(
        "--destination",
        type=Path,
        default=DEFAULT_DESTINATION,
    )
    parser.add_argument("--card-index", type=Path, default=DEFAULT_CARD_INDEX)
    parser.add_argument("--skip-copy", action="store_true")
    args = parser.parse_args()

    if not args.skip_copy:
        count, total_bytes = sync_card_icons(args.source, args.destination)
        print(f"synced {count} card icons ({total_bytes:,} bytes) -> {args.destination}")

    if args.card_index.exists():
        report = validate_card_icon_coverage(args.card_index, args.destination)
        print(
            "coverage: "
            f"{report['any']}/{report['cards']} any, "
            f"{report['awakened']} awakened, "
            f"{report['normal']} normal"
        )
        if report["missing"]:
            print("missing:", ", ".join(report["missing"][:50]))


if __name__ == "__main__":
    main()
