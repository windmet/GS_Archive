"""Sync card images from extracted GS resources into the web viewer.

The web viewer keeps large binary assets out of git. Run this after extracting
`ALL_PHOTOS` to populate `public/assets/cards`.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


DEFAULT_SOURCE = Path(
    r"E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS"
)
DEFAULT_DESTINATION = Path(__file__).resolve().parents[1] / "web_viewer" / "public" / "assets" / "cards"
DEFAULT_CARD_INDEX = Path(__file__).resolve().parents[1] / "web_viewer" / "public" / "data" / "masterdata" / "card_index.json"


def image_root(source: Path) -> Path:
    if source.name == "image_card":
        return source
    candidate = source / "assets" / "resources" / "image" / "image_card"
    if candidate.exists():
        return candidate
    return source


def copy_files(files: list[Path], destination: Path) -> tuple[int, int]:
    destination.mkdir(parents=True, exist_ok=True)
    count = 0
    total_bytes = 0
    for path in files:
        target = destination / path.name
        shutil.copy2(path, target)
        count += 1
        total_bytes += path.stat().st_size
    return count, total_bytes


def load_selected_resource_ids(card_index: Path, resource_id: list[str], rarity: list[str]) -> set[str]:
    data = json.loads(card_index.read_text(encoding="utf-8"))
    cards = data.get("cards") or []
    selected = set(resource_id)
    rarity_set = {item.upper() for item in rarity}
    if rarity_set:
        for card in cards:
            if str(card.get("rarity") or "").upper() in rarity_set:
                selected.add(card["resource_id"])
    return selected


def sync_card_icons(source: Path, destination: Path) -> tuple[int, int]:
    source = image_root(source) / "image_card_icon"
    if not source.exists():
        raise FileNotFoundError(f"source directory not found: {source}")
    return copy_files(list(source.glob("*.png")), destination / "icons")


def sync_selected_large_images(
    source: Path,
    destination: Path,
    resource_ids: set[str],
    include_portrait: bool,
    include_landscape: bool,
) -> tuple[int, int]:
    root = image_root(source)
    files: list[Path] = []
    if include_portrait:
        portrait_dir = root / "image_card_portrait"
        for resource_id in resource_ids:
            files.extend(portrait_dir.glob(f"image_card_portrait_*_{resource_id}*.png"))
    if include_landscape:
        landscape_dir = root / "image_card_landscape"
        for resource_id in resource_ids:
            files.extend(landscape_dir.glob(f"image_card_landscape_{resource_id}*.png"))

    unique_files = sorted(set(files))
    return copy_files(unique_files, destination / "large")


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
        icon_dir = destination / "icons"
        normal_exists = (icon_dir / f"image_card_icon_{resource_id}.png").exists()
        awakened_exists = (icon_dir / f"image_card_icon_{resource_id}p.png").exists()
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
    parser.add_argument("--resource-id", action="append", default=[])
    parser.add_argument("--rarity", action="append", default=[])
    parser.add_argument("--portrait", action="store_true")
    parser.add_argument("--landscape", action="store_true")
    args = parser.parse_args()

    if not args.skip_copy:
        count, total_bytes = sync_card_icons(args.source, args.destination)
        print(f"synced {count} card icons ({total_bytes:,} bytes) -> {args.destination}")
        if args.portrait or args.landscape:
            resource_ids = load_selected_resource_ids(args.card_index, args.resource_id, args.rarity)
            count, total_bytes = sync_selected_large_images(
                args.source,
                args.destination,
                resource_ids,
                args.portrait,
                args.landscape,
            )
            print(f"synced {count} large card images ({total_bytes:,} bytes) -> {args.destination / 'large'}")

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
