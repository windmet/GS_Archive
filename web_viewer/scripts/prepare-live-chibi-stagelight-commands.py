#!/usr/bin/env python3
"""Export indexed RAW Stagelight channels and source-identified BPM sets."""
import argparse
import csv
import io
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_stagelight import stagelight_events


def main():
    from live_chibi_raw_semantics import load_raw_live_semantics, sha256_file
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/stage-stagelight-commands.json')
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    index_path = ROOT / 'public/assets/live-chibi/choreography/index.json'
    output = args.output.resolve()
    if output.is_relative_to(sources.raw_root.resolve()) or output == index_path.resolve():
        parser.error('Output must not overwrite RAW/choreography')
    index_hash = sha256_file(index_path)
    songs = json.loads(index_path.read_text(encoding='utf-8'))['songs']
    codes = sorted({song['songCode'] for song in songs})
    raw_root = (sources.raw_root / 'asset').resolve()
    paths = [(raw_root / f'song_{code}.unity3d').resolve() for code in codes]
    if any(path.parent != raw_root for path in paths):
        raise ValueError('Unsafe Stagelight bundle')
    hashes = {path.name: sha256_file(path) for path in paths}
    raw = load_raw_live_semantics(raw_root)['choreography']
    charts = {}
    for code in codes:
        path = ROOT / f'public/data/song_charts/{code}-1.json'
        before = sha256_file(path)
        chart = json.loads(path.read_text(encoding='utf-8'))
        tempos = chart.get('tempos', [])
        if (chart.get('schemaVersion') != 1 or chart.get('songCode') != code or chart.get('difficultyType') != 1
                or chart.get('timeUnit') != 'native_tick' or not tempos or tempos[0]['tick'] != 0
                or any(not math.isfinite(t['tempo']) or t['tempo'] <= 0 for t in tempos)):
            raise ValueError('Invalid Stagelight tempo source: ' + code)
        if sha256_file(path) != before:
            raise ValueError('Changed Stagelight tempo source')
        charts[code] = {'file': f'song_charts/{code}-1.json', 'sha256': before,
                        'values': sorted({t['tempo'] for t in tempos})}
    tracks = {}
    for song in songs:
        name = song['source'].removesuffix('.csv')
        source = raw[name]
        expected = f'song_{song["songCode"]}.unity3d'
        if source['bundles'] != [expected] or source['bundleSha256'] != hashes[expected] or song['id'] in tracks:
            raise ValueError('Ambiguous Stagelight RAW identity')
        rows = list(csv.reader(io.StringIO(source['payload'].decode('utf-8-sig', errors='surrogateescape'))))
        tracks[song['id']] = {'songCode': song['songCode'], 'source': song['source'], 'events': stagelight_events(source['payload']),
            'tempo': charts[song['songCode']], 'raw': {'bundle': expected, 'textAsset': name, 'textSha256': source['sha256']}}
    if (sha256_file(index_path) != index_hash or any(sha256_file(path) != hashes[path.name] for path in paths)
            or any(sha256_file(ROOT / 'public/data' / chart['file']) != chart['sha256'] for chart in charts.values())):
        raise ValueError('Changed Stagelight inputs')
    body = {'schemaVersion': 1, 'choreographyIndexSha256': index_hash,
            'bundles': [{'name': name, 'sha256': value} for name, value in hashes.items()],
            'eventCount': sum(len(track['events']) for track in tracks.values()), 'songs': tracks}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp.json')
    temporary.write_text(json.dumps(body, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(output)
    print(json.dumps({'arrangements': len(tracks), 'events': body['eventCount'], 'bytes': output.stat().st_size, 'sha256': sha256_file(output)}))


if __name__ == '__main__':
    main()
