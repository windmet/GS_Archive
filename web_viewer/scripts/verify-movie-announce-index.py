#!/usr/bin/env python3
"""Verify the committed MovieAnnounce table-175 identity index."""

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
    build_movie_announce_index,
    extract_table_rows,
    iter_top_records,
)


INDEX_PATH = (
    PROJECT_ROOT
    / "public"
    / "data"
    / "masterdata"
    / "movie_announce_index.json"
)
SOURCE_FIELDS = {
    "id": 1,
    "type": 2,
    "sort_order": 3,
    "short_skip_time": 4,
    "term": 5,
    "resource_id": 6,
    "skip_type": 7,
}


def fail(message: str) -> None:
    raise ValueError(message)


def validate_shape(payload: dict) -> None:
    if payload.get("schema_version") != 1:
        fail("schema_version must be 1")
    entries = payload.get("movie_announces")
    if not isinstance(entries, list) or len(entries) != 30:
        fail("movie_announces must contain exactly 30 records")
    resource_ids = [entry.get("resource_id") for entry in entries]
    ids = [entry.get("id") for entry in entries]
    if resource_ids != sorted(resource_ids) or len(set(resource_ids)) != 30:
        fail("MovieAnnounce ResourceIds must be unique and sorted")
    if len(set(ids)) != 30:
        fail("MovieAnnounce IDs must be unique")
    for entry in entries:
        if set(entry) != {
            "id",
            "type",
            "sort_order",
            "short_skip_time",
            "term",
            "resource_id",
            "skip_type",
            "_source",
        }:
            fail(f"unexpected MovieAnnounce fields: {entry!r}")
        if (
            not isinstance(entry.get("id"), int)
            or not isinstance(entry.get("type"), int)
            or not isinstance(entry.get("sort_order"), int)
            or (
                entry.get("short_skip_time") is not None
                and not isinstance(entry.get("short_skip_time"), int)
            )
            or not isinstance(entry.get("resource_id"), str)
            or not entry["resource_id"].isdigit()
            or not isinstance(entry.get("skip_type"), int)
            or not isinstance(entry.get("term"), dict)
            or set(entry["term"]) != {"start_at", "end_at"}
            or not isinstance(entry["term"].get("start_at"), int)
            or not isinstance(entry["term"].get("end_at"), int)
            or entry["term"]["start_at"] >= entry["term"]["end_at"]
        ):
            fail(f"invalid MovieAnnounce record shape: {entry!r}")
        source = entry.get("_source")
        if (
            not isinstance(source, dict)
            or set(source) != {"table", "fields", "offset"}
            or source.get("table") != 175
            or source.get("fields") != SOURCE_FIELDS
            or not isinstance(source.get("offset"), int)
        ):
            fail(f"invalid table-175 evidence for {entry['resource_id']}")
    meta = payload.get("meta")
    if meta != {
        "record_count": 30,
        "unique_resource_ids": 30,
        "source_table": 175,
    }:
        fail("MovieAnnounce summary drifted")


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
        observed = build_movie_announce_index(
            extract_table_rows(records, {175})
        )
        if committed != observed:
            fail("committed MovieAnnounce index differs from mounted table 175")

    mode = "source-only" if args.source_only else "mounted"
    print(f"MovieAnnounce index verified ({mode}): 30 records / 30 unique ResourceIds")


if __name__ == "__main__":
    main()
