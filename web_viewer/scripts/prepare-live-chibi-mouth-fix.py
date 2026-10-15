#!/usr/bin/env python3
"""Export fixed mouth controls from all indexed RAW TextAssets; preserve shared resources."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_mouth_fix import mouth_fix_events


def main():
    import UnityPy
    from live_chibi_raw_semantics import sha256_file, text_asset_payload
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/stage-mouth-fix.json')
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    index_path = ROOT / 'public/assets/live-chibi/choreography/index.json'
    output = args.output.resolve()
    if output.is_relative_to(sources.raw_root.resolve()) or output == index_path.resolve():
        parser.error('Output must not overwrite RAW or choreography')
    index_hash = sha256_file(index_path)
    songs = json.loads(index_path.read_text(encoding='utf-8'))['songs']
    groups = {}
    for song in songs:
        groups.setdefault(song['songCode'], []).append(song)
    tracks, bundles = {}, []
    raw_root = (sources.raw_root / 'asset').resolve()
    for code, entries in sorted(groups.items()):
        bundle = (raw_root / f'song_{code}.unity3d').resolve()
        if bundle.parent != raw_root:
            raise ValueError('Unsafe mouth fix bundle')
        before = sha256_file(bundle)
        wanted = {song['source'].removesuffix('.csv'): song for song in entries}
        if len(wanted) != len(entries):
            raise ValueError('Duplicate mouth fix source')
        found = set()
        for obj in UnityPy.load(str(bundle)).objects:
            if obj.type.name != 'TextAsset':
                continue
            asset = obj.read()
            if asset.m_Name not in wanted:
                continue
            if asset.m_Name in found:
                raise ValueError('Ambiguous mouth fix RAW source')
            found.add(asset.m_Name)
            song = wanted[asset.m_Name]
            payload = text_asset_payload(asset)
            rows = list(csv.reader(io.StringIO(payload.decode('utf-8-sig', errors='surrogateescape'))))
            tracks[song['id']] = {'songCode': code, 'source': song['source'], 'events': mouth_fix_events(rows),
                'raw': {'bundle': bundle.name, 'serializedFile': obj.assets_file.name,
                        'pathId': str(obj.path_id), 'textSha256': hashlib.sha256(payload).hexdigest()}}
        if found != wanted.keys() or sha256_file(bundle) != before:
            raise ValueError('Missing/changed mouth fix RAW source')
        bundles.append({'name': bundle.name, 'sha256': before})
    if len(tracks) != len(songs) or sha256_file(index_path) != index_hash:
        raise ValueError('Changed mouth fix choreography index')
    body = {'schemaVersion': 1, 'choreographyIndexSha256': index_hash, 'bundles': bundles,
            'eventCount': sum(len(track['events']) for track in tracks.values()), 'songs': tracks}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp.json')
    temporary.write_text(json.dumps(body, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(output)
    print(json.dumps({'arrangements': len(tracks), 'events': body['eventCount'], 'bytes': output.stat().st_size, 'sha256': sha256_file(output)}))


if __name__ == '__main__':
    main()
