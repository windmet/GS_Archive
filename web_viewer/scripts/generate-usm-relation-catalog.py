#!/usr/bin/env python3
"""Generate a read-only relation catalog for every RAW movie USM."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import load_raw_live_semantics


DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "data" / "usm_relation_catalog.json"
BACKMONITOR_INDEX = (
    PROJECT_ROOT / "public" / "assets" / "live-chibi" / "backmonitor" / "index.json"
)
MUSIC_CATALOG = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"
MOVIE_ANNOUNCE_INDEX = (
    PROJECT_ROOT / "public" / "data" / "masterdata" / "movie_announce_index.json"
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def milliseconds(value: object) -> int | None:
    try:
        parsed = float(str(value))
    except (TypeError, ValueError):
        return None
    return round(parsed * 1000) if parsed >= 0 else None


def probe_usm(ffprobe: str, path: Path) -> dict:
    try:
        result = subprocess.run(
            [
                ffprobe,
                "-v",
                "quiet",
                "-show_entries",
                "format=format_name,duration",
                "-show_entries",
                "stream=index,codec_type,codec_name,width,height,r_frame_rate,duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {
            "state": "probe-failed",
            "format": None,
            "duration_ms": None,
            "streams": [],
            "evidence": "ffprobe did not expose a reliable RAW USM stream header",
        }
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        payload = {}
    streams = []
    for index, stream in enumerate(payload.get("streams") or []):
        streams.append(
            {
                "index": int(stream.get("index", index)),
                "codec_type": str(stream.get("codec_type") or "unknown"),
                "codec_name": stream.get("codec_name") or None,
                "width": int(stream["width"]) if stream.get("width") is not None else None,
                "height": int(stream["height"]) if stream.get("height") is not None else None,
                "frame_rate": stream.get("r_frame_rate") or None,
                "duration_ms": milliseconds(stream.get("duration")),
            }
        )
    format_name = (payload.get("format") or {}).get("format_name")
    success = result.returncode == 0 and format_name and streams
    return {
        "state": "ffprobe-header" if success else "probe-failed",
        "format": format_name or None,
        "duration_ms": milliseconds((payload.get("format") or {}).get("duration")),
        "streams": streams,
        "evidence": (
            "ffprobe read the RAW USM container header without producing a derivative"
            if success
            else "ffprobe did not expose a reliable RAW USM stream header"
        ),
    }


def family_for(stem: str) -> str:
    if stem.startswith("3dmv_"):
        return "3dmv"
    if re.match(r"^c[0-9]+_", stem):
        return "card-rarity"
    if stem.startswith("live_backmonitor_"):
        return "live-backmonitor"
    if stem.startswith("movie_home_"):
        return "movie-home"
    if stem.startswith("mvlive_"):
        return "mvlive"
    if stem.startswith("skill_movie_"):
        return "skill-movie"
    if stem == "ssr_motion" or stem.startswith("ssr_motion_"):
        return "ssr-motion"
    return "other"


def filename_candidate(family: str) -> tuple[str, str] | None:
    return {
        "3dmv": ("3d-live-movie", "3dmv filename family"),
        "card-rarity": ("card-rarity-animation", "card/rarity filename family"),
        "movie-home": ("home-animation", "movie_home filename family"),
        "mvlive": ("live-movie", "mvlive filename family"),
        "skill-movie": ("card-skill-animation", "skill_movie filename family"),
        "ssr-motion": ("ssr-card-animation", "ssr_motion filename family"),
    }.get(family)


def choreography_relations(raw_asset_root: Path) -> dict[str, dict]:
    semantics = load_raw_live_semantics(raw_asset_root)
    relations: dict[str, dict] = defaultdict(
        lambda: {"kinds": set(), "scripts": set()}
    )
    for script_name, record in semantics["choreography"].items():
        text = record["payload"].decode("utf-8-sig", errors="surrogateescape")
        for row in csv.reader(io.StringIO(text, newline="")):
            if not row or row[0] != "Backmonitor":
                continue
            for column, kind in ((2, "backmonitor-movie"), (3, "backmonitor-transition")):
                if len(row) > column and row[column].strip():
                    relation = relations[row[column].strip()]
                    relation["kinds"].add(kind)
                    relation["scripts"].add(script_name)
    return relations


def derived_assets(stem: str, backmonitor: dict) -> list[dict]:
    movie = (backmonitor.get("assets") or {}).get(stem)
    if movie:
        return [
            {
                "role": "movie",
                "path": f"web_viewer/public/assets/live-chibi/{movie['file']}",
                "width": movie["width"],
                "height": movie["height"],
                "frame_rate": movie["frameRate"],
                "duration_ms": movie["duration"],
                "bytes": movie["bytes"],
            }
        ]
    transition = (backmonitor.get("transitions") or {}).get(stem)
    if transition:
        return [
            {
                "role": role,
                "path": (
                    "web_viewer/public/assets/live-chibi/"
                    + transition[f"{role}File"]
                ),
                "width": transition[role]["width"],
                "height": transition[role]["height"],
                "frame_rate": transition[role]["frameRate"],
                "duration_ms": transition[role]["duration"],
                "bytes": transition[role]["bytes"],
            }
            for role in ("color", "alpha")
        ]
    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ffprobe")
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    movie_root = (sources.raw_root / "movie").resolve()
    if not movie_root.is_dir():
        raise FileNotFoundError(f"Missing RAW movie root: {movie_root}")
    ffprobe = shutil.which(
        args.ffprobe
        or (str(sources.ffprobe_file) if sources.ffprobe_file else "ffprobe")
    )
    if not ffprobe:
        raise FileNotFoundError("FFprobe is required for read-only USM header inspection")

    backmonitor = json.loads(BACKMONITOR_INDEX.read_text(encoding="utf-8"))
    music = json.loads(MUSIC_CATALOG.read_text(encoding="utf-8"))
    movie_announces = json.loads(
        MOVIE_ANNOUNCE_INDEX.read_text(encoding="utf-8")
    )
    movie_announce_by_usm = {
        f"movie_home_announce_{entry['resource_id']}": entry
        for entry in movie_announces.get("movie_announces", [])
    }
    song_codes = sorted((music.get("songs") or {}).keys())
    relations = choreography_relations((sources.raw_root / "asset").resolve())
    files = sorted(movie_root.glob("*.usm"), key=lambda path: path.name.lower())
    file_stems = {path.stem for path in files}
    actual_movie_announce_ids = {
        stem for stem in file_stems if stem.startswith("movie_home_announce_")
    }
    expected_movie_announce_ids = set(movie_announce_by_usm)
    if actual_movie_announce_ids != expected_movie_announce_ids:
        raise ValueError(
            "MovieAnnounceData and RAW movie-home populations differ: "
            f"missing={sorted(expected_movie_announce_ids - actual_movie_announce_ids)}, "
            f"extra={sorted(actual_movie_announce_ids - expected_movie_announce_ids)}"
        )
    entries = []

    for index, path in enumerate(files, start=1):
        stem = path.stem
        family = family_for(stem)
        relation = relations.get(stem)
        exact = relation is not None
        movie_announce = movie_announce_by_usm.get(stem)
        exact_masterdata = movie_announce is not None
        if exact and exact_masterdata:
            raise ValueError(
                f"USM cannot be both an exact Backmonitor and MovieAnnounce relation: {stem}"
            )
        kinds = sorted(relation["kinds"]) if relation else []
        if len(kinds) > 1:
            raise ValueError(f"USM has conflicting Backmonitor relation kinds: {stem}")
        scripts = sorted(relation["scripts"]) if relation else []
        derived = derived_assets(stem, backmonitor)
        if exact and not derived:
            raise ValueError(f"Exact Backmonitor relation has no derived index entry: {stem}")

        masterdata_tokens = [
            {
                "catalog": "music_catalog.songs",
                "key": song_code,
                "evidence": f"filename token equals music_catalog song_code {song_code}",
            }
            for song_code in song_codes
            if re.search(rf"(?:^|_){re.escape(song_code)}(?:_|$)", stem)
        ]
        candidates = []
        if exact:
            candidates.append(
                {
                    "consumer": "ChibiStageViewer.backmonitor",
                    "state": "exact",
                    "evidence": (
                        f"{len(scripts)} RAW choreography scripts contain a "
                        "Backmonitor command for this exact USM ID"
                    ),
                }
            )
        else:
            candidate = filename_candidate(family)
            if candidate:
                candidates.append(
                    {
                        "consumer": candidate[0],
                        "state": "filename-candidate",
                        "evidence": candidate[1],
                    }
                )

        with path.open("rb") as stream:
            magic = stream.read(4).decode("ascii", errors="replace")
        if magic != "CRID":
            raise ValueError(f"Unexpected USM magic for {path.name}: {magic!r}")
        stat = path.stat()
        entries.append(
            {
                "id": stem,
                "family": family,
                "raw": {
                    "relative_path": f"movie/{path.name}",
                    "filename": path.name,
                    "bytes": stat.st_size,
                    "sha256": sha256_file(path),
                    "container": "cri-usm",
                    "magic": magic,
                },
                "media_probe": probe_usm(ffprobe, path),
                "masterdata_tokens": masterdata_tokens,
                "consumer_candidates": candidates,
                "mapping": {
                    "state": (
                        "exact-consumer"
                        if exact
                        else "exact-masterdata"
                        if exact_masterdata
                        else "unresolved"
                    ),
                    "kind": (
                        kinds[0]
                        if exact
                        else "movie-announce"
                        if exact_masterdata
                        else "unresolved"
                    ),
                    "raw_effect_scripts": scripts,
                    "derived_assets": derived,
                    **(
                        {
                            "masterdata_relation": {
                                "catalog": "movie_announce_index.movie_announces",
                                "resource_id": movie_announce["resource_id"],
                                "record_id": movie_announce["id"],
                                "evidence": (
                                    "MovieAnnounceData table 175 ResourceId resolves "
                                    "to this complete movie_home_announce USM identity"
                                ),
                            }
                        }
                        if exact_masterdata
                        else {}
                    ),
                },
                "evidence": (
                    [
                        "Exact RAW Backmonitor command identity and prepared browser asset agree."
                    ]
                    if exact
                    else [
                        "Exact MovieAnnounceData table 175 ResourceId and RAW USM identity agree."
                    ]
                    if exact_masterdata
                    else [
                        "No direct Backmonitor relation exists in the 119 RAW choreography scripts."
                    ]
                ),
            }
        )
        print(f"[{index:03d}/{len(files):03d}] {stem}")

    family_counts = Counter(entry["family"] for entry in entries)
    exact_count = sum(
        entry["mapping"]["state"] == "exact-consumer" for entry in entries
    )
    exact_masterdata_count = sum(
        entry["mapping"]["state"] == "exact-masterdata" for entry in entries
    )
    payload = {
        "schema_version": 2,
        "sources": {
            "raw_movie_root": "RAW/movie",
            "backmonitor_index": (
                "web_viewer/public/assets/live-chibi/backmonitor/index.json"
            ),
            "music_catalog": (
                "web_viewer/public/data/masterdata/music_catalog.json"
            ),
            "movie_announce_index": (
                "web_viewer/public/data/masterdata/movie_announce_index.json"
            ),
        },
        "summary": {
            "total": len(entries),
            "total_bytes": sum(entry["raw"]["bytes"] for entry in entries),
            "exact_consumer": exact_count,
            "exact_masterdata": exact_masterdata_count,
            "unresolved": len(entries) - exact_count - exact_masterdata_count,
            "families": dict(sorted(family_counts.items())),
        },
        "entries": entries,
    }
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        f"USM relation catalog written: {len(entries)} total / "
        f"{exact_count} exact consumer / {exact_masterdata_count} exact masterdata / "
        f"{len(entries) - exact_count - exact_masterdata_count} unresolved"
    )


if __name__ == "__main__":
    main()
