#!/usr/bin/env python3
"""Extract built-in live-stage mask and laser textures from the local XAPK."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

import UnityPy
from live_chibi_spotlight import spotlight_sprite_model


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "stage-effects"


def find_xapk(explicit: Path | None, configured: Path | None) -> Path:
    path = (explicit or configured)
    if path is None:
        raise ValueError("xapk_file or --xapk is required for stage effects")
    resolved = path.resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"XAPK not found: {resolved}")
    return resolved


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
    return lowered in {"laserlight_1", "laserlight_2", "laserlight_3", "spotlight1", "spotlight2"} or (
        "pinspotlight" in lowered
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--xapk", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    xapk = find_xapk(args.xapk, sources.xapk_file)
    output_root = args.output_root.resolve()
    unity_data = read_unity_data(xapk)
    environment = UnityPy.load(unity_data)
    output_root.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}
    for obj in environment.objects:
        if obj.type.name != "Texture2D":
            continue
        texture = obj.read()
        if not is_stage_effect_texture(texture.m_Name):
            continue
        image = texture.image.convert("RGBA")
        filename = f"{texture.m_Name}.png"
        target = output_root / filename
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
            "source": {"serializedFile": obj.assets_file.name, "pathId": str(obj.path_id),
                       "sha256": hashlib.sha256(obj.get_raw_data()).hexdigest()},
            "pngSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }

    # Inspect typed bindings before publishing a renderer descriptor; names alone
    # do not establish that a texture belongs to the Spotlight prefab.
    import importlib.util
    audit_spec = importlib.util.spec_from_file_location('light_audit', PROJECT_ROOT / 'scripts/audit-chibi-light-resources.py')
    audit = importlib.util.module_from_spec(audit_spec)
    audit_spec.loader.exec_module(audit)
    roots = [obj for obj in environment.objects
             if obj.type.name == 'GameObject' and obj.read().m_Name == 'LiveObjectSpotlight']
    if len(roots) != 1:
        raise ValueError('Ambiguous native Spotlight prefab')
    spotlight = spotlight_sprite_model(audit.inspect_prefab(roots[0]))
    for layer in spotlight['layers']:
        source = assets[layer['asset']]['source']
        if (source['serializedFile'], source['pathId']) != (spotlight['serializedFile'], layer['texturePathId']):
            raise ValueError('Spotlight texture identity mismatch')

    index = {
        "schemaVersion": 2,
        "source": xapk.name,
        "unityDataSha256": hashlib.sha256(unity_data).hexdigest(),
        "assets": dict(sorted(assets.items())),
        "spotlight": spotlight,
    }
    index_target = output_root / "index.json"
    index_target.write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Prepared {len(assets)} built-in stage-effect textures from {xapk.name}")


if __name__ == "__main__":
    main()
