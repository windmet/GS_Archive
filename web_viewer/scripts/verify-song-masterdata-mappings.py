#!/usr/bin/env python3
"""Verify committed song performer mappings against mounted table 46."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from archive_paths import load_archive_sources
from masterdata_extract import extract_table_rows, iter_top_records


def fail(message: str) -> None:
    raise AssertionError(message)


def main() -> None:
    sources = load_archive_sources()
    rows = extract_table_rows(
        list(iter_top_records(sources.masterdata_decoded_file.read_bytes())),
        {46},
    )[46]
    music = json.loads(
        (PROJECT_ROOT / "public/data/masterdata/music_catalog.json").read_text(
            encoding="utf-8"
        )
    )
    song_catalog = json.loads(
        (PROJECT_ROOT / "public/data/song_catalog.json").read_text(encoding="utf-8")
    )
    units = json.loads(
        (PROJECT_ROOT / "public/data/masterdata/idol_unit_dictionary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest = json.loads(
        (PROJECT_ROOT / "public/data/archive_manifest.json").read_text(
            encoding="utf-8"
        )
    )

    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if isinstance(row.get("4"), str):
            grouped[row["4"]].append(row)
    if len(rows) != 99 or len(grouped) != 61:
        fail(f"expected 99 table rows / 61 songs, got {len(rows)} / {len(grouped)}")

    performer_rows = 0
    category_counts: dict[int, int] = defaultdict(int)
    membership = manifest.get("unit_membership_by_idol") or {}
    idol_by_id = units.get("by_numeric_id") or {}
    for code, song_rows in grouped.items():
        mappings = {
            (row.get("7") or {}).get("1"): (row.get("7") or {}).get("2")
            for row in song_rows
        }
        if len(mappings) != 1:
            fail(f"{code}: conflicting field-7 mappings: {mappings}")
        category, unit_id = next(iter(mappings.items()))
        category_counts[category] += 1
        performer_ids = sorted({
            row[str(field)]
            for row in song_rows
            for field in range(30, 35)
            if isinstance(row.get(str(field)), int)
        })
        performer_rows += sum(
            any(isinstance(row.get(str(field)), int) for field in range(30, 35))
            for row in song_rows
        )
        committed = music["songs"].get(code)
        if not committed:
            fail(f"{code}: missing from music_catalog")
        published = song_catalog["songs"].get(code)
        if not published:
            fail(f"{code}: missing from song_catalog")
        # The catalog identity projection follows the last table row for a
        # duplicated code (e.g. ntalon/pl1gdd carry an OriginalSongId there).
        effective_row = song_rows[-1]
        expected_song_data = {
            "on_stage_count": effective_row.get("16"),
            "has_switch_singer": bool(effective_row.get("17", 0)),
            "has_original_member": bool(effective_row.get("35", 0)),
            "has_solo_singing": bool(effective_row.get("37", 0)),
            "solo_singing_open_at": effective_row.get("42"),
            "original_song_id": effective_row.get("43"),
        }
        if published.get("song_data") != expected_song_data:
            fail(f"{code}: SongData selection flags mismatch")
        if committed.get("unit_mapping", {}).get("category") != category:
            fail(f"{code}: category mismatch")
        if committed.get("unit_mapping", {}).get("unit_id") != unit_id:
            fail(f"{code}: unit/selector value mismatch")
        if committed.get("performer_idol_ids") != performer_ids:
            fail(f"{code}: performer ids mismatch")
        if committed.get("table_46_row_count") != len(song_rows):
            fail(f"{code}: row count mismatch")

        if category == 2 and performer_ids:
            explicit_codes = {
                idol_by_id[str(idol_id)]["idol_code"] for idol_id in performer_ids
            }
            unit_members = {
                idol_code
                for idol_code, relation in membership.items()
                if relation.get("unit_id") == unit_id
            }
            if explicit_codes != unit_members:
                fail(f"{code}: explicit performers differ from confirmed unit roster")

    explicit_song_count = sum(
        bool(song.get("performer_idol_ids")) for song in music["songs"].values()
    )
    if dict(category_counts) != {3: 14, 2: 47}:
        fail(f"unexpected category counts: {dict(category_counts)}")
    if performer_rows != 20 or explicit_song_count != 13:
        fail(
            f"expected 20 performer rows / 13 unique songs, got "
            f"{performer_rows} / {explicit_song_count}"
        )
    if sum(
        bool(song.get("song_data", {}).get("has_switch_singer"))
        for song in song_catalog["songs"].values()
    ) != 5:
        fail("expected five songs to carry HasSwitchSinger")
    if music["songs"]["brndnf"]["unit_mapping"]["unit_id"] != 1:
        fail("BRAND NEW FIELD must resolve to Jupiter")
    if music["songs"]["psblts"]["unit_mapping"]["unit_id"] != 12:
        fail("Possibilities must resolve to S.E.M")
    if music["songs"]["flslgt"]["performer_idol_ids"] != [7, 9, 22, 48]:
        fail("FLASH LIGHT performer ids mismatch")

    print(
        "Song masterdata mappings verified: 99 rows / 61 songs, "
        "47 confirmed unit songs, 14 unresolved selectors, "
        "20 performer rows / 13 unique songs"
    )


if __name__ == "__main__":
    main()
