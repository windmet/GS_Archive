#!/usr/bin/env python3
"""Refresh only Object_layer hide/duration fields from exact indexed RAW TextAssets."""
import argparse
import copy
import csv
import hashlib
import io
import json
from pathlib import Path
import sys

import UnityPy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_object_commands import object_layer_events
from live_chibi_raw_semantics import text_asset_payload, sha256_file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    source_path = sources.published_path('assets/live-chibi/choreography/index.json')
    output, receipt_path = args.output.resolve(), args.receipt.resolve()
    if output.is_relative_to(sources.raw_root.resolve()):
        parser.error('Output cannot be inside RAW')
    if receipt_path.is_relative_to(sources.raw_root.resolve()) or receipt_path.is_relative_to(sources.publish_root.resolve()):
        parser.error('Receipt must be outside RAW and published assets')
    if receipt_path == output:
        parser.error('Output and receipt must be distinct')
    before = json.loads(source_path.read_text(encoding='utf-8'))
    after = copy.deepcopy(before)
    by_code = {}
    for song in after['songs']:
        by_code.setdefault(song['songCode'], []).append(song)
    evidence, changes = [], []
    raw_root = (sources.raw_root / 'asset').resolve()
    for code, songs in sorted(by_code.items()):
        path = (raw_root / f'song_{code}.unity3d').resolve()
        if path.parent != raw_root:
            raise ValueError('Unsafe indexed bundle')
        wanted = {song['source'].removesuffix('.csv'): song for song in songs}
        if len(wanted) != len(songs):
            raise ValueError('Duplicate indexed source')
        found = set()
        environment = UnityPy.load(str(path))
        bundle_hash = sha256_file(path)
        for obj in environment.objects:
            if obj.type.name != 'TextAsset':
                continue
            text = obj.read()
            if text.m_Name not in wanted:
                continue
            if text.m_Name in found:
                raise ValueError('Ambiguous RAW TextAsset')
            found.add(text.m_Name)
            payload = text_asset_payload(text)
            rows = list(csv.reader(io.StringIO(payload.decode('utf-8-sig'), newline='')))
            song = wanted[text.m_Name]
            old = song['objectLayerEvents']
            new = object_layer_events(rows)
            strip = lambda events: [{k: v for k, v in event.items() if k not in ('hide', 'duration')} for event in events]
            if strip(old) != strip(new):
                raise ValueError(f"Unexpected non-control change: {song['id']}")
            changes.extend({'songId': song['id'], 'time': a['time'], 'asset': a['asset'],
                            'before': {k: a[k] for k in ('hide', 'duration')},
                            'after': {k: b[k] for k in ('hide', 'duration')}}
                           for a, b in zip(old, new) if a != b)
            song['objectLayerEvents'] = new
            evidence.append({'songId': song['id'], 'bundle': path.name, 'bundleSha256': bundle_hash,
                             'serializedFile': obj.assets_file.name, 'pathId': str(obj.path_id),
                             'textSha256': hashlib.sha256(payload).hexdigest(),
                             'controlColumns': {name: rows[0].index(name) for name in ('value101', 'value102')}})
        if found != wanted.keys():
            raise ValueError('Missing indexed RAW TextAsset')
    # All other fields/arrays are copied exactly; keep the compatible schema.
    body = (json.dumps(after, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    receipt = {'schemaVersion': 1, 'status': 'raw_named_control_repair',
               'inputSha256': sha256_file(source_path), 'outputSha256': hashlib.sha256(body).hexdigest(),
               'arrangements': len(evidence), 'changedEvents': len(changes), 'changes': changes, 'sources': evidence}
    output.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    output.with_suffix('.tmp.json').write_bytes(body)
    output.with_suffix('.tmp.json').replace(output)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: receipt[k] for k in ('arrangements', 'changedEvents', 'outputSha256')}))


if __name__ == '__main__':
    main()
