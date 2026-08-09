"""Regression gate for the Event 1_3_10001_01 step-9 stage timing fix."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT.parent / "data_pipeline"
RAW = Path(
    r"E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01"
    r"\scenario_1_3_10001_01_a.json"
)
sys.path.insert(0, str(PIPELINE))

from scenario_compiler import ScenarioCompiler  # noqa: E402


def main() -> None:
    if not RAW.is_file():
        raise SystemExit(f"RAW fixture is unavailable: {RAW}")
    with RAW.open("r", encoding="utf-8-sig") as handle:
        raw = json.load(handle)
    compiled = ScenarioCompiler(
        raw,
        "1_3_10001_01",
        "1_3_10001_01_a",
        "scenariodata/1_3_10001_01/scenario_1_3_10001_01_a.json",
    ).compile()
    step = next(step for step in compiled["steps"] if step["step_id"] == 9)
    assert step["type"] == "stage"
    assert abs(float(step["duration"]) - 0.5) < 1e-9, step["duration"]
    assert "048mom" not in {
        spine["id"] for spine in step["state"].get("spines", [])
    }
    delayed = next(
        event for event in step.get("timeline", [])
        if event.get("chara_id") == "048mom"
    )
    assert delayed["time"] == 5.0
    print(
        "Story step 9 timing: authored wait 0.5s preserved; "
        "missing 048mom timeline cue retained without extending the stage"
    )


if __name__ == "__main__":
    main()
