"""Build a curated catalog of locally extracted SideM UI-adjacent assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


DEFAULT_KEY = b"DefaultPassPhrase"

CATALOG_GROUPS = (
    "prefabs",
    "spriteatlas",
    "image/image_logo",
    "image/image_home_button",
    "image/image_home_balloon",
    "image/image_story",
    "image/image_unit",
    "image/image_idol_banner",
    "image/image_item",
    "image/image_gasha",
    "image/image_event",
    "image/image_mobile_background",
    "image/image_tutorial",
    "image/image_title_background",
    "image/image_jacket",
    "image/image_song_bg",
    "sprites/image_work",
)

DOMAIN_BY_GROUP = {
    "prefabs": "shared",
    "spriteatlas": "interaction",
    "image/image_logo": "brand",
    "image/image_home_button": "home",
    "image/image_home_balloon": "home",
    "image/image_story": "story",
    "image/image_unit": "unit",
    "image/image_idol_banner": "idol",
    "image/image_item": "item",
    "image/image_gasha": "gasha",
    "image/image_event": "event",
    "image/image_mobile_background": "interaction",
    "image/image_tutorial": "tutorial",
    "image/image_title_background": "story",
    "image/image_jacket": "music",
    "image/image_song_bg": "music",
    "sprites/image_work": "work",
}

ROLE_PATTERNS = (
    ("button", re.compile(r"button", re.I)),
    ("banner", re.compile(r"banner|announce", re.I)),
    ("logo", re.compile(r"logo", re.I)),
    ("icon", re.compile(r"icon", re.I)),
    ("background", re.compile(r"background|\bbg\b", re.I)),
    ("balloon", re.compile(r"balloon", re.I)),
    ("tab", re.compile(r"tab", re.I)),
    ("frame", re.compile(r"frame", re.I)),
    ("key_visual", re.compile(r"(?:^|_)kv(?:_|$)", re.I)),
    ("tutorial", re.compile(r"tutorial", re.I)),
)


def xor_decode(data: bytes) -> bytes:
    return bytes(value ^ DEFAULT_KEY[index % len(DEFAULT_KEY)] for index, value in enumerate(data))


def load_local_state(root: Path | None) -> dict[str, Any]:
    if not root or not root.exists():
        return {}
    records: dict[str, Any] = {}
    for path in sorted(root.iterdir()):
        if not path.is_file():
            continue
        try:
            records[path.name] = json.loads(xor_decode(path.read_bytes()).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            records[path.name] = {"decode_status": "unsupported"}
    return records


def classify_role(filename: str) -> str:
    for role, pattern in ROLE_PATTERNS:
        if pattern.search(filename):
            return role
    return "image"


def recommended_use(domain: str, role: str, filename: str) -> str:
    if domain == "unit" and role == "logo" and "event_logo" not in filename and "logo_icon" not in filename:
        return "entity_identity"
    if domain in {"story", "event", "gasha"} and role in {"banner", "button", "key_visual"}:
        return "content_navigation"
    if role in {"icon", "logo"} and domain in {"item", "brand", "work"}:
        return "domain_reference"
    if domain in {"tutorial", "home"}:
        return "reference_only"
    return "catalog_only"


def file_record(source_root: Path, group: str, path: Path) -> dict[str, Any]:
    relative = path.relative_to(source_root).as_posix()
    with Image.open(path) as image:
        width, height = image.size
        mode = image.mode
        has_alpha = "A" in image.getbands()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    domain = DOMAIN_BY_GROUP[group]
    role = classify_role(path.name)
    return {
        "id": relative.removesuffix(".png").replace("/", ":"),
        "filename": path.name,
        "source_relative": relative,
        "source_group": group,
        "domain": domain,
        "role": role,
        "recommended_use": recommended_use(domain, role, path.name),
        "width": width,
        "height": height,
        "aspect_ratio": round(width / height, 4) if height else 0,
        "mode": mode,
        "has_alpha": has_alpha,
        "bytes": path.stat().st_size,
        "sha256": digest,
    }


def copy_unit_logos(source_root: Path, public_root: Path) -> dict[str, str]:
    source_dir = source_root / "image" / "image_unit"
    destination = public_root / "assets" / "units" / "logos"
    destination.mkdir(parents=True, exist_ok=True)
    logos: dict[str, str] = {}
    for path in sorted(source_dir.rglob("image_unit_logo_*.png")):
        if "logo_icon" in path.name or "event_logo" in path.name:
            continue
        match = re.fullmatch(r"image_unit_logo_(\w+)\.png", path.name)
        if not match:
            continue
        shutil.copy2(path, destination / path.name)
        logos[match.group(1)] = f"/assets/units/logos/{path.name}"
    return logos


def copy_brand_mark(source_root: Path, public_root: Path) -> str:
    source = source_root / "image" / "image_logo" / "image_logo_imas_M_mark.png"
    if not source.exists():
        return ""
    destination = public_root / "assets" / "brand" / source.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return f"/assets/brand/{source.name}"


def load_event_codes(archive_manifest: Path | None) -> list[str]:
    if not archive_manifest or not archive_manifest.exists():
        return []
    payload = json.loads(archive_manifest.read_text(encoding="utf-8"))
    return sorted({
        str(event["event_code"])
        for event in payload.get("unit_event_relations", [])
        if event.get("event_code")
    })


def copy_event_banners(source_root: Path, public_root: Path, event_codes: list[str]) -> dict[str, str]:
    destination = public_root / "assets" / "events" / "banners"
    destination.mkdir(parents=True, exist_ok=True)
    banners: dict[str, str] = {}
    for event_code in event_codes:
        filename = f"image_home_announce_event_{event_code}_01.png"
        source = source_root / "image" / "image_event" / "announce" / event_code / filename
        if not source.exists():
            continue
        shutil.copy2(source, destination / filename)
        banners[event_code] = f"/assets/events/banners/{filename}"
    return banners


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_root", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--local-data", type=Path)
    parser.add_argument("--public-root", type=Path)
    parser.add_argument("--archive-manifest", type=Path)
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    entries = []
    missing_groups = []
    for group in CATALOG_GROUPS:
        directory = source_root / Path(group)
        if not directory.exists():
            missing_groups.append(group)
            continue
        entries.extend(file_record(source_root, group, path) for path in sorted(directory.rglob("*.png")))

    public_root = args.public_root.resolve() if args.public_root else None
    unit_logo_urls = copy_unit_logos(source_root, public_root) if public_root else {}
    brand_mark_url = copy_brand_mark(source_root, public_root) if public_root else ""
    event_banner_urls = copy_event_banners(
        source_root,
        public_root,
        load_event_codes(args.archive_manifest),
    ) if public_root else {}
    for entry in entries:
        match = re.fullmatch(r"image_unit_logo_(\w+)\.png", entry["filename"])
        if match and match.group(1) in unit_logo_urls:
            entry["public_url"] = unit_logo_urls[match.group(1)]
        if entry["filename"] == "image_logo_imas_M_mark.png" and brand_mark_url:
            entry["public_url"] = brand_mark_url
        event_banner_match = re.fullmatch(r"image_home_announce_event_(\d+)_01\.png", entry["filename"])
        if event_banner_match and event_banner_match.group(1) in event_banner_urls:
            entry["public_url"] = event_banner_urls[event_banner_match.group(1)]

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "label": "GS_Res/ALL_PHOTOS/assets/resources",
            "absolute_path_omitted": True,
            "scope": "Selected UI-adjacent PNG exports; not a complete Unity UI prefab dump.",
            "missing_groups": missing_groups,
        },
        "entries": entries,
        "by_id": {entry["id"]: entry for entry in entries},
        "featured_sets": {
            "unit_logo_urls": unit_logo_urls,
            "brand_mark_url": brand_mark_url,
            "event_banner_urls": event_banner_urls,
        },
        "local_state": load_local_state(args.local_data),
        "meta": {
            "entry_count": len(entries),
            "public_unit_logo_count": len(unit_logo_urls),
            "public_brand_mark_count": int(bool(brand_mark_url)),
            "public_event_banner_count": len(event_banner_urls),
            "counts_by_domain": dict(sorted(Counter(entry["domain"] for entry in entries).items())),
            "counts_by_role": dict(sorted(Counter(entry["role"] for entry in entries).items())),
            "counts_by_recommended_use": dict(sorted(Counter(entry["recommended_use"] for entry in entries).items())),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False))


if __name__ == "__main__":
    main()
