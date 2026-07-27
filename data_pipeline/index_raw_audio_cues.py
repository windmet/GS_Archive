"""Build a resumable cue-to-bank index from SideM RAW ACB/AWB audio."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Iterable

from archive_paths import add_sources_config_argument, load_archive_sources


FIELD_PATTERN = re.compile(r"^(?P<key>[^:]+):\s*(?P<value>.*)$")


def parse_metadata(stdout: str, *, single_stream_fallback: bool = False) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    current: dict[str, str] = {}
    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if line.startswith("metadata for "):
            if current:
                records.append(normalize_metadata(current, single_stream_fallback))
                current = {}
            continue
        match = FIELD_PATTERN.match(line)
        if match:
            current[match.group("key").strip().lower()] = match.group("value").strip()
    if current:
        records.append(normalize_metadata(current, single_stream_fallback))
    return [record for record in records if record.get("selection") and record.get("name")]


def integer_prefix(value: str) -> int | None:
    match = re.match(r"^-?\d+", value or "")
    return int(match.group()) if match else None


def duration_seconds(value: str) -> float | None:
    match = re.search(r"\((?:(\d+):)?(\d+):(\d+(?:\.\d+)?) seconds\)", value or "")
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2))
    seconds = float(match.group(3))
    return hours * 3600 + minutes * 60 + seconds


def normalize_metadata(
    fields: dict[str, str],
    single_stream_fallback: bool = False,
) -> dict[str, Any]:
    name = fields.get("stream name", "")
    return {
        "selection": integer_prefix(fields.get("stream index", ""))
        or (1 if single_stream_fallback and name else None),
        "name": name,
        "aliases": [part.strip() for part in name.split(";") if part.strip()],
        "total": integer_prefix(fields.get("stream count", ""))
        or (1 if single_stream_fallback and name else None),
        "sample_rate": integer_prefix(fields.get("sample rate", "")),
        "channels": integer_prefix(fields.get("channels", "")),
        "samples": integer_prefix(fields.get("stream total samples", "")),
        "duration": duration_seconds(fields.get("stream total samples", "")),
        "encoding": fields.get("encoding") or None,
        "layout": fields.get("layout") or None,
        "loop_start": integer_prefix(fields.get("loop start", "")),
        "loop_end": integer_prefix(fields.get("loop end", "")),
    }


def story_se_cues(compiled_root: Path) -> tuple[set[str], int, list[dict[str, str]]]:
    cues: set[str] = set()
    parsed = 0
    errors = []
    for path in compiled_root.rglob("*.json"):
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            errors.append({"path": str(path), "error": str(error)})
            continue
        parsed += 1
        for record in walk(document):
            se = record.get("se")
            if isinstance(se, dict):
                cue = se.get("cue")
                if isinstance(cue, str) and cue and cue != "0":
                    cues.add(cue)
            events = record.get("se_events")
            if isinstance(events, list):
                for event in events:
                    cue = event.get("cue") if isinstance(event, dict) else None
                    if isinstance(cue, str) and cue and cue != "0":
                        cues.add(cue)
    return cues, parsed, errors


def walk(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def source_for_bank(acb: Path) -> Path:
    awb = acb.with_suffix(".awb")
    return awb if awb.is_file() else acb


def cache_path(cache_root: Path, acb: Path) -> Path:
    return cache_root / f"{acb.name}.json"


def index_bank(vgmstream: Path, acb: Path, cache_root: Path) -> dict[str, Any]:
    source = source_for_bank(acb)
    result = subprocess.run(
        [str(vgmstream), "-m", str(source)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    streams = parse_metadata(result.stdout, single_stream_fallback=True)
    total = int(streams[0].get("total") or 1) if streams else 0
    # Do not use vgmstream's `-S 0` range mode here. Some CLI builds write WAV
    # files beside the source even when metadata-only mode is also requested.
    # Per-selection metadata calls are slower but keep RAW byte-for-byte clean.
    for selection in range(2, total + 1):
        selected = subprocess.run(
            [str(vgmstream), "-m", "-s", str(selection), str(source)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        parsed = parse_metadata(selected.stdout)
        if parsed:
            streams.extend(parsed)
    record = {
        "schema_version": 1,
        "bank": f"RAW/audio/{acb.name}",
        "source": f"RAW/audio/{source.name}",
        "external_awb": source.suffix.lower() == ".awb",
        "source_size": source.stat().st_size,
        "return_code": result.returncode,
        "stream_count": len(streams),
        "streams": streams,
        "stderr": result.stderr.strip() if not streams else "",
    }
    destination = cache_path(cache_root, acb)
    destination.write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return record


def load_record(path: Path) -> dict[str, Any] | None:
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    return record if record.get("schema_version") == 1 else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--compiled-root", type=Path)
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument("--bank-glob", action="append", default=[])
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--refresh", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_audio = (args.raw_root or sources.raw_root).resolve() / "audio"
    compiled_root = (
        args.compiled_root or sources.published_path("data", "compiled")
    ).resolve()
    output_root = (
        args.output_root or sources.inventory_path("audio", "cue-index")
    ).resolve()
    cache_root = output_root / "banks"
    cache_root.mkdir(parents=True, exist_ok=True)
    vgmstream = (args.vgmstream or sources.tool_file("vgmstream")).resolve()
    if not vgmstream.is_file():
        raise FileNotFoundError(vgmstream)

    patterns = args.bank_glob or ["*.acb"]
    selected: dict[str, Path] = {}
    for pattern in patterns:
        for path in raw_audio.glob(pattern):
            if path.is_file() and path.suffix.lower() == ".acb":
                selected[path.name.lower()] = path
    banks = [selected[key] for key in sorted(selected)]

    records: dict[str, dict[str, Any]] = {}
    pending = []
    for acb in banks:
        cached = None if args.refresh else load_record(cache_path(cache_root, acb))
        if cached is None:
            pending.append(acb)
        else:
            records[acb.name.lower()] = cached

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {
            executor.submit(index_bank, vgmstream, acb, cache_root): acb
            for acb in pending
        }
        for future in as_completed(futures):
            acb = futures[future]
            record = future.result()
            records[acb.name.lower()] = record
            completed = len(records)
            if completed % 100 == 0 or completed == len(banks):
                print(
                    f"[{completed}/{len(banks)}] {acb.name}: "
                    f"{record['stream_count']} streams"
                )

    # Aggregate every cached bank, not only this invocation's selection. This
    # makes repeated targeted passes converge on one authoritative index.
    all_records = []
    for path in sorted(cache_root.glob("*.json")):
        record = load_record(path)
        if record is not None:
            all_records.append(record)

    cue_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for bank in all_records:
        for stream in bank.get("streams") or []:
            for cue in stream.get("aliases") or []:
                cue_index[cue].append(
                    {
                        "bank": bank["bank"],
                        "source": bank["source"],
                        "selection": stream["selection"],
                        "stream_name": stream["name"],
                        "duration": stream["duration"],
                        "sample_rate": stream["sample_rate"],
                        "channels": stream["channels"],
                        "encoding": stream["encoding"],
                        "loop_start": stream["loop_start"],
                        "loop_end": stream["loop_end"],
                    }
                )

    target_cues, parsed_files, json_errors = story_se_cues(compiled_root)
    resolved = sorted(cue for cue in target_cues if cue in cue_index)
    missing = sorted(target_cues - set(resolved))
    non_waveform_cues: dict[str, dict[str, str]] = {}
    zero_stream_banks = [
        record for record in all_records if not (record.get("streams") or [])
    ]
    for cue in missing:
        encoded = cue.encode("utf-8")
        for bank in zero_stream_banks:
            source_name = Path(bank["source"]).name
            source_path = raw_audio / source_name
            try:
                contains_cue = encoded in source_path.read_bytes()
            except OSError:
                contains_cue = False
            if contains_cue:
                non_waveform_cues[cue] = {
                    "bank": bank["bank"],
                    "source": bank["source"],
                    "classification": "control_only_no_waveform",
                }
                break
    unclassified = sorted(set(missing) - set(non_waveform_cues))
    ambiguous = {
        cue: entries
        for cue, entries in cue_index.items()
        if cue in target_cues and len(entries) > 1
    }
    index_document = {
        "schema_version": 1,
        "indexed_banks": len(all_records),
        "indexed_streams": sum(record.get("stream_count", 0) for record in all_records),
        "unique_cues": len(cue_index),
        "cues": dict(sorted(cue_index.items())),
    }
    coverage = {
        "schema_version": 1,
        "compiled_json_files": parsed_files,
        "compiled_json_errors": json_errors,
        "target_story_se_cues": len(target_cues),
        "resolved_audio": len(resolved),
        "non_waveform_control": len(non_waveform_cues),
        "classified": len(resolved) + len(non_waveform_cues),
        "non_waveform_cues": non_waveform_cues,
        "unclassified": unclassified,
        "ambiguous": ambiguous,
        "indexed_banks": len(all_records),
        "selected_banks_this_run": len(banks),
        "newly_indexed_this_run": len(pending),
    }
    (output_root / "cue_index.json").write_text(
        json.dumps(index_document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_root / "story_se_coverage.json").write_text(
        json.dumps(coverage, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(coverage, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
