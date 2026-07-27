"""Reconstruct a simple multi-track CRI ACB sequence as an auditable candidate."""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
from pathlib import Path
from typing import Any

from archive_paths import add_sources_config_argument, load_archive_sources
from cri_utf import UtfTable, nested_table, parse_track_commands, table_index_list
from extract_raw_audio_candidate import (
    decode_candidate,
    inspect_stream,
    probe_output,
    sha256_file,
    stream_aliases,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--cue-index", type=Path)
    parser.add_argument("--cue", required=True)
    parser.add_argument("--kind", choices=("song", "bgm", "ambient", "se"), required=True)
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument("--ffmpeg", type=Path)
    parser.add_argument("--ffprobe", type=Path)
    parser.add_argument("--evidence", action="append", default=[])
    return parser.parse_args()


def json_value(value: Any) -> Any:
    if isinstance(value, bytes):
        return {"hex": value.hex()}
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_value(item) for item in value]
    return value


def command_argument(commands: list[dict[str, Any]], command: str) -> bytes | None:
    matches = [
        bytes.fromhex(item["argument_hex"])
        for item in commands
        if item["command"] == command
    ]
    if len(matches) > 1:
        raise ValueError(f"track contains repeated {command} commands")
    return matches[0] if matches else None


def reference_index(argument: bytes, expected_type: int, label: str) -> int:
    if len(argument) != 4:
        raise ValueError(f"{label} reference is not four bytes: {argument.hex()}")
    reference_type, index = struct.unpack(">HH", argument)
    if reference_type != expected_type:
        raise ValueError(
            f"{label} reference type {reference_type} != expected {expected_type}"
        )
    return index


