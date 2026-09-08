"""Pure seasonal projections; resource evidence is supplied by the caller."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any
from .provenance import source
from .story_resources import compiled_filename, normalize_compiled_resource, enrich_resource_row


def build_seasonal_communication_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rows = []
    family_by_table = {159: "valentine_idol", 162: "valentine_support", 165: "white_day_idol", 168: "white_day_support"}
    for table_id, family in family_by_table.items():
        for row in tables.get(table_id, []):
            entry = enrich_resource_row(
                row,
                table_id,
                "5",
                compiled_stems,
                compiled_summaries,
                {"id": 1, "group_or_year": 2, "speaker_or_idol": 3, "episode_no": 4, "resource_id": 5, "title": 9},
            )
            entry.update({
                "family": family,
                "season": "valentine" if family.startswith("valentine") else "white_day",
                "participant_type": "support" if family.endswith("support") else "idol",
                "participant_numeric_id": row.get("3"),
                "title": row.get("9"),
            })
            rows.append(entry)
    return {"communications": rows, "meta": {"communication_count": len(rows)}}


def build_seasonal_campaign_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    speaker_dictionary: dict[str, Any],
) -> dict[str, Any]:
    event_rows = {
        row.get("1"): row
        for row in tables.get(112, [])
        if row.get("1") in {40001, 40002, 50001, 50002}
    }
    idols = idol_unit_dictionary.get("by_numeric_id", {})
    speakers = speaker_dictionary.get("speakers", {})
    speaker_by_npc = {
        entry.get("npc_id"): entry
        for entry in speakers.values()
        if isinstance(entry, dict) and isinstance(entry.get("npc_id"), int)
    }
    # Seasonal ids use 101/102 even though the president's generic NPC id is 901.
    support_by_seasonal_id = {
        101: speakers.get("101ken"),
        102: speakers.get("102sha"),
    }
    support_by_seasonal_id.update({key: value for key, value in speaker_by_npc.items() if key in {101, 102}})

    family_tables = {
        "valentine": ((159, "idol"), (162, "support")),
        "white_day": ((165, "idol"), (168, "support")),
    }
    participant_levels: dict[tuple[int, str, int], int] = {}
    for row in tables.get(147, []):
        participant_levels[(row.get("2"), "idol", row.get("3"))] = row.get("4")
    for row in tables.get(148, []):
        participant_levels[(row.get("2"), "support", row.get("3"))] = row.get("4")

    campaigns = []
    by_code = {}
    for detail_id in (1, 2):
        year = 2021 + detail_id
        for season, event_code in (("valentine", 40000 + detail_id), ("white_day", 50000 + detail_id)):
            event = event_rows.get(event_code, {})
            participant_rows: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
            introduction = []
            for table_id, participant_type in family_tables[season]:
                for row in tables.get(table_id, []):
                    if row.get("2") != detail_id:
                        continue
                    resource_id = row.get("5")
                    compiled_file = compiled_filename(resource_id, compiled_stems) if isinstance(resource_id, str) else None
                    episode = {
                        "id": row.get("1"),
                        "episode_no": row.get("4"),
                        "title": row.get("9"),
                        "required_valentine_level": row.get("6"),
                        "reward": row.get("7") or row.get("8"),
                        "resource_id": resource_id,
                        "playback_entity_id": normalize_compiled_resource(resource_id) if isinstance(resource_id, str) else None,
                        "compiled_file": compiled_file,
                        "compiled_exists": bool(compiled_file),
                        "compiled_summary": compiled_summaries.get(Path(compiled_file).stem) if compiled_file else None,
                        "_source": source(table_id, {
                            "id": 1,
                            "campaign_detail_id": 2,
                            "participant_numeric_id": 3,
                            "episode_no": 4,
                            "resource_id": 5,
                            "required_valentine_level": 6,
                            "reward": 7 if season == "valentine" else 8,
                            "title": 9,
                        }, row.get("_offset")),
                    }
                    participant_id = row.get("3")
                    if not isinstance(participant_id, int):
                        introduction.append(episode)
                    else:
                        participant_rows[(participant_type, participant_id)].append(episode)

            participants = []
            for (participant_type, participant_id), episodes in sorted(participant_rows.items(), key=lambda item: item[0][1]):
                identity = idols.get(str(participant_id)) or idols.get(participant_id) if participant_type == "idol" else support_by_seasonal_id.get(participant_id)
                identity = identity if isinstance(identity, dict) else {}
                participants.append({
                    "participant_type": participant_type,
                    "participant_numeric_id": participant_id,
                    "participant_code": identity.get("idol_code") or identity.get("speaker_id"),
                    "display_name": identity.get("display_name"),
                    "level_group_id": participant_levels.get((detail_id, participant_type, participant_id)),
                    "episodes": episodes,
                    "playback_entity_count": len({item["playback_entity_id"] for item in episodes if item["playback_entity_id"]}),
                })

            campaign = {
                "id": f"{season}_{year}",
                "year": year,
                "season": season,
                "event_code": event_code,
                "campaign_detail_id": detail_id,
                "name": event.get("2"),
                "term": event.get("5"),
                "archive_term": event.get("6"),
                "bgm_resource_id": event.get("14"),
                "paired_campaign_id": f"{'white_day' if season == 'valentine' else 'valentine'}_{year}",
                "introduction": introduction,
                "participants": participants,
                "level_groups": [row for row in tables.get(149, []) if row.get("2") in {
                    participant.get("level_group_id") for participant in participants
                }],
                "ranking_reward_rules": [row for row in tables.get(150, []) if season == "valentine" and row.get("2") == detail_id],
                "playback_entity_count": len({
                    episode["playback_entity_id"]
                    for participant in participants
                    for episode in participant["episodes"]
                    if episode["playback_entity_id"]
                }) + len({item["playback_entity_id"] for item in introduction if item["playback_entity_id"]}),
                "_source": source(112, {
                    "event_code": 1,
                    "name": 2,
                    "campaign_type": 3,
                    "campaign_detail_id": 4,
                    "term": 5,
                    "archive_term": 6,
                    "bgm_resource_id": 14,
                }, event.get("_offset")),
            }
            campaigns.append(campaign)
            by_code[str(event_code)] = campaign["id"]

    cycles = [
        {
            "year": year,
            "valentine_campaign_id": f"valentine_{year}",
            "white_day_campaign_id": f"white_day_{year}",
            "relation_source": source(153, {"white_day_detail_id": 1, "valentine_detail_id": 2}, row.get("_offset")),
        }
        for row in tables.get(153, [])
        for year in [2021 + row.get("1")]
    ]
    return {
        "schema_version": 1,
        "campaigns": campaigns,
        "by_id": {item["id"]: item for item in campaigns},
        "by_event_code": by_code,
        "cycles": cycles,
        "meta": {
            "campaign_count": len(campaigns),
            "cycle_count": len(cycles),
            "raw_episode_count": sum(
                len(item["introduction"]) + sum(len(participant["episodes"]) for participant in item["participants"])
                for item in campaigns
            ),
            "playback_entity_count": sum(item["playback_entity_count"] for item in campaigns),
            "classification": "seasonal_campaign",
        },
    }
