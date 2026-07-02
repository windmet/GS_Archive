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


DEFAULT_KEY = b"DefaultPassPhrase"


def read_varint(data: bytes, pos: int, end: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while pos < end:
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7
    raise EOFError("truncated varint")


def xor_decode(data: bytes, key: bytes = DEFAULT_KEY) -> bytes:
    return bytes(byte ^ key[i % len(key)] for i, byte in enumerate(data))


def iter_top_records(data: bytes):
    pos = 0
    end = len(data)
    while pos < end:
        start = pos
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 2:
            length, pos = read_varint(data, pos, end)
            payload_start = pos
            pos += length
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        elif wire_type == 0:
            value, pos = read_varint(data, pos, end)
            yield field_no, start, pos, pos, value
        elif wire_type == 1:
            payload_start = pos
            pos += 8
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        elif wire_type == 5:
            payload_start = pos
            pos += 4
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        else:
            raise ValueError(f"unsupported top-level wire type {wire_type} at {start:#x}")


def decode_string(raw: bytes) -> str | None:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not text:
        return ""
    printable = sum(ch.isprintable() or ch in "\r\n\t" for ch in text) / len(text)
    return text if printable > 0.85 else None


def parse_message(data: bytes, nested: bool = False) -> dict[str, Any]:
    pos = 0
    end = len(data)
    out: dict[str, Any] = {}
    multi: dict[str, list[Any]] = {}

    def put(field_no: int, value: Any) -> None:
        key = str(field_no)
        if key in out:
            if key not in multi:
                multi[key] = [out[key]]
            multi[key].append(value)
            out[key] = multi[key]
        else:
            out[key] = value

    while pos < end:
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 0:
            value, pos = read_varint(data, pos, end)
            put(field_no, value)
        elif wire_type == 2:
            length, pos = read_varint(data, pos, end)
            raw = data[pos : pos + length]
            pos += length
            text = decode_string(raw)
            if text is not None:
                put(field_no, text)
            elif nested:
                put(field_no, parse_message(raw, nested=False))
            else:
                put(field_no, raw.hex())
        elif wire_type == 1:
            put(field_no, data[pos : pos + 8].hex())
            pos += 8
        elif wire_type == 5:
            put(field_no, data[pos : pos + 4].hex())
            pos += 4
        else:
            put(field_no, f"unsupported_wire_{wire_type}")
            break
    return out


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
        parsed = parse_message(payload)
        resource_id = parsed.get("14")
        if isinstance(resource_id, str) and PATTERNS["card_resource"].match(resource_id):
            parsed["_offset"] = start
            parsed["_end"] = end
            cards.append(parsed)
    return cards


def extract_scenario_titles(records: list[tuple[int, int, int, int, Any]]) -> dict[str, list[dict[str, Any]]]:
    tables: dict[str, list[dict[str, Any]]] = {
        "main_chapters": [],
        "main_episodes": [],
        "idol_story_chapters": [],
        "idol_story_episodes": [],
        "card_scenarios": [],
        "work_story_resources": [],
        "birthday_episodes": [],
        "extra_story_groups": [],
        "extra_story_episodes": [],
    }
    mapping = {
        5: "main_chapters",
        6: "main_episodes",
        8: "idol_story_chapters",
        9: "idol_story_episodes",
        43: "card_scenarios",
        54: "work_story_resources",
        55: "work_story_resources",
        78: "birthday_episodes",
        144: "extra_story_groups",
        145: "extra_story_episodes",
    }
    for top_field, start, payload_start, end, payload in records:
        name = mapping.get(top_field)
        if not name or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload)
        parsed["_top_field"] = top_field
        parsed["_offset"] = start
        tables[name].append(parsed)
    return tables


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


def normalize_compiled_resource(resource_id: str) -> str:
    match = re.match(r"^((?:1_1|1_2|1_4)_\d{3}_\d{2})_[a-z]$", resource_id)
    if match:
        return match.group(1)
    match = re.match(r"^((?:5_\d{2})_\d{3}_\d{2})_[a-z]$", resource_id)
    if match:
        return match.group(1)
    return resource_id


def collect_compiled_stems(compiled_dir: Path | None) -> set[str]:
    if not compiled_dir or not compiled_dir.exists():
        return set()
    excluded = {"index", "manifest", "voice_index"}
    return {path.stem for path in compiled_dir.glob("*.json") if path.stem not in excluded}


