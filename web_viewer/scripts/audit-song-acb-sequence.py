#!/usr/bin/env python3
"""Read-only audit of RAW song3 ACB sequence/track-event parameters.

This intentionally preserves CRI command payloads as opaque data.  The output
can show that a cue has one or more sequence/track-event commands, and can
compare those signatures across songs and idol variants, but it does not label
an opcode as volume, pan, fade, or timing without a primary runtime mapping.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from cri_utf import UtfTable  # noqa: E402


SONG_VARIANT_RE = re.compile(r"_(\d{3}[a-z]{3})$", re.IGNORECASE)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def nested_table(row: dict[str, Any], name: str) -> UtfTable | None:
    payload = row.get(name)
    if not isinstance(payload, bytes) or not payload:
        return None
    try:
        return UtfTable(payload)
    except (IndexError, KeyError, ValueError) as exc:
        raise ValueError(f"invalid nested UTF table {name}: {exc}") from exc


def parse_command_stream(payload: bytes) -> list[dict[str, Any]]:
    commands: list[dict[str, Any]] = []
    cursor = 0
    while cursor + 3 <= len(payload):
        opcode, width = struct.unpack_from(">HB", payload, cursor)
        cursor += 3
        if cursor + width > len(payload):
            commands.append(
                {
                    "opcode": f"0x{opcode:04x}",
                    "width": width,
                    "payload_hex": payload[cursor:].hex(),
                    "truncated": True,
                }
            )
            return commands
        argument = payload[cursor : cursor + width]
        cursor += width
        item: dict[str, Any] = {
            "opcode": f"0x{opcode:04x}",
            "width": width,
            "payload_hex": argument.hex(),
        }
        if width == 4:
            item["payload_uint32"] = int.from_bytes(argument, "big")
            item["payload_float32"] = struct.unpack(">f", argument)[0]
        commands.append(item)
        if opcode == 0:
            break
    if cursor != len(payload):
        commands.append(
            {
                "opcode": "trailing",
                "width": len(payload) - cursor,
                "payload_hex": payload[cursor:].hex(),
                "truncated": True,
            }
        )
    return commands


def classify(stem: str) -> str:
    if stem.endswith("_bgm"):
        return "backing"
    if SONG_VARIANT_RE.search(stem):
        return "idol_variant"
    return "base_or_special"


def command_signature(commands: list[dict[str, Any]]) -> tuple[str, ...]:
    return tuple(
        f"{item['opcode']}:{item['width']}:{item['payload_hex']}"
        for item in commands
    )


def signature_id(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def audit_acb(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    top = UtfTable(data)
    root = top.rows[0]
    cue_table = nested_table(root, "CueTable")
    cue_names = nested_table(root, "CueNameTable")
    waveform_table = nested_table(root, "WaveformTable")
    sequence_commands = nested_table(root, "SeqCommandTable")
    track_events = nested_table(root, "TrackEventTable")
    references = nested_table(root, "AcfReferenceTable")

    sequence_records = [
        {
            "raw_hex": row["Command"].hex(),
            "commands": parse_command_stream(row["Command"]),
        }
        for row in (sequence_commands.rows if sequence_commands else [])
    ]
    track_event_records = [
        {
            "raw_hex": row["Command"].hex(),
            "commands": parse_command_stream(row["Command"]),
        }
        for row in (track_events.rows if track_events else [])
    ]
    category_names = sorted(
        row.get("Name", "")
        for row in (references.rows if references else [])
        if row.get("Type") == 3 and row.get("Name")
    )
    waveform_shapes = sorted(
        {
            (
                row.get("NumChannels"),
                row.get("SamplingRate"),
                row.get("NumSamples"),
                row.get("LoopFlag"),
                row.get("Streaming"),
                row.get("EncodeType"),
            )
            for row in (waveform_table.rows if waveform_table else [])
        }
    )
    cue_name_rows = cue_names.rows if cue_names else []
    cue_rows = cue_table.rows if cue_table else []
    cue_records = []
    for row in cue_name_rows:
        cue_index = row.get("CueIndex")
        cue = (
            cue_rows[cue_index]
            if isinstance(cue_index, int) and 0 <= cue_index < len(cue_rows)
            else {}
        )
        cue_records.append(
            {
                "name": row.get("CueName", ""),
                "cue_index": cue_index,
                "reference_type": cue.get("ReferenceType"),
                "reference_index": cue.get("ReferenceIndex"),
                "length_ms": cue.get("Length"),
            }
        )
    return {
        "source": f"RAW/audio/{path.name}",
        "size": len(data),
        "sha256": sha256(data),
        "kind": classify(path.stem[len("song3_") :]),
        "cue_count": len(cue_rows),
        "cue_names": [item["name"] for item in cue_records],
        "cues": cue_records,
        "category_names": category_names,
        "waveform_shapes": [list(shape) for shape in waveform_shapes],
        "sequence_commands": sequence_records,
        "track_event_commands": track_event_records,
        "sequence_opcodes": sorted(
            {
                item["opcode"]
                for record in sequence_records
                for item in record["commands"]
                if item["opcode"].startswith("0x")
            }
        ),
        "track_event_opcodes": sorted(
            {
                item["opcode"]
                for record in track_event_records
                for item in record["commands"]
                if item["opcode"].startswith("0x")
            }
        ),
    }


def build_summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    opcode_counts: Counter[str] = Counter()
    payload_counts: dict[str, Counter[str]] = defaultdict(Counter)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        sequence = record["sequence_commands"]
        track_events = record["track_event_commands"]
        for stream in (*sequence, *track_events):
            for command in stream["commands"]:
                opcode = command["opcode"]
                if not opcode.startswith("0x"):
                    continue
                opcode_counts[opcode] += 1
                payload_counts[opcode][command["payload_hex"]] += 1
        key = {
            "category_names": record["category_names"],
            "sequence": sequence,
            "track_events": track_events,
        }
        grouped[signature_id(key)].append(record)

    signatures = []
    for group_id, items in sorted(
        grouped.items(), key=lambda item: (-len(item[1]), item[0])
    ):
        first = items[0]
        signatures.append(
            {
                "id": group_id,
                "count": len(items),
                "kinds": dict(Counter(item["kind"] for item in items)),
                "examples": [item["source"] for item in items[:8]],
                "category_names": first["category_names"],
                "sequence_commands": first["sequence_commands"],
                "track_event_commands": first["track_event_commands"],
            }
        )

    return {
        "acb_count": len(records),
        "unique_signature_count": len(signatures),
        "kind_counts": dict(Counter(record["kind"] for record in records)),
        "opcode_counts": dict(sorted(opcode_counts.items())),
        "opcode_payloads": {
            opcode: [
                {"payload_hex": payload, "count": count}
                for payload, count in sorted(
                    payloads.items(), key=lambda item: (-item[1], item[0])
                )[:32]
            ]
            for opcode, payloads in sorted(payload_counts.items())
        },
        "signatures": signatures,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw-audio",
        type=Path,
        required=True,
        help="RAW/audio directory containing song3_*.acb",
    )
    parser.add_argument(
        "--pattern",
        default="song3_*.acb",
        help="glob below --raw-audio (default: song3_*.acb)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / ".analysis" / "song-acb-sequence-audit.json",
    )
    args = parser.parse_args()
    audio_root = args.raw_audio.resolve()
    files = sorted(path for path in audio_root.glob(args.pattern) if path.is_file())
    if not files:
        raise FileNotFoundError(f"no ACB files matched {audio_root / args.pattern}")
    records = [audit_acb(path) for path in files]
    result = {
        "schema_version": 1,
        "authority": "RAW/audio song3 ACB files",
        "scope": {
            "root_label": "RAW/audio",
            "pattern": args.pattern,
            "read_only": True,
        },
        "summary": build_summary(records),
        "files": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
