#!/usr/bin/env python3
"""Verify that live-chibi audio metadata inspection never decodes into RAW."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("prepare-live-chibi-audio.py")
SPEC = importlib.util.spec_from_file_location("prepare_live_chibi_audio", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load {SCRIPT_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


commands: list[list[str]] = []


def fake_run_json(command: list[str]) -> dict:
    commands.append(command)
    selection = int(command[command.index("-s") + 1]) if "-s" in command else 1
    return {
        "sampleRate": 44_100,
        "channels": 2,
        "numberOfSamples": 5_745_601,
        "encoding": "CRI HCA",
        "streamInfo": {
            "name": f"song3_fixture_{selection}",
            "total": 3,
        },
    }


with patch.object(MODULE, "run_json", side_effect=fake_run_json):
    streams = MODULE.inspect_streams(Path("vgmstream-cli"), Path("song3_fixture.acb"))

assert [stream["selection"] for stream in streams] == [1, 2, 3]
assert len(commands) == 3
for command in commands:
    assert "-m" in command, f"metadata inspection must use -m: {command}"
    assert "-I" in command, f"metadata inspection must request JSON info: {command}"
    assert "-o" not in command, f"metadata inspection must not name an output: {command}"
    assert "-p" not in command, f"metadata inspection must not decode to stdout: {command}"

assert commands[0] == [
    "vgmstream-cli",
    "-m",
    "-I",
    "song3_fixture.acb",
]
assert commands[1] == [
    "vgmstream-cli",
    "-m",
    "-s",
    "2",
    "-I",
    "song3_fixture.acb",
]

print("Live-chibi audio metadata inspection is decode-free.")
