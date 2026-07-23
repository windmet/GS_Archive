"""Safely publish one audited migration candidate into the local compiled corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def resolve_inside(root: Path, relative: str) -> Path:
    normalized = relative.replace("\\", "/")
    candidate = (root / normalized).resolve()
    if candidate == root or root not in candidate.parents:
        raise ValueError(f"Path escapes root {root}: {relative}")
    return candidate


def audited_files(candidate_dir: Path, manifest: dict[str, Any]) -> list[tuple[str, str]]:
    group_id = str(manifest.get("group_id", ""))
    aggregate = str(manifest.get("aggregate_file", ""))
    episodes = manifest.get("episode_files", [])
    if not group_id or aggregate != f"{group_id}.json":
        raise ValueError("Candidate manifest has an invalid aggregate identity")
    if not isinstance(episodes, list) or not episodes:
        raise ValueError("Candidate manifest has no episode files")
    voice = manifest.get("voice_linking", {})
    if voice.get("unresolved") != 0 or voice.get("resolved") != voice.get("references"):
        raise ValueError(f"Candidate voice linking is incomplete: {voice}")

    records = [("aggregate", aggregate)]
    for relative in episodes:
        episode_id = Path(str(relative)).stem
        records.append((episode_id.removeprefix(f"{group_id}_"), str(relative)))
    for audit_name, relative in records:
        candidate_path = resolve_inside(candidate_dir, relative)
        if not candidate_path.is_file():
            raise FileNotFoundError(f"Candidate artifact missing: {candidate_path}")
        scenario = load_json(candidate_path)
        expected_id = group_id if audit_name == "aggregate" else Path(relative).stem
        if scenario.get("scenario_id") != expected_id:
            raise ValueError(f"Scenario identity mismatch for {relative}: {scenario.get('scenario_id')}")
        audit = load_json(candidate_dir / f"audit-{audit_name}.json")
        if audit.get("acceptance", {}).get("passed") is not True:
            raise ValueError(f"Migration audit did not pass for {relative}")
        if audit.get("non_text_differences", {}).get("count") != 0:
            raise ValueError(f"Non-text differences remain for {relative}")
    return records


def atomic_copy(source: Path, target: Path) -> None:
    temporary = target.with_name(f".{target.name}.sidem-publish-tmp")
    if temporary.exists():
        raise FileExistsError(f"Temporary publish file already exists: {temporary}")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        shutil.copy2(source, temporary)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def publish(candidate_dir: Path, compiled_dir: Path, backup_dir: Path) -> dict[str, Any]:
    candidate_dir = candidate_dir.resolve()
    compiled_dir = compiled_dir.resolve()
    backup_dir = backup_dir.resolve()
    if not candidate_dir.is_dir() or not compiled_dir.is_dir():
        raise FileNotFoundError("Candidate and compiled directories must already exist")
    if backup_dir == compiled_dir or compiled_dir in backup_dir.parents:
        raise ValueError("Backup directory must be outside the compiled corpus")
    if backup_dir.exists() and any(backup_dir.iterdir()):
        raise ValueError(f"Backup directory must be empty: {backup_dir}")

    manifest = load_json(candidate_dir / "migration_candidate_manifest.json")
    records = audited_files(candidate_dir, manifest)
    targets = []
    for audit_name, relative in records:
        source = resolve_inside(candidate_dir, relative)
        target = resolve_inside(compiled_dir, relative)
        if not target.is_file():
            raise FileNotFoundError(f"Refusing to publish without an existing target: {target}")
        targets.append((audit_name, relative, source, target))

    backup_dir.mkdir(parents=True, exist_ok=True)
    file_records = []
    for audit_name, relative, source, target in targets:
        backup = resolve_inside(backup_dir, relative)
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup)
        file_records.append({
            "audit": audit_name,
            "file": relative.replace("\\", "/"),
            "old_hash": sha256_file(target),
            "new_hash": sha256_file(source),
            "backup_hash": sha256_file(backup),
        })

    for _, _, source, target in targets:
        atomic_copy(source, target)

    for record, (_, _, source, target) in zip(file_records, targets, strict=True):
        published_hash = sha256_file(target)
        if published_hash != record["new_hash"] or published_hash != sha256_file(source):
            raise RuntimeError(f"Published artifact verification failed: {target}")

    report = {
        "schema_version": 1,
        "group_id": manifest["group_id"],
        "source_raw_hash": load_json(candidate_dir / manifest["aggregate_file"]).get("source", {}).get("raw_hash"),
        "backup_dir": str(backup_dir),
        "files": file_records,
    }
    with (backup_dir / "publish_backup_manifest.json").open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate-dir", required=True)
    parser.add_argument("--compiled-dir", required=True)
    parser.add_argument("--backup-dir", required=True)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = publish(Path(args.candidate_dir), Path(args.compiled_dir), Path(args.backup_dir))
    print(json.dumps(result, ensure_ascii=False, indent=2))
