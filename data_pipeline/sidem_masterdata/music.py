"""Songs, explicit performers, and BGM selector relations from masterdata rows."""
from typing import Any
from .provenance import source


def build_music_catalog(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {}
    bgm = {}
    seasonal_switch_rows = []
    table_46_performer_row_count = 0
    for row in tables.get(46, []):
        code = row.get("4")
        if not isinstance(code, str):
            continue
        unit_mapping = row.get("7") if isinstance(row.get("7"), dict) else {}
        category = unit_mapping.get("1")
        unit_id = unit_mapping.get("2")
        performer_ids = [
            row.get(str(field))
            for field in range(30, 35)
            if isinstance(row.get(str(field)), int)
        ]
        if performer_ids:
            table_46_performer_row_count += 1
        previous = songs.get(code)
        if previous:
            previous_mapping = previous["unit_mapping"]
            if (
                previous_mapping["category"] != category
                or previous_mapping["unit_id"] != unit_id
            ):
                raise ValueError(f"conflicting table 46 unit mapping for {code}")
            previous["performer_idol_ids"] = sorted(set(
                previous["performer_idol_ids"] + performer_ids
            ))
            previous["table_46_row_count"] += 1
            previous["_source"] = source(
                46,
                {
                    "song_code": 4,
                    "title": 5,
                    "kana": 6,
                    "unit_mapping": 7,
                    "credits": 8,
                    "links": 9,
                    "performer_idol_id_1": 30,
                    "performer_idol_id_2": 31,
                    "performer_idol_id_3": 32,
                    "performer_idol_id_4": 33,
                    "performer_idol_id_5": 34,
                },
                row.get("_offset"),
            )
            continue
        songs[code] = {
            "song_code": code,
            "title": row.get("5"),
            "kana": row.get("6"),
            "credits": row.get("8"),
            "links": [value for value in (row.get("9"), row.get("10")) if isinstance(value, str)],
            "unit_mapping": {
                "category": category,
                "unit_id": unit_id,
                "status": (
                    "confirmed_unit_relation"
                    if category == 2
                    else "unresolved_special_selector"
                ),
            },
            "performer_idol_ids": sorted(set(performer_ids)),
            "table_46_row_count": 1,
            "_source": source(
                46,
                {
                    "song_code": 4,
                    "title": 5,
                    "kana": 6,
                    "unit_mapping": 7,
                    "credits": 8,
                    "links": 9,
                    "performer_idol_id_1": 30,
                    "performer_idol_id_2": 31,
                    "performer_idol_id_3": 32,
                    "performer_idol_id_4": 33,
                    "performer_idol_id_5": 34,
                },
                row.get("_offset"),
            ),
        }
    for row in tables.get(112, []):
        resource = row.get("14")
        if not isinstance(resource, str):
            continue
        bgm[resource] = {
            "bgm_resource_id": resource,
            "title": row.get("2"),
            "event_id": row.get("1"),
            "_source": source(112, {"event_id": 1, "title": 2, "bgm_resource_id": 14}, row.get("_offset")),
        }
    role_fields = {
        "source_selector": "3",
        "seasonal_bank": "4",
        "seasonal_base_cue": "5",
        "seasonal_selector": "6",
    }
    for row in tables.get(133, []):
        relation = {
            "row_id": row.get("1"),
            "season_id": row.get("2"),
            **{
                role: row.get(field)
                for role, field in role_fields.items()
            },
            "_source": source(
                133,
                {
                    "row_id": 1,
                    "season_id": 2,
                    **{role: int(field) for role, field in role_fields.items()},
                },
                row.get("_offset"),
            ),
        }
        seasonal_switch_rows.append(relation)
        for role, field in role_fields.items():
            resource = row.get(field)
            if not isinstance(resource, str):
                continue
            bgm.setdefault(resource, {
                "bgm_resource_id": resource,
                "title": None,
                "seasonal_variants": [],
                "_source": source(133, {"bgm_resource_id": int(field)}, row.get("_offset")),
            })
            bgm[resource].setdefault("seasonal_variants", []).append({
                "table_id": 133,
                "row_id": row.get("1"),
                "season_id": row.get("2"),
                "field": int(field),
                "role": role,
            })
            roles = bgm[resource].setdefault("table_133_roles", [])
            if role not in roles:
                roles.append(role)
    return {
        "schema_version": 2,
        "songs": songs,
        "bgm": bgm,
        "seasonal_switch_rows": seasonal_switch_rows,
        "meta": {
            "song_count": len(songs),
            "table_46_row_count": len(tables.get(46, [])),
            "confirmed_unit_song_count": sum(
                song["unit_mapping"]["status"] == "confirmed_unit_relation"
                for song in songs.values()
            ),
            "unresolved_special_selector_song_count": sum(
                song["unit_mapping"]["status"] == "unresolved_special_selector"
                for song in songs.values()
            ),
            "explicit_performer_song_count": sum(
                bool(song["performer_idol_ids"])
                for song in songs.values()
            ),
            "explicit_performer_row_count": table_46_performer_row_count,
            "bgm_count": len(bgm),
            "table_133_row_count": len(seasonal_switch_rows),
            "table_133_resource_count": len({
                relation[role]
                for relation in seasonal_switch_rows
                for role in role_fields
                if isinstance(relation.get(role), str)
            }),
        },
    }