def summarize_compiled_scenario(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return {}

    steps = data.get("steps") or []
    step_types: Counter[str] = Counter()
    chara_ids: set[str] = set()
    title = None
    voice_count = 0
    lip_count = 0

    for step in steps:
        if not isinstance(step, dict):
            continue
        step_type = step.get("type")
        if isinstance(step_type, str):
            step_types[step_type] += 1

        dialogue = step.get("dialogue") if isinstance(step.get("dialogue"), dict) else {}
        text = dialogue.get("text")
        if not title and step_type == "title" and isinstance(text, str):
            title = text
        if dialogue.get("voice"):
            voice_count += 1
        if isinstance(dialogue.get("lip"), dict) and dialogue["lip"].get("path"):
            lip_count += 1

        chara_id = step.get("chara_id")
        if isinstance(chara_id, str):
            chara_ids.add(chara_id)
        state = step.get("state") if isinstance(step.get("state"), dict) else {}
        for spine in state.get("spines") or []:
            if isinstance(spine, dict) and isinstance(spine.get("id"), str):
                chara_ids.add(spine["id"])

    if not title:
        for step in steps:
            if not isinstance(step, dict):
                continue
            dialogue = step.get("dialogue") if isinstance(step.get("dialogue"), dict) else {}
            text = dialogue.get("text")
            if isinstance(text, str) and text and text != "【あらすじ】":
                title = text.splitlines()[0]
                break

    return {
        "scenario_id": data.get("scenario_id"),
        "title": title,
        "step_count": len(steps),
        "step_types": dict(sorted(step_types.items())),
        "voice_count": voice_count,
        "lip_count": lip_count,
        "characters": sorted(chara_ids),
    }


def collect_compiled_summaries(compiled_dir: Path | None) -> dict[str, dict[str, Any]]:
    if not compiled_dir or not compiled_dir.exists():
        return {}
    excluded = {"index", "manifest", "voice_index"}
    summaries = {}
    for path in compiled_dir.glob("*.json"):
        if path.stem in excluded:
            continue
        summary = summarize_compiled_scenario(path)
        if summary:
            summaries[path.stem] = summary
    return summaries


def collect_voice_stems(voice_dir: Path | None) -> set[str]:
    if not voice_dir or not voice_dir.exists():
        return set()
    return {path.stem for path in voice_dir.rglob("*.m4a")}


def compiled_exists(resource_id: str, compiled_stems: set[str]) -> bool:
    normalized = normalize_compiled_resource(resource_id)
    return normalized in compiled_stems or any(stem.endswith(f"_{normalized}") for stem in compiled_stems)


def compiled_filename(resource_id: str, compiled_stems: set[str]) -> str | None:
    normalized = normalize_compiled_resource(resource_id)
    if normalized in compiled_stems:
        return f"{normalized}.json"
    matches = sorted(stem for stem in compiled_stems if stem.endswith(f"_{normalized}"))
    return f"{matches[0]}.json" if matches else None


def build_story_master_index(
    story_tables: dict[str, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    def row_with_file(row: dict[str, Any], resource_key: str = "6") -> dict[str, Any]:
        resource_id = row.get(resource_key)
        out = dict(row)
        if isinstance(resource_id, str):
            out["resource_id"] = resource_id
            out["compiled_resource_id"] = normalize_compiled_resource(resource_id)
            out["compiled_file"] = compiled_filename(resource_id, compiled_stems)
            out["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
            if out["compiled_file"]:
                summary = compiled_summaries.get(Path(out["compiled_file"]).stem)
                if summary:
                    out["compiled_summary"] = summary
        return out

    return {
        "main": {
            "chapters": story_tables.get("main_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("main_episodes", [])],
        },
        "idol_story": {
            "chapters": story_tables.get("idol_story_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("idol_story_episodes", [])],
        },
        "card_scenarios": [
            row_with_file(row, "4") for row in story_tables.get("card_scenarios", [])
        ],
        "work": [
            row_with_file(row, "5") for row in story_tables.get("work_story_resources", [])
        ],
        "birthday": [
            row_with_file(row, "5") for row in story_tables.get("birthday_episodes", [])
        ],
        "extra": {
            "groups": story_tables.get("extra_story_groups", []),
            "episodes": [row_with_file(row, "5") for row in story_tables.get("extra_story_episodes", [])],
        },
    }


def build_card_index(
    cards: list[dict[str, Any]],
    card_voice_cues: list[dict[str, Any]],
    story_tables: dict[str, list[dict[str, Any]]],
    voice_stems: set[str],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    cues_by_card: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for cue in card_voice_cues:
        card_id = cue.get("card_id")
        if isinstance(card_id, int):
            cues_by_card[card_id].append(cue)

    scenario_rows_by_card: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in story_tables.get("card_scenarios", []):
        row_id = row.get("1")
        if not isinstance(row_id, int):
            continue
        card_id = row_id // 100
        resource_id = row.get("4")
        entry = dict(row)
        if isinstance(resource_id, str):
            entry["resource_id"] = resource_id
            entry["compiled_file"] = compiled_filename(resource_id, compiled_stems)
            entry["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
            if entry["compiled_file"]:
                summary = compiled_summaries.get(Path(entry["compiled_file"]).stem)
                if summary:
                    entry["compiled_summary"] = summary
        scenario_rows_by_card[card_id].append(entry)

    indexed_cards = []
    by_character: dict[str, list[str]] = defaultdict(list)
    for card in cards:
        card_id = card.get("1")
        resource_id = card.get("14")
        if not isinstance(card_id, int) or not isinstance(resource_id, str):
            continue

        character_id = resource_id[:6]
        rarity_match = re.search(r"_(n|r|sr|ssr)(\d+)$", resource_id)
        rarity = rarity_match.group(1).upper() if rarity_match else ""
        ordinal = int(rarity_match.group(2)) if rarity_match else None

        home_cues = sorted(cues_by_card.get(card_id, []), key=lambda item: item.get("cue") or "")
        home_cue_names = {item.get("cue") for item in home_cues}
        scenario_entries = sorted(
            scenario_rows_by_card.get(card_id, []),
            key=lambda item: item.get("1") if isinstance(item.get("1"), int) else 0,
        )
        scenario_resources = {
            item.get("resource_id") for item in scenario_entries if isinstance(item.get("resource_id"), str)
        }

        voice_base = None
        for cue in home_cues:
            base = cue.get("scenario_base")
            if isinstance(base, str) and base.endswith("_00"):
                voice_base = base[:-3]
                break
        if not voice_base:
            for resource in scenario_resources:
                if isinstance(resource, str):
                    voice_base = re.sub(r"_09_[a-z]$", "", resource)
                    break

        all_card_voice_candidates: list[str] = []
        unmapped_voice_candidates: list[str] = []
        if voice_base:
            all_card_voice_candidates = sorted(
                stem for stem in voice_stems if stem.startswith(f"{voice_base}_")
            )
            mapped_prefixes = set(home_cue_names)
            for resource in scenario_resources:
                if isinstance(resource, str):
                    mapped_prefixes.add(resource)
            for stem in all_card_voice_candidates:
                if stem in home_cue_names:
                    continue
                if any(stem.startswith(f"{prefix}") for prefix in scenario_resources if isinstance(prefix, str)):
                    continue
                unmapped_voice_candidates.append(stem)

        entry = {
            "card_id": card_id,
            "resource_id": resource_id,
            "character_id": character_id,
            "rarity": rarity,
            "ordinal": ordinal,
            "title_full": card.get("13"),
            "title": card.get("40") or card.get("13"),
            "release_at": card.get("18"),
            "texts": {
                "normal": card.get("19"),
                "awakened": card.get("22"),
                "extra": card.get("36"),
            },
            "voice_base": voice_base,
            "home_voice_cues": home_cues,
            "scenario_entries": scenario_entries,
            "voice_candidates": {
                "all": all_card_voice_candidates,
                "unmapped_card_only": unmapped_voice_candidates,
            },
        }
        indexed_cards.append(entry)
        by_character[character_id].append(resource_id)

    indexed_cards.sort(key=lambda item: (item["character_id"], item["card_id"]))
    return {
        "cards": indexed_cards,
        "by_character": {key: sorted(value) for key, value in sorted(by_character.items())},
        "meta": {
            "card_count": len(indexed_cards),
            "home_voice_cue_count": len(card_voice_cues),
        },
    }


def build_validation_report(
    story_tables: dict[str, list[dict[str, Any]]],
    card_voice_cues: list[dict[str, Any]],
    compiled_stems: set[str],
    voice_stems: set[str],
) -> dict[str, Any]:
    resource_groups = {
        "main_episodes": ("main_episodes", "6"),
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
    }


def build_archive_summary(
    story_index: dict[str, Any],
    card_index: dict[str, Any],
    validation_report: dict[str, Any],
) -> dict[str, Any]:
    cards = card_index.get("cards", [])
    rarity_counts = Counter(card.get("rarity") or "UNKNOWN" for card in cards)
    story_counts = {
        "main_chapters": len(story_index.get("main", {}).get("chapters", [])),
        "main_episodes": len(story_index.get("main", {}).get("episodes", [])),
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
    parser.add_argument("--out-dir", type=Path, default=Path(".analysis/masterdata"))
    parser.add_argument("--public-out-dir", type=Path)
    parser.add_argument("--compiled-dir", type=Path)
    parser.add_argument("--voice-dir", type=Path)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    decoded = xor_decode(args.input.read_bytes())
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)

    records = list(iter_top_records(decoded))
    compiled_stems = collect_compiled_stems(args.compiled_dir)
    compiled_summaries = collect_compiled_summaries(args.compiled_dir)
    voice_stems = collect_voice_stems(args.voice_dir)
    card_parameters = extract_card_parameters(records)
    story_tables = extract_scenario_titles(records)
    card_voice_cues = extract_card_voice_cues(records)
    story_master_index = build_story_master_index(story_tables, compiled_stems, compiled_summaries)
    card_index = build_card_index(
        card_parameters,
        card_voice_cues,
        story_tables,
        voice_stems,
        compiled_stems,
        compiled_summaries,
    )
    validation_report = build_validation_report(
        story_tables,
        card_voice_cues,
        compiled_stems,
        voice_stems,
    )
    outputs = {
        "masterdata_table_scan.json": build_table_scan(records),
        "card_parameter_field1_extract.json": card_parameters,
        "story_related_tables_extract.json": story_tables,
        "card_voice_cue_field91_extract.json": card_voice_cues,
        "story_master_index.json": story_master_index,
        "card_index.json": card_index,
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
            "card_index.json",
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
