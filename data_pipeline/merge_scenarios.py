"""
Merge story continuation compiled files.
Operates on existing compiled outputs.

Strategy (two patterns):

  Pattern A — _scenario_ naming format (legacy):
    1. Group compiled files by parent directory (everything before _scenario_)
    2. Only proceed for parent groups where ALL files are lettered variants
       (i.e., no standalone base file exists in the same parent group)
    3. Within those groups, further group by base scenario ID (without trailing letter)
    4. Merge each subgroup: concatenate steps with renumbering

  Pattern B — merged naming format (base file + lettered variants):
    e.g. 1_x_038tak_2_1_2_038_12.json (base, already has all branches)
         + 1_x_038tak_2_1_2_038_12_a.json / _b.json / _c.json (redundant variants)
    1. Detect merged-format files (no _scenario_ separator) with trailing _[a-z]
    2. If a corresponding base file exists, the variants are redundant
       (base file already contains all branch steps + jump_points)
    3. Simply delete the variant files
"""

import json
import os
import re
from collections import defaultdict

COMPILED_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..",
    "web_viewer", "public", "data", "compiled"
))
EXCLUDE = {"manifest.json", "voice_index.json", "index.json"}

# Pattern: {parent}_scenario_{scenarioId_with_possible_letter}.json
# e.g. "1_4_001_01_scenario_1_4_001_01_a.json"
COMPILED_RE = re.compile(r'^(.+?)_scenario_(.+)\.json$')

# Pattern: lettered variant in merged format: base_<letter>.json
# e.g. 1_x_038tak_2_1_2_038_12_a.json
LETTERED_VARIANT_RE = re.compile(r'^(.+?)_[a-z]\.json$')


def parse_compiled_filename(fn: str):
    """Returns (parent, scenario_id) or None."""
    m = COMPILED_RE.match(fn)
    if m:
        return m.group(1), m.group(2)
    return None


def has_trailing_letter(scenario_id: str) -> bool:
    """Check if scenario_id ends with _[a-z]."""
    return bool(re.search(r'_[a-z]$', scenario_id))


def strip_trailing_letter(scenario_id: str) -> str:
    """Remove trailing _[a-z] if present."""
    if has_trailing_letter(scenario_id):
        return scenario_id[:-2]  # remove _ + letter
    return scenario_id


def scan_merge_candidates():
    """
    Find _scenario_ directories where ALL compiled files are lettered variants.
    Returns list of (parent, base_id, [filename...]) tuples to merge.
    """
    files = sorted(
        f for f in os.listdir(COMPILED_DIR)
        if f.endswith(".json") and f not in EXCLUDE
    )

    # Step 1: Group by parent directory
    by_parent = defaultdict(list)
    for fn in files:
        parsed = parse_compiled_filename(fn)
        if parsed:
            by_parent[parsed[0]].append((fn, parsed[1]))

    # Step 2: For each parent, check if ALL files are lettered
    candidates = []
    for parent, entries in sorted(by_parent.items()):
        all_lettered = all(has_trailing_letter(sid) for _, sid in entries)

        if not all_lettered:
            continue  # mixed directory → lettered files are choice branches

        # Step 3: Group by base scenario ID (without trailing letter)
        base_groups = defaultdict(list)
        for fn, sid in entries:
            base = strip_trailing_letter(sid)
            base_groups[base].append(fn)

        # Step 4: Only include groups with >= 2 files
        for base_id, fns in sorted(base_groups.items()):
            if len(fns) >= 2:
                candidates.append((parent, base_id, sorted(fns)))

    return candidates


def merge_group(parent: str, base_id: str, filenames: list[str]):
    """Merge a group of _scenario_ lettered files into one."""
    merge_key = f"{parent}_{base_id}" if parent != base_id else base_id
    print(f"  {merge_key:45s} ({len(filenames)} files)")

    all_steps = []
    combined_jump_points = {}
    step_offset = 0

    for fn in filenames:
        path = os.path.join(COMPILED_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"    ✗ {fn}: {e}")
            return

        for step in data.get("steps", []):
            step["step_id"] = step["step_id"] + step_offset
            all_steps.append(step)

        for label, orig_step in data.get("jump_points", {}).items():
            combined_jump_points[label] = orig_step + step_offset

        step_offset += data.get("total_steps", 0)

    merged = {
        "scenario_id": merge_key,
        "total_steps": len(all_steps),
        "steps": all_steps,
        "jump_points": combined_jump_points,
    }

    out_fn = f"{merge_key}.json"
    out_path = os.path.join(COMPILED_DIR, out_fn)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    for fn in filenames:
        os.remove(os.path.join(COMPILED_DIR, fn))

    print(f"    → {out_fn} ({len(all_steps)} steps)")


# ── Pattern B: merged-format base + lettered variants ──────────────

def scan_merged_variant_candidates():
    """
    Find merged-format files (no _scenario_ separator) where a base file
    exists alongside lettered variants. The base file already contains all
    branch content with jump_points — variants are redundant.
    Returns list of (base_fn, [variant_fn...]) tuples.
    """
    files = sorted(
        f for f in os.listdir(COMPILED_DIR)
        if f.endswith(".json") and f not in EXCLUDE
    )
    all_set = set(files)

    by_base = defaultdict(list)
    for fn in files:
        if "_scenario_" in fn:
            continue  # handled by scan_merge_candidates
        m = LETTERED_VARIANT_RE.match(fn)
        if m:
            base = m.group(1) + ".json"
            if base in all_set:
                by_base[base].append(fn)

    return [(base, sorted(vars)) for base, vars in sorted(by_base.items()) if vars]


def remove_redundant_variants(base_fn: str, variants: list[str]):
    """Delete redundant lettered variants — base file already has all branches."""
    print(f"  {base_fn:45s} + {len(variants)} variants → keep base (already merged)")
    for fn in variants:
        path = os.path.join(COMPILED_DIR, fn)
        os.remove(path)
        print(f"    x removed {fn}")


def main():
    # Pattern A: _scenario_ format
    candidates = scan_merge_candidates()
    print(f"Pattern A (_scenario_ format): {len(candidates)} groups to merge...\n")
    total_orig = sum(len(fns) for _, _, fns in candidates)
    total_new = len(candidates)
    for parent, base_id, fns in candidates:
        merge_group(parent, base_id, fns)
    if candidates:
        print(f"  → {total_orig} files → {total_new} merged files.\n")

    # Pattern B: merged-format base + lettered variants
    merged_candidates = scan_merged_variant_candidates()
    print(f"Pattern B (merged-format variants): {len(merged_candidates)} groups to clean...\n")
    merged_variant_count = sum(len(v) for _, v in merged_candidates)
    for base_fn, variants in merged_candidates:
        remove_redundant_variants(base_fn, variants)
    if merged_candidates:
        print(f"  → {merged_variant_count} redundant variant files removed.\n")

    total = total_orig + merged_variant_count
    net = total_new + len(merged_candidates)
    print(f"Done. {total} files → {net} files kept/merged.")


if __name__ == "__main__":
    main()
