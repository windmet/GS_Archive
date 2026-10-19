#!/usr/bin/env python3
"""Extract all indexed Penlight named events without rewriting shared assets."""
import argparse
import csv
import hashlib
import io
import json
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_penlight_commands import penlight_events
from sidem_masterdata.named_wire import fields


def penlight_masterdata(data):
    """Project only native IdolData.PenlightColorCode and SongData.IdolType."""
    colors, types = {}, {}
    for row in fields(data):
        if row.number not in (2, 46):
            continue
        if row.wire_type != 2:
            raise ValueError('Unexpected Penlight masterdata table wire')
        by_number = {}
        for field in fields(row.value):
            if field.number in ((10, 39) if row.number == 2 else (4, 13)):
                if field.number in by_number:
                    raise ValueError('Duplicate singular Penlight masterdata field')
                by_number[field.number] = field
        def string(number):
            value = by_number.get(number)
            if not value:
                return ''
            if value.wire_type != 2:
                raise ValueError('Invalid Penlight masterdata string wire')
            return value.value.decode('utf-8')
        if row.number == 2:
            code, color = string(10), string(39)
            if not code or code in colors or not re.fullmatch(r'#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?', color):
                raise ValueError('Invalid or duplicate native idol Penlight color')
            colors[code] = color
        else:
            code, field = string(4), by_number.get(13)
            if field and field.wire_type != 0:
                raise ValueError('Invalid SongData.IdolType wire')
            value = field.value if field else 0
            if not code or code in types and types[code] != value:
                raise ValueError('Invalid/conflicting SongData.IdolType')
            types[code] = value
    return colors, types


def main():
    from live_chibi_raw_semantics import text_asset_payload, sha256_file
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/stage-penlight-commands.json')
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    master_path = sources.masterdata_input('decoded')
    master_bytes = master_path.read_bytes()
    master_hash = hashlib.sha256(master_bytes).hexdigest()
    if sources.masterdata_decoded_sha256 and master_hash != sources.masterdata_decoded_sha256:
        raise ValueError('Penlight masterdata hash does not match source configuration')
    idol_colors, idol_types = penlight_masterdata(master_bytes)
    index_path = ROOT / 'public/assets/live-chibi/choreography/index.json'
    model_path = ROOT / 'public/assets/live-chibi/penlight/index.json'
    output = args.output.resolve()
    if output.is_relative_to(sources.raw_root.resolve()) or output in (index_path.resolve(), model_path.resolve()):
        parser.error('Penlight commands must not overwrite RAW or resource inputs')
    index_hash, model_hash = sha256_file(index_path), sha256_file(model_path)
    songs = json.loads(index_path.read_text(encoding='utf-8'))['songs']
    by_code = {}
    for song in songs:
        by_code.setdefault(song['songCode'], []).append(song)
    tracks, bundles = {}, []
    import UnityPy
    raw_root = (sources.raw_root / 'asset').resolve()
    for code, entries in sorted(by_code.items()):
        path = (raw_root / f'song_{code}.unity3d').resolve()
        if path.parent != raw_root:
            raise ValueError('Unsafe indexed Penlight bundle')
        bundle_hash = sha256_file(path)
        wanted = {song['source'].removesuffix('.csv'): song for song in entries}
        if len(wanted) != len(entries):
            raise ValueError('Duplicate Penlight source identity')
        found = set()
        for obj in UnityPy.load(str(path)).objects:
            if obj.type.name != 'TextAsset':
                continue
            text = obj.read()
            if text.m_Name not in wanted:
                continue
            if text.m_Name in found:
                raise ValueError('Ambiguous Penlight TextAsset')
            found.add(text.m_Name)
            song = wanted[text.m_Name]
            payload = text_asset_payload(text)
            rows = list(csv.reader(io.StringIO(payload.decode('utf-8-sig', errors='surrogateescape'))))
            try:
                events = penlight_events(rows)
            except ValueError as error:
                raise ValueError(f'{song["id"]}: {error}') from error
            if code not in idol_types:
                raise ValueError(f'Native SongData.IdolType unavailable: {code}')
            tracks[song['id']] = {'songCode': code, 'source': song['source'], 'nativeIdolType': idol_types[code], 'events': events,
                'raw': {'bundle': path.name, 'serializedFile': obj.assets_file.name,
                        'pathId': str(obj.path_id), 'textSha256': hashlib.sha256(payload).hexdigest()}}
        if found != wanted.keys() or sha256_file(path) != bundle_hash:
            raise ValueError(f'Missing/changed Penlight RAW input: {code}')
        bundles.append({'name': path.name, 'sha256': bundle_hash})
    if len(tracks) != len(songs) or sha256_file(index_path) != index_hash or sha256_file(model_path) != model_hash or sha256_file(master_path) != master_hash:
        raise ValueError('Penlight source inputs changed or lost an arrangement')
    body = {'schemaVersion': 1, 'status': 'native_named_penlight_commands_not_visual_acceptance',
            'choreographyIndexSha256': index_hash, 'modelSha256': model_hash, 'bundles': bundles,
            'idolColors': idol_colors, 'masterdataSource': {'sha256': master_hash,
                'idolTable': 2, 'idolResourceIdField': 10, 'penlightColorField': 39, 'songTable': 46, 'songIdolTypeField': 13},
            'eventCount': sum(len(track['events']) for track in tracks.values()), 'songs': tracks}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp.json')
    temporary.write_text(json.dumps(body, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(output)
    print(json.dumps({'arrangements': len(tracks), 'events': body['eventCount'], 'bytes': output.stat().st_size,
                      'sha256': sha256_file(output)}))


if __name__ == '__main__':
    main()
