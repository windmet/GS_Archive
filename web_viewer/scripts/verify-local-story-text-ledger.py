"""Verify isolated strict-v2 batch outputs against the recorded RAW sources."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

def sha(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def text_refs(scenario: dict):
    for step in scenario.get("steps", []):
        dialogue = step.get("dialogue") or {}
        for key in ("speaker_text_ref", "text_ref"):
            if dialogue.get(key):
                yield dialogue[key]
        caption = step.get("text_time") or {}
        if caption.get("text_ref"):
            yield caption["text_ref"]
        for option in step.get("options", []):
            for key in ("text_ref", "detail_text_ref"):
                if option.get(key):
                    yield option[key]


def verify(output: Path) -> dict:
    ledger = json.loads((output / "ledger.json").read_text("utf-8"))
    if ledger["schema_version"] != 1 or ledger["publication_status"] != "candidate-only":
        raise ValueError("Unexpected ledger contract")
    raw_asset = Path(ledger["raw_root"]) / "asset"
    compiled_root = Path(__file__).resolve().parents[1] / "public" / "data" / "compiled"
    bundles = sorted(raw_asset.glob("scenario_*.unity3d"))
    if len(bundles) != ledger["bundles"]:
        raise ValueError("RAW bundle count changed")
    by_name = {path.name: path for path in bundles}
    source_hashes = {name: sha(path) for name, path in by_name.items()}
    seen_candidates, seen_units = set(), set()
    statuses = Counter()
    text_units = 0
    candidate_bytes = 0
    covered = set()
    for entry in ledger["entries"]:
        bundle = entry["bundle"]
        if bundle not in source_hashes or entry["bundle_sha256"] != source_hashes[bundle]:
            raise ValueError(f"Source mismatch: {bundle}")
        covered.add(bundle)
        statuses[entry["status"]] += 1
        if entry["status"] not in ("strict-v2-candidate", "schema-invalid-choice-target"):
            if "candidate" in entry:
                raise ValueError(f"Noncandidate has output: {bundle}")
            continue
        relative = Path(entry["candidate"])
        if relative.is_absolute() or ".." in relative.parts or str(relative) in seen_candidates:
            raise ValueError(f"Unsafe or duplicate candidate path: {relative}")
        seen_candidates.add(str(relative))
        path = output / "candidates" / relative
        if sha(path) != entry["candidate_sha256"]:
            raise ValueError(f"Candidate changed: {relative}")
        scenario = json.loads(path.read_text("utf-8"))
        if scenario.get("schema_version") != 2 or scenario.get("runtime_contract") != "story-runtime-v2":
            raise ValueError(f"Not strict v2: {relative}")
        if scenario.get("scenario_id") != entry.get("candidate_scenario_id"):
            raise ValueError(f"Candidate scenario identity changed: {relative}")
        if entry.get("identity_basis") == "mounted-owner-part":
            owner = Path(entry["container_path"]).parent.name
            if entry["candidate_scenario_id"] != f"{owner}_{entry['part']}" or not (compiled_root / f"{owner}_{entry['part']}.json").is_file():
                raise ValueError(f"Mounted owner identity unavailable: {relative}")
        elif entry.get("identity_basis") == "mounted-group-episode":
            if not (compiled_root / "episodes" / f"{entry['part']}.json").is_file():
                raise ValueError(f"Mounted group episode unavailable: {relative}")
        else:
            raise ValueError(f"Unknown identity basis: {relative}")
        if scenario["source"] != {"raw_path": f"RAW/asset/{bundle}", "raw_hash": source_hashes[bundle]}:
            raise ValueError(f"Candidate provenance changed: {relative}")
        refs = list(text_refs(scenario))
        invalid_steps = sorted({step["step_id"] for step in scenario["steps"]
                                for option in step.get("options", [])
                                if option.get("target_step_id", 0) < 1})
        if (entry["status"] == "schema-invalid-choice-target") != bool(invalid_steps):
            raise ValueError(f"Choice target status changed: {relative}")
        if invalid_steps != entry.get("invalid_choice_steps", []):
            raise ValueError(f"Invalid choice steps changed: {relative}")
        ids = [ref["unit_id"] for ref in refs]
        if len(ids) != entry["text_units"] or len(scenario["steps"]) != entry["steps"]:
            raise ValueError(f"Candidate counts changed: {relative}")
        for unit_id in ids:
            if unit_id in seen_units:
                raise ValueError(f"Duplicate unit_id: {unit_id}")
            seen_units.add(unit_id)
        text_units += len(ids)
        candidate_bytes += path.stat().st_size
    if covered != set(by_name):
        raise ValueError("Some RAW bundles lack ledger entries")
    actual = {str(path.relative_to(output / "candidates")) for path in (output / "candidates").rglob("*.json")}
    if actual != seen_candidates:
        raise ValueError("Candidate directory and ledger differ")
    summary = {"statuses": dict(sorted(statuses.items())), "text_units": text_units,
               "candidate_bytes": candidate_bytes}
    if summary != ledger["summary"]:
        raise ValueError("Ledger summary differs from candidates")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / ".analysis/local-story-strict-v2-r2")
    args = parser.parse_args()
    print(json.dumps(verify(args.output.resolve()), ensure_ascii=False, indent=2))
