"""Safety checks for the audited migration publisher."""

from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("publish-story-migration-candidate.py")
SPEC = importlib.util.spec_from_file_location("publish_story_migration_candidate", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {SCRIPT_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


with tempfile.TemporaryDirectory() as temporary_dir:
    root = Path(temporary_dir)
    candidate = root / "candidate"
    compiled = root / "compiled"
    backup = root / "backup"
    scenario = {
        "scenario_id": "fixture",
        "source": {"raw_hash": f"sha256:{'1' * 64}"},
        "steps": [],
    }
    episode = {**scenario, "scenario_id": "fixture_a"}
    write_json(candidate / "fixture.json", scenario)
    write_json(candidate / "episodes/fixture_a.json", episode)
    write_json(compiled / "fixture.json", {"scenario_id": "fixture", "steps": [{"old": True}]})
    write_json(compiled / "episodes/fixture_a.json", {"scenario_id": "fixture_a", "steps": [{"old": True}]})
    write_json(candidate / "migration_candidate_manifest.json", {
        "group_id": "fixture",
        "aggregate_file": "fixture.json",
        "episode_files": ["episodes/fixture_a.json"],
        "voice_linking": {"references": 1, "resolved": 1, "unresolved": 0},
    })
    accepted = {
        "acceptance": {"passed": True},
        "non_text_differences": {"count": 0},
    }
    write_json(candidate / "audit-aggregate.json", accepted)
    write_json(candidate / "audit-a.json", accepted)

    old_hash = MODULE.sha256_file(compiled / "fixture.json")
    report = MODULE.publish(candidate, compiled, backup)
    assert report["source_raw_hash"] == f"sha256:{'1' * 64}"
    assert report["files"][0]["old_hash"] == old_hash
    assert MODULE.sha256_file(compiled / "fixture.json") == MODULE.sha256_file(candidate / "fixture.json")
    assert MODULE.sha256_file(backup / "fixture.json") == old_hash
    assert (backup / "publish_backup_manifest.json").is_file()

    try:
        MODULE.publish(candidate, compiled, backup)
    except ValueError as error:
        assert "must be empty" in str(error)
    else:
        raise AssertionError("Publisher must reject a non-empty backup directory")

    manifest_path = candidate / "migration_candidate_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["voice_linking"] = {"references": 1, "resolved": 0, "unresolved": 1}
    write_json(manifest_path, manifest)
    try:
        MODULE.audited_files(candidate, manifest)
    except ValueError as error:
        assert "voice linking is incomplete" in str(error)
    else:
        raise AssertionError("Publisher must reject unresolved voice references")
    manifest["voice_linking"] = {"references": 1, "resolved": 1, "unresolved": 0}
    write_json(manifest_path, manifest)

    (compiled / "episodes/fixture_a.json").unlink()
    try:
        MODULE.publish(candidate, compiled, root / "missing-target-backup")
    except FileNotFoundError as error:
        assert "existing target" in str(error)
    else:
        raise AssertionError("Publisher must reject a missing formal target")

    try:
        MODULE.resolve_inside(compiled, "../escape.json")
    except ValueError:
        pass
    else:
        raise AssertionError("Publisher must reject paths escaping the compiled root")

print("Story migration publish verification passed")
print("  audited files publish atomically with exact recoverable backups")
print("  traversal, missing targets, dirty backups, and unresolved voices are rejected")
