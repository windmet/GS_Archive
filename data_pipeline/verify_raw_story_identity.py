"""Regression checks for Unity container-path story identity and grouping."""

from __future__ import annotations

import json

from extract_raw_story_candidate import group_scenario_assets


def record(name: str, directory: str, path_id: int) -> dict:
    payload = json.dumps({"scenario": {"command_list": []}}).encode("utf-8")
    return {
        "name": name,
        "payload": payload,
        "container_path": f"assets/resources/scenariodata/{directory}/{name}.json",
        "path_id": path_id,
    }


merged, excluded = group_scenario_assets(
    [
        record("scenario_1_4_001_01_a", "1_4_001_01", 1),
        record("scenario_1_4_001_01_b", "1_4_001_01", 2),
    ]
)
assert not excluded
assert list(merged) == ["1_4_001_01"]
assert [item["part_id"] for item in merged["1_4_001_01"]["items"]] == [
    "1_4_001_01_a",
    "1_4_001_01_b",
]

mixed, excluded = group_scenario_assets(
    [
        record("scenario_1_2_001_12", "1_x_001tom_2", 3),
        record("scenario_1_2_001_12_a", "1_x_001tom_2", 4),
        record("scenario_1_2_001_12_b", "1_x_001tom_2", 5),
    ]
)
assert not excluded
assert set(mixed) == {
    "1_x_001tom_2_1_2_001_12",
    "1_x_001tom_2_1_2_001_12_a",
    "1_x_001tom_2_1_2_001_12_b",
}

same_name, excluded = group_scenario_assets(
    [
        record("scenario_2_3_001_01_00", "001tom_301", 6),
        record("scenario_2_3_001_01_00", "028soi_302", 7),
        {
            "name": "scenario_dummy",
            "payload": b"",
            "container_path": "assets/resources/scenariodata/others/scenario_dummy.json",
            "path_id": 8,
        },
    ]
)
assert set(same_name) == {
    "001tom_301_2_3_001_01_00",
    "028soi_302_2_3_001_01_00",
}
assert len(excluded) == 1
assert excluded[0]["text_asset"] == "scenario_dummy"
assert excluded[0]["path_id"] == 8
assert excluded[0]["reason"] == "invalid_json"

print("RAW story Unity identity verification passed.")
