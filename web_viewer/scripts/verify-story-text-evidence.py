#!/usr/bin/env python3
"""Verify localization source hashing and compiler-emitted text evidence."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_ROOT = ROOT.parent / "data_pipeline"
sys.path.insert(0, str(PIPELINE_ROOT))

from scenario_compiler import ScenarioCompiler  # noqa: E402


def load_json(path: Path):
    def reject_duplicate_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key in {path}: {key!r}")
            result[key] = value
        return result

    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle, object_pairs_hook=reject_duplicate_keys)


def assert_equal(actual, expected, label: str):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def collect_text_records(compiled: dict) -> dict[str, dict]:
    records: dict[str, dict] = {}

    def add(text_ref: dict, record: dict):
        unit_id = text_ref["unit_id"]
        if unit_id in records:
            raise AssertionError(f"duplicate compiled text unit id: {unit_id}")
        records[unit_id] = {"ref": text_ref, **record}

    for step in compiled.get("steps", []):
        dialogue = step.get("dialogue") or {}
        for key in ("speaker_text_ref", "text_ref"):
            text_ref = dialogue.get(key)
            if not text_ref:
                continue
            add(text_ref, {
                "speaker_kind": (dialogue.get("speaker_identity") or {}).get("kind"),
            })
        for option in step.get("options", []):
            for key in ("text_ref", "detail_text_ref"):
                text_ref = option.get(key)
                if not text_ref:
                    continue
                add(text_ref, {
                    "choice_id": step.get("choice_id"),
                    "option_id": option.get("option_id"),
                })
        text_time = step.get("text_time") or {}
        text_ref = text_time.get("text_ref")
        if text_ref:
            add(text_ref, {})
    return records


def verify_hash_vectors():
    fixture = load_json(ROOT / "fixtures" / "localization" / "source-hash-v1.json")
    assert_equal(fixture.get("schema_version"), 1, "hash fixture schema_version")
    for vector in fixture.get("vectors", []):
        name = vector["name"]
        normalized = ScenarioCompiler.normalize_source_text(vector["input"])
        assert_equal(normalized, vector["normalized"], f"{name} normalized text")
        assert_equal(
            ScenarioCompiler.source_text_hash(vector["input"]),
            vector["source_hash"],
            f"{name} source hash",
        )


def verify_compiler_evidence():
    fixture = load_json(
        ROOT / "fixtures" / "localization" / "scenario-text-evidence-1_4_001_01_d.json"
    )
    max_index = max(command["command_index"] for command in fixture["commands"])
    commands = [{"Type": "noop", "Values": []} for _ in range(max_index + 2)]
    for command in fixture["commands"]:
        commands[command["command_index"]] = {
            "Type": command["type"],
            "Values": command["values"],
        }

    compiler = ScenarioCompiler(
        {"Command": commands},
        fixture["scenario_id"],
        fixture["part_id"],
        fixture["source_file"],
    )
    compiled = compiler.compile()
    assert_equal(compiled["text_catalog_id"], fixture["scenario_id"], "text_catalog_id")
    assert_equal(compiled["text_contract_version"], 1, "text_contract_version")

    records = collect_text_records(compiled)
    expected_ids = {entry["unit_id"] for entry in fixture["expected"]}
    assert_equal(set(records), expected_ids, "compiled text unit set")

    for expected in fixture["expected"]:
        unit_id = expected["unit_id"]
        if unit_id not in records:
            raise AssertionError(f"missing compiled text unit: {unit_id}")
        actual = records[unit_id]
        text_ref = actual["ref"]
        source = text_ref["source"]
        assert_equal(text_ref["source_hash"], expected["source_hash"], f"{unit_id} hash")
        assert_equal(source["field_kind"], expected["field_kind"], f"{unit_id} field kind")
        assert_equal(source["field_ordinal"], expected["field_ordinal"], f"{unit_id} ordinal")
        assert_equal(source["scenario_id"], fixture["scenario_id"], f"{unit_id} scenario")
        assert_equal(source["part_id"], fixture["part_id"], f"{unit_id} part")
        assert_equal(source["file"], fixture["source_file"], f"{unit_id} file")
        if os.path.isabs(source["file"]) or "\\" in source["file"]:
            raise AssertionError(f"non-canonical source path: {source['file']}")
        if "speaker_kind" in expected:
            assert_equal(actual.get("speaker_kind"), expected["speaker_kind"], f"{unit_id} speaker")
        if "choice_id" in expected:
            assert_equal(actual.get("choice_id"), expected["choice_id"], f"{unit_id} choice")
            assert_equal(actual.get("option_id"), expected["option_id"], f"{unit_id} option")


def verify_schema_contracts():
    compiled_schema = load_json(ROOT / "schemas" / "compiled-scenario-v2.schema.json")
    authoritative_schema = load_json(ROOT / "schemas" / "compiled-scenario-v2-authoritative.schema.json")
    overlay_schema = load_json(ROOT / "schemas" / "story-translation-overlay-v1.schema.json")
    entity_schema = load_json(ROOT / "schemas" / "entity-translation-overlay-v1.schema.json")
    assert_equal(compiled_schema["$defs"]["textRef"]["additionalProperties"], False, "textRef strictness")
    assert_equal(compiled_schema["additionalProperties"], True, "compatibility schema remains permissive")
    assert_equal(authoritative_schema["additionalProperties"], False, "authoritative top-level strictness")
    assert_equal(authoritative_schema["$defs"]["step"]["additionalProperties"], False, "authoritative step strictness")
    assert_equal(authoritative_schema["$defs"]["dialogue"]["additionalProperties"], False, "authoritative dialogue strictness")
    assert_equal(authoritative_schema["$defs"]["snapshot"]["additionalProperties"], False, "authoritative snapshot top-level strictness")
    for snapshot_def_name in (
        "vector2",
        "vector3",
        "durationTransition",
        "backgroundEffect",
        "backgroundProfile",
        "backgroundTransition",
        "environmentalState",
        "imageIcon",
        "screenFadeState",
        "screenSlideState",
        "fadeOverlay",
        "directionalWipeOverlay",
        "fadeScreenEffect",
        "singleScreenEffect",
        "spineFade",
        "spineState",
    ):
        assert_equal(
            authoritative_schema["$defs"][snapshot_def_name]["additionalProperties"],
            False,
            f"authoritative {snapshot_def_name} strictness",
        )
    for payload_name in (
        "cameraPayload",
        "backgroundPayload",
        "sePayload",
        "directionalWipePayload",
        "screenFadePayload",
        "spineMotionPayload",
        "spineExpressionPayload",
        "spineStopPayload",
        "spineTintPayload",
    ):
        assert_equal(
            authoritative_schema["$defs"][payload_name]["additionalProperties"],
            False,
            f"authoritative {payload_name} strictness",
        )
    assert_equal(len(authoritative_schema["$defs"]["cue"]["oneOf"]), 10, "authoritative cue action contract count")
    assert_equal(authoritative_schema["properties"]["runtime_contract"]["const"], "story-runtime-v2", "authoritative runtime contract")
    assert_equal(overlay_schema["properties"]["schema_version"]["const"], 1, "overlay schema")
    assert_equal(entity_schema["properties"]["schema_version"]["const"], 1, "entity schema")


def verify_overlay_fixture():
    evidence = load_json(
        ROOT / "fixtures" / "localization" / "scenario-text-evidence-1_4_001_01_d.json"
    )
    overlay = load_json(ROOT / "fixtures" / "localization" / "scenario-overlay-zh-CN.json")
    assert_equal(overlay.get("schema_version"), 1, "overlay schema_version")
    assert_equal(overlay.get("locale"), "zh-CN", "overlay locale")
    assert_equal(overlay.get("scenario_id"), evidence["scenario_id"], "overlay scenario")
    expected_hashes = {entry["unit_id"]: entry["source_hash"] for entry in evidence["expected"]}
    allowed_statuses = {"draft", "reviewed", "final"}
    seen = set()
    for unit_id, entry in overlay.get("entries", {}).items():
        if unit_id in seen:
            raise AssertionError(f"duplicate overlay unit id: {unit_id}")
        seen.add(unit_id)
        if unit_id not in expected_hashes:
            raise AssertionError(f"orphaned fixture translation: {unit_id}")
        assert_equal(entry.get("source_hash"), expected_hashes[unit_id], f"{unit_id} overlay hash")
        if entry.get("status") not in allowed_statuses:
            raise AssertionError(f"invalid translation status for {unit_id}: {entry.get('status')!r}")
        if not isinstance(entry.get("text"), str) or not entry["text"]:
            raise AssertionError(f"empty fixture translation: {unit_id}")
        forbidden = {"step_id", "target_step_id", "voice", "lip", "timeline", "cues", "snapshot", "state"}
        found_forbidden = forbidden.intersection(entry)
        if found_forbidden:
            raise AssertionError(f"overlay entry owns runtime fields: {sorted(found_forbidden)}")

    stale_unit_id, fixture_entry = next(iter(overlay["entries"].items()))
    stale_probe = dict(fixture_entry)
    stale_probe["source_hash"] = "sha256:" + "0" * 64
    stale = stale_probe["source_hash"] != expected_hashes[stale_unit_id]
    if not stale:
        raise AssertionError("stale probe was not derived from source-hash mismatch")


def main():
    verify_hash_vectors()
    verify_compiler_evidence()
    verify_schema_contracts()
    verify_overlay_fixture()
    print("Story text evidence verification passed.")


if __name__ == "__main__":
    main()
