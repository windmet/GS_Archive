"""Contract checks for the isolated story migration candidate compiler."""

from __future__ import annotations

import importlib.util
import re
import tempfile
from pathlib import Path
from types import SimpleNamespace


SCRIPT_PATH = Path(__file__).with_name("compile-story-migration-candidate.py")
SPEC = importlib.util.spec_from_file_location("compile_story_migration_candidate", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {SCRIPT_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


assert MODULE.expand_expected_parts("a-c,e", "fixture") == [
    "fixture_a",
    "fixture_b",
    "fixture_c",
    "fixture_e",
]

try:
    MODULE.expand_expected_parts("c-a", "fixture")
except ValueError:
    pass
else:
    raise AssertionError("Descending expected-part ranges must be rejected")

voice_scenario = {
    "scenario_id": "1_4_001_01_a",
    "steps": [{"dialogue": {"voice": "a1000.m4a"}}],
}
voice_stats = MODULE.relink_voices(voice_scenario, {"1_4_001_01_a1000.m4a"})
assert voice_stats == {"references": 1, "resolved": 1, "unresolved": 0}
assert voice_scenario["steps"][0]["dialogue"]["voice"] == "1_4_001_01_a1000.m4a"

with tempfile.TemporaryDirectory() as temporary_dir:
    temporary_root = Path(temporary_dir)
    first = temporary_root / "a.json"
    second = temporary_root / "b.json"
    first.write_bytes(b'{"part":"a"}\n')
    second.write_bytes(b'{"part":"b"}\n')
    standalone_source = MODULE.build_source_evidence(
        [first],
        ["scenariodata/fixture/a.json"],
    )
    assert standalone_source["raw_hash"] == MODULE.sha256_bytes(first.read_bytes())
    assert standalone_source["raw_hash_format"] == "sha256-raw-file-v1"
    grouped_source = MODULE.build_source_evidence(
        [first, second],
        ["scenariodata/fixture/a.json", "scenariodata/fixture/b.json"],
    )
    assert re.fullmatch(r"sha256:[a-f0-9]{64}", grouped_source["raw_hash"])
    assert grouped_source["raw_hash_format"] == "sha256-group-manifest-v1"
    assert grouped_source["raw_path"] == "scenariodata/fixture"
    assert grouped_source["raw_files"] == [
        {"path": "scenariodata/fixture/a.json", "raw_hash": MODULE.sha256_bytes(first.read_bytes())},
        {"path": "scenariodata/fixture/b.json", "raw_hash": MODULE.sha256_bytes(second.read_bytes())},
    ]
    assert MODULE.build_source_evidence(
        [second, first],
        ["scenariodata/fixture/b.json", "scenariodata/fixture/a.json"],
    )["raw_hash"] == grouped_source["raw_hash"]

    raw_file = temporary_root / "scenario_fixture.json"
    MODULE.save_json(raw_file, {
        "Command": [
            {"Type": "image_bg", "Values": ["bg001_315pro_in_01"]},
            {"Type": "text", "Values": ["天ヶ瀬 冬馬", "行くぜ！", "001tom", ""]},
        ],
    })
    authoritative_output = temporary_root / "authoritative"
    direct_authoritative = MODULE.ScenarioCompiler(
        MODULE.load_json(raw_file),
        "fixture",
        "fixture",
        "scenariodata/fixture/scenario_fixture.json",
    ).compile(
        output_contract="authoritative",
        source=MODULE.build_source_evidence(
            [raw_file],
            ["scenariodata/fixture/scenario_fixture.json"],
        ),
        compiler_version="python-native-direct-v1",
    )
    assert direct_authoritative["runtime_contract"] == "story-runtime-v2"
    assert direct_authoritative["compiler_version"] == "python-native-direct-v1"
    manifest = MODULE.compile_candidate(SimpleNamespace(
        output_dir=str(authoritative_output),
        expected_parts="",
        raw_file=str(raw_file),
        raw_group_dir=None,
        group_id="fixture",
        voice_index="",
        output_contract="authoritative",
        compiler_version="python-native-verification-v1",
    ))
    authoritative = MODULE.load_json(authoritative_output / "fixture.json")
    assert manifest["output_contract"] == "authoritative"
    assert manifest["compiler_version"] == "python-native-verification-v1"
    assert authoritative["runtime_contract"] == "story-runtime-v2"
    assert authoritative["compiler_version"] == "python-native-verification-v1"
    assert authoritative["steps"][0]["snapshot_format"] == "story-snapshot-v2"
    assert "state" not in authoritative["steps"][0]
    assert "timeline" not in authoritative["steps"][0]
    assert "text" not in authoritative["steps"][0]["dialogue"]

split_source = {
    "scenario_id": "fixture",
    "text_catalog_id": "fixture",
    "text_contract_version": 1,
    "source": {
        "raw_path": "scenariodata/fixture",
        "raw_hash": f"sha256:{'1' * 64}",
    },
    "steps": [
        {"step_id": 1, "type": "adv", "episode_index": 0},
        {"step_id": 2, "type": "adv", "episode_index": 0},
        {"step_id": 3, "type": "choice", "episode_index": 1, "options": [{"step_id": 4}]},
        {"step_id": 4, "type": "adv", "episode_index": 1},
    ],
    "jump_points": {"second": 4},
    "episodes": [
        {
            "source_scenario_id": "fixture_a",
            "start_step_index": 0,
            "end_step_index": 1,
            "start_step_id": 1,
            "end_step_id": 2,
        },
        {
            "source_scenario_id": "fixture_b",
            "start_step_index": 2,
            "end_step_index": 3,
            "start_step_id": 3,
            "end_step_id": 4,
        },
    ],
}

episodes = MODULE.split_episodes(split_source)
assert list(episodes) == ["fixture_a", "fixture_b"]
assert [step["step_id"] for step in episodes["fixture_b"]["steps"]] == [1, 2]
assert episodes["fixture_b"]["steps"][0]["options"][0]["step_id"] == 2
assert episodes["fixture_b"]["jump_points"] == {"second": 2}
assert episodes["fixture_b"]["aggregate_source"] == {
    "file": "fixture.json",
    "scenario_id": "fixture",
    "start_step_index": 2,
    "end_step_index": 3,
}
assert episodes["fixture_b"]["source"] == split_source["source"]

print("Story migration candidate verification passed")
print("  expected parts, deterministic raw hashes, voice relink, episode rebasing, and Python-native strict output covered")
