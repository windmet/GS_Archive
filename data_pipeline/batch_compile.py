"""
Batch compile all scenario JSON files with A-to-J story segment merging,
and link voice references to extracted M4A files.

Usage:
  python batch_compile.py                    # full pipeline
  python batch_compile.py --compile-only     # only compile scenarios
  python batch_compile.py --voice-only       # only relink voices
"""

import json
import os
import sys
import re
from copy import deepcopy
from collections import defaultdict
from scenario_compiler import ScenarioCompiler

SCENARIO_ROOT = r"E:\BaiduNetdiskDownload\SideM\scripts\scenariodata"
OUTPUT_DIR = os.path.abspath(r"E:\Web_build\SideM_Archived\web_viewer\public\data\compiled")
VOICE_INDEX = os.path.join(OUTPUT_DIR, "voice_index.json")
EPISODE_OUTPUT_DIR = os.path.join(OUTPUT_DIR, "episodes")

# Pattern for raw filename: scenario_{scenarioId}.json
RAW_RE = re.compile(r"^scenario_(.+)\.json$")


def get_scenario_voice_prefix(scenario_id: str) -> str:
    """Derive ACB voice prefix from scenario_id.

    The extracted M4A files have ACB cue names like {prefix}{suffix}.m4a
    where prefix is typically the scenario path fraction.
    For merged files (scenario_id = e.g. 1_4_001_00), prefix = '1_4_001_00_'.
    Returns empty string if prefix cannot be determined.
    """
    # Merged: scenario_id = '1_4_001_00' → prefix = '1_4_001_00_'
    m = re.match(r"^(\d[\d_]+[a-z0-9]+)", scenario_id)
    if m:
        return m.group(1) + "_"
    # Old format: '1_4_001_01_scenario_1_4_001_01_a' → try extracting the scenario part
    m = re.match(r"(.+?)_scenario_(.+)", scenario_id)
    if m:
        prefix = m.group(2).rstrip("_abcdefghij")
        if prefix:
            return prefix + "_"
    return ""


def parse_raw_filename(fn: str) -> str | None:
    """Extract scenarioId from raw filename. Returns None if no match."""
    m = RAW_RE.match(fn)
    return m.group(1) if m else None


def has_trailing_letter(sid: str) -> bool:
    """Check if scenario_id ends with _[a-z]."""
    return bool(re.search(r'_[a-z]$', sid))


def strip_trailing_letter(sid: str) -> str:
    """Remove trailing _[a-z] if present."""
    if has_trailing_letter(sid):
        return sid[:-2]
    return sid


