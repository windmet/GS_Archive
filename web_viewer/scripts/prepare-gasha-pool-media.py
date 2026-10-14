#!/usr/bin/env python3
"""Publish the client's own gasha art for pools that have no announcement banner.

config/gasha-pool-media.v1.json links each ticket-only pool to a RAW gasha id by the pool name drawn on its
banner (GashaData, which named the art, was server-delivered). For every linked id this decodes
RAW/asset/image_gasha_banner_<id> (200x100 list banner), image_gasha_logo_<id> (280x280 title logo) and, when
the client has one, image_gasha_bg_<id> (1800x1068 key visual), writes them under
public/assets/gasha-pool/ (ignored; media goes to R2), and pins each output and source bundle by SHA-256 in
the tracked index public/data/editorial/gasha-pool-media.json.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path

import UnityPy
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("backmonitor", PROJECT_ROOT / "scripts" / "prepare-live-chibi-backmonitor.py")
backmonitor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backmonitor)

CONFIG_PATH = PROJECT_ROOT / "config" / "gasha-pool-media.v1.json"
TICKETS_PATH = PROJECT_ROOT / "public" / "data" / "editorial" / "gasha-ticket-evidence.json"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "gasha-pool"
INDEX_PATH = PROJECT_ROOT / "public" / "data" / "editorial" / "gasha-pool-media.json"
ROLES = {"banner": ((200, 100), "png"), "logo": ((280, 280), "png"), "bg": ((1800, 1068), "webp")}
WEBP_QUALITY = 82


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def texture(bundle: Path) -> Image.Image:
    textures = [obj.read() for obj in UnityPy.load(str(bundle)).objects if obj.type.name == "Texture2D"]
    if len(textures) != 1:
        raise SystemExit(f"{bundle.name}: expected one Texture2D, found {len(textures)}")
    return textures[0].image


def encode(image: Image.Image, kind: str) -> bytes:
    buffer = io.BytesIO()
    if kind == "png":
        image.save(buffer, "PNG", optimize=True)
    else:
        image.convert("RGB").save(buffer, "WEBP", quality=WEBP_QUALITY, method=6)
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    backmonitor.add_sources_config_argument(parser)
    args = parser.parse_args()
    sources = backmonitor.load_archive_sources(args.sources_config)
    asset_root = sources.raw_root / "asset"
    config_raw = CONFIG_PATH.read_bytes()
    config = json.loads(config_raw)
    ticket_ids = {row["id"] for row in json.loads(TICKETS_PATH.read_text(encoding="utf-8"))["rows"] if not row["matched_ids"]}

    linked = [pool["pool"] for pool in config["pools"]] + [pool for row in config["unresolved"] for pool in row["pools"]]
    if len(linked) != len(set(linked)) or set(linked) != ticket_ids:
        raise SystemExit("config must name every ticket-only pool exactly once")
    ids = sorted({pool["primary"] for pool in config["pools"]}
                 | {variant["gasha_id"] for pool in config["pools"] for variant in pool.get("variants", [])}
                 | {gasha_id for row in config["unresolved"] for gasha_id in row["gasha_ids"]})
    for pool in config["pools"]:
        if pool["basis"] not in config["basis"]:
            raise SystemExit(f"{pool['pool']}: unknown basis {pool['basis']}")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    media = {}
    for gasha_id in ids:
        entry = {}
        for role, (size, kind) in ROLES.items():
            bundle = asset_root / f"image_gasha_{role}_{gasha_id}.unity3d"
            if not bundle.exists():
                if role != "bg":
                    raise SystemExit(f"missing RAW {bundle.name}")
                continue
            image = texture(bundle)
            if image.size != size:
                raise SystemExit(f"{bundle.name}: {image.size} is not {size}")
            data = encode(image, kind)
            output = OUTPUT_ROOT / f"{gasha_id}-{role}.{kind}"
            if not output.exists() or output.read_bytes() != data:
                output.write_bytes(data)
            entry[role] = {"url": f"/assets/gasha-pool/{output.name}", "width": size[0], "height": size[1], "bytes": len(data),
                           "sha256": sha256(data), "bundle": bundle.name, "bundle_sha256": sha256(bundle.read_bytes())}
        media[str(gasha_id)] = entry
        print(f"{gasha_id}: {', '.join(entry)}")

    index = {
        "schema_version": 1,
        "config": {"path": "config/gasha-pool-media.v1.json", "sha256": sha256(config_raw)},
        "encoding": f"banner and logo: lossless PNG at source size; bg: WebP q{WEBP_QUALITY} at source size",
        "summary": {"gasha_ids": len(media), "with_bg": sum(1 for entry in media.values() if "bg" in entry),
                    "pools": len(config["pools"]), "unresolved_pools": sum(len(row["pools"]) for row in config["unresolved"]),
                    "bytes": sum(asset["bytes"] for entry in media.values() for asset in entry.values())},
        "media": media,
    }
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(index["summary"]))


if __name__ == "__main__":
    main()
