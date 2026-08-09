"""Regression gate for the Event 1_3_10001_01 step-9 stage timing fix."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT.parent / "data_pipeline"
FIXTURE = ROOT / "fixtures" / "story-runtime" / "step9-missing-target-timing-raw.json"
MOUNTED_RAW = Path(
    r"E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01"
    r"\scenario_1_3_10001_01_a.json"
)
sys.path.insert(0, str(PIPELINE))

from scenario_compiler import ScenarioCompiler  # noqa: E402


def load_raw(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def assert_timing(compiled: dict, step_id: int, label: str) -> None:
    step = next(step for step in compiled["steps"] if step["step_id"] == step_id)
    assert step["type"] == "stage", label
    assert abs(float(step["duration"]) - 0.5) < 1e-9, (label, step["duration"])
    assert "048mom" not in {
        spine["id"] for spine in step["state"].get("spines", [])
    }, label
    delayed = next(
        event for event in step.get("timeline", [])
        if event.get("chara_id") == "048mom"
    )
    assert delayed["time"] == 5.0, (label, delayed["time"])


def main() -> None:
    source_only = "--source-only" in sys.argv[1:]
    if not FIXTURE.is_file():
        raise SystemExit(f"Committed timing fixture is unavailable: {FIXTURE}")
    fixture_compiled = ScenarioCompiler(
        load_raw(FIXTURE),
        "fixture_step9_missing_target_timing",
        "fixture_step9_missing_target_timing",
        "fixtures/story-runtime/step9-missing-target-timing-raw.json",
    ).compile()
    assert_timing(fixture_compiled, 1, "committed minimal fixture")

    mounted_status = "mounted Event RAW skipped"
    if not source_only and MOUNTED_RAW.is_file():
        mounted_compiled = ScenarioCompiler(
            load_raw(MOUNTED_RAW),
            "1_3_10001_01",
            "1_3_10001_01_a",
            "scenariodata/1_3_10001_01/scenario_1_3_10001_01_a.json",
        ).compile()
        assert_timing(mounted_compiled, 9, "mounted Event RAW")
        mounted_status = "mounted Event RAW verified"

    print(
        "Story step 9 timing: committed RAW-command fixture preserves authored "
        "wait 0.5s; missing 048mom timeline cue retained without extending the "
        f"stage; {mounted_status}"
    )


if __name__ == "__main__":
    main()
