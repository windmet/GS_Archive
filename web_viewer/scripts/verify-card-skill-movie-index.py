#!/usr/bin/env python3
"""Verify the committed CardData skill-cutin resource identity index."""

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
    build_card_skill_movie_index,
    extract_table_rows,
    iter_top_records,
)


INDEX_PATH = (
    PROJECT_ROOT
    / "public"
    / "data"
    / "masterdata"
    / "card_skill_movie_index.json"
)
SOURCE_FIELDS = {
    "card_id": 1,
    "resource_id": 14,
    "has_skill_cutin_resource": 31,
    "title": 40,
}


def fail(message: str) -> None:
    raise ValueError(message)


def validate_shape(payload: dict) -> None:
    if payload.get("schema_version") != 1:
        fail("schema_version must be 1")
    entries = payload.get("skill_movies")
    if not isinstance(entries, list) or len(entries) != 124:
        fail("skill_movies must contain exactly 124 resources")
    resource_ids = [entry.get("resource_id") for entry in entries]
    if resource_ids != sorted(resource_ids) or len(set(resource_ids)) != 124:
        fail("skill-movie ResourceIds must be unique and sorted")

    card_ids = []
    shared_count = 0
    for entry in entries:
        if set(entry) != {"resource_id", "cards"}:
            fail(f"unexpected skill-movie fields: {entry!r}")
        resource_id = entry.get("resource_id")
        cards = entry.get("cards")
        if (
            not isinstance(resource_id, str)
            or not resource_id
            or not isinstance(cards, list)
            or not cards
        ):
            fail(f"invalid skill-movie record shape: {entry!r}")
        if len(cards) > 1:
            shared_count += 1
        current_ids = [card.get("card_id") for card in cards]
        if current_ids != sorted(current_ids) or len(set(current_ids)) != len(current_ids):
            fail(f"card IDs must be unique and sorted for {resource_id}")
        for card in cards:
            if set(card) != {"card_id", "title", "_source"}:
                fail(f"unexpected card relation fields: {card!r}")
            if (
                not isinstance(card.get("card_id"), int)
                or not isinstance(card.get("title"), str)
                or not card["title"]
            ):
                fail(f"invalid card relation for {resource_id}: {card!r}")
            source = card.get("_source")
            if (
                not isinstance(source, dict)
                or set(source) != {"table", "fields", "offset"}
                or source.get("table") != 1
                or source.get("fields") != SOURCE_FIELDS
                or not isinstance(source.get("offset"), int)
            ):
                fail(f"invalid CardData evidence for {resource_id}")
        card_ids.extend(current_ids)

    if len(card_ids) != 127 or len(set(card_ids)) != 127:
        fail("skill-movie index must contain 127 unique card records")
    if shared_count != 3:
        fail("skill-movie index must preserve exactly 3 shared resources")
    if payload.get("meta") != {
        "resource_count": 124,
        "card_record_count": 127,
        "shared_resource_count": 3,
        "source_table": 1,
        "predicate": "CardData.HasSkillCutinResource == true",
    }:
        fail("skill-movie summary drifted")


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
        observed = build_card_skill_movie_index(extract_table_rows(records, {1}))
        if committed != observed:
            fail("committed skill-movie index differs from mounted CardData table 1")

    mode = "source-only" if args.source_only else "mounted"
    print(
        f"Card skill-movie index verified ({mode}): "
        "124 resources / 127 card records / 3 shared resources"
    )


if __name__ == "__main__":
    main()
