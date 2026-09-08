"""Build identity dictionaries from supplied masterdata rows and resource indexes.

No disk access or publication. Numeric unit candidates are not treated as
confirmed membership, and missing resource indexes remain unknown.
"""
import re
from collections import Counter
from typing import Any
from .provenance import source


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


