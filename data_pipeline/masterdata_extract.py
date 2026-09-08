"""Extract useful records from SideM Growing Stars client_master_data.

The iOS cache file is XOR-obfuscated with the repeating ASCII phrase
``DefaultPassPhrase``. The decoded payload is a protobuf stream where each
top-level field number behaves like a table id.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

if __package__:
    from .story_catalog import build_story_catalog
    from .sidem_masterdata.provenance import source
    from .sidem_masterdata.backgrounds import build_background_catalog as project_background_catalog
    from .sidem_masterdata.resource_inputs import (load_json_file, load_spine_ids, load_prefab_models, collect_compiled_stems, summarize_compiled_scenario, collect_compiled_summaries, collect_card_home_voice_previews, collect_voice_stems, collect_background_stems)
    from .sidem_masterdata.gasha import extract_gasha_announcements, build_gasha_index
    from .sidem_masterdata.events import extract_event_tables, build_event_index as project_event_index
    from .sidem_masterdata.cards import canonical_cards, build_card_index
    from .sidem_masterdata.card_voices import OPERATIONAL_VOICE_SUFFIXES, classify_card_operational_voices
    from .sidem_masterdata.card_details import split_card_index, extract_card_details_in_place
    from .sidem_masterdata.card_gameplay import (IDOL_TYPE_NAMES, build_card_parameter, render_skill_description, build_card_reference_maps, build_card_gameplay, build_card_costume_relations)
    from .sidem_masterdata.story_tables import extract_scenario_titles
    from .sidem_masterdata.birthday import build_birthday_semantic_catalog
    from .sidem_masterdata.story_index import build_story_master_index
    from .sidem_masterdata.work import build_work_story_index as project_work_story_index, work_story_files
    from .sidem_masterdata.compiled_inputs import load_scenario_payloads
    from .sidem_masterdata.story_resources import (normalize_compiled_resource, compiled_exists, compiled_filename, enrich_resource_row, normalize_release_condition, normalize_term)
    from .sidem_masterdata.episodes import (build_idol_episode_index)
    from .sidem_masterdata.mobile import (build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index)
    from .sidem_masterdata.seasonal import (build_seasonal_communication_index, build_seasonal_campaign_index)
    from .sidem_masterdata.music import build_music_catalog
    from .sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
    from .sidem_masterdata.identities import (maybe_resource_id, idol_id_from_resource, build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary)
else:
    from story_catalog import build_story_catalog
    from sidem_masterdata.provenance import source
    from sidem_masterdata.backgrounds import build_background_catalog as project_background_catalog
    from sidem_masterdata.resource_inputs import (load_json_file, load_spine_ids, load_prefab_models, collect_compiled_stems, summarize_compiled_scenario, collect_compiled_summaries, collect_card_home_voice_previews, collect_voice_stems, collect_background_stems)
    from sidem_masterdata.gasha import extract_gasha_announcements, build_gasha_index
    from sidem_masterdata.events import extract_event_tables, build_event_index as project_event_index
    from sidem_masterdata.cards import canonical_cards, build_card_index
    from sidem_masterdata.card_voices import OPERATIONAL_VOICE_SUFFIXES, classify_card_operational_voices
    from sidem_masterdata.card_details import split_card_index, extract_card_details_in_place
    from sidem_masterdata.card_gameplay import (IDOL_TYPE_NAMES, build_card_parameter, render_skill_description, build_card_reference_maps, build_card_gameplay, build_card_costume_relations)
    from sidem_masterdata.story_tables import extract_scenario_titles
    from sidem_masterdata.birthday import build_birthday_semantic_catalog
    from sidem_masterdata.story_index import build_story_master_index
    from sidem_masterdata.work import build_work_story_index as project_work_story_index, work_story_files
    from sidem_masterdata.compiled_inputs import load_scenario_payloads
    from sidem_masterdata.story_resources import (normalize_compiled_resource, compiled_exists, compiled_filename, enrich_resource_row, normalize_release_condition, normalize_term)
    from sidem_masterdata.episodes import (build_idol_episode_index)
    from sidem_masterdata.mobile import (build_mobile_archive_index, build_home_interaction_index, build_short_adv_profile_index)
    from sidem_masterdata.seasonal import (build_seasonal_communication_index, build_seasonal_campaign_index)
    from sidem_masterdata.music import build_music_catalog
    from sidem_masterdata.movies import build_movie_announce_index, build_card_skill_movie_index, build_song_movie_index
    from sidem_masterdata.identities import (maybe_resource_id, idol_id_from_resource, build_idol_unit_dictionary, build_speaker_dictionary, build_costume_dictionary, build_face_dictionary)


# Preserve imports used by existing tooling while new wire consumers use the package.
if __package__:
    from .sidem_masterdata import (DEFAULT_KEY, read_varint, xor_decode, decode_masterdata_input,
                                  iter_top_records, decode_string, parse_message,
                                  length_delimited_field_bytes, extract_table_rows)
else:
    from sidem_masterdata import (DEFAULT_KEY, read_varint, xor_decode, decode_masterdata_input,
                                 iter_top_records, decode_string, parse_message,
                                 length_delimited_field_bytes, extract_table_rows)


PATTERNS = {
    "card_resource": re.compile(r"\b\d{3}[a-z]{3}_(?:n|r|sr|ssr)\d+\b"),
    "costume_or_card": re.compile(r"\b\d{3}[a-z]{3}_\d{3}_\d{2}\b"),
    "scenario_resource": re.compile(r"\b[1259]_[0-9]_[0-9]{3}_[0-9]{2}(?:_[0-9a-z]+)?\b"),
    "asset": re.compile(r"\b(?:bg\d{3}|bgm_|card_|live_|skill_movie_|song3_|system_)"),
    "timecode": re.compile(r"\b\d{2}:\d{2}:\d{2}\b"),
    "jp_text": re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]"),
}


def build_table_scan(records: list[tuple[int, int, int, int, Any]]) -> list[dict[str, Any]]:
    stats: dict[int, dict[str, Any]] = {}
    samples: dict[tuple[int, str], list[str]] = defaultdict(list)
    for top_field, start, payload_start, end, payload in records:
        table = stats.setdefault(
            top_field,
            {
                "top_field": top_field,
                "records": 0,
                "lengths": [],
                "strings": 0,
                "field_counts": Counter(),
                "matches": Counter(),
            },
        )
        table["records"] += 1
        table["lengths"].append(end - payload_start)
        if not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload)
        for inner_field, value in parsed.items():
            values = value if isinstance(value, list) else [value]
            table["field_counts"][int(inner_field)] += len(values)
            for item in values:
                if not isinstance(item, str):
                    continue
                table["strings"] += 1
                for name, pattern in PATTERNS.items():
                    if pattern.search(item):
                        table["matches"][name] += 1
                        bucket = samples[(top_field, name)]
                        if len(bucket) < 8:
                            bucket.append(item[:300])

    report = []
    for top_field, table in sorted(stats.items()):
        lengths = table.pop("lengths")
        field_counts = table.pop("field_counts")
        matches = table.pop("matches")
        report.append(
            {
                **table,
                "avg_len": round(sum(lengths) / len(lengths), 1),
                "min_len": min(lengths),
                "max_len": max(lengths),
                "common_inner_fields": field_counts.most_common(12),
                "matches": dict(matches),
                "samples": {
                    name: samples.get((top_field, name), []) for name in PATTERNS
                },
            }
        )
    return report


def extract_card_parameters(records: list[tuple[int, int, int, int, Any]]) -> list[dict[str, Any]]:
    cards = []
    for top_field, start, payload_start, end, payload in records:
        if top_field != 1 or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=True)
        resource_id = parsed.get("14")
        if isinstance(resource_id, str) and PATTERNS["card_resource"].match(resource_id):
            parsed["_offset"] = start
            parsed["_end"] = end
            cards.append(parsed)
    return cards


def build_event_index(
    records: list[tuple[int, int, int, int, Any]],
    story_tables: dict[str, list[dict[str, Any]]],
    card_index: dict[str, Any],
) -> dict[str, Any]:
    """Compatibility wrapper for callers supplying wire records."""
    return project_event_index(extract_event_tables(records), story_tables, card_index)


def build_work_story_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    background_catalog: dict[str, Any],
) -> dict[str, Any]:
    """Compatibility orchestration; the work domain consumes supplied payloads."""
    payloads = load_scenario_payloads(compiled_dir, work_story_files(tables, compiled_stems))
    return project_work_story_index(
        tables, compiled_stems, compiled_summaries, idol_unit_dictionary, background_catalog, payloads
    )


def build_background_catalog(tables: dict[int, list[dict[str, Any]]], bg_dir: Path | None = None) -> dict[str, Any]:
    """Compatibility adapter for callers supplying a background directory."""
    return project_background_catalog(tables, collect_background_stems(bg_dir))


def extract_card_voice_cues(records: list[tuple[int, int, int, int, Any]]) -> list[dict[str, Any]]:
    cues = []
    for top_field, start, payload_start, end, payload in records:
        if top_field != 91 or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=True)
        nested = parsed.get("4")
        if isinstance(nested, dict):
            cues.append(
                {
                    "id": parsed.get("1"),
                    "card_id": parsed.get("2"),
                    "scenario_base": nested.get("1"),
                    "cue": nested.get("2"),
                    "start_time": nested.get("5"),
                    "end_time": nested.get("6"),
                }
            )
    return cues


def build_card_detail_index(card_index: dict[str, Any]) -> dict[str, Any]:
    """Compatibility only: consumes detail fields from card_index in place."""
    return extract_card_details_in_place(card_index)


def build_validation_report(
    story_tables: dict[str, list[dict[str, Any]]],
    card_voice_cues: list[dict[str, Any]],
    card_home_voice_previews: dict[str, dict[str, Any]],
    compiled_stems: set[str],
    voice_stems: set[str],
) -> dict[str, Any]:
    resource_groups = {
        "main_episodes": ("main_episodes", "6"),
        "event_episodes": ("event_episodes", "5"),
        "unit_story_episodes": ("unit_episodes", "6"),
        "idol_story_episodes": ("idol_story_episodes", "6"),
        "card_scenarios": ("card_scenarios", "4"),
        "work_story_resources": ("work_story_resources", "5"),
        "birthday_episodes": ("birthday_episodes", "5"),
        "extra_story_episodes": ("extra_story_episodes", "5"),
    }
    story_coverage = {}
    for label, (group, key) in resource_groups.items():
        rows = story_tables.get(group, [])
        total = 0
        hits = 0
        missing = []
        for row in rows:
            resource_id = row.get(key)
            if not isinstance(resource_id, str) or not re.match(r"^[0-9]_[0-9]{1,2}_", resource_id):
                continue
            total += 1
            if compiled_exists(resource_id, compiled_stems):
                hits += 1
            elif len(missing) < 20:
                missing.append(resource_id)
        story_coverage[label] = {
            "total": total,
            "compiled_hits": hits,
            "coverage": round(hits / total, 4) if total else None,
            "missing_sample": missing,
        }

    cue_total = len(card_voice_cues)
    cue_hits = sum(1 for cue in card_voice_cues if cue.get("cue") in voice_stems)
    return {
        "story_coverage": story_coverage,
        "card_voice_cue_coverage": {
            "total": cue_total,
            "audio_hits": cue_hits,
            "coverage": round(cue_hits / cue_total, 4) if cue_total else None,
        },
        "card_home_voice_preview_coverage": {
            "total": cue_total,
            "preview_hits": sum(1 for cue in card_voice_cues if cue.get("cue") in card_home_voice_previews),
            "coverage": round(
                sum(1 for cue in card_voice_cues if cue.get("cue") in card_home_voice_previews) / cue_total,
                4,
            ) if cue_total else None,
        },
    }


def build_archive_summary(
    story_index: dict[str, Any],
    card_index: dict[str, Any],
    validation_report: dict[str, Any],
) -> dict[str, Any]:
    cards = card_index.get("cards", [])
    rarity_counts = Counter(card.get("rarity") or "UNKNOWN" for card in cards)
    story_counts = {
        "main_groups": len(story_index.get("main", {}).get("groups", [])),
        "main_chapters": len(story_index.get("main", {}).get("chapters", [])),
        "main_episodes": len(story_index.get("main", {}).get("episodes", [])),
        "event_groups": len(story_index.get("event", {}).get("groups", [])),
        "event_episodes": len(story_index.get("event", {}).get("episodes", [])),
        "unit_story_groups": len(story_index.get("unit_story", {}).get("groups", [])),
        "unit_story_chapters": len(story_index.get("unit_story", {}).get("chapters", [])),
        "unit_story_episodes": len(story_index.get("unit_story", {}).get("episodes", [])),
        "idol_story_chapters": len(story_index.get("idol_story", {}).get("chapters", [])),
        "idol_story_episodes": len(story_index.get("idol_story", {}).get("episodes", [])),
        "card_scenarios": len(story_index.get("card_scenarios", [])),
        "work": len(story_index.get("work", [])),
        "birthday": len(story_index.get("birthday", [])),
        "extra_groups": len(story_index.get("extra", {}).get("groups", [])),
        "extra_episodes": len(story_index.get("extra", {}).get("episodes", [])),
    }
    card_counts = {
        "cards": len(cards),
        "characters": len(card_index.get("by_character", {})),
        "rarity": dict(sorted(rarity_counts.items())),
        "with_texts": sum(
            1
            for card in cards
            if any((card.get("texts") or {}).get(key) for key in ("normal", "awakened", "extra"))
        ),
        "with_home_voice": sum(1 for card in cards if card.get("home_voice_cues")),
        "with_scenario_entries": sum(1 for card in cards if card.get("scenario_entries")),
        "with_unmapped_card_only_voice_candidates": sum(
            1
            for card in cards
            if (card.get("voice_candidates") or {}).get("unmapped_card_only")
        ),
    }
    return {
        "generated_from": "client_master_data",
        "story_counts": story_counts,
        "card_counts": card_counts,
        "validation": validation_report,
        "recommended_archive_sources": {
            "main_story": "story_master_index.main",
            "event_story": "story_master_index.event",
            "unit_story": "story_master_index.unit_story",
            "idol_story": "story_master_index.idol_story",
            "card_archive": "card_index.cards",
            "card_phone_or_story": "card_index.cards[].scenario_entries",
            "work_story": "story_master_index.work",
            "birthday": "story_master_index.birthday",
            "extra": "story_master_index.extra",
            "compiled_fallback": "public/data/compiled/index.json",
        },
    }


def build_card_probe(card_index: dict[str, Any], resource_id: str) -> dict[str, Any]:
    card = next(
        (item for item in card_index.get("cards", []) if item.get("resource_id") == resource_id),
        None,
    )
    if not card:
        return {"resource_id": resource_id, "found": False}
    return {
        "resource_id": resource_id,
        "found": True,
        "card_id": card.get("card_id"),
        "character_id": card.get("character_id"),
        "rarity": card.get("rarity"),
        "title": card.get("title"),
        "voice_base": card.get("voice_base"),
        "texts": card.get("texts"),
        "home_voice_cues": [item.get("cue") for item in card.get("home_voice_cues", [])],
        "scenario_entries": [
            {
                "title": item.get("3"),
                "resource_id": item.get("resource_id"),
                "compiled_file": item.get("compiled_file"),
                "compiled_exists": item.get("compiled_exists"),
            }
            for item in card.get("scenario_entries", [])
        ],
        "unmapped_card_only_voice_candidates": (
            card.get("voice_candidates") or {}
        ).get("unmapped_card_only", []),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "--input-state",
        choices=("xor", "decoded"),
        default="xor",
        help=(
            "State of the positional input. The historical default is 'xor'; "
            "use 'decoded' for client_master_data.xor_DefaultPassPhrase.pb."
        ),
    )
    parser.add_argument("--out-dir", type=Path, default=Path(".analysis/masterdata"))
    parser.add_argument("--public-out-dir", type=Path)
    parser.add_argument("--compiled-dir", type=Path)
    parser.add_argument("--voice-dir", type=Path)
    parser.add_argument("--spines-index", type=Path)
    parser.add_argument("--prefab-meta", type=Path)
    parser.add_argument("--bg-dir", type=Path)
    parser.add_argument(
        "--seasonal-campaign-only",
        action="store_true",
        help="Generate only seasonal_campaign_index.json with its local identity relations.",
    )
    parser.add_argument(
        "--work-story-only",
        action="store_true",
        help="Generate only work_story_index.json with scene lines and short stories.",
    )
    parser.add_argument(
        "--idol-communication-only",
        action="store_true",
        help="Generate only idol_episode_index.json, mobile_archive_index.json and the corrected home interaction index.",
    )
    parser.add_argument(
        "--birthday-semantic-only",
        action="store_true",
        help=(
            "Generate only birthday_story_semantic_index.json from tables "
            "76/77/78/80/86."
        ),
    )
    parser.add_argument(
        "--music-catalog-only",
        action="store_true",
        help="Generate only music_catalog.json, including complete table-133 relations.",
    )
    parser.add_argument(
        "--movie-announce-only",
        action="store_true",
        help="Generate only movie_announce_index.json from table 175.",
    )
    parser.add_argument(
        "--card-skill-movie-only",
        action="store_true",
        help=(
            "Generate only card_skill_movie_index.json from CardData table 1 "
            "records whose HasSkillCutinResource field is true."
        ),
    )
    parser.add_argument(
        "--song-movie-only",
        action="store_true",
        help=(
            "Generate only song_movie_index.json from SongData table 46 "
            "MovieOffset and enabled MvliveOpenAt records."
        ),
    )
    parser.add_argument(
        "--curated-card-voices",
        type=Path,
        default=Path(__file__).resolve().parent / "curated" / "card_voice_transcripts.json",
    )
    parser.add_argument(
        "--curated-gasha-titles",
        type=Path,
        default=Path(__file__).resolve().parent / "curated" / "gasha_titles.json",
    )
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    decoded = decode_masterdata_input(args.input.read_bytes(), args.input_state)
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)

    records = list(iter_top_records(decoded))
    compiled_stems = collect_compiled_stems(args.compiled_dir)
    compiled_summaries = collect_compiled_summaries(args.compiled_dir)
    if args.birthday_semantic_only:
        birthday_tables = extract_scenario_titles(records)
        birthday_semantic_index = build_birthday_semantic_catalog(birthday_tables)
        filename = "birthday_story_semantic_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(birthday_semantic_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(birthday_semantic_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {birthday_semantic_index.get('meta', {})}")
        return
    if args.movie_announce_only:
        movie_tables = extract_table_rows(records, {175})
        movie_announce_index = build_movie_announce_index(movie_tables)
        filename = "movie_announce_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(movie_announce_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(movie_announce_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {movie_announce_index['meta']}")
        return
    if args.card_skill_movie_only:
        card_tables = extract_table_rows(records, {1})
        card_skill_movie_index = build_card_skill_movie_index(card_tables)
        filename = "card_skill_movie_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(card_skill_movie_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(card_skill_movie_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {card_skill_movie_index['meta']}")
        return
    if args.song_movie_only:
        song_tables = extract_table_rows(records, {46})
        song_movie_index = build_song_movie_index(song_tables)
        filename = "song_movie_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(song_movie_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(song_movie_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {song_movie_index['meta']}")
        return
    if args.music_catalog_only:
        music_tables = extract_table_rows(records, {46, 112, 133})
        music_catalog = build_music_catalog(music_tables)
        filename = "music_catalog.json"
        (args.out_dir / filename).write_text(
            json.dumps(music_catalog, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(music_catalog, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {music_catalog['meta']}")
        return
    if args.idol_communication_only:
        communication_tables = extract_table_rows(
            records,
            {
                2, 7, 8, 9, 20, 21, 23, 24, 32, 34, 36, 43, 44, 63, 68,
                94, 96, 98, 103, 104, 105, 106, 180,
            },
        )
        communication_idols = build_idol_unit_dictionary(communication_tables)
        selected_outputs = {
            "idol_episode_index.json": build_idol_episode_index(
                communication_tables, compiled_stems, compiled_summaries, communication_idols
            ),
            "mobile_archive_index.json": build_mobile_archive_index(
                communication_tables, compiled_stems, compiled_summaries, communication_idols
            ),
            "home_interaction_index.json": build_home_interaction_index(
                communication_tables, compiled_stems, compiled_summaries
            ),
        }
        for filename, data in selected_outputs.items():
            (args.out_dir / filename).write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            for filename, data in selected_outputs.items():
                (args.public_out_dir / filename).write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
                )
        print(f"decoded: {decoded_path}")
        for filename, data in selected_outputs.items():
            print(f"{filename}: {data.get('meta', {})}")
        return
    if args.seasonal_campaign_only:
        seasonal_tables = extract_table_rows(
            records,
            {2, 20, 21, 100, 112, 146, 147, 148, 149, 150, 153, 159, 162, 165, 168},
        )
        seasonal_idols = build_idol_unit_dictionary(seasonal_tables)
        seasonal_speakers = build_speaker_dictionary(seasonal_tables, seasonal_idols)
        seasonal_campaign_index = build_seasonal_campaign_index(
            seasonal_tables,
            compiled_stems,
            compiled_summaries,
            seasonal_idols,
            seasonal_speakers,
        )
        filename = "seasonal_campaign_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(seasonal_campaign_index, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(seasonal_campaign_index, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {len(seasonal_campaign_index['campaigns'])} campaigns")
        return
    if args.work_story_only:
        work_tables = extract_table_rows(records, {2, 20, 21, 53, 54, 55, 107, 108, 110})
        work_idols = build_idol_unit_dictionary(work_tables)
        work_backgrounds = build_background_catalog(work_tables, args.bg_dir)
        work_story_index = build_work_story_index(
            work_tables,
            args.compiled_dir,
            compiled_stems,
            compiled_summaries,
            work_idols,
            work_backgrounds,
        )
        filename = "work_story_index.json"
        (args.out_dir / filename).write_text(
            json.dumps(work_story_index, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        if args.public_out_dir:
            args.public_out_dir.mkdir(parents=True, exist_ok=True)
            (args.public_out_dir / filename).write_text(
                json.dumps(work_story_index, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        print(f"decoded: {decoded_path}")
        print(f"{filename}: {len(work_story_index['idols'])} idols")
        return
    voice_stems = collect_voice_stems(args.voice_dir)
    spine_ids = load_spine_ids(args.spines_index)
    prefab_models = load_prefab_models(args.prefab_meta)
    curated_card_voices = load_json_file(args.curated_card_voices) or {}
    curated_gasha_titles = load_json_file(args.curated_gasha_titles) or {}
    card_parameters = extract_card_parameters(records)
    story_tables = extract_scenario_titles(records)
    gasha_announcement_index = extract_gasha_announcements(records)
    card_voice_cues = extract_card_voice_cues(records)
    card_home_voice_previews = collect_card_home_voice_previews(
        card_voice_cues,
        args.compiled_dir,
        compiled_stems,
    )
    catalog_tables = extract_table_rows(
        records,
        {
            2, 7, 8, 9, 16, 20, 21, 23, 24, 27, 28, 29, 32, 34, 36, 40, 43, 44,
            46, 53, 54, 55, 63, 68, 90, 94, 96, 98, 100, 101, 103, 104,
            75, 105, 106, 107, 108, 110, 112, 130, 133, 146, 147, 148, 149, 150,
            153, 159, 162, 165, 168, 175, 176, 180,
        },
    )
    idol_unit_dictionary = build_idol_unit_dictionary(catalog_tables)
    speaker_dictionary = build_speaker_dictionary(catalog_tables, idol_unit_dictionary)
    costume_dictionary = build_costume_dictionary(catalog_tables, idol_unit_dictionary, spine_ids, prefab_models)
    idol_episode_index = build_idol_episode_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
    )
    mobile_archive_index = build_mobile_archive_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
    )
    home_interaction_index = build_home_interaction_index(catalog_tables, compiled_stems, compiled_summaries)
    short_adv_profile_index = build_short_adv_profile_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_communication_index = build_seasonal_communication_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_campaign_index = build_seasonal_campaign_index(
        catalog_tables,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
        speaker_dictionary,
    )
    background_catalog = build_background_catalog(catalog_tables, args.bg_dir)
    work_story_index = build_work_story_index(
        catalog_tables,
        args.compiled_dir,
        compiled_stems,
        compiled_summaries,
        idol_unit_dictionary,
        background_catalog,
    )
    music_catalog = build_music_catalog(catalog_tables)
    movie_announce_index = build_movie_announce_index(catalog_tables)
    card_skill_movie_index = build_card_skill_movie_index(catalog_tables)
    song_movie_index = build_song_movie_index(catalog_tables)
    face_dictionary = build_face_dictionary(catalog_tables)
    story_master_index = build_story_master_index(story_tables, compiled_stems, compiled_summaries)
    birthday_story_semantic_index = build_birthday_semantic_catalog(story_tables)
    card_index = build_card_index(
        card_parameters,
        card_voice_cues,
        card_home_voice_previews,
        story_tables,
        catalog_tables,
        voice_stems,
        compiled_stems,
        compiled_summaries,
        curated_card_voices,
    )
    card_index, card_detail_index = split_card_index(card_index)
    gasha_index = build_gasha_index(gasha_announcement_index, card_index, curated_gasha_titles)
    event_index = project_event_index(extract_event_tables(records), story_tables, card_index)
    validation_report = build_validation_report(
        story_tables,
        card_voice_cues,
        card_home_voice_previews,
        compiled_stems,
        voice_stems,
    )
    outputs = {
        "story_catalog.json": build_story_catalog(story_master_index),
        "masterdata_table_scan.json": build_table_scan(records),
        "card_parameter_field1_extract.json": card_parameters,
        "story_related_tables_extract.json": story_tables,
        "card_voice_cue_field91_extract.json": card_voice_cues,
        "card_home_voice_preview_extract.json": card_home_voice_previews,
        "story_master_index.json": story_master_index,
        "birthday_story_semantic_index.json": birthday_story_semantic_index,
        "gasha_announcement_index.json": gasha_announcement_index,
        "gasha_index.json": gasha_index,
        "event_index.json": event_index,
        "card_index.json": card_index,
        "card_detail_index.json": card_detail_index,
        "idol_unit_dictionary.json": idol_unit_dictionary,
        "speaker_dictionary.json": speaker_dictionary,
        "costume_dictionary.json": costume_dictionary,
        "idol_episode_index.json": idol_episode_index,
        "mobile_archive_index.json": mobile_archive_index,
        "home_interaction_index.json": home_interaction_index,
        "short_adv_profile_index.json": short_adv_profile_index,
        "seasonal_communication_index.json": seasonal_communication_index,
        "seasonal_campaign_index.json": seasonal_campaign_index,
        "work_story_index.json": work_story_index,
        "background_catalog.json": background_catalog,
        "music_catalog.json": music_catalog,
        "movie_announce_index.json": movie_announce_index,
        "card_skill_movie_index.json": card_skill_movie_index,
        "song_movie_index.json": song_movie_index,
        "face_dictionary.json": face_dictionary,
        "masterdata_validation_report.json": validation_report,
        "archive_summary.json": build_archive_summary(
            story_master_index,
            card_index,
            validation_report,
        ),
        "040ren_ssr03_probe.json": build_card_probe(card_index, "040ren_ssr03"),
    }
    for filename, data in outputs.items():
        (args.out_dir / filename).write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    if args.public_out_dir:
        args.public_out_dir.mkdir(parents=True, exist_ok=True)
        for filename in (
            "story_master_index.json",
            "story_catalog.json",
            "gasha_announcement_index.json",
            "gasha_index.json",
            "event_index.json",
            "card_index.json",
            "card_detail_index.json",
            "idol_unit_dictionary.json",
            "speaker_dictionary.json",
            "costume_dictionary.json",
            "idol_episode_index.json",
            "mobile_archive_index.json",
            "home_interaction_index.json",
            "short_adv_profile_index.json",
            "seasonal_communication_index.json",
            "seasonal_campaign_index.json",
            "work_story_index.json",
            "background_catalog.json",
            "music_catalog.json",
            "movie_announce_index.json",
            "card_skill_movie_index.json",
            "song_movie_index.json",
            "face_dictionary.json",
            "masterdata_validation_report.json",
        ):
            (args.public_out_dir / filename).write_text(
                json.dumps(outputs[filename], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    print(f"decoded: {decoded_path}")
    for filename, data in outputs.items():
        if isinstance(data, list):
            count = len(data)
        elif isinstance(data, dict):
            count = len(data)
        else:
            count = 1
        print(f"{filename}: {count} records")


if __name__ == "__main__":
    main()
