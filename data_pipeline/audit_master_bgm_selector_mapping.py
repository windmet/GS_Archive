"""Audit master table-133 BGM resources against RAW CRI ACB cue metadata.

This script keeps RAW immutable.  It decodes the relevant master-data rows,
reads only the small @UTF metadata in the ACB files, and combines that evidence
with the waveform-only vgmstream cue index.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from masterdata_extract import extract_table_rows, iter_top_records, xor_decode


UTF_TYPES: dict[int, tuple[str, int]] = {
    0x0: (">B", 1),
    0x1: (">b", 1),
    0x2: (">H", 2),
    0x3: (">h", 2),
    0x4: (">I", 4),
    0x5: (">i", 4),
    0x6: (">Q", 8),
    0x7: (">q", 8),
    0x8: (">f", 4),
    0xA: ("string", 4),
    0xB: ("data", 8),
}


class UtfTable:
    """Minimal read-only parser for the CRI @UTF tables used by these ACBs."""

    def __init__(self, payload: bytes) -> None:
        if payload[:4] != b"@UTF":
            raise ValueError("not a CRI @UTF table")
        self.payload = payload
        (
            _table_size,
            _unknown,
            row_offset,
            string_offset,
            data_offset,
            _table_name_offset,
            column_count,
            row_size,
            row_count,
        ) = struct.unpack_from(">IHHIIIHHI", payload, 4)
        self.row_base = row_offset + 8
        self.string_base = string_offset + 8
        self.data_base = data_offset + 8

        cursor = 0x20
        columns: list[tuple[str, int, int, Any]] = []
        for _ in range(column_count):
            field_type = payload[cursor]
            name_offset = struct.unpack_from(">I", payload, cursor + 1)[0]
            cursor += 5
            storage = field_type & 0xF0
            value_type = field_type & 0x0F
            name = self._cstring(self.string_base + name_offset)
            if storage in (0x30, 0x70):
                constant, cursor = self._read_value(cursor, value_type)
            elif storage == 0x10:
                constant = 0
            elif storage == 0x50:
                constant = None
            else:
                raise ValueError(f"unsupported @UTF storage 0x{storage:02x}")
            columns.append((name, storage, value_type, constant))

        self.rows: list[dict[str, Any]] = []
        for row_number in range(row_count):
            cursor = self.row_base + row_number * row_size
            row: dict[str, Any] = {}
            for name, storage, value_type, constant in columns:
                if storage == 0x50:
                    value, cursor = self._read_value(cursor, value_type)
                else:
                    value = constant
                row[name] = value
            self.rows.append(row)

    def _cstring(self, offset: int) -> str:
        end = self.payload.index(0, offset)
        return self.payload[offset:end].decode("utf-8")

    def _read_value(self, offset: int, value_type: int) -> tuple[Any, int]:
        kind, size = UTF_TYPES[value_type]
        if kind == "string":
            string_offset = struct.unpack_from(">I", self.payload, offset)[0]
            return self._cstring(self.string_base + string_offset), offset + size
        if kind == "data":
            data_offset, data_size = struct.unpack_from(">II", self.payload, offset)
            start = self.data_base + data_offset
            return self.payload[start : start + data_size], offset + size
        return struct.unpack_from(kind, self.payload, offset)[0], offset + size


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def nested_table(top: UtfTable, name: str) -> UtfTable:
    payload = top.rows[0].get(name)
    if not isinstance(payload, bytes) or not payload:
        raise ValueError(f"ACB has no non-empty {name}")
    return UtfTable(payload)


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


def master_table_133(path: Path) -> list[dict[str, Any]]:
    records = list(iter_top_records(xor_decode(path.read_bytes())))
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
    parser.add_argument("--master-data", type=Path, required=True)
    parser.add_argument("--music-catalog", type=Path, required=True)
    parser.add_argument("--cue-index", type=Path, required=True)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = master_table_133(args.master_data.resolve())
    music_catalog = json.loads(args.music_catalog.read_text(encoding="utf-8"))
    waveform_index = json.loads(args.cue_index.read_text(encoding="utf-8")).get(
        "cues", {}
    )

    seasonal_banks = sorted({row["seasonal_bank"] for row in rows})
    acb_names = ["bgm_system", *seasonal_banks]
    action_cues: dict[str, list[dict[str, Any]]] = defaultdict(list)
    inspected_banks: list[dict[str, Any]] = []
    for bank in acb_names:
        acb = args.raw_root.resolve() / "audio" / f"{bank}.acb"
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
        bank_path = args.raw_root.resolve() / "audio" / f"{resource}.acb"
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
            "client_master_data": sha256_file(args.master_data.resolve()),
            "music_catalog": sha256_file(args.music_catalog.resolve()),
            "cue_index": sha256_file(args.cue_index.resolve()),
        },
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
            "master": "XOR-decoded client_master_data table 133",
            "waveforms": "vgmstream cue_index.json",
            "controls": "ACB @UTF CueName/Cue/Sequence/ActionTrack tables",
            "selected_target_rule": (
                "the one ActionTrack target whose command index occurs once "
                "when the other five targets share a command index"
            ),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "output": str(args.output.resolve()),
        "table_133_rows": len(rows),
        "music_catalog_bgm": len(resources),
        "classification_counts": dict(sorted(classification_counts.items())),
        "switch_selected_waveforms": len(selected_mappings),
        "unresolved": report["unresolved"],
        "structural_anomalies": structural_anomalies,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
