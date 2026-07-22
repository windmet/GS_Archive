"""Contract checks for the isolated story migration candidate compiler."""

from __future__ import annotations

import importlib.util
from pathlib import Path


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

split_source = {
    "scenario_id": "fixture",
    "text_catalog_id": "fixture",
    "text_contract_version": 1,
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

print("Story migration candidate verification passed")
print("  expected part ranges, deterministic voice relink, and episode rebasing covered")
