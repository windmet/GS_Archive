#!/usr/bin/env python3
"""Compile Yamamura's office system voices into one-step story-player previews.

The login-bonus and work-menu lines (scenario_4_1_101_00/01) are ordinary ADV scripts:
model 101ken_001_00 on bg001_315pro_in_01, with face/animation cues and adxlip curves.
The shared compiler emits those steps; only the voice name is rewritten, because these
system scripts name cues by label (a1000 or 4_1_101_0N_a1000) instead of by voice sheet.

Writes src/data/officeVoicePreviews.json: { cue: step } for every line in officeSystemVoices.json.
Usage: python scripts/build-office-voice-previews.py [rawScenarioDir]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT.parent / "data_pipeline"))
from sidem_scenario.compiler import ScenarioCompiler  # noqa: E402

RAW_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "E:/BaiduNetdiskDownload/SideM/scripts/scenariodata") / "4_x_101ken"
VOICES = json.loads((PROJECT_ROOT / "src/data/officeSystemVoices.json").read_text(encoding="utf-8"))
TARGET = PROJECT_ROOT / "src/data/officeVoicePreviews.json"


def main() -> None:
    wanted = {line["cue"] for scene in VOICES["scenes"] for line in scene["lines"]}
    previews = {}
    for script in ("00", "01"):
        compiled = ScenarioCompiler.compile_file(str(RAW_DIR / f"scenario_4_1_101_{script}.json"))
        for step in compiled["steps"]:
            dialogue = step.get("dialogue") or {}
            lip = (dialogue.get("lip") or {}).get("path") or ""
            cue = Path(lip).stem
            if cue not in wanted or not dialogue.get("voice"):
                continue
            # adxlip/101ken/4_1_101_01/4_1_101_01_a1000.json names the real cue; the compiled voice does not.
            dialogue["voice"] = f"{cue}.m4a"
            dialogue["text_cn"] = ""
            spines = step["state"]["spines"]
            assert [spine["model"] for spine in spines] == [VOICES["speaker"]["model"]], cue
            previews[cue] = {"source_scenario_id": compiled["scenario_id"], "step": step}
    missing = wanted - previews.keys()
    assert not missing, f"no compiled step for {sorted(missing)}"
    TARGET.write_text(json.dumps({"schema": "GS-OFFICE-VOICE-PREVIEWS-V1", "previews": dict(sorted(previews.items()))}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(previews)} office previews -> {TARGET.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
