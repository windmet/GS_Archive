"""Audit every RAW scenario bundle against compiler, voice, lipsync and public data."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from extract_raw_story_candidate import (
    LETTERED_PART,
    extract_text_asset_records,
    group_scenario_assets,
)
from scenario_compiler import ScenarioCompiler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--cue-index", type=Path, required=True)
    parser.add_argument("--compiled-root", type=Path, required=True)
    parser.add_argument("--source-manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def load_source_hashes(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    hashes: dict[str, str] = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            record = json.loads(line)
            relative_path = str(record.get("relative_path") or "").replace("\\", "/")
            if relative_path:
                hashes[relative_path] = str(record.get("sha256") or "")
    return hashes


def published_scenarios(compiled_root: Path) -> list[str]:
    stems = []
    for path in sorted(compiled_root.glob("*.json")):
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if isinstance(document, dict) and isinstance(document.get("steps"), list):
            stems.append(path.stem)
    return stems


def published_matches(identifier: str, published: list[str]) -> list[str]:
    suffix = f"_{identifier}"
    return [stem for stem in published if stem == identifier or stem.endswith(suffix)]


def voice_stem(step: dict[str, Any]) -> str:
    dialogue = step.get("dialogue")
    voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
    value = str(voice or "")
    return value[:-4] if value.lower().endswith(".m4a") else value


def source_part(step: dict[str, Any], fallback: str) -> str:
    evidence = step.get("evidence")
    if isinstance(evidence, dict) and evidence.get("source_part_id"):
        return str(evidence["source_part_id"])
    return fallback


def entry_bank(entry: dict[str, Any]) -> str:
    return Path(str(entry.get("source") or entry.get("bank") or "")).stem


def resolve_voice(
    stem: str,
    part_id: str,
    group_id: str,
    entries_by_cue: dict[str, list[dict[str, Any]]],
    cues_by_bank: dict[str, set[str]],
) -> dict[str, Any]:
    def resolved(cue: str, method: str) -> dict[str, Any] | None:
        entries = entries_by_cue.get(cue) or []
        if not entries:
            return None
        return {
            "status": "resolved",
            "method": method,
            "cue": cue,
            "banks": sorted({entry_bank(entry) for entry in entries}),
        }

    exact_entries = entries_by_cue.get(stem) or []
    if exact_entries:
        related = [
            entry
            for entry in exact_entries
            if entry_bank(entry) == part_id
            or entry_bank(entry).startswith(f"{part_id}_")
            or entry_bank(entry) == group_id
            or entry_bank(entry).startswith(f"{group_id}_")
        ]
        selected = related or exact_entries
        return {
            "status": "resolved",
            "method": "exact_cue",
            "cue": stem,
            "banks": sorted({entry_bank(entry) for entry in selected}),
        }

    pieces = stem.split("_")
    for split_at in range(1, len(pieces)):
        bank_prefix = "_".join(pieces[:split_at])
        cue_suffix = "_".join(pieces[split_at:])
        if cue_suffix in cues_by_bank.get(bank_prefix, set()):
            return {
                "status": "resolved",
                "method": "strip_container_bank_prefix",
                "cue": cue_suffix,
                "banks": [bank_prefix],
            }

    timed = re.match(r"^(?P<bank>.+_t\d+)_([a-z])(?P<number>\d+)$", stem)
    if timed:
        result = resolved(
            f"{timed.group('bank')}_{timed.group('number')}",
            "timed_bank_drop_part_letter",
        )
        if result:
            return result
        regular_bank = re.sub(r"_t\d+$", "", timed.group("bank"))
        result = resolved(
            f"{regular_bank}_{timed.group(2)}{timed.group('number')}",
            "timed_bank_regular_fallback",
        )
        if result:
            return result

    short = re.match(r"^(?P<letter>[a-z])(?P<number>\d+)$", stem)
    if short:
        part_match = LETTERED_PART.match(part_id)
        if part_match and part_match.group("letter") == short.group("letter"):
            result = resolved(
                f"{part_id}{short.group('number')}",
                "source_part_number",
            )
            if result:
                return result
        result = resolved(f"{group_id}_{stem}", "resource_prefix")
        if result:
            return result

    related_banks = [
        bank
        for bank in cues_by_bank
        if bank == part_id
        or bank.startswith(f"{part_id}_")
        or bank == group_id
        or bank.startswith(f"{group_id}_")
    ]
    cue_candidates = sorted(
        {
            cue
            for bank in related_banks
            for cue in cues_by_bank[bank]
            if cue.endswith(stem)
        }
    )
    if len(cue_candidates) == 1:
        cue = cue_candidates[0]
        return {
            "status": "resolved",
            "method": "related_bank_suffix",
            "cue": cue,
            "banks": sorted(
                {
                    entry_bank(entry)
                    for entry in entries_by_cue.get(cue) or []
                    if entry_bank(entry) in related_banks
                }
            ),
        }
    return {
        "status": "ambiguous" if cue_candidates else "unresolved",
        "method": None,
        "cue": None,
        "banks": [],
        "candidates": cue_candidates[:20],
    }


def main() -> None:
    args = parse_args()
    raw_root = args.raw_root.resolve()
    raw_assets = raw_root / "asset"
    cue_index_path = args.cue_index.resolve()
    compiled_root = args.compiled_root.resolve()
    source_hashes = load_source_hashes(
        args.source_manifest.resolve() if args.source_manifest else None
    )
    cue_index = json.loads(cue_index_path.read_text(encoding="utf-8"))
    entries_by_cue: dict[str, list[dict[str, Any]]] = cue_index.get("cues") or {}
    cues_by_bank: dict[str, set[str]] = defaultdict(set)
    for cue, entries in entries_by_cue.items():
        for entry in entries:
            cues_by_bank[entry_bank(entry)].add(cue)
    published = published_scenarios(compiled_root)
    lipsync_stems = {
        path.stem.removeprefix("lipsync_")
        for path in raw_assets.glob("lipsync_*.unity3d")
    }

    summary: Counter[str] = Counter()
    excluded_assets: list[dict[str, Any]] = []
    compile_errors: list[dict[str, Any]] = []
    unresolved_voices: list[dict[str, Any]] = []
    ambiguous_voices: list[dict[str, Any]] = []
    groups_document: dict[str, Any] = {}
    duplicate_group_ids: dict[str, list[str]] = defaultdict(list)
    all_referenced_voice_banks: set[str] = set()
    all_missing_lipsync_banks: set[str] = set()

    for bundle in sorted(raw_assets.glob("scenario_*.unity3d")):
        summary["scenario_bundles"] += 1
        records = extract_text_asset_records(bundle)
        summary["text_assets"] += len(records)
        groups, excluded = group_scenario_assets(records)
        for item in excluded:
            excluded_assets.append({"bundle": bundle.name, **item})
            summary[f"excluded_{item['reason']}"] += 1

        for scenario_id, group in sorted(groups.items()):
            summary["logical_groups"] += 1
            items = group["items"]
            resource_id = str(group["resource_id"])
            summary["valid_scenario_text_assets"] += len(items)
            part_ids = [str(item["part_id"]) for item in items]
            raw_data = [item["parsed"] for item in items]
            text_names = [str(item["text_asset"]) for item in items]
            try:
                compiled = ScenarioCompiler.compile_group(
                    raw_data,
                    scenario_id,
                    part_ids,
                    [
                        f"RAW/asset/{bundle.name}#{item['container_path']}"
                        for item in items
                    ],
                )
            except Exception as error:
                summary["compile_errors"] += 1
                compile_errors.append(
                    {
                        "bundle": bundle.name,
                        "scenario_id": scenario_id,
                        "resource_id": resource_id,
                        "part_ids": part_ids,
                        "error": repr(error),
                    }
                )
                continue

            summary["compiled_groups"] += 1
            summary["compiled_steps"] += len(compiled.get("steps") or [])
            group_voice = Counter()
            referenced_banks: set[str] = set()
            for step_index, step in enumerate(compiled.get("steps") or []):
                stem = voice_stem(step)
                if not stem:
                    continue
                summary["voice_references"] += 1
                group_voice["references"] += 1
                part_id = source_part(step, resource_id)
                resolution = resolve_voice(
                    stem,
                    part_id,
                    resource_id,
                    entries_by_cue,
                    cues_by_bank,
                )
                status = resolution["status"]
                method = resolution.get("method")
                summary[f"voice_{status}"] += 1
                group_voice[status] += 1
                if method:
                    summary[f"voice_method_{method}"] += 1
                    group_voice[f"method_{method}"] += 1
                referenced_banks.update(resolution.get("banks") or [])
                if status != "resolved":
                    record = {
                        "bundle": bundle.name,
                        "scenario_id": scenario_id,
                        "resource_id": resource_id,
                        "part_id": part_id,
                        "step_index": step_index,
                        "voice": stem,
                        "resolution": resolution,
                    }
                    target = (
                        ambiguous_voices if status == "ambiguous" else unresolved_voices
                    )
                    if len(target) < 200:
                        target.append(record)

            published_group = published_matches(scenario_id, published)
            part_matches = {
                part_id: published_matches(
                    (
                        part_id
                        if group["namespace"] == part_id
                        else f"{group['namespace']}_{part_id}"
                    ),
                    published,
                )
                for part_id in part_ids
            }
            represented_parts = sum(
                bool(part_matches[part_id] or published_group)
                for part_id in part_ids
            )
            summary["parts_represented_in_public"] += represented_parts
            summary["parts_without_public_match"] += len(part_ids) - represented_parts
            if len(published_group) == 1:
                summary["groups_with_unique_public_match"] += 1
            elif len(published_group) > 1:
                summary["groups_with_ambiguous_public_match"] += 1
            elif any(part_matches.values()):
                summary["groups_represented_by_part_files"] += 1
            else:
                summary["groups_without_public_match"] += 1

            missing_lipsync = sorted(
                bank for bank in referenced_banks if bank not in lipsync_stems
            )
            all_referenced_voice_banks.update(referenced_banks)
            all_missing_lipsync_banks.update(missing_lipsync)
            summary["voice_bank_relations"] += len(referenced_banks)
            summary["voice_bank_relations_with_lipsync"] += (
                len(referenced_banks) - len(missing_lipsync)
            )
            relative_bundle = f"asset/{bundle.name}"
            group_record = {
                "scenario_id": scenario_id,
                "resource_id": resource_id,
                "namespace": group["namespace"],
                "container_directory": group["container_directory"],
                "bundle": f"RAW/{relative_bundle}",
                "bundle_sha256": source_hashes.get(relative_bundle),
                "part_ids": part_ids,
                "text_assets": [
                    {
                        "name": item["text_asset"],
                        "container_path": item["container_path"],
                        "path_id": item["path_id"],
                    }
                    for item in items
                ],
                "step_count": len(compiled.get("steps") or []),
                "episode_count": len(compiled.get("episodes") or []),
                "voice": dict(sorted(group_voice.items())),
                "referenced_voice_banks": sorted(referenced_banks),
                "missing_lipsync_banks": missing_lipsync,
                "published_group_matches": published_group,
                "published_part_matches": part_matches,
            }
            if scenario_id in groups_document:
                duplicate_group_ids[scenario_id].append(bundle.name)
            else:
                groups_document[scenario_id] = group_record

    summary["duplicate_group_ids"] = len(duplicate_group_ids)
    summary["unique_referenced_voice_banks"] = len(all_referenced_voice_banks)
    summary["unique_referenced_voice_banks_with_lipsync"] = (
        len(all_referenced_voice_banks) - len(all_missing_lipsync_banks)
    )
    document = {
        "schema_version": 1,
        "sources": {
            "raw_root": str(raw_root),
            "cue_index": str(cue_index_path),
            "compiled_root": str(compiled_root),
            "source_manifest": (
                str(args.source_manifest.resolve()) if args.source_manifest else None
            ),
        },
        "summary": dict(sorted(summary.items())),
        "excluded_assets": excluded_assets,
        "compile_errors": compile_errors,
        "unresolved_voices": unresolved_voices,
        "ambiguous_voices": ambiguous_voices,
        "duplicate_group_ids": dict(sorted(duplicate_group_ids.items())),
        "groups": dict(sorted(groups_document.items())),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(document["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