def compile_batch():
    """
    Compile all scenario JSONs with A-to-J merge support.

    Strategy:
      1. Scan all raw files, group by parent directory.
      2. For each parent directory:
         a. If ALL files are lettered variants → merge groups by base ID
         b. If mixed (standalone + lettered) → compile individually
         c. If all standalone → compile individually
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Collect all raw files grouped by parent directory
    dirs: dict[str, list[tuple[str, str]]] = defaultdict(list)  # parent → [(fn, scenarioId)]

    for dirpath, _, filenames in os.walk(SCENARIO_ROOT):
        parent = os.path.basename(dirpath)
        for fn in filenames:
            if not fn.endswith(".json"):
                continue
            sid = parse_raw_filename(fn)
            if sid:
                dirs[parent].append((fn, sid))

    count = 0
    errors = []
    seen = set()

    for parent in sorted(dirs.keys()):
        entries = dirs[parent]
        # Check: is this directory ALL lettered?
        all_lettered = all(has_trailing_letter(sid) for _, sid in entries)

        if all_lettered and len(entries) >= 2:
            # ── Merge groups ──
            base_groups = defaultdict(list)  # base_id → [(fn, sid)]
            for fn, sid in entries:
                base_groups[strip_trailing_letter(sid)].append((fn, sid))

            for base_id, group in sorted(base_groups.items()):
                if len(group) < 2:
                    # Single lettered file in all-lettered dir → compile normally
                    fn, sid = group[0]
                    in_path = os.path.join(SCENARIO_ROOT, parent, fn)
                    try:
                        data = ScenarioCompiler.load_json(in_path)
                        result = ScenarioCompiler(
                            data,
                            f"{parent}_{sid}",
                            sid,
                            f"scenariodata/{parent}/{fn}",
                        ).compile()
                        out_name = f"{parent}_{sid}.json"
                        out_path = os.path.join(OUTPUT_DIR, out_name)
                        ScenarioCompiler.save_json(result, out_path)
                        count += 1
                        print(f"  {parent}_{sid} → {out_name} ({result['total_steps']} steps)")
                    except Exception as e:
                        errors.append(f"{parent}/{fn}: {e}")
                    continue

                # ── Merge group ──
                raw_data_list = []
                part_ids = []
                source_files = []
                for fn, sid in sorted(group, key=lambda x: x[0]):
                    in_path = os.path.join(SCENARIO_ROOT, parent, fn)
                    raw_data_list.append(ScenarioCompiler.load_json(in_path))
                    part_ids.append(sid)
                    source_files.append(f"scenariodata/{parent}/{fn}")

                try:
                    merge_key = f"{parent}_{base_id}" if parent != base_id else base_id
                    result = ScenarioCompiler.compile_group(
                        raw_data_list,
                        merge_key,
                        part_ids,
                        source_files,
                    )

                    out_name = f"{merge_key}.json"
                    out_path = os.path.join(OUTPUT_DIR, out_name)
                    ScenarioCompiler.save_json(result, out_path)
                    count += 1
                    print(f"  {merge_key:45s} → {out_name} ({result['total_steps']} steps, {len(group)} files merged)")
                except Exception as e:
                    errors.append(f"{parent}/{base_id}: {e}")

        else:
            # ── Individual compilation ──
            for fn, sid in sorted(entries, key=lambda x: x[0]):
                in_path = os.path.join(SCENARIO_ROOT, parent, fn)
                try:
                    data = ScenarioCompiler.load_json(in_path)
                    full_id = f"{parent}_{sid}"
                    result = ScenarioCompiler(
                        data,
                        full_id,
                        sid,
                        f"scenariodata/{parent}/{fn}",
                    ).compile()

                    out_name = f"{full_id}.json"
                    out_path = os.path.join(OUTPUT_DIR, out_name)

                    if out_name in seen:
                        print(f"  ⚠ collision: {full_id}")
                        out_name = f"{full_id}_{hash(in_path) & 0xFFFF}.json"
                        out_path = os.path.join(OUTPUT_DIR, out_name)
                    seen.add(out_name)

                    ScenarioCompiler.save_json(result, out_path)
                    count += 1
                except Exception as e:
                    errors.append(f"{parent}/{fn}: {e}")

    # Generate manifest
    manifest = []
    for fn in sorted(os.listdir(OUTPUT_DIR)):
        if fn.endswith(".json") and fn not in ("manifest.json", "voice_index.json", "index.json"):
            manifest.append(fn)
    with open(os.path.join(OUTPUT_DIR, "manifest.json"), "w") as f:
        json.dump({"count": len(manifest), "files": manifest}, f, indent=2)

    print(f"\nCompiled {count} scenarios → {OUTPUT_DIR}")
    for e in errors:
        print(f"  ✗ {e}")
    return errors


def split_compiled_episodes():
    """Write independently loadable episode files from merged scenarios.

    The merged result remains the compatibility artifact and state-machine
    source. Slicing that result preserves inherited audio/scene state while
    restoring the raw one-file-per-episode playback boundary.
    """
    os.makedirs(EPISODE_OUTPUT_DIR, exist_ok=True)
    expected_files = set()
    source_owners = {}
    written = 0

    for fn in sorted(os.listdir(OUTPUT_DIR)):
        if not fn.endswith(".json") or fn in ("voice_index.json", "manifest.json", "index.json"):
            continue
        path = os.path.join(OUTPUT_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                scenario = json.load(f)
        except Exception:
            continue

        episodes = scenario.get("episodes", [])
        if len(episodes) < 2:
            continue

        for episode in episodes:
            source_id = episode.get("source_scenario_id", "")
            start = int(episode.get("start_step_index", 0))
            end = int(episode.get("end_step_index", -1))
            if not source_id or start < 0 or end < start or end >= len(scenario.get("steps", [])):
                raise ValueError(f"Invalid episode boundary in {fn}: {episode}")
            if source_id in source_owners and source_owners[source_id] != fn:
                raise ValueError(f"Episode id collision: {source_id} in {source_owners[source_id]} and {fn}")
            source_owners[source_id] = fn

            first_step_id = int(episode.get("start_step_id", start + 1))
            last_step_id = int(episode.get("end_step_id", end + 1))
            steps = deepcopy(scenario["steps"][start:end + 1])
            for step in steps:
                step["step_id"] = int(step.get("step_id", first_step_id)) - first_step_id + 1
                step["episode_index"] = 0
                for option in step.get("options", []):
                    target = option.get("step_id")
                    if target is None:
                        continue
                    target = int(target)
                    if target < first_step_id or target > last_step_id:
                        raise ValueError(f"Cross-episode choice in {fn}: {source_id} -> step {target}")
                    option["step_id"] = target - first_step_id + 1

            jump_points = {
                label: int(target) - first_step_id + 1
                for label, target in scenario.get("jump_points", {}).items()
                if first_step_id <= int(target) <= last_step_id
            }
            local_episode = deepcopy(episode)
            local_episode.update({
                "episode_index": 0,
                "episode_no": 1,
                "start_step_index": 0,
                "start_step_id": 1,
                "end_step_index": len(steps) - 1,
                "end_step_id": len(steps),
                "step_count": len(steps),
            })
            result = {
                "scenario_id": source_id,
                "text_catalog_id": scenario.get("text_catalog_id", scenario.get("scenario_id", fn[:-5])),
                "text_contract_version": scenario.get("text_contract_version", 1),
                "total_steps": len(steps),
                "steps": steps,
                "jump_points": jump_points,
                "episodes": [local_episode],
                "aggregate_source": {
                    "file": fn,
                    "scenario_id": scenario.get("scenario_id", fn[:-5]),
                    "start_step_index": start,
                    "end_step_index": end,
                },
            }
            out_name = f"{source_id}.json"
            with open(os.path.join(EPISODE_OUTPUT_DIR, out_name), "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            expected_files.add(out_name)
            written += 1

    for fn in os.listdir(EPISODE_OUTPUT_DIR):
        if fn.endswith(".json") and fn != "manifest.json" and fn not in expected_files:
            os.remove(os.path.join(EPISODE_OUTPUT_DIR, fn))

    with open(os.path.join(EPISODE_OUTPUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"count": len(expected_files), "files": sorted(expected_files)}, f, indent=2)
    print(f"Episode artifacts: {written} files -> {EPISODE_OUTPUT_DIR}")


def link_voices():
    """
    Post-process compiled scenarios to resolve voice references against
    extracted M4A filenames (cue names from ACB).

    Compiled step voice references are bare suffixes like 'a1003.m4a'.
    Extracted M4A files have full ACB cue names like '1_4_001_00_a1003.m4a'.

    Strategy: build a reverse index from bare suffix to all matching
    extracted filenames. Most suffixes are unique; for ambiguous cases
    (same suffix in multiple scenarios), disambiguate by checking
    which prefix matches the compiled scenario_id.
    """
    if not os.path.exists(VOICE_INDEX):
        print("No voice_index.json found. Run extract_voice.py first.")
        return

    with open(VOICE_INDEX, "r", encoding="utf-8") as f:
        voice_data = json.load(f)
    extracted = voice_data.get("index", voice_data) if isinstance(voice_data, dict) else voice_data
    extracted_m4as = set(extracted.keys())

    # Build reverse index: suffix → [full filenames]
    suffix_map = {}
    for fn in extracted_m4as:
        # Extract the trailing suffix after the last underscore before .m4a
        # e.g. '1_4_001_00_a1003.m4a' → suffix 'a1003'
        base = fn[:-4]  # remove .m4a
        idx = base.rfind("_")
        if idx >= 0:
            suffix = base[idx + 1:]
        else:
            suffix = base
        suffix_map.setdefault(suffix, []).append(fn)

    print(f"Extracted voice files: {len(extracted_m4as)}, unique suffixes: {len(suffix_map)}")

    resolved = 0
    unresolved = 0
    step_total = 0
    written = 0
    ambiguous_matched = 0

    compiled_dir = OUTPUT_DIR
    for fn in sorted(os.listdir(compiled_dir)):
        if not fn.endswith(".json") or fn in ("voice_index.json", "manifest.json", "index.json"):
            continue
        path = os.path.join(compiled_dir, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                scenario = json.load(f)
        except Exception:
            continue

        scenario_id = scenario.get("scenario_id", "")
        modified = False

        for step in scenario.get("steps", []):
            voice = step.get("dialogue", {}).get("voice", "")
            if not voice:
                continue
            step_total += 1

            voice_key = voice.replace(".m4a", "")

            matched = None

            # Case 1: direct match (bare suffix matches an extracted file)
            if voice in extracted_m4as:
                matched = voice

            # Case 2: suffix-based lookup
            if not matched:
                # Extract the actual suffix (last segment after _)
                vk_suffix = voice_key.split("_")[-1] if "_" in voice_key else voice_key
                candidates = suffix_map.get(vk_suffix, [])
                if len(candidates) == 0:
                    pass
                elif len(candidates) == 1:
                    matched = candidates[0]
                else:
                    # Ambiguous: pick the one whose prefix is contained in the scenario_id
                    for c in candidates:
                        c_base = c[:-4]  # remove .m4a
                        # Prefix = everything before the suffix (removing trailing underscore)
                        prefix_len = len(c_base) - len(vk_suffix) - 1
                        c_prefix = c_base[:prefix_len] if prefix_len > 0 else ""
                        if c_prefix and c_prefix in scenario_id:
                            matched = c
                            ambiguous_matched += 1
                            break
                    if not matched:
                        matched = candidates[0]
                        ambiguous_matched += 1

            if matched:
                step["dialogue"]["voice"] = matched
                resolved += 1
                modified = True
            else:
                unresolved += 1

        if modified:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(scenario, f, ensure_ascii=False, indent=2)
            written += 1

    print(f"Voice linking: {resolved}/{step_total} resolved, {unresolved} unresolved ({written} files updated, {ambiguous_matched} ambiguous)")


def main():
    do_compile = True
    do_voice = True

    if "--compile-only" in sys.argv:
        do_voice = False
    if "--voice-only" in sys.argv:
        do_compile = False

    if do_compile:
        print("=== Batch compiling scenarios (with A-to-J merge) ===\n")
        compile_batch()

    if do_voice:
        print("\n=== Linking voices ===")
        link_voices()

    print("\n=== Splitting episode artifacts ===")
    split_compiled_episodes()

    print("\nDone.")


if __name__ == "__main__":
    main()
