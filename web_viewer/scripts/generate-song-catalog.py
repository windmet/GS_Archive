#!/usr/bin/env python3
"""Generate a read-only metadata catalog for the 61 music_catalog songs.

The catalog aggregates table-46 identity (song_id, open_at), the committed
song movie relations, the committed RAW audio-layer relations, and a RAW
choreography bundle scan. It never decodes, copies, or publishes media.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from archive_paths import add_sources_config_argument, load_archive_sources

from masterdata_extract import extract_table_rows, iter_top_records

try:
    import UnityPy
except ImportError:
    UnityPy = None

DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "data" / "song_catalog.json"
MUSIC_CATALOG = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"
SONG_MOVIE_INDEX = PROJECT_ROOT / "public" / "data" / "masterdata" / "song_movie_index.json"
SONG_AUDIO_CATALOG = PROJECT_ROOT / "public" / "data" / "song_audio_relation_catalog.json"
SONG_JACKET_INDEX = PROJECT_ROOT / "public" / "data" / "song_jacket_index.json"

DISABLED_OPEN_AT = 4102412400  # 2100-01-01 UTC sentinel in this snapshot.

IDOL_SUFFIX_RE = re.compile(r"^\d{3}[a-z]{3}$")
SONG3_PREFIX = "song3_"


def load_table46_song_identities(masterdata_decoded: Path) -> dict[str, dict]:
    """Extract song_id / open_at / close_at for every song_code in table 46."""
    records = list(iter_top_records(masterdata_decoded.read_bytes()))
    rows = extract_table_rows(records, {46})
    identities: dict[str, dict] = {}
    for row in rows[46]:
        code = row.get("4")
        if not isinstance(code, str):
            continue
        identities[code] = {
            "song_id": row.get("1"),
            "open_at": row.get("29"),
        }
    return identities


def scan_choreography_bundle(bundle_path: Path, code: str) -> dict:
    """Read TextAsset / sprite names from a song_<code>.unity3d bundle."""
    if UnityPy is None:
        raise RuntimeError("UnityPy is required for the choreography scan")
    result = {
        "has_fumen": False,
        "has_for_lipsync": False,
        "has_live_effect": False,
        "live_effect_variants": [],
        "has_jacket": False,
        "has_song_bg": False,
    }
    env = UnityPy.load(str(bundle_path))
    fumen_name = f"{code}_fumen"
    lipsync_name = f"{code}_for_lipsync"
    effect_prefix = f"{code}_live_effect"
    jacket_name = f"image_jacket_{code}"
    song_bg_name = f"image_song_bg_{code}"
    for obj in env.objects:
        if obj.type.name == "TextAsset":
            name = obj.read().m_Name
            if name == fumen_name:
                result["has_fumen"] = True
            elif name == lipsync_name:
                result["has_for_lipsync"] = True
            elif name == effect_prefix:
                result["has_live_effect"] = True
            elif name.startswith(effect_prefix + "_"):
                result["live_effect_variants"].append(name[len(effect_prefix) + 1:])
        elif obj.type.name in ("Sprite", "Texture2D"):
            name = obj.read().m_Name
            if name == jacket_name:
                result["has_jacket"] = True
            elif name == song_bg_name:
                result["has_song_bg"] = True
    result["live_effect_variants"].sort()
    return result


def derive_audio(code: str, layers: list[dict]) -> dict:
    """Summarize the committed audio-layer relations for one song."""
    audio = {
        "unit_cue_count": 0,
        "unit_codes": [],
        "oneshot_cue_count": 0,
        "oneshot_idol_codes": [],
        "idol_vocal_file_count": 0,
        "idol_vocal_codes": [],
        "backing_file_count": 0,
        "has_full_mix": False,
    }
    for layer in layers:
        kind = layer.get("kind")
        if kind == "unit-cue":
            audio["unit_cue_count"] = len(layer.get("cue_names") or [])
            audio["unit_codes"] = [
                cue.split(f"{SONG3_PREFIX}{code}_", 1)[1]
                for cue in (layer.get("cue_names") or [])
            ]
        elif kind == "oneshot-cue":
            audio["oneshot_cue_count"] = len(layer.get("cue_names") or [])
            audio["oneshot_idol_codes"] = [
                cue.split("_oneshot_", 1)[1]
                for cue in (layer.get("cue_names") or [])
            ]
        elif kind == "idol-vocal":
            files = layer.get("files") or []
            audio["idol_vocal_file_count"] = len(files)
            audio["idol_vocal_codes"] = [
                Path(name).stem.rsplit("_", 1)[1]
                for name in files
                if IDOL_SUFFIX_RE.match(Path(name).stem.rsplit("_", 1)[-1])
            ]
        elif kind == "backing":
            audio["backing_file_count"] = len(layer.get("files") or [])
        elif kind == "full-mix":
            audio["has_full_mix"] = True
    return audio


def build_catalog(
    music_catalog: dict,
    song_movie_index: dict,
    song_audio_catalog: dict,
    song_jacket_index: dict,
    identities: dict[str, dict],
    asset_root: Path,
) -> dict:
    songs: dict[str, dict] = {}
    movies_by_song_id: dict[int, list[dict]] = {}
    for entry in song_movie_index.get("song_movies", []):
        kind = entry["kind"]
        for song in entry.get("songs", []):
            movie = {
                "kind": kind,
                "resource_id": entry["resource_id"],
                "movie_offset": song.get("movie_offset"),
                "movie_finish_offset": song.get("movie_finish_offset"),
            }
            movies_by_song_id.setdefault(song["song_id"], []).append(movie)

    jacket_by_code = song_jacket_index.get("entries") or {}

    for code, meta in sorted(music_catalog["songs"].items()):
        identity = identities.get(code, {})
        song_id = identity.get("song_id")
        open_at = identity.get("open_at")
        audio_source = song_audio_catalog["songs"].get(code, {})
        audio = derive_audio(code, audio_source.get("audio_layers", []))
        unit_cue_count = audio["unit_cue_count"]
        oneshot_cue_count = audio["oneshot_cue_count"]
        if unit_cue_count:
            audio_form = "layered"
        elif oneshot_cue_count:
            audio_form = "oneshot"
        else:
            audio_form = "single-cue"

        bundle_path = asset_root / f"song_{code}.unity3d"
        choreography = (
            scan_choreography_bundle(bundle_path, code)
            if bundle_path.is_file()
            else {
                "has_fumen": False,
                "has_for_lipsync": False,
                "has_live_effect": False,
                "live_effect_variants": [],
                "has_jacket": False,
                "has_song_bg": False,
            }
        )

        movies = []
        if song_id is not None:
            movies = movies_by_song_id.get(song_id, [])

        jacket = jacket_by_code.get(code)
        songs[code] = {
            "song_id": song_id,
            "song_code": code,
            "title": meta.get("title"),
            "kana": meta.get("kana"),
            "credits": meta.get("credits"),
            "links": list(dict.fromkeys(meta.get("links") or [])),
            "open_at": open_at,
            "available": open_at is not None and open_at != DISABLED_OPEN_AT,
            "jacket_url": jacket.get("url") if jacket else None,
            "audio_form": audio_form,
            "audio": audio,
            "choreography": choreography,
            "movies": movies,
        }

    summary = {
        "song_count": len(songs),
        "available_song_count": sum(1 for song in songs.values() if song["available"]),
        "mv_resource_count": len(song_movie_index.get("song_movies", [])),
        "three_d_movie_count": sum(
            1 for entry in song_movie_index.get("song_movies", []) if entry["kind"] == "3dmv"
        ),
        "mvlive_count": sum(
            1 for entry in song_movie_index.get("song_movies", []) if entry["kind"] == "mvlive"
        ),
        "layered_song_count": sum(1 for song in songs.values() if song["audio_form"] == "layered"),
        "oneshot_song_count": sum(1 for song in songs.values() if song["audio_form"] == "oneshot"),
        "choreography_bundle_count": sum(
            1 for song in songs.values() if song["choreography"]["has_fumen"]
        ),
        "lipsync_coverage": sum(
            1 for song in songs.values() if song["choreography"]["has_for_lipsync"]
        ),
        "unit_effect_song_count": sum(
            1
            for song in songs.values()
            if song["choreography"]["live_effect_variants"]
        ),
        "jacket_coverage": sum(1 for song in songs.values() if song["choreography"]["has_jacket"]),
        "song_bg_coverage": sum(1 for song in songs.values() if song["choreography"]["has_song_bg"]),
        "jacket_url_coverage": sum(1 for song in songs.values() if song.get("jacket_url")),
    }

    return {
        "schema_version": 1,
        "sources": {
            "music_catalog": "public/data/masterdata/music_catalog.json",
            "song_movie_index": "public/data/masterdata/song_movie_index.json",
            "song_audio_relation_catalog": "public/data/song_audio_relation_catalog.json",
            "song_jacket_index": "public/data/song_jacket_index.json",
            "masterdata_table": 46,
            "choreography_root": "RAW/asset",
        },
        "summary": summary,
        "songs": songs,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    if not sources.masterdata_decoded_file.is_file():
        raise FileNotFoundError(
            f"Missing decoded masterdata: {sources.masterdata_decoded_file}"
        )
    asset_root = (sources.raw_root / "asset").resolve()
    if not asset_root.is_dir():
        raise FileNotFoundError(f"Missing RAW asset root: {asset_root}")

    music_catalog = json.loads(MUSIC_CATALOG.read_text(encoding="utf-8"))
    song_movie_index = json.loads(SONG_MOVIE_INDEX.read_text(encoding="utf-8"))
    song_audio_catalog = json.loads(SONG_AUDIO_CATALOG.read_text(encoding="utf-8"))
    song_jacket_index = json.loads(SONG_JACKET_INDEX.read_text(encoding="utf-8"))
    identities = load_table46_song_identities(sources.masterdata_decoded_file)

    catalog = build_catalog(
        music_catalog,
        song_movie_index,
        song_audio_catalog,
        song_jacket_index,
        identities,
        asset_root,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.output} "
        f"({catalog['summary']['song_count']} songs, "
        f"{catalog['summary']['mv_resource_count']} movie relations)"
    )


if __name__ == "__main__":
    main()
