#!/usr/bin/env python3
"""Extract the 61 song jacket covers from RAW song bundles.

Each music_catalog song carries a RAW song_<code>.unity3d choreography bundle
that exposes a 730x720 ASTC Texture2D named image_jacket_<code>. This command
exports that texture for every song and records a read-only index keyed by
song_code; it never decodes audio or publishes anything itself.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import UnityPy

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT_ROOT = (
    PROJECT_ROOT / ".analysis" / "raw-migration" / "song-jackets" / "candidate"
)
DEFAULT_INDEX_OUTPUT = (
    PROJECT_ROOT / ".analysis" / "raw-migration" / "song-jackets" / "song_jacket_index.json"
)
MUSIC_CATALOG = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"
PUBLIC_URL_ROOT = "/assets/songs"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_jacket(bundle_path: Path, code: str, output_path: Path) -> dict:
    """Export image_jacket_<code> from a song bundle, keyed by texture name."""
    environment = UnityPy.load(str(bundle_path))
    target_name = f"image_jacket_{code}"
    for obj in environment.objects:
        if obj.type.name != "Texture2D":
            continue
        data = obj.read()
        if data.m_Name != target_name:
            continue
        image = data.image
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)
        return {
            "filename": output_path.name,
            "url": f"{PUBLIC_URL_ROOT}/{output_path.name}",
            "width": int(image.width),
            "height": int(image.height),
            "bytes": output_path.stat().st_size,
            "sha256": sha256_file(output_path),
            "texture_name": str(data.m_Name),
            "path_id": str(obj.path_id),
        }
    raise ValueError(f"{bundle_path.name} has no Texture2D named {target_name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--index-output", type=Path, default=DEFAULT_INDEX_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    asset_root = (sources.raw_root / "asset").resolve()
    if not asset_root.is_dir():
        raise FileNotFoundError(f"Missing RAW asset root: {asset_root}")

    music_catalog = json.loads(MUSIC_CATALOG.read_text(encoding="utf-8"))
    songs = music_catalog.get("songs") or {}
    if len(songs) != 61:
        raise ValueError(f"expected 61 music_catalog songs, found {len(songs)}")

    output_root = args.output_root.resolve()
    entries: dict[str, dict] = {}
    for code in sorted(songs):
        bundle_path = asset_root / f"song_{code}.unity3d"
        if not bundle_path.is_file():
            raise FileNotFoundError(bundle_path)
        entry = extract_jacket(bundle_path, code, output_root / f"jacket_{code}.png")
        entry["raw_bundle"] = {
            "filename": bundle_path.name,
            "relative_path": bundle_path.relative_to(sources.raw_root).as_posix(),
            "bytes": bundle_path.stat().st_size,
            "sha256": sha256_file(bundle_path),
        }
        entries[code] = entry

    index = {
        "schema_version": 1,
        "authority": {
            "semantic_relation": "music_catalog song_code -> RAW song_<code>.unity3d Texture2D image_jacket_<code>",
            "physical_payload": "RAW asset/song_<code>.unity3d",
            "subresource_identity": "Unity Texture2D name",
        },
        "source": {
            "music_catalog": MUSIC_CATALOG.relative_to(PROJECT_ROOT).as_posix(),
            "choreography_root": "RAW/asset",
        },
        "entries": entries,
        "meta": {
            "entry_count": len(entries),
            "published_bytes": sum(entry["bytes"] for entry in entries.values()),
        },
    }
    index_output = args.index_output.resolve()
    index_output.parent.mkdir(parents=True, exist_ok=True)
    index_output.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Song jackets prepared: {len(entries)} covers / "
        f"{index['meta']['published_bytes']} bytes"
    )
    print(f"assets: {output_root}")
    print(f"index: {index_output}")


if __name__ == "__main__":
    main()
