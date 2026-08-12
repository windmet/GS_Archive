"""Bidirectional regression matrix for silent-stage timing semantics."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT.parent / "data_pipeline"
FIXTURE_ROOT = ROOT / "fixtures" / "story-runtime"
MOUNTED_ROOT = Path(r"E:\BaiduNetdiskDownload\SideM\scripts\scenariodata\1_3_10001_01")
sys.path.insert(0, str(PIPELINE))

from scenario_compiler import ScenarioCompiler  # noqa: E402


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def compile_fixture(filename: str) -> dict:
    path = FIXTURE_ROOT / filename
    if not path.is_file():
        raise AssertionError(f"committed timing fixture unavailable: {path}")
    stem = path.stem.replace("-raw", "")
    return ScenarioCompiler(
        load_json(path),
        f"fixture_{stem}",
        f"fixture_{stem}",
        f"fixtures/story-runtime/{filename}",
    ).compile()


def stage(compiled: dict, step_id: int = 1) -> dict:
    result = next(item for item in compiled["steps"] if item["step_id"] == step_id)
    assert result["type"] == "stage", (step_id, result["type"])
    return result


def assert_close(actual: object, expected: float, label: str) -> None:
    assert abs(float(actual) - expected) < 1e-9, (label, actual, expected)


def visible_ids(step_data: dict, snapshot_key: str = "state") -> set[str]:
    return {
        item["id"]
        for item in step_data[snapshot_key].get("spines", [])
        if item.get("visible", False)
    }


def timeline_event(step_data: dict, target: str, time: float, label: str = "") -> dict:
    matches = [
        event for event in step_data.get("timeline", [])
        if event.get("chara_id") == target and float(event.get("time", -1)) == time
    ]
    assert matches, (
        label,
        target,
        time,
        [
            (event.get("chara_id"), event.get("time"), event.get("type"))
            for event in step_data.get("timeline", [])
        ],
    )
    return matches[0]


def authoritative_cue(step_data: dict, target: str, at: float) -> dict:
    return next(
        cue for cue in step_data.get("cues", [])
        if cue.get("target") == target and float(cue.get("at", -1)) == at
    )


def verify_source_only_matrix() -> None:
    missing = stage(compile_fixture("step9-missing-target-timing-raw.json"))
    assert_close(missing["duration"], 0.5, "missing target must not extend stage")
    assert "048mom" not in visible_ids(missing)
    timeline_event(missing, "048mom", 5.0)

    fading = stage(compile_fixture("timing-pending-fade-target-raw.json"))
    assert_close(fading["duration"], 0.5, "pending fade-out target must not extend stage")
    fading_spine = next(item for item in fading["state"]["spines"] if item["id"] == "047shu")
    assert fading_spine.get("fade", {}).get("type") == "out", fading_spine
    timeline_event(fading, "047shu", 5.0)

    extending = stage(compile_fixture("timing-visible-target-extension-raw.json"))
    assert "047shu" in visible_ids(extending)
    timeline_event(extending, "047shu", 4.5)
    assert_close(extending["duration"], 4.7, "visible delayed cue must extend short stage")

    authored = stage(compile_fixture("timing-authored-long-choreography-raw.json"))
    assert "047shu" in visible_ids(authored)
    timeline_event(authored, "047shu", 4.5)
    assert_close(authored["duration"], 7.5, "authored long wait must remain long")

    published_cases = [
        ("episodes/1_3_10001_01_c.json", 4, 7.5, "047shu", 4.5),
        ("episodes/1_3_10001_01_f.json", 3, 6.0, "048mom", 3.5),
    ]
    for relative, step_id, duration, target, cue_at in published_cases:
        published = stage(load_json(ROOT / "public" / "data" / "compiled" / relative), step_id)
        assert target in visible_ids(published, "entry_snapshot"), (relative, target)
        cue = authoritative_cue(published, target, cue_at)
        assert cue["lifecycle"]["blocks_auto"] is True, (relative, cue)
        assert_close(published["duration"], duration, f"published long choreography {relative}")


def verify_mounted_raw() -> str:
    mounted_cases = [
        ("scenario_1_3_10001_01_a.json", 9, 0.5, "048mom", 5.0),
        ("scenario_1_3_10001_01_c.json", 5, 7.5, "047shu", 4.5),
        ("scenario_1_3_10001_01_f.json", 4, 6.0, "048mom", 3.5),
    ]
    if not all((MOUNTED_ROOT / item[0]).is_file() for item in mounted_cases):
        return "mounted Event RAW skipped"
    for filename, step_id, duration, target, event_time in mounted_cases:
        compiled = ScenarioCompiler(
            load_json(MOUNTED_ROOT / filename),
            "1_3_10001_01",
            filename.removeprefix("scenario_").removesuffix(".json"),
            f"scenariodata/1_3_10001_01/{filename}",
        ).compile()
        current = stage(compiled, step_id)
        timeline_event(current, target, event_time, f"mounted RAW {filename} step {step_id}")
        assert_close(current["duration"], duration, f"mounted RAW {filename}")
    return "mounted Event RAW a/c/f verified"


def main() -> None:
    verify_source_only_matrix()
    mounted = "mounted Event RAW skipped by --source-only"
    if "--source-only" not in sys.argv[1:]:
        mounted = verify_mounted_raw()
    print(
        "Story timing semantics matrix: missing and pending-fade targets fail open; "
        "visible delayed cues extend short stages; authored 7.5s/6.0s published "
        f"choreography remains long; {mounted}"
    )


if __name__ == "__main__":
    main()
