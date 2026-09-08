"""Extract and compile one story from SideM RAW without touching public data."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


from archive_paths import add_sources_config_argument, load_archive_sources
from scenario_compiler import ScenarioCompiler
from sidem_scenario import LocalScenarioResources


# Compatibility exports for existing consumers; new readers import sidem_raw.
from sidem_raw import (LETTERED_PART, text_asset_bytes, extract_text_asset_records,
                       extract_text_assets, group_scenario_assets, relink_voices_from_raw_cues)
from sidem_raw.audio_probe import inspect_acb_cues


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--scenario-id", required=True)
    parser.add_argument(
        "--scenario-container",
        type=Path,
        help="Explicit scenario bundle; required when the semantic ID is in an aggregate bundle",
    )
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument(
        "--cue-index",
        type=Path,
        help="Full RAW cue index; preferred over probing ACB selections again",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_root = (args.raw_root or sources.raw_root).resolve()
    output_dir = (
        args.output_dir or sources.inventory_path(args.scenario_id)
    ).resolve()
    cue_index_path = (
        args.cue_index.resolve()
        if args.cue_index
        else sources.inventory_path("audio", "cue-index", "cue_index.json")
    )
    if not cue_index_path.is_file():
        if args.cue_index:
            raise FileNotFoundError(cue_index_path)
        cue_index_path = None
    vgmstream = (
        args.vgmstream.resolve()
        if args.vgmstream
        else sources.vgmstream_file
    )
    scenario_bundle = (
        args.scenario_container.resolve()
        if args.scenario_container
        else raw_root / "asset" / f"scenario_{args.scenario_id}.unity3d"
    )
    if not scenario_bundle.is_file():
        raise FileNotFoundError(scenario_bundle)
    if vgmstream is not None and not vgmstream.is_file():
        raise FileNotFoundError(vgmstream)
    if cue_index_path is None and vgmstream is None:
        raise ValueError(
            "a cue index or configured/provided vgmstream executable is required"
        )

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
        resources=LocalScenarioResources.from_archive_sources(sources),
    )

    cue_entries: dict[str, list[dict[str, Any]]] = {}
    cues_by_bank: dict[str, set[str]] = defaultdict(set)
    if cue_index_path:
        cue_document = json.loads(cue_index_path.read_text(encoding="utf-8"))
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
                        else inspect_acb_cues(vgmstream, acb)
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
                "path": str(cue_index_path),
                "sha256": sha256_file(cue_index_path),
            }
            if cue_index_path
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
