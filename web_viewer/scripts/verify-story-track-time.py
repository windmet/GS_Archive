"""RAW fourth-column -> compatibility/authoritative offset regression."""
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "data_pipeline"))
from scenario_compiler import ScenarioCompiler, ScenarioState
from sidem_scenario.authoritative import _normalized_snapshots, _legacy_cues, compile_authoritative_scenario


def command(kind, *values):
    return {"Type": kind, "Values": list(values)}


raw = {"Command": [command("idol_model", "004ter", "004ter_001_00"),
                   command("idol_fadein", "004ter", "0", "0"),
                   command("idol_animation", "004ter", "0", "angry", ".1"),
                   command("idol_animation", "004ter", "2.7", "weight", ".6"),
                   command("text", "", "first", "004ter", ""),
                   command("text", "", "second", "004ter", "")]}
compiled = ScenarioCompiler(raw, "track_time_fixture").compile()
assert compiled["steps"][0]["state"]["spines"][0]["anim_track_time"] == .1
assert compiled["steps"][0]["timeline"][0]["track_time"] == .6
assert compiled["steps"][1]["state"]["spines"][0]["anim_track_time"] == .6

for kind in ("idol_animation", "idol_nobackanimation"):
    compiler = ScenarioCompiler({"Command": []}, "track-time-fixture")
    compiler.state.spawn_spine("004ter", "004ter_001_00")
    handler = getattr(compiler, "_" + kind)
    handler(["004ter", "0", "angry", ".1"])
    assert compiler.state.find_spine("004ter")["anim_track_time"] == .1
    handler(["004ter", "2.7", "weight", ".6"])
    assert compiler._timeline_events[-1]["track_time"] == .6
    compiler._apply_timeline()
    assert compiler.state.find_spine("004ter")["anim_track_time"] == .6
    if kind == "idol_nobackanimation":
        assert compiler.state.find_spine("004ter")["anim_no_back"] is True
    for raw in ([], ["004ter", "0", "angry"], ["004ter", "0", "angry", "目"],
                ["004ter", "0", "angry", "nan"], ["004ter", "0", "angry", "inf"]):
        assert compiler._animation_track_time(raw) == 0
    handler(["004ter", "0", "angry", ""])
    assert "anim_track_time" not in compiler.state.find_spine("004ter")

state = ScenarioState()
state.spawn_spine("004ter", "004ter_001_00")
state.update_spine_anim("004ter", "angry", .1)
state.spawn_spine("004ter", "004ter_002_00")
assert "anim_track_time" not in state.find_spine("004ter"), "model reset must clear the offset"

scenario = {"steps": [{"step_id": 1, "type": "adv", "state": {"spines": [{"id": "004ter", "anim": "angry", "anim_track_time": .1}]},
                       "timeline": [{"type": "spine_anim", "chara_id": "004ter", "value": "weight", "time": 2.7, "track_time": .6}]},
                      {"step_id": 2, "type": "adv", "state": {"spines": [{"id": "004ter", "anim": "weight", "anim_track_time": .6}]},
                       "timeline": [{"type": "spine_anim", "chara_id": "004ter", "value": "wait_loop", "time": 1}]}]}
normalized = {"steps": [{"entry_snapshot": _normalized_snapshots(step, None)[0], "settled_snapshot": _normalized_snapshots(step, None)[1], "cues": _legacy_cues(step)} for step in scenario["steps"]]}
assert normalized["steps"][0]["entry_snapshot"]["spines"][0]["anim_track_time"] == .1
assert normalized["steps"][0]["settled_snapshot"]["spines"][0]["anim_track_time"] == .6
assert normalized["steps"][0]["cues"][0]["payload"]["track_time"] == .6
assert "anim_track_time" not in normalized["steps"][1]["settled_snapshot"]["spines"][0]

fixture = json.loads((ROOT / "fixtures/story-runtime/compatibility-v1-authoritative-source.json").read_text(encoding="utf-8"))
fixture["steps"][0]["state"]["spines"][0]["anim_track_time"] = .1
fixture["steps"][0].setdefault("timeline", []).append({"type": "spine_anim", "chara_id": "001tom", "value": "weight", "time": 2.7, "track_time": .6})
authoritative = compile_authoritative_scenario(fixture)
assert authoritative["steps"][0]["entry_snapshot"]["spines"][0]["anim_track_time"] == .1
assert authoritative["steps"][0]["settled_snapshot"]["spines"][0]["anim_track_time"] == .6
assert next(c for c in authoritative["steps"][0]["cues"] if c["action"] == "spine.body.play")["payload"]["track_time"] == .6
print("Story track time: RAW body/noback immediate and delayed offsets, invalid defaults, model reset and Python snapshot/cue propagation passed")
