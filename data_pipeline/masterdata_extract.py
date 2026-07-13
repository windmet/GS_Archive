"""Extract useful records from SideM Growing Stars client_master_data.

The iOS cache file is XOR-obfuscated with the repeating ASCII phrase
``DefaultPassPhrase``. The decoded payload is a protobuf stream where each
top-level field number behaves like a table id.
"""

from __future__ import annotations

import argparse
import hashlib
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
        "main_groups": [],
        "main_chapters": [],
        "main_episodes": [],
        "event_groups": [],
        "event_episodes": [],
        "unit_groups": [],
        "unit_chapters": [],
        "unit_episodes": [],
        "idol_story_chapters": [],
        "idol_story_episodes": [],
        "card_scenarios": [],
        "work_story_resources": [],
        "birthday_episodes": [],
        "extra_story_groups": [],
        "extra_story_episodes": [],
    }
    mapping = {
        4: "main_groups",
        5: "main_chapters",
        6: "main_episodes",
        11: "event_groups",
        12: "event_episodes",
        13: "unit_groups",
        14: "unit_chapters",
        15: "unit_episodes",
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


def extract_table_rows(
    records: list[tuple[int, int, int, int, Any]],
    table_ids: set[int],
    *,
    nested: bool = True,
) -> dict[int, list[dict[str, Any]]]:
    tables: dict[int, list[dict[str, Any]]] = {table_id: [] for table_id in table_ids}
    for top_field, start, payload_start, end, payload in records:
        if top_field not in table_ids or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=nested)
        parsed["_top_field"] = top_field
        parsed["_offset"] = start
        tables[top_field].append(parsed)
    return tables


def source(table: int, fields: dict[str, int], offset: int | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"table": table, "fields": fields}
    if offset is not None:
        out["offset"] = offset
    return out


def load_json_file(path: Path | None) -> Any:
    if not path or not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def load_spine_ids(path: Path | None) -> set[str]:
    data = load_json_file(path)
    if isinstance(data, list):
        return {item for item in data if isinstance(item, str)}
    if isinstance(data, dict):
        for key in ("models", "spines", "items"):
            value = data.get(key)
            if isinstance(value, list):
                return {item for item in value if isinstance(item, str)}
            if isinstance(value, dict):
                return set(value)
    return set()


def load_prefab_models(path: Path | None) -> dict[str, Any]:
    data = load_json_file(path)
    if isinstance(data, dict) and isinstance(data.get("models"), dict):
        return data["models"]
    return {}


