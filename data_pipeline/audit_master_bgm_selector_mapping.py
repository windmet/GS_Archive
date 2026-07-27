"""Audit master table-133 BGM resources against RAW CRI ACB cue metadata.

This script keeps RAW immutable.  It decodes the relevant master-data rows,
reads only the small @UTF metadata in the ACB files, and combines that evidence
with the waveform-only vgmstream cue index.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from archive_paths import (
    MASTERDATA_INPUT_STATES,
    add_sources_config_argument,
    load_archive_sources,
)
from cri_utf import UtfTable, nested_table
from masterdata_extract import (
    decode_masterdata_input,
    extract_table_rows,
    iter_top_records,
)

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
def inspect_action_cues(acb: Path) -> dict[str, dict[str, Any]]:
    top = UtfTable(acb.read_bytes())
    cue_names = nested_table(top, "CueNameTable").rows
    cues = nested_table(top, "CueTable").rows
    sequences = nested_table(top, "SequenceTable").rows
    action_tracks = nested_table(top, "ActionTrackTable").rows

    name_by_index = {row["CueIndex"]: row["CueName"] for row in cue_names}
    name_by_id = {
        cue["CueId"]: name_by_index[index]
        for index, cue in enumerate(cues)
        if index in name_by_index
    }
    results: dict[str, dict[str, Any]] = {}
    for cue_index, cue_name in name_by_index.items():
        cue = cues[cue_index]
        sequence = sequences[cue["ReferenceIndex"]]
        action_count = sequence.get("NumActionTracks", 0)
        action_start = sequence.get("ActionTrackStartIndex", 0xFFFF)
        if not action_count or action_start == 0xFFFF:
            continue

        actions = action_tracks[action_start : action_start + action_count]
        targets = [
            {
                "cue_id": action.get("TargetId"),
                "cue": name_by_id.get(action.get("TargetId")),
                "command_index": action.get("CommandIndex"),
                "target_acb": action.get("TargetAcbName"),
            }
            for action in actions
        ]
        command_counts = Counter(item["command_index"] for item in targets)
        selected = [
            item
            for item in targets
            if command_counts[item["command_index"]] == 1
            and len(command_counts) > 1
        ]
        results[cue_name] = {
            "cue_index": cue_index,
            "cue_id": cue.get("CueId"),
            "length": cue.get("Length"),
            "related_waveforms": cue.get("NumRelatedWaveforms"),
            "action_track_count": action_count,
            "controlled_targets": targets,
            "selected_target": selected[0] if len(selected) == 1 else None,
        }
    return results


def master_table_133(path: Path, input_state: str) -> list[dict[str, Any]]:
    records = list(
        iter_top_records(decode_masterdata_input(path.read_bytes(), input_state))
    )
    rows = extract_table_rows(records, {133})[133]
    return [
        {
            "row_id": row.get("1"),
            "season_id": row.get("2"),
            "source_selector": row.get("3"),
            "seasonal_bank": row.get("4"),
            "seasonal_base_cue": row.get("5"),
            "seasonal_selector": row.get("6"),
            "_source": {
                "table": 133,
                "offset": row.get("_offset"),
                "fields": {
                    "row_id": 1,
                    "season_id": 2,
                    "source_selector": 3,
                    "seasonal_bank": 4,
                    "seasonal_base_cue": 5,
                    "seasonal_selector": 6,
                },
            },
        }
        for row in rows
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--master-data", type=Path)
    parser.add_argument(
        "--master-data-state",
        choices=MASTERDATA_INPUT_STATES,
        default="xor",
    )
    parser.add_argument("--music-catalog", type=Path)
    parser.add_argument("--cue-index", type=Path)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    master_data = (
        args.master_data or sources.masterdata_input(args.master_data_state)
    ).resolve()
    music_catalog_path = (
        args.music_catalog
        or sources.published_path("data", "masterdata", "music_catalog.json")
    ).resolve()
    cue_index_path = (
        args.cue_index
        or sources.inventory_path("audio", "cue-index", "cue_index.json")
    ).resolve()
    raw_root = (args.raw_root or sources.raw_root).resolve()
    output = (
        args.output
        or sources.inventory_path(
            "audio", "master-bgm", "selector_mapping.json"
        )
    ).resolve()

    rows = master_table_133(master_data, args.master_data_state)
    music_catalog = json.loads(music_catalog_path.read_text(encoding="utf-8"))
    waveform_index = json.loads(cue_index_path.read_text(encoding="utf-8")).get(
        "cues", {}
    )

    seasonal_banks = sorted({row["seasonal_bank"] for row in rows})
    acb_names = ["bgm_system", *seasonal_banks]
    action_cues: dict[str, list[dict[str, Any]]] = defaultdict(list)
    inspected_banks: list[dict[str, Any]] = []
    for bank in acb_names:
        acb = raw_root / "audio" / f"{bank}.acb"
        bank_actions = inspect_action_cues(acb)
        inspected_banks.append(
            {
                "bank": bank,
                "path": f"RAW/audio/{acb.name}",
                "size": acb.stat().st_size,
                "sha256": sha256_file(acb),
                "action_cue_count": len(bank_actions),
            }
        )
        for cue, evidence in bank_actions.items():
            action_cues[cue].append(
                {"bank": bank, "path": f"RAW/audio/{acb.name}", **evidence}
            )

    table_roles: dict[str, set[str]] = defaultdict(set)
    table_relations: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        for role in (
            "source_selector",
            "seasonal_bank",
            "seasonal_base_cue",
            "seasonal_selector",
        ):
            resource = row[role]
            table_roles[resource].add(role)
            table_relations[resource].append(row["row_id"])

    resources: dict[str, dict[str, Any]] = {}
    for resource in sorted(music_catalog.get("bgm", {})):
        waveform_entries = waveform_index.get(resource, [])
        action_entries = action_cues.get(resource, [])
        bank_path = raw_root / "audio" / f"{resource}.acb"
        if waveform_entries:
            classification = "waveform_cue"
        elif action_entries:
            classification = (
                "switch_action_cue" if "_sw_" in resource else "base_action_cue"
            )
        elif bank_path.is_file():
            classification = "acb_bank"
        else:
            classification = "unresolved"
        resources[resource] = {
            "resource": resource,
            "classification": classification,
            "table_133_roles": sorted(table_roles.get(resource, set())),
            "table_133_row_ids": sorted(set(table_relations.get(resource, []))),
            "waveform_entries": waveform_entries,
            "action_entries": action_entries,
            "bank_path": f"RAW/audio/{bank_path.name}" if bank_path.is_file() else None,
        }

    classification_counts = Counter(
        record["classification"] for record in resources.values()
    )
    selected_mappings = {
        resource: record["action_entries"][0]["selected_target"]["cue"]
        for resource, record in resources.items()
        if record["classification"] == "switch_action_cue"
        and len(record["action_entries"]) == 1
        and record["action_entries"][0].get("selected_target")
    }
    relation_mappings = []
    for row in rows:
        source_record = resources[row["source_selector"]]
        base_record = resources[row["seasonal_base_cue"]]
        selector_record = resources[row["seasonal_selector"]]

        def action_resolution(record: dict[str, Any]) -> dict[str, Any]:
            action = (
                record["action_entries"][0]
                if len(record["action_entries"]) == 1
                else None
            )
            return {
                "classification": record["classification"],
                "bank": action.get("bank") if action else None,
                "selected_waveform": (
                    (action.get("selected_target") or {}).get("cue")
                    if action
                    else None
                ),
                "controlled_waveforms": (
                    [
                        target.get("cue")
                        for target in action.get("controlled_targets", [])
                    ]
                    if action
                    else []
                ),
            }

        relation_mappings.append({
            **row,
            "resolution": {
                "source_selector": action_resolution(source_record),
                "seasonal_bank": resources[row["seasonal_bank"]]["bank_path"],
                "seasonal_base_cue": action_resolution(base_record),
                "seasonal_selector": action_resolution(selector_record),
            },
        })

    structural_anomalies = []
    for resource, record in resources.items():
        if record["classification"] not in {
            "base_action_cue",
            "switch_action_cue",
        }:
            continue
        actions = record["action_entries"]
        if len(actions) != 1:
            structural_anomalies.append(
                f"{resource}: expected one ACB action-cue definition, found {len(actions)}"
            )
            continue
        action = actions[0]
        if action.get("related_waveforms") != 0:
            structural_anomalies.append(
                f"{resource}: action cue unexpectedly reports related waveforms"
            )
        target_cues = [
            target.get("cue") for target in action.get("controlled_targets", [])
        ]
        missing_targets = [cue for cue in target_cues if cue not in waveform_index]
        if missing_targets:
            structural_anomalies.append(
                f"{resource}: controlled targets absent from waveform index {missing_targets}"
            )
        if (
            record["classification"] == "switch_action_cue"
            and not action.get("selected_target")
        ):
            structural_anomalies.append(
                f"{resource}: switch action has no unique selected target"
            )

    report = {
        "schema_version": 1,
        "master_table": 133,
        "source_hashes": {
            "client_master_data": sha256_file(master_data),
            "music_catalog": sha256_file(music_catalog_path),
            "cue_index": sha256_file(cue_index_path),
        },
        "masterdata_input_state": args.master_data_state,
        "table_133_row_count": len(rows),
        "music_catalog_bgm_count": len(resources),
        "classification_counts": dict(sorted(classification_counts.items())),
        "unresolved": [
            resource
            for resource, record in resources.items()
            if record["classification"] == "unresolved"
        ],
        "inspected_banks": inspected_banks,
        "switch_selected_waveforms": selected_mappings,
        "table_133_rows": rows,
        "table_133_relation_mappings": relation_mappings,
        "structural_anomalies": structural_anomalies,
        "resources": resources,
        "method": {
            "master": (
                f"{args.master_data_state}-state client_master_data table 133"
            ),
            "waveforms": "vgmstream cue_index.json",
            "controls": "ACB @UTF CueName/Cue/Sequence/ActionTrack tables",
            "selected_target_rule": (
                "the one ActionTrack target whose command index occurs once "
                "when the other five targets share a command index"
            ),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "output": str(output),
        "table_133_rows": len(rows),
        "music_catalog_bgm": len(resources),
        "classification_counts": dict(sorted(classification_counts.items())),
        "switch_selected_waveforms": len(selected_mappings),
        "unresolved": report["unresolved"],
        "structural_anomalies": structural_anomalies,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
