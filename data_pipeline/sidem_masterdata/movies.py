"""Movie resource identity indexes; no decoding, filesystem or publication."""
from collections import defaultdict
from typing import Any
from .provenance import source


def build_movie_announce_index(
    tables: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    entries = []
    resource_ids = set()
    ids = set()
    for row in tables.get(175, []):
        record_id = row.get("1")
        resource_id = row.get("6")
        if not isinstance(record_id, int) or not isinstance(resource_id, str):
            continue
        if record_id in ids:
            raise ValueError(f"duplicate MovieAnnounceData ID: {record_id}")
        if resource_id in resource_ids:
            raise ValueError(
                f"duplicate MovieAnnounceData ResourceId: {resource_id}"
            )
        ids.add(record_id)
        resource_ids.add(resource_id)
        term = row.get("5") if isinstance(row.get("5"), dict) else {}
        entries.append(
            {
                "id": record_id,
                "type": row.get("2"),
                "sort_order": row.get("3"),
                "short_skip_time": row.get("4"),
                "term": {
                    "start_at": term.get("1"),
                    "end_at": term.get("2"),
                },
                "resource_id": resource_id,
                "skip_type": row.get("7"),
                "_source": source(
                    175,
                    {
                        "id": 1,
                        "type": 2,
                        "sort_order": 3,
                        "short_skip_time": 4,
                        "term": 5,
                        "resource_id": 6,
                        "skip_type": 7,
                    },
                    row.get("_offset"),
                ),
            }
        )
    entries.sort(key=lambda entry: entry["resource_id"])
    return {
        "schema_version": 1,
        "movie_announces": entries,
        "meta": {
            "record_count": len(entries),
            "unique_resource_ids": len(resource_ids),
            "source_table": 175,
        },
    }


def build_card_skill_movie_index(
    tables: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    """Build the exact CardData skill-cutin resource identity index."""
    by_resource: dict[str, list[dict[str, Any]]] = defaultdict(list)
    card_ids = set()
    for row in tables.get(1, []):
        card_id = row.get("1")
        resource_id = row.get("14")
        has_skill_cutin_resource = row.get("31")
        if (
            not isinstance(card_id, int)
            or not isinstance(resource_id, str)
            or has_skill_cutin_resource != 1
        ):
            continue
        if card_id in card_ids:
            raise ValueError(f"duplicate CardData ID: {card_id}")
        card_ids.add(card_id)
        by_resource[resource_id].append(
            {
                "card_id": card_id,
                "title": row.get("40") or row.get("13"),
                "_source": source(
                    1,
                    {
                        "card_id": 1,
                        "resource_id": 14,
                        "has_skill_cutin_resource": 31,
                        "title": 40,
                    },
                    row.get("_offset"),
                ),
            }
        )

    entries = []
    shared_resource_count = 0
    for resource_id, records in sorted(by_resource.items()):
        records.sort(key=lambda entry: entry["card_id"])
        if len(records) > 1:
            shared_resource_count += 1
        entries.append(
            {
                "resource_id": resource_id,
                "cards": records,
            }
        )
    return {
        "schema_version": 1,
        "skill_movies": entries,
        "meta": {
            "resource_count": len(entries),
            "card_record_count": sum(len(entry["cards"]) for entry in entries),
            "shared_resource_count": shared_resource_count,
            "source_table": 1,
            "predicate": "CardData.HasSkillCutinResource == true",
        },
    }


def build_song_movie_index(
    tables: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    """Build exact SongData 3D-movie and MV-live resource identities."""
    disabled_open_at = 4102412400  # 2100-01-01 UTC sentinel in this snapshot.
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    record_keys = set()
    for row in tables.get(46, []):
        record_id = row.get("1")
        resource_id = row.get("4")
        if not isinstance(record_id, int) or not isinstance(resource_id, str):
            continue
        kinds = []
        if isinstance(row.get("24"), int):
            kinds.append("3dmv")
        mvlive_open_at = row.get("38")
        if (
            isinstance(mvlive_open_at, int)
            and 0 < mvlive_open_at < disabled_open_at
        ):
            kinds.append("mvlive")
        for kind in kinds:
            key = (kind, record_id)
            if key in record_keys:
                raise ValueError(f"duplicate SongData {kind} record ID: {record_id}")
            record_keys.add(key)
            grouped[(kind, resource_id)].append(
                {
                    "song_id": record_id,
                    "title": row.get("5"),
                    "movie_open_at": row.get("23"),
                    "movie_offset": row.get("24"),
                    "movie_finish_offset": row.get("36"),
                    "mvlive_open_at": row.get("38"),
                    "mvlive_offset": row.get("39"),
                    "mvlive_finish_offset": row.get("40"),
                    "_source": source(
                        46,
                        {
                            "song_id": 1,
                            "resource_id": 4,
                            "title": 5,
                            "movie_open_at": 23,
                            "movie_offset": 24,
                            "movie_finish_offset": 36,
                            "mvlive_open_at": 38,
                            "mvlive_offset": 39,
                            "mvlive_finish_offset": 40,
                        },
                        row.get("_offset"),
                    ),
                }
            )

    entries = []
    shared_resource_count = 0
    for (kind, resource_id), records in sorted(grouped.items()):
        records.sort(key=lambda entry: entry["song_id"])
        if len(records) > 1:
            shared_resource_count += 1
        entries.append(
            {
                "kind": kind,
                "resource_id": resource_id,
                "songs": records,
            }
        )
    return {
        "schema_version": 1,
        "song_movies": entries,
        "meta": {
            "resource_count": len(entries),
            "song_record_count": sum(len(entry["songs"]) for entry in entries),
            "shared_resource_count": shared_resource_count,
            "three_d_movie_count": sum(
                entry["kind"] == "3dmv" for entry in entries
            ),
            "mvlive_count": sum(entry["kind"] == "mvlive" for entry in entries),
            "source_table": 46,
            "disabled_open_at": disabled_open_at,
        },
    }


