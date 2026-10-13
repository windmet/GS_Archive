"""Home stand voices: IdolSystemScenarios / CardSystemScenarios with their native conditions.

SystemScenarioData.ScriptName (field 1) names the compiled script; ScriptLabel (field 2) is a
jump point inside it. HomeIdol builds a SystemScenarioDecider over the current card's and the
idol's HomeStand rows; this projection keeps every condition the decider reads.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any
from .compiled_inputs import load_scenario_payloads
from .provenance import source

# SystemScenarioType from the il2cpp protobuf schema.
SCENARIO_TYPES = {1: "HomeStand", 2: "HomeCard", 3: "HomeSetting", 4: "IdolDetail", 5: "Training",
                  6: "LiveResult", 7: "ReliabilityRankUp", 8: "HomeStandCard", 9: "LiveStartButtonVoice"}
HOME_STAND = 1
SYSTEM_SCENARIO_FIELDS = {"script_name": 1, "script_label": 2, "open_month": 3, "close_month": 4,
                          "open_time": 5, "close_time": 6, "type": 13, "param1": 14, "param2": 15}


def system_scenario(payload: Any) -> dict[str, Any]:
    """Protobuf defaults are explicit: absent numbers are 0, absent strings empty."""
    payload = payload if isinstance(payload, dict) else {}
    result = {}
    for name, field in SYSTEM_SCENARIO_FIELDS.items():
        value = payload.get(str(field))
        result[name] = value if value is not None else ("" if field in (1, 2, 5, 6) else 0)
    return result


def script_file(script_name: str, compiled_stems: set[str]) -> str | None:
    """A ScriptName resolves to exactly one compiled stem: itself or `<prefix>_<ScriptName>`."""
    if not script_name:
        return None
    matches = sorted(stem for stem in compiled_stems if stem == script_name or stem.endswith(f"_{script_name}"))
    return f"{matches[0]}.json" if len(matches) == 1 else None


def jump_step(payload: Any, label: str) -> tuple[int | None, dict[str, Any] | None]:
    """A compiled jump point holds the step_id the label lands on (step ids start at 1)."""
    jumps = payload.get("jump_points") if isinstance(payload, dict) else None
    steps = payload.get("steps") if isinstance(payload, dict) else None
    step_id = jumps.get(label) if isinstance(jumps, dict) else None
    if not isinstance(step_id, int) or not isinstance(steps, list):
        return None, None
    step = next((row for row in steps if isinstance(row, dict) and row.get("step_id") == step_id), None)
    dialogue = step.get("dialogue") if step else None
    return step_id, step if isinstance(dialogue, dict) and dialogue.get("voice") else None


def build_home_system_voice_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
    idol_unit_dictionary: dict[str, Any],
) -> dict[str, Any]:
    idols_by_numeric = idol_unit_dictionary.get("by_numeric_id") or {}
    idol_rows = [row for row in tables.get(90, []) if system_scenario(row.get("3"))["type"] == HOME_STAND]
    files = {row_scenario["script_name"]: script_file(row_scenario["script_name"], compiled_stems)
             for row_scenario in (system_scenario(row.get("3")) for row in idol_rows)}
    payloads = load_scenario_payloads(compiled_dir, [name for name in files.values() if name])

    idols: dict[int, dict[str, Any]] = {}
    unresolved = []
    for row in idol_rows:
        scenario = system_scenario(row.get("3"))
        idol_id = row.get("2")
        identity = idols_by_numeric.get(str(idol_id)) or {}
        compiled_file = files.get(scenario["script_name"])
        index, step = jump_step(payloads.get(compiled_file), scenario["script_label"]) if compiled_file else (None, None)
        dialogue = step.get("dialogue") if step else {}
        voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
        if not step or Path(str(voice)).stem != scenario["script_label"]:
            unresolved.append({"id": row.get("1"), "script_name": scenario["script_name"],
                               "script_label": scenario["script_label"], "compiled_file": compiled_file,
                               "jump_step_id": index, "voice": voice})
            continue
        idol = idols.setdefault(idol_id, {"idol_numeric_id": idol_id, "idol_code": identity.get("idol_code"),
                                          "display_name": identity.get("display_name"), "scenarios": []})
        idol["scenarios"].append({
            "id": row.get("1"),
            **scenario,
            "compiled_file": compiled_file,
            "scenario_id": payloads[compiled_file].get("scenario_id"),
            "jump_step_id": index,
            "step_id": step.get("step_id"),
            "voice": voice,
            "speaker": dialogue.get("speaker"),
            "text": dialogue.get("text"),
            "preview_step": step,
            "_source": source(90, {"id": 1, "idol_numeric_id": 2, "system_scenario": 3}, row.get("_offset")),
        })

    cards: dict[str, list[dict[str, Any]]] = {}
    card_type_counts: dict[str, int] = {}
    for row in tables.get(91, []):
        scenario = system_scenario(row.get("4"))
        card_type_counts[str(scenario["type"])] = card_type_counts.get(str(scenario["type"]), 0) + 1
        if scenario["type"] != HOME_STAND:
            continue
        cards.setdefault(str(row.get("2")), []).append({
            "id": row.get("1"),
            "card_id": row.get("2"),
            "override_idol_system_scenario_id": row.get("3") or 0,
            **scenario,
            "_source": source(91, {"id": 1, "card_id": 2, "override_idol_system_scenario_id": 3,
                                   "system_scenario": 4}, row.get("_offset")),
        })

    idol_type_counts: dict[str, int] = {}
    for row in tables.get(90, []):
        kind = str(system_scenario(row.get("3"))["type"])
        idol_type_counts[kind] = idol_type_counts.get(kind, 0) + 1
    idol_list = sorted(idols.values(), key=lambda item: item["idol_numeric_id"])
    for idol in idol_list:
        idol["scenarios"].sort(key=lambda item: item["id"])
    scenarios = [scenario for idol in idol_list for scenario in idol["scenarios"]]
    return {
        "schema_version": 1,
        "authority": {
            "selection": "HomeIdol.SetData -> SystemScenarioDecider(idolId, cardId, type=HomeStand, recent=4)",
            "script": "SystemScenarioData.ScriptName names the compiled script; ScriptLabel is its jump point",
            "card_filter": "card rows with Param2 != 0 are excluded while the card is not awakened",
            "override": "a card row's OverrideIdolSystemScenarioId removes that idol row from the pool",
            "clock": "ServerDateTime.Now; month range may wrap the year; time is [open, close) anchored to the current date",
        },
        "scenario_types": {str(key): value for key, value in SCENARIO_TYPES.items()},
        "idols": idol_list,
        "card_home_stand": dict(sorted(cards.items(), key=lambda item: int(item[0]))),
        "unresolved": unresolved,
        "meta": {
            "idol_count": len(idol_list),
            "idol_home_stand_count": len(scenarios),
            "idol_source_row_count": len(tables.get(90, [])),
            "idol_type_counts": dict(sorted(idol_type_counts.items())),
            "card_source_row_count": len(tables.get(91, [])),
            "card_type_counts": dict(sorted(card_type_counts.items())),
            "card_home_stand_row_count": sum(len(rows) for rows in cards.values()),
            "month_conditioned_count": sum(1 for row in scenarios if (row["open_month"], row["close_month"]) != (1, 12)),
            "time_conditioned_count": sum(1 for row in scenarios if (row["open_time"], row["close_time"]) != ("00:00:00", "00:00:00")),
            "compiled_file_count": len({row["compiled_file"] for row in scenarios}),
            "unresolved_count": len(unresolved),
        },
    }
