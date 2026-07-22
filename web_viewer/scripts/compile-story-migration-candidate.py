"""Compile one raw story group into an isolated migration candidate directory.

This intentionally never writes to public/data/compiled. It reuses one
ScenarioCompiler state machine for every lettered raw part, relinks voice cues,
and then emits independently auditable episode artifacts.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from scenario_compiler import ScenarioCompiler  # noqa: E402


PART_PATTERN = re.compile(r"^scenario_(?P<part>.+_[a-z])\.json$")


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256_bytes(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def build_source_evidence(paths: list[Path], source_files: list[str]) -> dict[str, Any]:
    if len(paths) != len(source_files) or not paths:
        raise ValueError("Source evidence requires matching non-empty path and source-file lists")
    records = sorted([
        {"path": source_file.replace("\\", "/"), "raw_hash": sha256_bytes(path.read_bytes())}
        for path, source_file in zip(paths, source_files, strict=True)
    ], key=lambda record: record["path"])
    if len(records) == 1:
        raw_hash = records[0]["raw_hash"]
        hash_format = "sha256-raw-file-v1"
    else:
        manifest = {"format": "story-raw-group-v1", "files": records}
        canonical = json.dumps(
            manifest,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        raw_hash = sha256_bytes(canonical)
        hash_format = "sha256-group-manifest-v1"
    parent_paths = {str(Path(record["path"]).parent).replace("\\", "/") for record in records}
    return {
        "raw_path": parent_paths.pop() if len(parent_paths) == 1 else ".",
        "raw_hash": raw_hash,
        "raw_hash_format": hash_format,
        "raw_files": records,
    }


def discover_parts(raw_group_dir: Path, group_id: str) -> list[tuple[Path, str]]:
    entries: list[tuple[Path, str]] = []
    for path in raw_group_dir.glob(f"scenario_{group_id}_*.json"):
        match = PART_PATTERN.fullmatch(path.name)
        if match:
            entries.append((path, match.group("part")))
    entries.sort(key=lambda entry: entry[0].name)
    if len(entries) < 2:
        raise ValueError(
            f"Expected at least two lettered raw parts for {group_id}; found {len(entries)} in {raw_group_dir}"
        )
    return entries


def expand_expected_parts(value: str, group_id: str) -> list[str]:
    if not value:
        return []
    suffixes: list[str] = []
    for token in (part.strip().lower() for part in value.split(",")):
        if not token:
            continue
        if re.fullmatch(r"[a-z]-[a-z]", token):
            start, end = token.split("-", 1)
            if ord(start) > ord(end):
                raise ValueError(f"Invalid descending part range: {token}")
            suffixes.extend(chr(code) for code in range(ord(start), ord(end) + 1))
        elif re.fullmatch(r"[a-z]", token):
            suffixes.append(token)
        else:
            raise ValueError(f"Invalid expected part token: {token}")
    return [f"{group_id}_{suffix}" for suffix in dict.fromkeys(suffixes)]


def load_voice_names(voice_index_path: Path) -> set[str]:
    payload = load_json(voice_index_path)
    index = payload.get("index", payload) if isinstance(payload, dict) else payload
    if isinstance(index, dict):
        return set(index.keys())
    if isinstance(index, list):
        return {str(value) for value in index}
    raise ValueError(f"Unsupported voice index shape: {voice_index_path}")


def voice_suffix_map(voice_names: set[str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for filename in sorted(voice_names):
        stem = filename[:-4] if filename.endswith(".m4a") else filename
        suffix = stem.rsplit("_", 1)[-1]
        result.setdefault(suffix, []).append(filename)
    return result


def resolve_voice(voice: str, scenario_id: str, voice_names: set[str], suffixes: dict[str, list[str]]) -> str | None:
    if voice in voice_names:
        return voice
    voice_key = voice[:-4] if voice.endswith(".m4a") else voice
    suffix = voice_key.rsplit("_", 1)[-1]
    candidates = suffixes.get(suffix, [])
    if len(candidates) == 1:
        return candidates[0]
    for candidate in candidates:
        stem = candidate[:-4] if candidate.endswith(".m4a") else candidate
        prefix = stem[: -(len(suffix) + 1)] if len(stem) > len(suffix) else ""
        if prefix and prefix in scenario_id:
            return candidate
    return candidates[0] if candidates else None


def relink_voices(scenario: dict[str, Any], voice_names: set[str]) -> dict[str, int]:
    suffixes = voice_suffix_map(voice_names)
    resolved = 0
    unresolved = 0
    references = 0
    scenario_id = str(scenario.get("scenario_id", ""))
    for step in scenario.get("steps", []):
        dialogue = step.get("dialogue")
        voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
        if not voice:
            continue
        references += 1
        match = resolve_voice(str(voice), scenario_id, voice_names, suffixes)
        if match:
            dialogue["voice"] = match
            resolved += 1
        else:
            unresolved += 1
    return {"references": references, "resolved": resolved, "unresolved": unresolved}


def split_episodes(scenario: dict[str, Any]) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    steps = scenario.get("steps", [])
    for episode in scenario.get("episodes", []):
        source_id = str(episode.get("source_scenario_id", ""))
        start = int(episode.get("start_step_index", 0))
        end = int(episode.get("end_step_index", -1))
        if not source_id or start < 0 or end < start or end >= len(steps):
            raise ValueError(f"Invalid episode boundary: {episode}")
        if source_id in output:
            raise ValueError(f"Duplicate episode identity: {source_id}")

        first_step_id = int(episode.get("start_step_id", start + 1))
        last_step_id = int(episode.get("end_step_id", end + 1))
        local_steps = copy.deepcopy(steps[start : end + 1])
        for step in local_steps:
            step["step_id"] = int(step.get("step_id", first_step_id)) - first_step_id + 1
            step["episode_index"] = 0
            for option in step.get("options", []):
                target = option.get("step_id")
                if target is None:
                    continue
                target = int(target)
                if target < first_step_id or target > last_step_id:
                    raise ValueError(f"Cross-episode choice in {source_id}: step {target}")
                option["step_id"] = target - first_step_id + 1

        jump_points = {
            label: int(target) - first_step_id + 1
            for label, target in scenario.get("jump_points", {}).items()
            if first_step_id <= int(target) <= last_step_id
        }
        local_episode = copy.deepcopy(episode)
        local_episode.update(
            {
                "episode_index": 0,
                "episode_no": 1,
                "start_step_index": 0,
                "start_step_id": 1,
                "end_step_index": len(local_steps) - 1,
                "end_step_id": len(local_steps),
                "step_count": len(local_steps),
            }
        )
        output[source_id] = {
            "scenario_id": source_id,
            "text_catalog_id": scenario.get("text_catalog_id", scenario.get("scenario_id")),
            "text_contract_version": scenario.get("text_contract_version", 1),
            "total_steps": len(local_steps),
            "steps": local_steps,
            "jump_points": jump_points,
            "episodes": [local_episode],
            "source": copy.deepcopy(scenario.get("source")),
            "aggregate_source": {
                "file": f"{scenario.get('scenario_id')}.json",
                "scenario_id": scenario.get("scenario_id"),
                "start_step_index": start,
                "end_step_index": end,
            },
        }
    return output


def compile_candidate(args: argparse.Namespace) -> dict[str, Any]:
    output_dir = Path(args.output_dir).resolve()
    if output_dir == PROJECT_ROOT or PROJECT_ROOT in output_dir.parents:
        raise ValueError("Candidate output must be outside the web_viewer workspace")
    if output_dir.exists() and any(output_dir.iterdir()):
        raise ValueError(f"Candidate output directory must be empty: {output_dir}")

    expected_parts = expand_expected_parts(args.expected_parts, args.group_id)
    if args.raw_file:
        if expected_parts:
            raise ValueError("--expected-parts is only valid with --raw-group-dir")
        raw_file = Path(args.raw_file).resolve()
        raw_paths = [raw_file]
        part_id = raw_file.stem.removeprefix("scenario_")
        source_files = [f"scenariodata/{raw_file.parent.name}/{raw_file.name}"]
        scenario = ScenarioCompiler(
            load_json(raw_file),
            args.group_id,
            part_id,
            source_files[0],
        ).compile()
        compilation_mode = "standalone"
    else:
        raw_group_dir = Path(args.raw_group_dir).resolve()
        parts = discover_parts(raw_group_dir, args.group_id)
        raw_paths = [path for path, _ in parts]
        discovered_part_ids = [part_id for _, part_id in parts]
        if expected_parts and discovered_part_ids != expected_parts:
            raise ValueError(
                f"Raw part set mismatch for {args.group_id}: expected {expected_parts}, found {discovered_part_ids}"
            )
        raw_data = [load_json(path) for path, _ in parts]
        part_ids = [part_id for _, part_id in parts]
        source_files = [f"scenariodata/{raw_group_dir.name}/{path.name}" for path, _ in parts]
        scenario = ScenarioCompiler.compile_group(raw_data, args.group_id, part_ids, source_files)
        compilation_mode = "group"

    scenario["source"] = build_source_evidence(raw_paths, source_files)

    voice_stats = {"references": 0, "resolved": 0, "unresolved": 0}
    if args.voice_index:
        voice_stats = relink_voices(scenario, load_voice_names(Path(args.voice_index).resolve()))

    aggregate_path = output_dir / f"{args.group_id}.json"
    save_json(aggregate_path, scenario)

    episodes = split_episodes(scenario)
    for source_id, episode in episodes.items():
        save_json(output_dir / "episodes" / f"{source_id}.json", episode)

    manifest = {
        "schema_version": 1,
        "group_id": args.group_id,
        "compilation_mode": compilation_mode,
        "expected_parts": expected_parts,
        "raw_parts": source_files,
        "aggregate_file": aggregate_path.name,
        "episode_files": [f"episodes/{source_id}.json" for source_id in sorted(episodes)],
        "aggregate_steps": len(scenario.get("steps", [])),
        "episode_steps": {source_id: episode["total_steps"] for source_id, episode in sorted(episodes.items())},
        "voice_linking": voice_stats,
    }
    save_json(output_dir / "migration_candidate_manifest.json", manifest)
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--raw-group-dir")
    source.add_argument("--raw-file")
    parser.add_argument("--group-id", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument(
        "--expected-parts",
        default="",
        help="Optional comma/range list such as a-j; compilation fails unless the discovered part set matches exactly.",
    )
    parser.add_argument(
        "--voice-index",
        default=str(PROJECT_ROOT / "public" / "data" / "compiled" / "voice_index.json"),
        help="Set to an empty string to skip voice relinking.",
    )
    return parser.parse_args()


def main() -> None:
    manifest = compile_candidate(parse_args())
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
