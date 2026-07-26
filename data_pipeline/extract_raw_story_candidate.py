"""Extract and compile one story from SideM RAW without touching public data."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

import UnityPy

from scenario_compiler import ScenarioCompiler


LETTERED_PART = re.compile(r"^(?P<base>.+)_(?P<letter>[a-z])$")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def text_asset_bytes(data: Any) -> bytes:
    script = data.m_Script
    return script.encode("utf-8") if isinstance(script, str) else bytes(script)


def extract_text_asset_records(bundle: Path) -> list[dict[str, Any]]:
    """Return TextAssets with the Unity container path that gives them identity."""
    environment = UnityPy.load(str(bundle))
    records = []
    for container_path, obj in environment.container.items():
        if obj.type.name != "TextAsset":
            continue
        data = obj.read()
        records.append(
            {
                "name": str(data.m_Name),
                "payload": text_asset_bytes(data),
                "container_path": str(container_path).replace("\\", "/"),
                "path_id": obj.path_id,
            }
        )
    return sorted(
        records,
        key=lambda record: (
            record["container_path"],
            record["name"],
            record["path_id"],
        ),
    )


def extract_text_assets(bundle: Path) -> list[tuple[str, bytes]]:
    """Compatibility wrapper for extractors that do not need container identity."""
    return [
        (str(record["name"]), bytes(record["payload"]))
        for record in extract_text_asset_records(bundle)
    ]


def group_scenario_assets(
    records: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Recover semantic scenario identity from Unity container directories."""
    by_directory: dict[str, list[dict[str, Any]]] = defaultdict(list)
    excluded: list[dict[str, Any]] = []
    for record in records:
        name = str(record["name"])
        payload = bytes(record["payload"])
        if not name.startswith("scenario_"):
            excluded.append(
                {
                    "text_asset": name,
                    "container_path": record["container_path"],
                    "path_id": record["path_id"],
                    "reason": "non_scenario_name",
                }
            )
            continue
        try:
            parsed = json.loads(payload.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            excluded.append(
                {
                    "text_asset": name,
                    "container_path": record["container_path"],
                    "path_id": record["path_id"],
                    "reason": "invalid_json",
                    "error": str(error),
                }
            )
            continue
        part_id = name.removeprefix("scenario_")
        container_path = Path(str(record["container_path"]))
        directory = container_path.parent.as_posix()
        by_directory[directory].append(
            {
                "part_id": part_id,
                "parsed": parsed,
                "payload": payload,
                "text_asset": name,
                "container_path": str(record["container_path"]),
                "path_id": record["path_id"],
            }
        )

    groups: dict[str, dict[str, Any]] = {}
    for directory, directory_records in sorted(by_directory.items()):
        namespace = Path(directory).name
        all_lettered = all(
            LETTERED_PART.match(str(record["part_id"]))
            for record in directory_records
        )
        resource_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        if all_lettered and len(directory_records) >= 2:
            for record in directory_records:
                match = LETTERED_PART.match(str(record["part_id"]))
                assert match is not None
                resource_groups[match.group("base")].append(record)
        else:
            for record in directory_records:
                resource_groups[str(record["part_id"])].append(record)

        for resource_id, items in sorted(resource_groups.items()):
            scenario_id = (
                resource_id
                if namespace == resource_id
                else f"{namespace}_{resource_id}"
            )
            if scenario_id in groups:
                raise ValueError(
                    f"duplicate semantic scenario id {scenario_id!r} in {directory}"
                )
            groups[scenario_id] = {
                "scenario_id": scenario_id,
                "resource_id": resource_id,
                "namespace": namespace,
                "container_directory": directory,
                "items": sorted(items, key=lambda item: item["container_path"]),
            }
    return groups, excluded


def inspect_acb_cues(vgmstream: Path | None, acb: Path) -> list[str]:
    if vgmstream is None:
        return []
    cues = []
    for selection in range(1, 201):
        result = subprocess.run(
            [str(vgmstream), "-m", "-s", str(selection), str(acb)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        name = None
        for line in result.stdout.splitlines():
            if "stream name:" in line:
                name = line.split("stream name:", 1)[1].strip()
                break
        if not name:
            break
        cues.append(name)
    return cues


def relink_voices_from_raw_cues(
    scenario: dict[str, Any],
    audio_records: list[dict[str, Any]],
) -> dict[str, int]:
    cues_by_part = {
        str(record["part_id"]): set(record.get("cues") or [])
        for record in audio_records
    }
    all_cues = set().union(*cues_by_part.values()) if cues_by_part else set()
    stats = {"references": 0, "resolved": 0, "unresolved": 0, "ambiguous": 0}
    for step in scenario.get("steps") or []:
        dialogue = step.get("dialogue")
        voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
        if not voice:
            continue
        stats["references"] += 1
        evidence = step.get("evidence") if isinstance(step.get("evidence"), dict) else {}
        part_id = str(evidence.get("source_part_id") or "")
        part_cues = cues_by_part.get(part_id, set())
        stem = str(voice)
        if stem.lower().endswith(".m4a"):
            stem = stem[:-4]

        candidates = []
        if stem in all_cues:
            candidates = [stem]
        else:
            candidates = sorted(cue for cue in part_cues if cue.endswith(stem))
        if not candidates:
            tail = re.search(r"([a-z]\d+)$", stem, flags=re.IGNORECASE)
            if tail:
                candidates = sorted(
                    cue for cue in part_cues if cue.endswith(tail.group(1))
                )

        if len(candidates) == 1:
            dialogue["voice"] = f"{candidates[0]}.m4a"
            stats["resolved"] += 1
        elif len(candidates) > 1:
            stats["ambiguous"] += 1
        else:
            stats["unresolved"] += 1
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--scenario-id", required=True)
    parser.add_argument(
        "--scenario-container",
        type=Path,
        help="Explicit scenario bundle; required when the semantic ID is in an aggregate bundle",
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument(
        "--cue-index",
        type=Path,
        help="Full RAW cue index; preferred over probing ACB selections again",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_root = args.raw_root.resolve()
    output_dir = args.output_dir.resolve()
    scenario_bundle = (
        args.scenario_container.resolve()
        if args.scenario_container
        else raw_root / "asset" / f"scenario_{args.scenario_id}.unity3d"
    )
    if not scenario_bundle.is_file():
        raise FileNotFoundError(scenario_bundle)
    if args.vgmstream and not args.vgmstream.is_file():
        raise FileNotFoundError(args.vgmstream)
    if args.cue_index and not args.cue_index.is_file():
        raise FileNotFoundError(args.cue_index)

    all_groups, excluded = group_scenario_assets(
        extract_text_asset_records(scenario_bundle)
    )
    selected = all_groups.get(args.scenario_id)
    if selected is None:
        resource_matches = [
            group
            for group in all_groups.values()
            if group["resource_id"] == args.scenario_id
        ]
        if len(resource_matches) == 1:
            selected = resource_matches[0]
        else:
            raise RuntimeError(
                f"Scenario {args.scenario_id!r} is not uniquely present in "
                f"{scenario_bundle.name}; available semantic IDs: "
                f"{sorted(all_groups)[:50]!r}"
            )
    scenario_id = str(selected["scenario_id"])
    selected_items = selected["items"]

    scenario_dir = output_dir / "extracted" / "scenarios" / scenario_id
    lipsync_root = output_dir / "extracted" / "lipsync"
    compatibility_dir = output_dir / "compiled" / "compatibility"
    authoritative_dir = output_dir / "compiled" / "authoritative"
    scenario_dir.mkdir(parents=True, exist_ok=True)
    lipsync_root.mkdir(parents=True, exist_ok=True)
    compatibility_dir.mkdir(parents=True, exist_ok=True)
    authoritative_dir.mkdir(parents=True, exist_ok=True)

    scenario_records = []
    raw_data = []
    part_ids = []
    source_files = []

    for item in selected_items:
        name = str(item["text_asset"])
        payload = bytes(item["payload"])
        part_id = str(item["part_id"])
        destination = scenario_dir / f"{name}.json"
        destination.write_bytes(payload)
        raw_data.append(item["parsed"])
        part_ids.append(part_id)
        source_files.append(f"RAW/asset/{scenario_bundle.name}#{item['container_path']}")
        scenario_records.append(
            {
                "part_id": part_id,
                "text_asset": name,
                "container_path": item["container_path"],
                "path_id": item["path_id"],
                "output": str(destination),
                "size": len(payload),
                "sha256": sha256_bytes(payload),
            }
        )

    if not raw_data:
        raise RuntimeError(f"No scenario TextAssets found in {scenario_bundle}")

    compiled = ScenarioCompiler.compile_group(
        raw_data,
        scenario_id,
        part_ids,
        source_files,
    )

    cue_entries: dict[str, list[dict[str, Any]]] = {}
    cues_by_bank: dict[str, set[str]] = defaultdict(set)
    if args.cue_index:
        cue_document = json.loads(args.cue_index.read_text(encoding="utf-8"))
        cue_entries = cue_document.get("cues") or {}
        for cue, entries in cue_entries.items():
            for entry in entries:
                bank = Path(str(entry.get("source") or entry.get("bank") or "")).stem
                cues_by_bank[bank].add(cue)

    audio_banks = {
        part_id
        for part_id in part_ids
        if (raw_root / "audio" / f"{part_id}.acb").is_file()
    }
    if cue_entries:
        for step in compiled.get("steps") or []:
            stem = str(
                ((step.get("dialogue") or {}).get("voice"))
                if isinstance(step.get("dialogue"), dict)
                else ""
            )
            stem = stem[:-4] if stem.lower().endswith(".m4a") else stem
            for entry in cue_entries.get(stem) or []:
                audio_banks.add(
                    Path(str(entry.get("source") or entry.get("bank") or "")).stem
                )

    audio_records = []
    lipsync_records = []
    for bank in sorted(audio_banks):
        acb = raw_root / "audio" / f"{bank}.acb"
        if acb.is_file():
            audio_records.append(
                {
                    "part_id": bank,
                    "container": str(acb),
                    "container_sha256": sha256_file(acb),
                    "cues": (
                        sorted(cues_by_bank.get(bank) or [])
                        if cue_entries
                        else inspect_acb_cues(args.vgmstream, acb)
                    ),
                }
            )

        lipsync_bundle = raw_root / "asset" / f"lipsync_{bank}.unity3d"
        if lipsync_bundle.is_file():
            part_output = lipsync_root / bank
            part_output.mkdir(parents=True, exist_ok=True)
            assets = extract_text_assets(lipsync_bundle)
            for name, payload in assets:
                (part_output / f"{name}.json").write_bytes(payload)
            lipsync_records.append(
                {
                    "part_id": bank,
                    "container": str(lipsync_bundle),
                    "container_sha256": sha256_file(lipsync_bundle),
                    "text_asset_count": len(assets),
                    "text_assets": [name for name, _ in assets],
                }
            )

    compiled["source"] = {
        "raw_path": f"RAW/asset/{scenario_bundle.name}",
        "raw_hash": f"sha256:{sha256_file(scenario_bundle)}",
        "raw_hash_format": "sha256-unity3d-container-v1",
        "raw_files": [
            {
                "path": record["text_asset"],
                "raw_hash": f"sha256:{record['sha256']}",
            }
            for record in scenario_records
        ],
    }
    voice_relink = relink_voices_from_raw_cues(compiled, audio_records)
    compatibility_path = compatibility_dir / f"{scenario_id}.json"
    ScenarioCompiler.save_json(compiled, str(compatibility_path))
    authoritative = ScenarioCompiler.to_authoritative(
        compiled,
        compiler_version="raw-source-candidate-v1",
    )
    authoritative_path = authoritative_dir / f"{scenario_id}.json"
    ScenarioCompiler.save_json(authoritative, str(authoritative_path))

    manifest = {
        "schema_version": 2,
        "scenario_id": scenario_id,
        "requested_scenario_id": args.scenario_id,
        "resource_id": selected["resource_id"],
        "namespace": selected["namespace"],
        "container_directory": selected["container_directory"],
        "excluded_container_assets": excluded,
        "raw_root": str(raw_root),
        "scenario_container": {
            "path": str(scenario_bundle),
            "sha256": sha256_file(scenario_bundle),
        },
        "cue_index": (
            {
                "path": str(args.cue_index.resolve()),
                "sha256": sha256_file(args.cue_index.resolve()),
            }
            if args.cue_index
            else None
        ),
        "scenario_parts": scenario_records,
        "lipsync": lipsync_records,
        "audio": audio_records,
        "voice_relink": voice_relink,
        "compiled_compatibility": {
            "path": str(compatibility_path),
            "sha256": sha256_file(compatibility_path),
            "total_steps": compiled.get("total_steps"),
            "episode_count": len(compiled.get("episodes") or []),
        },
        "compiled_authoritative": {
            "path": str(authoritative_path),
            "sha256": sha256_file(authoritative_path),
            "step_count": len(authoritative.get("steps") or []),
            "episode_count": len(authoritative.get("episodes") or []),
        },
    }
    manifest_path = output_dir / "candidate_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
