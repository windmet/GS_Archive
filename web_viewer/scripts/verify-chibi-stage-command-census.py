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
all_rows = [['type', 'time', 'value1'], ['#Penlight', '0'], [], ['Penlight', '-2000'],
            ['Livechara_mouth_shape_fix', '10'], ['Livechara_foot_color_solo', '20'],
            ['Livechara_Offset', '30'], ['Underlight_future', '40'], ['Unknown_Command', '50'],
            ['Smoke', '60']]
all_record = census.census_rows(all_rows)
assert all_record['allCommands'] == {command: 1 for command in [
    'Penlight', 'Livechara_mouth_shape_fix', 'Livechara_foot_color_solo', 'Livechara_Offset',
    'Underlight_future', 'Unknown_Command', 'Smoke']}
all_summary = census.summarize_records([all_record, census.census_rows([['Unknown_Command', '100']])])
assert all_summary['allCommands']['Unknown_Command'] == 2
assert all_summary['allAffectedArrangements']['Unknown_Command'] == 2
assert all_summary['allAffectedArrangements']['Livechara_Offset'] == 1
all_record.update(songId='song_live_effect', songCode='song', source='song_live_effect',
                  bundle='song_song.unity3d', serializedFile='CAB-test', pathId='42', textSha256='a' * 64)
inventory = census.compact_inventory({'choreographyIndexSha256': 'b' * 64, 'arrangements': 1, 'nonTimedCommands': {},
    'allCommands': all_record['allCommands'], 'allAffectedArrangements': {}, 'bundles': [], 'records': [all_record]})
assert inventory['songs']['song_live_effect']['commands']['Smoke'] == 1
assert inventory['songs']['song_live_effect']['raw']['textSha256'] == 'a' * 64
assert 'firstRows' not in inventory['songs']['song_live_effect']  # No full CSV arguments published.
annotations = census.census_rows([['type','time'],['指定形式_#Livechara_motion','说明'],['Future','NaN'],['Future','12']])
assert annotations['nonTimedCommands'] == {'Future': 1, '指定形式_#Livechara_motion': 1}
assert annotations['allCommands']['Future'] == 2  # Retained, not silently dropped as a comment.
print("PASS native stage command census: family suffixes, source order, raw flag and empty fields")
