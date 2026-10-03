#!/usr/bin/env python3
"""Pure checks for command-family and untouched backmonitor-field census."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("census", Path(__file__).with_name(
    "audit-live-chibi-stage-command-coverage.py"))
census = importlib.util.module_from_spec(spec)
spec.loader.exec_module(census)
rows = [[], ["#Searchlight_show_2", "100"], ["Searchlight_show_2", "900", "late"],
        ["Searchlight_show_2", "100", "early"], ["NewSuspensionlight_create", "10"],
        ["Suspensionlight", "20"], ["Suspensionlight_fake_variant", "30"],
        ["Penlight_unit", "40"], ["NotSearchlight", "50"], ["Searchlightish", "60"],
        ["Backmonitor", "95850", "trhorz_01", "", "-7", "340", "920", " 1 ", "1000"],
        ["Backmonitor", "-2000", "unique_black", "", "", "", "", "0"],
        ["Backmonitor", "0"],
        ["Backmonitor", "5", "", "", "", "", "", ""]]
record = census.census_rows(rows)
assert record["families"] == {"NewSuspensionlight": 1, "Penlight": 1,
                               "Searchlight": 2, "Suspensionlight": 2}
assert "Suspensionlight_fake_variant" in record["commands"]  # Unknown suffix is still inventoried.
assert record["firstRows"]["Searchlight_show_2"][1] == "900"
assert record["lastRows"]["Searchlight_show_2"][1] == "100"  # Source order, not playback order.
assert record["backmonitorRows"][0] == {"sourceRow": 11, "row": rows[10], "rawValue6": "1"}
assert rows[10][7] == " 1 "  # Raw source remains intact.
assert record["backmonitorRows"][2]["rawValue6"] is None
summary = census.summarize_records([record, census.census_rows([])])
assert summary["affectedFamilies"]["Searchlight"] == 1
assert summary["backmonitorRawValue6"] == {"": 1, "0": 1, "1": 1, "<missing>": 1}
assert summary["backmonitorNonzeroValue6Arrangements"] == 1
assert census.command_family("Searchlight") == "Searchlight"
assert census.command_family("Searchlightish") is None
print("PASS native stage command census: family suffixes, source order, raw flag and empty fields")
