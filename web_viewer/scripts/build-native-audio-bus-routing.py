#!/usr/bin/env python3
"""Build src/data/nativeAudioBusRouting.json from the client's CRI audio data.

The client applies no per-call filter: StoryView/PhoneDisplay only call
SoundManager.PlaySe/PlayVoice(cueSheet, cue). Phone and "TV" sound comes from
authoring in two places, both read here byte for byte:

* each ACB cue's bus sends (command 0x006f: u16 index into the ACB's
  StringValueTable, u16 level / 10000). When a cue lists sends, only those
  buses receive it: a cue with just `bus_phone` has no dry MasterOut signal.
* glowing.acf (IPA /Data/Raw/ADX2/glowing.acf), DspBusSetting_0 default
  snapshot: the bus volumes, their DSP chains and where each bus sends.

Only cues whose sends differ from the default "MasterOut 1.0" are written.
Live-only sheets (song3_*, crowd_*) and stage_master routing are out of scope.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import struct
import sys
import zipfile
from collections import Counter
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = WEB_ROOT.parent
sys.path.insert(0, str(REPO_ROOT / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources  # noqa: E402
from cri_utf import UtfTable, parse_track_commands, table_index_list  # noqa: E402

_spec = importlib.util.spec_from_file_location('acf_audit', WEB_ROOT / 'scripts' / 'audit-cri-acf-mixer.py')
acf_audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(acf_audit)

OUTPUT = WEB_ROOT / 'src' / 'data' / 'nativeAudioBusRouting.json'
ACF_ENTRY = '/Data/Raw/ADX2/glowing.acf'
DSP_SETTING = 'DspBusSetting_0'  # SoundManager.DSP_BUS_SETTING
ROUTED_BUSES = ('bus_phone', 'bus_reverb')
LIVE_ONLY_PREFIXES = ('song3_', 'crowd_')
DEFAULT_SENDS = (('MasterOut', 1.0),)
SEND_BUS = '0x006f'
NOTE_ON = '0x07d0'


def sub_table(row: dict, name: str) -> UtfTable | None:
    value = row.get(name)
    return UtfTable(value) if isinstance(value, bytes) and value[:4] == b'@UTF' else None


def bus_sends(commands: list[dict]) -> list[tuple[int, float]]:
    out = []
    for command in commands:
        if command['command'] == SEND_BUS:
            raw = bytes.fromhex(command['argument_hex'])
            out.append((int.from_bytes(raw[:2], 'big'), int.from_bytes(raw[2:4], 'big') / 10000))
    return out


def acb_cue_sends(data: bytes) -> dict[str, tuple[tuple[str, float], ...]]:
    """Every cue's bus sends, gathered from sequence, track, track-event and synth commands."""
    top = UtfTable(data).rows[0]
    strings_table = sub_table(top, 'StringValueTable')
    strings = [row['StringValue'] for row in strings_table.rows] if strings_table else []
    tables = {name: sub_table(top, name) for name in (
        'CueTable', 'CueNameTable', 'SequenceTable', 'SynthTable', 'TrackTable', 'SeqCommandTable',
        'SynthCommandTable', 'TrackCommandTable', 'CommandTable', 'TrackEventTable')}

    def commands_of(table: UtfTable | None) -> list[list[dict]]:
        return [parse_track_commands(row['Command']) if row.get('Command') else [] for row in table.rows] if table else []

    seq_cmds = commands_of(tables['SeqCommandTable'])
    synth_cmds = commands_of(tables['SynthCommandTable'])
    track_cmds = commands_of(tables['TrackCommandTable'] or tables['CommandTable'])
    event_cmds = commands_of(tables['TrackEventTable'])
    rows = {name: tables[name].rows if tables[name] else [] for name in ('SequenceTable', 'SynthTable', 'TrackTable')}
    names = {row['CueIndex']: row['CueName'] for row in tables['CueNameTable'].rows} if tables['CueNameTable'] else {}

    def at(commands: list[list[dict]], index: int) -> list[dict]:
        return commands[index] if index != 65535 and index < len(commands) else []

    def synth(index: int, depth: int = 0) -> list[tuple[int, float]]:
        row = rows['SynthTable'][index]
        found = bus_sends(at(synth_cmds, row['CommandIndex']))
        items = table_index_list(row['ReferenceItems']) if row.get('ReferenceItems') else []
        for k in range(0, len(items) - 1, 2):
            if items[k] == 2 and depth < 4:
                found += synth(items[k + 1], depth + 1)
        return found

    cues = {}
    for index, cue in enumerate(tables['CueTable'].rows if tables['CueTable'] else []):
        found: list[tuple[int, float]] = []
        if cue['ReferenceType'] == 3 and cue['ReferenceIndex'] < len(rows['SequenceTable']):
            sequence = rows['SequenceTable'][cue['ReferenceIndex']]
            found += bus_sends(at(seq_cmds, sequence['CommandIndex']))
            for track_index in table_index_list(sequence['TrackIndex']) if sequence.get('TrackIndex') else []:
                track = rows['TrackTable'][track_index]
                found += bus_sends(at(track_cmds, track['CommandIndex']))
                for command in at(event_cmds, track['EventIndex']):
                    raw = bytes.fromhex(command['argument_hex'])
                    if command['command'] == NOTE_ON and int.from_bytes(raw[:2], 'big') == 2:
                        found += synth(int.from_bytes(raw[2:4], 'big'))
                found += bus_sends(at(event_cmds, track['EventIndex']))
        elif cue['ReferenceType'] == 1 and cue['ReferenceIndex'] < len(rows['SynthTable']):
            found += synth(cue['ReferenceIndex'])
        named = {}
        for bus, level in found:
            if bus >= len(strings):
                raise ValueError(f'bus index {bus} outside StringValueTable')
            named[strings[bus]] = level
        cues[names.get(index, str(index))] = tuple(sorted(named.items()))
    return cues