def maybe_resource_id(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def idol_id_from_resource(resource_id: str | None) -> int | None:
    if not resource_id:
        return None
    match = re.match(r"^(\d{3})[a-z0-9]{3}", resource_id)
    return int(match.group(1)) if match else None


def build_idol_unit_dictionary(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    units_by_id: dict[int, dict[str, Any]] = {}
    for row in tables.get(24, []):
        unit_id = row.get("1")
        if not isinstance(unit_id, int):
            continue
        units_by_id[unit_id] = {
            "unit_id": unit_id,
            "unit_name": row.get("2"),
            "unit_code": row.get("3"),
            "unit_color": row.get("4"),
            "unit_kana": row.get("7"),
            "description": row.get("8"),
            "representative_bg": row.get("9"),
            "_source": source(24, {
                "unit_id": 1,
                "unit_name": 2,
                "unit_code": 3,
                "unit_color": 4,
                "unit_kana": 7,
                "description": 8,
                "representative_bg": 9,
            }, row.get("_offset")),
        }

    idols = []
    idols_by_code: dict[str, dict[str, Any]] = {}
    idols_by_numeric_id: dict[str, dict[str, Any]] = {}
    for row in tables.get(2, []):
        idol_id = row.get("1")
        idol_code = row.get("10")
        if not isinstance(idol_id, int) or not isinstance(idol_code, str):
            continue
        unit_relation_candidate = row.get("32") if isinstance(row.get("32"), int) else None
        entry = {
            "idol_id": idol_id,
            "idol_code": idol_code,
            "display_name": row.get("12") or row.get("13") or row.get("14"),
            "name_fields": {
                "f12": row.get("12"),
                "f13": row.get("13"),
                "f14": row.get("14"),
                "kana": row.get("15"),
            },
            "age": row.get("16"),
            "height": row.get("18"),
            "weight": row.get("19"),
            "birthplace": row.get("20"),
            "cv": row.get("21"),
            "hobby": row.get("23"),
            "specialty": row.get("25"),
            "color": row.get("26") or row.get("39"),
            "birthday": row.get("29"),
            "zodiac": row.get("30"),
            "former_job": row.get("31"),
            "unit_relation_candidate_f32": unit_relation_candidate,
            "unit_id": None,
            "unit_code": None,
            "unit_name": None,
            "representative_bg": row.get("38"),
            "_source": source(2, {
                "idol_id": 1,
                "idol_code": 10,
                "display_name": 12,
                "kana": 15,
                "age": 16,
                "height": 18,
                "weight": 19,
                "birthplace": 20,
                "cv": 21,
                "hobby": 23,
                "specialty": 25,
                "color": 26,
                "birthday": 29,
                "zodiac": 30,
                "former_job": 31,
                "unit_relation_candidate_f32": 32,
                "representative_bg": 38,
            }, row.get("_offset")),
        }
        idols.append(entry)
        idols_by_code[idol_code] = entry
        idols_by_numeric_id[str(idol_id)] = entry

    return {
        "idols": idols,
        "units": list(units_by_id.values()),
        "by_idol_code": idols_by_code,
        "by_numeric_id": idols_by_numeric_id,
        "by_unit_id": {str(key): value for key, value in units_by_id.items()},
        "meta": {"idol_count": len(idols), "unit_count": len(units_by_id)},
    }


def build_speaker_dictionary(tables: dict[int, list[dict[str, Any]]], idol_dictionary: dict[str, Any]) -> dict[str, Any]:
    speakers: dict[str, dict[str, Any]] = {}
    for idol in idol_dictionary.get("idols", []):
        code = idol.get("idol_code")
        if not code:
            continue
        speakers[code] = {
            "speaker_id": code,
            "speaker_type": "idol",
            "display_name": idol.get("display_name"),
            "kana": (idol.get("name_fields") or {}).get("kana"),
            "idol_id": idol.get("idol_id"),
            "unit_name": idol.get("unit_name"),
            "_source": idol.get("_source"),
        }

    for row in tables.get(29, []):
        label_id = row.get("1")
        label = row.get("2")
        if label_id is None or not isinstance(label, str):
            continue
        key = f"group:{label_id}"
        speakers[key] = {
            "speaker_id": key,
            "speaker_type": "group_label",
            "display_name": label,
            "_source": source(29, {"label_id": 1, "display_name": 2}, row.get("_offset")),
        }

    for row in tables.get(100, []):
        npc_id = row.get("1")
        name = row.get("2")
        code = row.get("4")
        if npc_id is None or not isinstance(name, str):
            continue
        key = code if isinstance(code, str) and code else f"npc:{npc_id}"
        speakers[key] = {
            "speaker_id": key,
            "speaker_type": "npc",
            "npc_id": npc_id,
            "display_name": name,
            "npc_code": code,
            "category": row.get("5"),
            "birthday": row.get("9"),
            "_source": source(100, {"npc_id": 1, "display_name": 2, "npc_code": 4, "category": 5, "birthday": 9}, row.get("_offset")),
        }

    return {"speakers": speakers, "meta": {"speaker_count": len(speakers)}}


def build_costume_dictionary(
    tables: dict[int, list[dict[str, Any]]],
    idol_dictionary: dict[str, Any],
    spine_ids: set[str],
    prefab_models: dict[str, Any],
) -> dict[str, Any]:
    idols_by_numeric = idol_dictionary.get("by_numeric_id", {})
    costumes_by_model: dict[str, dict[str, Any]] = {}
    table_counts = Counter()
    for table_id in (28, 27):
        for row in tables.get(table_id, []):
            model_resource_id = maybe_resource_id(row.get("5"))
            if not model_resource_id:
                continue
            idol_num = row.get("2") if isinstance(row.get("2"), int) else idol_id_from_resource(model_resource_id)
            idol = idols_by_numeric.get(str(idol_num)) if idol_num is not None else None
            existing = costumes_by_model.get(model_resource_id)
            sources = list(existing.get("_sources", [])) if existing else []
            sources.append(source(table_id, {
                "costume_id": 1,
                "idol_numeric_id": 2,
                "costume_name": 3,
                "description": 4,
                "model_resource_id": 5,
                "release_at": 6,
                "relation_id": 7,
            }, row.get("_offset")))
            costumes_by_model[model_resource_id] = {
                "costume_id": row.get("1"),
                "idol_numeric_id": idol_num,
                "idol_code": idol.get("idol_code") if idol else model_resource_id[:6],
                "idol_name": idol.get("display_name") if idol else None,
                "unit_name": idol.get("unit_name") if idol else None,
                "costume_name": row.get("3"),
                "description": row.get("4"),
                "model_resource_id": model_resource_id,
                "release_at": row.get("6"),
                "relation_id": row.get("7"),
                "spine_exists": model_resource_id in spine_ids if spine_ids else None,
                "prefab_meta_exists": model_resource_id in prefab_models if prefab_models else None,
                "source_tables": sorted({s["table"] for s in sources}),
                "_source": sources[-1],
                "_sources": sources,
            }
            table_counts[table_id] += 1

    return {
        "costumes": sorted(costumes_by_model.values(), key=lambda item: item["model_resource_id"]),
        "by_model_resource_id": costumes_by_model,
        "meta": {
            "costume_count": len(costumes_by_model),
            "source_row_counts": {str(key): value for key, value in sorted(table_counts.items())},
            "spine_index_available": bool(spine_ids),
            "prefab_meta_available": bool(prefab_models),
        },
    }


def enrich_resource_row(
    row: dict[str, Any],
    table_id: int,
    resource_field: str,
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    field_map: dict[str, int],
) -> dict[str, Any]:
    out = dict(row)
    resource_id = row.get(resource_field)
    if isinstance(resource_id, str):
        out["resource_id"] = resource_id
        out["compiled_resource_id"] = normalize_compiled_resource(resource_id)
        out["compiled_file"] = compiled_filename(resource_id, compiled_stems)
        out["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
        if out["compiled_file"]:
            summary = compiled_summaries.get(Path(out["compiled_file"]).stem)
            if summary:
                out["compiled_summary"] = summary
    out["_source"] = source(table_id, field_map, row.get("_offset"))
    return out


def build_home_interaction_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rows = []
    specs = [
        (32, "work_unlock", "10", {"id": 1, "unlock_text": 3, "base_resource_id": 9, "resource_id": 10}),
        (34, "birthday_unlock", "10", {"id": 1, "title": 3, "base_resource_id": 9, "resource_id": 10}),
        (104, "home_time_slot_resource", "4", {"id": 1, "base_resource_id": 3, "resource_id": 4, "start_time": 5, "end_time": 6}),
        (105, "home_schedule_time_slot", "5", {"id": 1, "base_resource_id": 4, "resource_id": 5, "start_time": 7, "end_time": 8}),
    ]
    for table_id, family, resource_key, field_map in specs:
        for row in tables.get(table_id, []):
            resource_id = row.get(resource_key)
            base_id = row.get("9") or row.get("3") or row.get("4")
            entry = enrich_resource_row(row, table_id, resource_key, compiled_stems, compiled_summaries, field_map)
            entry.update({
                "family": family,
                "title": row.get("3") if table_id in (32, 34) else None,
                "base_resource_id": base_id if isinstance(base_id, str) else None,
                "idol_numeric_id": idol_id_from_resource(resource_id) if isinstance(resource_id, str) else None,
            })
            rows.append(entry)

    by_family: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_idol: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_family[row["family"]].append(row)
        if row.get("idol_numeric_id") is not None:
            by_idol[str(row["idol_numeric_id"]).zfill(3)].append(row)
    return {
        "interactions": rows,
        "by_family": dict(by_family),
        "by_idol_numeric_id": dict(by_idol),
        "meta": {"interaction_count": len(rows)},
    }


def build_short_adv_profile_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    rows = []
    for row in tables.get(90, []):
        nested = row.get("3") if isinstance(row.get("3"), dict) else {}
        resource_id = nested.get("2") if isinstance(nested, dict) else None
        entry = dict(row)
        entry["resource_id"] = resource_id
        if isinstance(resource_id, str):
            entry["compiled_resource_id"] = normalize_compiled_resource(resource_id)
            entry["compiled_file"] = compiled_filename(resource_id, compiled_stems)
            entry["compiled_exists"] = compiled_exists(resource_id, compiled_stems)
            if entry["compiled_file"]:
                summary = compiled_summaries.get(Path(entry["compiled_file"]).stem)
                if summary:
                    entry["compiled_summary"] = summary
        entry["base_resource_id"] = nested.get("1") if isinstance(nested, dict) else None
        entry["idol_numeric_id"] = row.get("2")
        entry["cue_payload"] = nested
        entry["_source"] = source(90, {"id": 1, "idol_numeric_id": 2, "nested_payload": 3}, row.get("_offset"))
        rows.append(entry)
    return {"entries": rows, "meta": {"entry_count": len(rows)}}


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


def build_background_catalog(tables: dict[int, list[dict[str, Any]]], bg_dir: Path | None = None) -> dict[str, Any]:
    bg_files = {path.stem for path in bg_dir.glob("*.png")} if bg_dir and bg_dir.exists() else set()
    backgrounds: dict[str, dict[str, Any]] = {}
    for row in tables.get(107, []):
        bg_id = row.get("5")
        if not isinstance(bg_id, str):
            continue
        backgrounds.setdefault(bg_id, {
            "bg_resource_id": bg_id,
            "names": [],
            "descriptions": [],
            "picture_studio_spots": [],
            "asset_exists": bg_id in bg_files if bg_files else None,
            "_sources": [],
        })
        entry = backgrounds[bg_id]
        if row.get("2") not in entry["names"]:
            entry["names"].append(row.get("2"))
        if row.get("7") not in entry["descriptions"]:
            entry["descriptions"].append(row.get("7"))
        entry["picture_studio_spots"].append(row.get("1"))
        entry["_sources"].append(source(107, {"spot_name": 2, "bg_resource_id": 5, "description": 7}, row.get("_offset")))
    for row in tables.get(108, []):
        bg_id = row.get("6")
        if not isinstance(bg_id, str):
            continue
        backgrounds.setdefault(bg_id, {
            "bg_resource_id": bg_id,
            "names": [],
            "descriptions": [],
            "picture_studio_scenes": [],
            "effects": [],
            "asset_exists": bg_id in bg_files if bg_files else None,
            "_sources": [],
        })
        entry = backgrounds[bg_id]
        entry.setdefault("picture_studio_scenes", []).append({"id": row.get("1"), "variant": row.get("3")})
        if row.get("8") not in entry["descriptions"]:
            entry["descriptions"].append(row.get("8"))
        if isinstance(row.get("7"), str):
            entry.setdefault("effects", []).append(row.get("7"))
        entry["_sources"].append(source(108, {"scene_variant": 3, "bg_resource_id": 6, "effect": 7, "description": 8}, row.get("_offset")))
    for row in tables.get(110, []):
        bg_id = row.get("2")
        if not isinstance(bg_id, str):
            continue
        backgrounds.setdefault(bg_id, {
            "bg_resource_id": bg_id,
            "names": [],
            "descriptions": [],
            "asset_exists": bg_id in bg_files if bg_files else None,
            "_sources": [],
        })
        backgrounds[bg_id]["_sources"].append(source(110, {"bg_resource_id": 2}, row.get("_offset")))
    for entry in backgrounds.values():
        entry["_source"] = entry["_sources"][0] if entry["_sources"] else None
    return {"backgrounds": backgrounds, "meta": {"background_count": len(backgrounds), "asset_probe_available": bool(bg_files)}}


def build_music_catalog(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {}
    bgm = {}
    for row in tables.get(46, []):
        code = row.get("4")
        if not isinstance(code, str):
            continue
        songs[code] = {
            "song_code": code,
            "title": row.get("5"),
            "kana": row.get("6"),
            "credits": row.get("8"),
            "links": [value for value in (row.get("9"), row.get("10")) if isinstance(value, str)],
            "_source": source(46, {"song_code": 4, "title": 5, "kana": 6, "credits": 8, "links": 9}, row.get("_offset")),
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
    for row in tables.get(133, []):
        for field in ("3", "4", "5", "6"):
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
                "field": int(field),
            })
    return {"songs": songs, "bgm": bgm, "meta": {"song_count": len(songs), "bgm_count": len(bgm)}}


def build_face_dictionary(tables: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    faces = {}
    for row in tables.get(176, []):
        base = row.get("3")
        evolved = row.get("4")
        if not isinstance(base, str):
            continue
        faces[base] = {
            "base_face": base,
            "evolution_face": evolved,
            "_source": source(176, {"base_face": 3, "evolution_face": 4}, row.get("_offset")),
        }
    return {"faces": faces, "meta": {"face_count": len(faces)}}


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
    match = re.match(r"^(1_3_\d{5}_\d{2})_[a-z]$", resource_id)
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


def collect_card_home_voice_previews(
    card_voice_cues: list[dict[str, Any]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
) -> dict[str, dict[str, Any]]:
    if not compiled_dir or not compiled_dir.exists():
        return {}

    bases = {
        cue.get("scenario_base")
        for cue in card_voice_cues
        if isinstance(cue.get("scenario_base"), str)
    }
    base_to_file: dict[str, str] = {}
    for base in sorted(bases):
        file_name = compiled_filename(base, compiled_stems)
        if file_name:
            base_to_file[base] = file_name

    previews: dict[str, dict[str, Any]] = {}
    for base, file_name in base_to_file.items():
        path = compiled_dir / file_name
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            continue

        for step in data.get("steps") or []:
            if not isinstance(step, dict):
                continue
            dialogue = step.get("dialogue") if isinstance(step.get("dialogue"), dict) else {}
            voice = dialogue.get("voice")
            if not isinstance(voice, str):
                continue
            cue_id = Path(voice).stem
            if not cue_id.startswith(f"{base}_"):
                continue
            previews[cue_id] = {
                "compiled_file": file_name,
                "scenario_id": data.get("scenario_id"),
                "step_id": step.get("step_id"),
                "step_type": step.get("type"),
                "speaker": dialogue.get("speaker"),
                "text": dialogue.get("text"),
                "voice": voice,
                "lip": dialogue.get("lip"),
                "spines": (step.get("state") or {}).get("spines") or [],
                "preview_step": step,
                "_source": {
                    "compiled_file": file_name,
                    "scenario_base": base,
                    "cue": cue_id,
                },
            }

    return previews


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
        table_id = row.get("_top_field")
        if isinstance(table_id, int):
            out["_source"] = source(table_id, {"resource_id": int(resource_key)}, row.get("_offset"))
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
            "groups": story_tables.get("main_groups", []),
            "chapters": story_tables.get("main_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("main_episodes", [])],
        },
        "event": {
            "groups": story_tables.get("event_groups", []),
            "episodes": [row_with_file(row, "5") for row in story_tables.get("event_episodes", [])],
        },
        "unit_story": {
            "groups": story_tables.get("unit_groups", []),
            "chapters": story_tables.get("unit_chapters", []),
            "episodes": [row_with_file(row, "6") for row in story_tables.get("unit_episodes", [])],
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
    card_home_voice_previews: dict[str, dict[str, Any]],
    story_tables: dict[str, list[dict[str, Any]]],
    voice_stems: set[str],
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    cards_by_release_title: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
    for card in cards:
        release_at = card.get("18")
        title = card.get("40") or card.get("13")
        resource_id = card.get("14")
        if isinstance(release_at, int) and isinstance(title, str) and isinstance(resource_id, str):
            cards_by_release_title[(release_at, title)].append(card)

    release_series_by_card_id: dict[int, dict[str, Any]] = {}
    release_series_count = 0
    for (release_at, title), batch in cards_by_release_title.items():
        resource_ids = sorted({row.get("14") for row in batch if isinstance(row.get("14"), str)})
        if len(resource_ids) < 2:
            continue
        character_ids = sorted({resource_id[:6] for resource_id in resource_ids})
        digest = hashlib.sha1(title.encode("utf-8")).hexdigest()[:10]
        relation = {
            "series_id": f"release_{release_at}_{digest}",
            "title": title,
            "release_at": release_at,
            "card_count": len(resource_ids),
            "character_count": len(character_ids),
            "relation_type": "exact_release_timestamp_and_title",
            "_source": source(1, {"release_at": 18, "title": 40}),
        }
        release_series_count += 1
        for row in batch:
            card_id = row.get("1")
            if isinstance(card_id, int):
                release_series_by_card_id[card_id] = relation

    cues_by_card: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for cue in card_voice_cues:
        card_id = cue.get("card_id")
        if isinstance(card_id, int):
            enriched = dict(cue)
            preview = card_home_voice_previews.get(str(cue.get("cue")))
            if preview:
                enriched["preview"] = preview
                enriched["compiled_file"] = preview.get("compiled_file")
                enriched["compiled_exists"] = True
            elif isinstance(cue.get("scenario_base"), str):
                enriched["compiled_file"] = compiled_filename(cue["scenario_base"], compiled_stems)
                enriched["compiled_exists"] = bool(enriched["compiled_file"])
            cues_by_card[card_id].append(enriched)

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
            "release_series": release_series_by_card_id.get(card_id),
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
            "_source": source(1, {
                "card_id": 1,
                "character_numeric_id": 2,
                "rarity_enum": 3,
                "title_full": 13,
                "resource_id": 14,
                "release_at": 18,
                "normal_text": 19,
                "awakened_text": 22,
                "extra_text": 36,
                "title": 40,
            }, card.get("_offset")),
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
            "release_series_count": release_series_count,
        },
    }


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
    parser.add_argument("--out-dir", type=Path, default=Path(".analysis/masterdata"))
    parser.add_argument("--public-out-dir", type=Path)
    parser.add_argument("--compiled-dir", type=Path)
    parser.add_argument("--voice-dir", type=Path)
    parser.add_argument("--spines-index", type=Path)
    parser.add_argument("--prefab-meta", type=Path)
    parser.add_argument("--bg-dir", type=Path)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    decoded = xor_decode(args.input.read_bytes())
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)

    records = list(iter_top_records(decoded))
    compiled_stems = collect_compiled_stems(args.compiled_dir)
    compiled_summaries = collect_compiled_summaries(args.compiled_dir)
    voice_stems = collect_voice_stems(args.voice_dir)
    spine_ids = load_spine_ids(args.spines_index)
    prefab_models = load_prefab_models(args.prefab_meta)
    card_parameters = extract_card_parameters(records)
    story_tables = extract_scenario_titles(records)
    card_voice_cues = extract_card_voice_cues(records)
    card_home_voice_previews = collect_card_home_voice_previews(
        card_voice_cues,
        args.compiled_dir,
        compiled_stems,
    )
    catalog_tables = extract_table_rows(
        records,
        {2, 24, 27, 28, 29, 32, 34, 46, 90, 100, 101, 104, 105, 107, 108, 110, 112, 133, 159, 162, 165, 168, 176},
    )
    idol_unit_dictionary = build_idol_unit_dictionary(catalog_tables)
    speaker_dictionary = build_speaker_dictionary(catalog_tables, idol_unit_dictionary)
    costume_dictionary = build_costume_dictionary(catalog_tables, idol_unit_dictionary, spine_ids, prefab_models)
    home_interaction_index = build_home_interaction_index(catalog_tables, compiled_stems, compiled_summaries)
    short_adv_profile_index = build_short_adv_profile_index(catalog_tables, compiled_stems, compiled_summaries)
    seasonal_communication_index = build_seasonal_communication_index(catalog_tables, compiled_stems, compiled_summaries)
    background_catalog = build_background_catalog(catalog_tables, args.bg_dir)
    music_catalog = build_music_catalog(catalog_tables)
    face_dictionary = build_face_dictionary(catalog_tables)
    story_master_index = build_story_master_index(story_tables, compiled_stems, compiled_summaries)
    card_index = build_card_index(
        card_parameters,
        card_voice_cues,
        card_home_voice_previews,
        story_tables,
        voice_stems,
        compiled_stems,
        compiled_summaries,
    )
    validation_report = build_validation_report(
        story_tables,
        card_voice_cues,
        card_home_voice_previews,
        compiled_stems,
        voice_stems,
    )
    outputs = {
        "masterdata_table_scan.json": build_table_scan(records),
        "card_parameter_field1_extract.json": card_parameters,
        "story_related_tables_extract.json": story_tables,
        "card_voice_cue_field91_extract.json": card_voice_cues,
        "card_home_voice_preview_extract.json": card_home_voice_previews,
        "story_master_index.json": story_master_index,
        "card_index.json": card_index,
        "idol_unit_dictionary.json": idol_unit_dictionary,
        "speaker_dictionary.json": speaker_dictionary,
        "costume_dictionary.json": costume_dictionary,
        "home_interaction_index.json": home_interaction_index,
        "short_adv_profile_index.json": short_adv_profile_index,
        "seasonal_communication_index.json": seasonal_communication_index,
        "background_catalog.json": background_catalog,
        "music_catalog.json": music_catalog,
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
            "card_index.json",
            "idol_unit_dictionary.json",
            "speaker_dictionary.json",
            "costume_dictionary.json",
            "home_interaction_index.json",
            "short_adv_profile_index.json",
            "seasonal_communication_index.json",
            "background_catalog.json",
            "music_catalog.json",
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
