"""Recompile local RAW stories with mounted group scope by default.

The output is an audit workspace, never a public corpus or publication release.
--scope raw-parts is a forensic inventory, not an episode replacement: it lacks
the preceding parts' synopsis deduplication and scene state.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "data_pipeline"))
from scenario_compiler import ScenarioCompiler  # noqa: E402
from sidem_raw import extract_text_asset_records  # noqa: E402


def digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


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


def run(raw_root: Path, output: Path) -> dict:
    asset_root = raw_root.resolve() / "asset"
    if not asset_root.is_dir():
        raise NotADirectoryError(asset_root)
    output = output.resolve()
    if output == ROOT or output.is_relative_to(ROOT / "public"):
        raise ValueError("Candidate output must stay outside public")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use an empty output; do not overwrite audited RAW candidates")
    candidates = output / "candidates"
    candidates.mkdir(parents=True, exist_ok=True)
    bundles = sorted(asset_root.glob("scenario_*.unity3d"))
    ledger = {"schema_version": 1, "purpose": "local-raw-strict-v2-text-audit",
              "publication_status": "candidate-only", "compilation_scope": "independent-raw-part", "raw_root": str(raw_root.resolve()),
              "bundles": len(bundles), "entries": []}
    seen_units: dict[str, str] = {}
    for bundle_no, bundle in enumerate(bundles, 1):
        bundle_id = bundle.stem.removeprefix("scenario_")
        bundle_hash = digest(bundle.read_bytes())
        try:
            records = extract_text_asset_records(bundle)
        except Exception as error:
            ledger["entries"].append({"bundle": bundle.name, "bundle_sha256": bundle_hash,
                                      "status": "extract-failed", "error": str(error)})
            continue
        if not records:
            ledger["entries"].append({"bundle": bundle.name, "bundle_sha256": bundle_hash,
                                      "status": "no-text-assets"})
        for record in records:
            part = record["name"].removeprefix("scenario_")
            entry = {"bundle": bundle.name, "bundle_sha256": bundle_hash,
                     "container_path": record["container_path"],
                     "part": part, "payload_sha256": digest(record["payload"])}
            ledger["entries"].append(entry)
            if not record["name"].startswith("scenario_") or not part:
                entry.update(status="skipped-non-scenario")
                continue
            try:
                raw = json.loads(record["payload"])
                owner = Path(record["container_path"]).parent.name
                owner_file = ROOT / "public" / "data" / "compiled" / f"{owner}_{part}.json"
                episode_file = ROOT / "public" / "data" / "compiled" / "episodes" / f"{part}.json"
                # Legacy mounted files already distinguish same-named RAW parts
                # under different owner containers. Reuse that identity; group
                # episodes retain their existing bundle-level text catalog ID.
                if owner_file.is_file():
                    scenario_id = owner_file.stem
                    identity_basis = "mounted-owner-part"
                elif episode_file.is_file():
                    scenario_id = bundle_id
                    identity_basis = "mounted-group-episode"
                else:
                    raise ValueError(f"no mounted compiled identity for {record['container_path']}")
                entry.update(candidate_scenario_id=scenario_id, identity_basis=identity_basis)
                if owner_file.is_file() and episode_file.is_file():
                    entry["also_mounted_as_episode"] = True
                compiled = ScenarioCompiler(raw, scenario_id, part, record["container_path"]).compile(
                    output_contract="authoritative",
                    source={"raw_path": f"RAW/asset/{bundle.name}", "raw_hash": bundle_hash},
                    compiler_version="local-raw-text-audit-v1",
                )
                refs = list(text_refs(compiled))
                ids = [ref["unit_id"] for ref in refs]
                if len(ids) != len(set(ids)):
                    raise ValueError("duplicate unit_id within part")
                for unit_id in ids:
                    if unit_id in seen_units:
                        raise ValueError(f"duplicate unit_id across parts: {unit_id} / {seen_units[unit_id]}")
                # Some bundles contain multiple TextAssets with the same name.
                # Keep their container identities distinct instead of overwriting.
                container_key = hashlib.sha256(
                    f"{record['container_path']}:{record['path_id']}".encode("utf-8")
                ).hexdigest()[:16]
                relative = Path(bundle_id) / f"{part}--{container_key}.json"
                target = candidates / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                encoded = (json.dumps(compiled, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
                target.write_bytes(encoded)
                seen_units.update({unit_id: f"{bundle.name}/{part}" for unit_id in ids})
                invalid_targets = [step["step_id"] for step in compiled["steps"]
                                   for option in step.get("options", [])
                                   if option.get("target_step_id", 0) < 1]
                entry.update(status="schema-invalid-choice-target" if invalid_targets else "strict-v2-candidate",
                             candidate=str(relative).replace("\\", "/"),
                             candidate_sha256=digest(encoded), steps=len(compiled["steps"]),
                             text_units=len(ids))
                if invalid_targets:
                    entry["invalid_choice_steps"] = sorted(set(invalid_targets))
            except Exception as error:
                entry.update(status="compile-failed", error=str(error))
        if bundle_no % 100 == 0:
            print(f"Processed {bundle_no}/{len(bundles)} bundles", flush=True)
    counts = Counter(entry["status"] for entry in ledger["entries"])
    ledger["summary"] = {"statuses": dict(sorted(counts.items())),
                         "text_units": sum(entry.get("text_units", 0) for entry in ledger["entries"]),
                         "candidate_bytes": sum((candidates / entry["candidate"]).stat().st_size
                                                for entry in ledger["entries"] if "candidate" in entry)}
    (output / "ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", "utf-8")
    return ledger["summary"]


def export_ledger(output: Path, target: Path) -> None:
    """Commit-safe index: source identities and outcomes, never RAW text/candidates."""
    ledger = json.loads((output / "ledger.json").read_text("utf-8"))
    keep = ("bundle", "bundle_sha256", "container_path", "part", "payload_sha256",
            "candidate_scenario_id", "identity_basis", "also_mounted_as_episode", "invalid_choice_steps",
            "status", "candidate", "candidate_sha256", "steps", "text_units", "error")
    compact = {"schema_version": 1, "purpose": ledger["purpose"],
               "publication_status": ledger["publication_status"],
               "source_scope": "local RAW/asset/scenario_*.unity3d",
               "bundles": ledger["bundles"], "summary": ledger["summary"],
               "entries": [{key: entry[key] for key in keep if key in entry}
                           for entry in ledger["entries"]]}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, default=ROOT.parent / "RAW")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--scope", choices=("mounted-groups", "raw-parts"), default="mounted-groups")
    parser.add_argument("--part-ledger", type=Path, default=ROOT / ".analysis/local-story-strict-v2-r2/ledger.json")
    parser.add_argument("--export-ledger", type=Path)
    parser.add_argument("--export-only", action="store_true")
    args = parser.parse_args()
    if args.scope == "mounted-groups":
        if args.export_only or args.export_ledger:
            parser.error("Raw-part exports require --scope raw-parts; group evidence is in its own ledger")
        spec = importlib.util.spec_from_file_location("mounted_groups", ROOT / "scripts/recompile-mounted-story-groups.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        summary = module.run(args.raw_root.resolve(), args.output or ROOT / ".analysis/local-story-group-v2-r1", args.part_ledger)
        print(json.dumps(summary, indent=2))
        raise SystemExit(1 if summary['statuses'].get('blocked') else 0)
    args.output = args.output or ROOT / ".analysis/local-story-strict-v2-r2"
    summary = json.loads((args.output / "ledger.json").read_text("utf-8"))["summary"] if args.export_only else run(args.raw_root, args.output)
    if args.export_ledger:
        export_ledger(args.output, args.export_ledger)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
