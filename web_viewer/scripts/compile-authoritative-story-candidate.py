"""Compile one compatibility scenario JSON to Python-native authoritative v2."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_ROOT = ROOT.parent / "data_pipeline"
sys.path.insert(0, str(PIPELINE_ROOT))

from scenario_compiler import ScenarioCompiler  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--compiler-version", default="scenario-compiler-python-v2")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    if output_path == ROOT or ROOT in output_path.parents:
        raise ValueError("Candidate output must be outside the web_viewer workspace")
    with input_path.open("r", encoding="utf-8") as handle:
        compatibility = json.load(handle)
    authoritative = ScenarioCompiler.to_authoritative(compatibility, args.compiler_version)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(authoritative, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Python authoritative candidate: {output_path} ({len(authoritative['steps'])} steps)")


if __name__ == "__main__":
    main()
