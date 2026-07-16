#!/usr/bin/env python3
"""Extract built-in live-stage mask and laser textures from the local XAPK."""

from __future__ import annotations

import argparse
import io
import json
import zipfile
from pathlib import Path

import UnityPy


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SIDEM_ROOT = Path(r"E:\BaiduNetdiskDownload\SideM")
XAPK_ROOT = SIDEM_ROOT / "サイスタ - 副本"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "stage-effects"


def find_xapk(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit)
        if path.is_file():
            return path
        raise FileNotFoundError(f"XAPK not found: {path}")
    candidates = sorted(XAPK_ROOT.glob("*.xapk"), key=lambda path: path.stat().st_mtime)
    if not candidates:
        raise FileNotFoundError(f"No XAPK found under {XAPK_ROOT}")
    return candidates[-1]


def read_unity_data(xapk: Path) -> bytes:
    with zipfile.ZipFile(xapk) as archive:
        apk_names = [
            name for name in archive.namelist()
            if name.endswith(".apk") and not Path(name).name.startswith("config.")
        ]
        if not apk_names:
            raise RuntimeError(f"Main APK missing from {xapk.name}")
        apk_bytes = archive.read(apk_names[0])
    with zipfile.ZipFile(io.BytesIO(apk_bytes)) as apk:
        data_name = "assets/bin/Data/data.unity3d"
        if data_name not in apk.namelist():
            raise RuntimeError(f"{data_name} missing from {apk_names[0]}")
        return apk.read(data_name)


def is_stage_effect_texture(name: str) -> bool:
    lowered = name.lower()
    return lowered in {"laserlight_1", "laserlight_2", "laserlight_3"} or (
        "pinspotlight" in lowered
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xapk")
    args = parser.parse_args()

    xapk = find_xapk(args.xapk)
    environment = UnityPy.load(read_unity_data(xapk))
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}
    for obj in environment.objects:
        if obj.type.name != "Texture2D":
            continue
        texture = obj.read()
        if not is_stage_effect_texture(texture.m_Name):
            continue
        image = texture.image.convert("RGBA")
        filename = f"{texture.m_Name}.png"
        target = OUTPUT_ROOT / filename
        temporary = target.with_name(f"{target.stem}.tmp{target.suffix}")
        temporary.unlink(missing_ok=True)
        image.save(temporary, format="PNG", optimize=True)
        temporary.replace(target)
        assets[texture.m_Name] = {
            "file": f"stage-effects/{filename}",
            "width": image.width,
            "height": image.height,
            "alphaRange": list(image.getchannel("A").getextrema()),
            "bytes": target.stat().st_size,
        }

    index = {
        "schemaVersion": 1,
        "source": xapk.name,
        "assets": dict(sorted(assets.items())),
    }
    index_target = OUTPUT_ROOT / "index.json"
    index_target.write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Prepared {len(assets)} built-in stage-effect textures from {xapk.name}")


if __name__ == "__main__":
    main()