def read_acf(ipa: Path) -> tuple[bytes, str]:
    with zipfile.ZipFile(ipa) as archive:
        entry = acf_audit.find_entry(archive.namelist(), ACF_ENTRY)
        return archive.read(entry), entry


def acf_buses(acf: bytes) -> dict:
    """Default-snapshot bus volume, DSP chain and outgoing sends of the routed buses."""
    tables = {table['name']: table for table in acf_audit.parse_all_utf_tables(acf) if table['name']}
    setting = next(row for row in tables['DspSetting']['rows'] if row['Name'] == DSP_SETTING)
    names = {index: row['StringValue'] for index, row in enumerate(tables['BusName']['rows'])}
    fx_table = tables['DspFx']
    links = tables['BusLink']['rows']
    buses = tables['Bus']['rows'][setting['StartIndex']:setting['StartIndex'] + setting['NumBuses']]
    out = {}
    for bus in buses:
        name = names[bus['BusNameIndex']]
        if name not in ROUTED_BUSES:
            continue
        fx = []
        for row in fx_table['rows'][bus['StartFxIndex']:bus['StartFxIndex'] + bus['NumFxs']] if bus['NumFxs'] else []:
            raw = bytes.fromhex(acf_audit._data_ref_hex(acf, fx_table, row['Parameters']))
            params = struct.unpack(f'>{len(raw) // 4}f', raw)
            if len(params) != row['NumParameters'] or row['Bypass']:
                raise ValueError(f'{name}: unexpected {row["DspName"]} parameter block')
            fx.append({'dsp': row['DspName'], 'params': [round(value, 4) for value in params]})
        sends = {}
        for link in links[bus['StartBusLinkIndex']:bus['StartBusLinkIndex'] + bus['NumBusLinks']] if bus['NumBusLinks'] else []:
            sends[names[link['BusNameIndex']]] = round(link['SendLevel'], 4)
        out[name] = {'volume': round(bus['Volume'], 4), 'sends': sends, 'fx': fx}
    missing = set(ROUTED_BUSES) - set(out)
    if missing:
        raise ValueError(f'buses missing from {DSP_SETTING}: {sorted(missing)}')
    return out


def build(ipa: Path, acb_root: Path) -> tuple[dict, Counter]:
    acf, entry = read_acf(ipa)
    profiles: list[tuple[tuple[str, float], ...]] = []
    sheets: dict[str, dict[str, int]] = {}
    voice: dict[str, int] = {}
    digests = hashlib.sha256()
    counts: Counter = Counter()
    acb_files = sorted(acb_root.glob('*.acb'))
    for path in acb_files:
        data = path.read_bytes()
        digests.update(path.name.encode() + b'\0' + hashlib.sha256(data).digest())
        sheet = path.stem
        if sheet.startswith(LIVE_ONLY_PREFIXES):
            continue
        try:
            cues = acb_cue_sends(data)
        except Exception as error:  # a few banks are not cue tables at all
            counts['unreadable_acb'] += 1
            print(f'skip {path.name}: {error}', file=sys.stderr)
            continue
        for cue, sends in cues.items():
            if not sends or sends == DEFAULT_SENDS:
                continue
            buses = {bus for bus, _ in sends} - {'MasterOut'}
            if not buses <= set(ROUTED_BUSES):
                raise ValueError(f'{sheet}/{cue} routes to {sorted(buses)} outside the story buses')
            if sends not in profiles:
                profiles.append(sends)
            profile = profiles.index(sends)
            sheets.setdefault(sheet, {})[cue] = profile
            counts['routed_cues'] += 1
            # Voice sheets are named after the scenario; their cues are the m4a stems.
            if sheet[:1].isdigit():
                if voice.get(cue, profile) != profile:
                    raise ValueError(f'voice cue {cue} has conflicting routes')
                voice[cue] = profile
    routing = {
        'schema': 'sidem-native-audio-bus-routing.v1',
        'source': {
            'acf': {'entry': entry, 'sha256': hashlib.sha256(acf).hexdigest(), 'dsp_setting': DSP_SETTING},
            'acb': {'root': 'RAW/audio', 'count': len(acb_files), 'digest': digests.hexdigest()},
        },
        'buses': acf_buses(acf),
        'profiles': [dict(sends) for sends in profiles],
        'sheets': {sheet: dict(sorted(cues.items())) for sheet, cues in sorted(sheets.items()) if not sheet[:1].isdigit()},
        'voice': compact_voice(voice),
    }
    counts['voice_cues'] = len(voice)
    counts['sheets'] = len(routing['sheets'])
    return routing, counts


def compact_voice(voice: dict[str, int]) -> dict[str, list[str]]:
    """{profile: [cue, ...]} keeps the table small; the runtime expands it to a Map."""
    grouped: dict[str, list[str]] = {}
    for cue, profile in sorted(voice.items()):
        grouped.setdefault(str(profile), []).append(cue)
    return grouped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ipa', type=Path, required=True, help='サイスタ IPA holding glowing.acf')
    parser.add_argument('--acb-root', type=Path, help='defaults to <raw_root>/audio from the archive sources')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    add_sources_config_argument(parser)
    args = parser.parse_args()
    acb_root = args.acb_root or load_archive_sources(args.sources_config).raw_root / 'audio'
    routing, counts = build(args.ipa, acb_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(routing, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'output': str(args.output), **counts, 'profiles': len(routing['profiles'])}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
