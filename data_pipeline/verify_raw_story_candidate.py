"""Compare a RAW-derived authoritative story with the current published story."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


IGNORED_KEYS = {"compiler_version", "source_file"}


def normalize(value: Any, *, path: tuple[str, ...] = ()) -> Any:
    if isinstance(value, list):
        return [normalize(item, path=path) for item in value]
    if not isinstance(value, dict):
        return value

    result = {}
    for key, child in value.items():
        if key in IGNORED_KEYS:
            continue
        if not path and key == "source":
            continue
        if key == "file" and path and path[-1] == "source":
            continue
        result[key] = normalize(child, path=(*path, key))
    return result


def first_differences(left: Any, right: Any, path: str = "$") -> list[str]:
    differences: list[str] = []
    if (
        isinstance(left, (int, float))
        and not isinstance(left, bool)
        and isinstance(right, (int, float))
        and not isinstance(right, bool)
        and left == right
    ):
        return differences
    if type(left) is not type(right):
        return [f"{path}: type {type(left).__name__} != {type(right).__name__}"]
    if isinstance(left, dict):
        for key in sorted(set(left) | set(right)):
            child_path = f"{path}.{key}"
            if key not in left:
                differences.append(f"{child_path}: missing from candidate")
            elif key not in right:
                differences.append(f"{child_path}: missing from current")
            else:
                differences.extend(first_differences(left[key], right[key], child_path))
            if len(differences) >= 50:
                break
    elif isinstance(left, list):
        if len(left) != len(right):
            differences.append(f"{path}: length {len(left)} != {len(right)}")
        for index, (left_item, right_item) in enumerate(zip(left, right)):
            differences.extend(
                first_differences(left_item, right_item, f"{path}[{index}]")
            )
            if len(differences) >= 50:
                break
    elif left != right:
        differences.append(f"{path}: {left!r} != {right!r}")
    return differences[:50]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--current", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    candidate = json.loads(args.candidate.read_text(encoding="utf-8"))
    current = json.loads(args.current.read_text(encoding="utf-8"))
    candidate_normalized = normalize(candidate)
    current_normalized = normalize(current)
    differences = first_differences(candidate_normalized, current_normalized)
    summary = {
        "candidate": str(args.candidate.resolve()),
        "current": str(args.current.resolve()),
        "candidate_steps": len(candidate.get("steps") or []),
        "current_steps": len(current.get("steps") or []),
        "candidate_episodes": len(candidate.get("episodes") or []),
        "current_episodes": len(current.get("episodes") or []),
        "semantic_equal_ignoring_provenance": not differences,
        "differences": differences,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if differences:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
