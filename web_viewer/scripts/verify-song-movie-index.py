#!/usr/bin/env python3
"""Verify the committed SongData 3D-movie and MV-live identity index."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources
from masterdata_extract import (
    build_song_movie_index,
    extract_table_rows,
    iter_top_records,
)


INDEX_PATH = (
    PROJECT_ROOT / "public" / "data" / "masterdata" / "song_movie_index.json"
)
SOURCE_FIELDS = {
    "song_id": 1,
    "resource_id": 4,
    "title": 5,
    "movie_open_at": 23,
    "movie_offset": 24,
    "movie_finish_offset": 36,
    "mvlive_open_at": 38,
    "mvlive_offset": 39,
    "mvlive_finish_offset": 40,
}
DISABLED_OPEN_AT = 4102412400


def fail(message: str) -> None:
    raise ValueError(message)


def validate_shape(payload: dict) -> None:
    if payload.get("schema_version") != 1:
        fail("schema_version must be 1")
    entries = payload.get("song_movies")
    if not isinstance(entries, list) or len(entries) != 12:
        fail("song_movies must contain exactly 12 resources")
    keys = [(entry.get("kind"), entry.get("resource_id")) for entry in entries]
    if keys != sorted(keys) or len(set(keys)) != 12:
        fail("song-movie kind/resource identities must be unique and sorted")

    record_keys = []
    shared_count = 0
    for entry in entries:
        if set(entry) != {"kind", "resource_id", "songs"}:
            fail(f"unexpected song-movie fields: {entry!r}")
        kind = entry.get("kind")
        resource_id = entry.get("resource_id")
        songs = entry.get("songs")
        if (
            kind not in {"3dmv", "mvlive"}
            or not isinstance(resource_id, str)
            or not resource_id
            or not isinstance(songs, list)
            or not songs
        ):
            fail(f"invalid song-movie record shape: {entry!r}")
        if len(songs) > 1:
            shared_count += 1
        song_ids = [song.get("song_id") for song in songs]
        if song_ids != sorted(song_ids) or len(set(song_ids)) != len(song_ids):
            fail(f"song IDs must be unique and sorted for {kind}/{resource_id}")
        for song in songs:
            if set(song) != {
                "song_id",
                "title",
                "movie_open_at",
                "movie_offset",
                "movie_finish_offset",
                "mvlive_open_at",
                "mvlive_offset",
                "mvlive_finish_offset",
                "_source",
            }:
                fail(f"unexpected SongData relation fields: {song!r}")
            if (
                not isinstance(song.get("song_id"), int)
                or not isinstance(song.get("title"), str)
                or not song["title"]
            ):
                fail(f"invalid SongData relation for {kind}/{resource_id}")
            if kind == "3dmv" and not isinstance(song.get("movie_offset"), int):
                fail(f"3dmv record lacks MovieOffset: {resource_id}")
            if kind == "mvlive" and not (
                isinstance(song.get("mvlive_open_at"), int)
                and 0 < song["mvlive_open_at"] < DISABLED_OPEN_AT
            ):
                fail(f"mvlive record lacks an enabled MvliveOpenAt: {resource_id}")
            source = song.get("_source")
            if (
                not isinstance(source, dict)
                or set(source) != {"table", "fields", "offset"}
                or source.get("table") != 46
                or source.get("fields") != SOURCE_FIELDS
                or not isinstance(source.get("offset"), int)
            ):
                fail(f"invalid SongData evidence for {kind}/{resource_id}")
            record_keys.append((kind, song["song_id"]))

    if len(record_keys) != 13 or len(set(record_keys)) != 13:
        fail("song-movie index must contain 13 unique kind/song records")
    if shared_count != 1:
        fail("song-movie index must preserve exactly one shared resource")
    if payload.get("meta") != {
        "resource_count": 12,
        "song_record_count": 13,
        "shared_resource_count": 1,
        "three_d_movie_count": 11,
        "mvlive_count": 1,
        "source_table": 46,
        "disabled_open_at": DISABLED_OPEN_AT,
    }:
        fail("song-movie summary drifted")


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--source-only", action="store_true")
    args = parser.parse_args()

    committed = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    validate_shape(committed)
    if not args.source_only:
        sources = load_archive_sources(args.sources_config)
        decoded_path = sources.masterdata_input("decoded")
        if not decoded_path.is_file():
            raise FileNotFoundError(decoded_path)
        records = list(iter_top_records(decoded_path.read_bytes()))
        observed = build_song_movie_index(extract_table_rows(records, {46}))
        if committed != observed:
            fail("committed song-movie index differs from mounted SongData table 46")

    mode = "source-only" if args.source_only else "mounted"
    print(
        f"Song movie index verified ({mode}): "
        "11 3dmv + 1 mvlive resources / 13 SongData records"
    )


if __name__ == "__main__":
    main()