def match_selection(
    entries: list[dict[str, Any]],
    vgmstream: Path,
    source: Path,
    cue: str,
    awb_id: int,
    expected_samples: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    inspected: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for entry in entries:
        metadata = inspect_stream(vgmstream, source, int(entry["selection"]))
        if metadata and cue in stream_aliases(metadata):
            inspected.append((entry, metadata))
    sample_matches = [
        pair
        for pair in inspected
        if abs(int(pair[1].get("numberOfSamples") or -10) - expected_samples) <= 1
    ]
    preferred = [
        pair for pair in sample_matches if int(pair[0]["selection"]) == awb_id + 1
    ]
    matches = preferred or sample_matches
    if len(matches) != 1:
        detail = [
            {
                "selection": entry.get("selection"),
                "samples": metadata.get("numberOfSamples"),
            }
            for entry, metadata in inspected
        ]
        raise RuntimeError(
            f"Cannot uniquely match waveform awb={awb_id}, samples={expected_samples}: "
            f"{detail!r}"
        )
    return matches[0]


def compose_candidate(
    ffmpeg: Path,
    segments: list[dict[str, Any]],
    destination: Path,
) -> None:
    command = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y"]
    for segment in segments:
        command.extend(["-i", str(segment["output_path"])])
    filters = [
        f"[{index}:a]adelay={segment['start_delay_ms']}:all=1[a{index}]"
        for index, segment in enumerate(segments)
    ]
    inputs = "".join(f"[a{index}]" for index in range(len(segments)))
    filters.append(
        f"{inputs}amix=inputs={len(segments)}:duration=longest:normalize=0[out]"
    )
    command.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[out]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(destination),
        ]
    )
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode:
        destination.unlink(missing_ok=True)
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_root = (args.raw_root or sources.raw_root).resolve()
    cue_index_path = (
        args.cue_index
        or sources.inventory_path("audio", "cue-index", "cue_index.json")
    ).resolve()
    output_root = (
        args.output_root or sources.inventory_path("audio")
    ).resolve()
    vgmstream = (args.vgmstream or sources.tool_file("vgmstream")).resolve()
    ffmpeg = (args.ffmpeg or sources.tool_file("ffmpeg")).resolve()
    ffprobe = (
        args.ffprobe
        or sources.ffprobe_file
        or ffmpeg.with_name("ffprobe.exe")
    ).resolve()
    for required in (cue_index_path, vgmstream, ffmpeg, ffprobe):
        if not required.is_file():
            raise FileNotFoundError(required)

    cue_index = json.loads(cue_index_path.read_text(encoding="utf-8"))
    entries = (cue_index.get("cues") or {}).get(args.cue) or []
    if len(entries) < 2:
        raise RuntimeError(f"Cue {args.cue!r} does not have multiple indexed waveforms")
    sources = {Path(str(entry["source"])).name for entry in entries}
    if len(sources) != 1:
        raise RuntimeError(f"Cue {args.cue!r} spans multiple ACB files: {sources!r}")
    source = raw_root / "audio" / sources.pop()
    if not source.is_file():
        raise FileNotFoundError(source)

    top = UtfTable(source.read_bytes())
    cue_names = nested_table(top, "CueNameTable").rows
    name_matches = [row for row in cue_names if row.get("CueName") == args.cue]
    if len(name_matches) != 1:
        raise RuntimeError(f"Expected one CueNameTable row, found {len(name_matches)}")
    cue_index_number = int(name_matches[0]["CueIndex"])
    cue_row = nested_table(top, "CueTable").rows[cue_index_number]
    if int(cue_row["ReferenceType"]) != 3:
        raise ValueError(f"Cue ReferenceType is {cue_row['ReferenceType']}, not Sequence (3)")

    sequence_index = int(cue_row["ReferenceIndex"])
    sequence_row = nested_table(top, "SequenceTable").rows[sequence_index]
    if int(sequence_row["Type"]) != 0:
        raise ValueError(f"Sequence Type is {sequence_row['Type']}, not Polyphonic (0)")
    track_indices = table_index_list(sequence_row["TrackIndex"])
    if len(track_indices) != int(sequence_row["NumTracks"]) or len(track_indices) < 2:
        raise ValueError("Sequence track index count is inconsistent")

    tracks = nested_table(top, "TrackTable").rows
    track_events = nested_table(top, "TrackEventTable").rows
    synths = nested_table(top, "SynthTable").rows
    waveforms = nested_table(top, "WaveformTable").rows
    track_commands = nested_table(top, "TrackCommandTable").rows
    seq_commands = nested_table(top, "SeqCommandTable").rows
    candidate_dir = output_root / args.kind / args.cue
    segment_dir = candidate_dir / "segments"
    segment_dir.mkdir(parents=True, exist_ok=True)

    segments: list[dict[str, Any]] = []
    for ordinal, track_index in enumerate(track_indices, start=1):
        track = tracks[track_index]
        event_index = int(track["EventIndex"])
        raw_event = track_events[event_index]["Command"]
        commands = parse_track_commands(raw_event)
        synth_argument = command_argument(commands, "0x07d0")
        if synth_argument is None:
            raise ValueError(f"Track {track_index} has no synth-reference command")
        synth_index = reference_index(synth_argument, 2, "synth")
        synth = synths[synth_index]
        waveform_index = reference_index(synth["ReferenceItems"], 1, "waveform")
        waveform = waveforms[waveform_index]
        delay_argument = command_argument(commands, "0x07d1")
        start_delay_ms = int.from_bytes(delay_argument, "big") if delay_argument else 0
        entry, metadata = match_selection(
            entries,
            vgmstream,
            source,
            args.cue,
            int(waveform["MemoryAwbId"]),
            int(waveform["NumSamples"]),
        )
        selection = int(entry["selection"])
        segment_path = segment_dir / f"{ordinal:02d}_selection_{selection}.m4a"
        decode_candidate(vgmstream, ffmpeg, source, selection, segment_path)
        track_command_index = int(track["CommandIndex"])
        segments.append(
            {
                "ordinal": ordinal,
                "track_index": track_index,
                "track": json_value(track),
                "event_index": event_index,
                "event_command_hex": raw_event.hex(),
                "event_commands": commands,
                "track_command": (
                    None
                    if track_command_index == 0xFFFF
                    else json_value(track_commands[track_command_index])
                ),
                "start_delay_ms": start_delay_ms,
                "synth_index": synth_index,
                "synth": json_value(synth),
                "waveform_index": waveform_index,
                "waveform": json_value(waveform),
                "selection": selection,
                "stream_metadata": metadata,
                "output_path": segment_path,
            }
        )

    destination = candidate_dir / f"{args.cue}.m4a"
    compose_candidate(ffmpeg, segments, destination)
    segment_manifest = []
    for segment in segments:
        output_path = segment.pop("output_path")
        segment_manifest.append(
            {
                **segment,
                "output": {
                    "path": str(output_path),
                    "size": output_path.stat().st_size,
                    "sha256": sha256_file(output_path),
                    "probe": probe_output(ffprobe, output_path),
                },
            }
        )
    sequence_command_index = int(sequence_row["CommandIndex"])
    manifest = {
        "schema_version": 2,
        "kind": args.kind,
        "cue": args.cue,
        "reconstruction": {
            "policy": "polyphonic_tracks_with_authored_start_delays",
            "unknown_commands": "preserved_in_event_commands_but_not_simulated",
        },
        "source": {
            "path": f"RAW/audio/{source.name}",
            "size": source.stat().st_size,
            "sha256": sha256_file(source),
            "cue_index_path": str(cue_index_path),
            "indexed_entries": entries,
        },
        "cue_table_index": cue_index_number,
        "cue_row": json_value(cue_row),
        "sequence_index": sequence_index,
        "sequence": json_value(sequence_row),
        "sequence_command": (
            None
            if sequence_command_index == 0xFFFF
            else json_value(seq_commands[sequence_command_index])
        ),
        "segments": segment_manifest,
        "evidence": args.evidence,
        "output": {
            "path": str(destination),
            "size": destination.stat().st_size,
            "sha256": sha256_file(destination),
            "probe": probe_output(ffprobe, destination),
        },
    }
    manifest_path = candidate_dir / "candidate.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
