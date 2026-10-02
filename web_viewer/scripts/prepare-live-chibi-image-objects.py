#!/usr/bin/env python3
"""Bounded Take a StuMp pilot: exact TextAsset and typed Sprite -> Texture2D."""
import argparse
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
from live_chibi_raw_semantics import text_asset_payload, sha256_file
from live_chibi_image_objects import image_object_events


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    output = args.output_root.resolve()
    if output.is_relative_to(sources.raw_root.resolve()):
        parser.error('Output cannot be inside RAW')
    if (output / 'index.json').exists():
        existing = json.loads((output / 'index.json').read_text(encoding='utf-8'))
        if existing.get('status') != 'take_image_object_pilot':
            parser.error('Preserve unrelated output index; choose a pilot-specific directory')
    catalog = json.loads(sources.published_path('assets/live-chibi/choreography/index.json').read_text(encoding='utf-8'))
    environments, evidence, songs, assets = {}, {}, {}, {}
    for code in ('tkstp1', 'tkstp2'):
        path = sources.raw_root / 'asset' / f'song_{code}.unity3d'
        environments[code] = UnityPy.load(str(path))
        evidence[code] = {'bundle': path.name, 'bundleSha256': sha256_file(path)}
        wanted = f'{code}_live_effect'
        if not any(song['id'] == wanted and song['source'] == wanted + '.csv' for song in catalog['songs']):
            raise ValueError('Pilot identity is not present in published catalog')
        matches = [obj for obj in environments[code].objects
                   if obj.type.name == 'TextAsset' and obj.read().m_Name == wanted]
        if len(matches) != 1:
            raise ValueError('Missing or ambiguous pilot TextAsset')
        obj = matches[0]
        payload = text_asset_payload(obj.read())
        rows = list(csv.reader(io.StringIO(payload.decode('utf-8-sig'), newline='')))
        songs[wanted] = {'events': image_object_events(rows), 'source': {
            **evidence[code], 'serializedFile': obj.assets_file.name,
            'pathId': str(obj.path_id), 'textSha256': hashlib.sha256(payload).hexdigest()}}
    output.mkdir(parents=True, exist_ok=True)
    wanted_assets = {event['asset'] for song in songs.values() for event in song['events'] if event['type'] == 'create'}
    # Both versions deliberately reference tkstp1 Sprites; never search by same-name Texture2D.
    for asset in sorted(wanted_assets):
        code = asset.removeprefix('stage_').split('_')[0]
        environment = environments[code]
        matches = [obj for obj in environment.objects
                   if obj.type.name == 'Sprite' and obj.read().m_Name == asset]
        if len(matches) != 1:
            raise ValueError('Missing or ambiguous typed Sprite: ' + asset)
        obj = matches[0]
        sprite = obj.read()
        texture_reader = sprite.m_RD.texture.deref()
        if texture_reader.type.name != 'Texture2D':
            raise ValueError('Sprite is not bound to a Texture2D')
        texture = texture_reader.read()
        image = texture.image
        rect = sprite.m_Rect
        # These pilot images are full transparent logical canvases. Preserve margins/pivot.
        if (rect.x, rect.y, rect.width, rect.height) != (0, 0, image.width, image.height):
            raise ValueError('Pilot requires full logical texture canvas: ' + asset)
        target = output / (asset + '.png')
        image.save(target, format='PNG', optimize=True)
        assets[asset] = {'file': 'image-objects/' + target.name, 'width': image.width, 'height': image.height,
                         'pivot': {'x': sprite.m_Pivot.x, 'y': sprite.m_Pivot.y},
                         'pixelsToUnits': sprite.m_PixelsToUnits, 'pngSha256': sha256_file(target),
                         'source': {**evidence[code], 'serializedFile': obj.assets_file.name,
                                    'spritePathId': str(obj.path_id), 'texturePathId': str(texture_reader.path_id)}}
    index = {'schemaVersion': 1, 'status': 'take_image_object_pilot', 'songs': songs, 'assets': assets,
             'notes': ['Show value6 retained without interpretation; linear fades and authored hide controls only.',
                       '2D placement shares centred stage design coordinates; not certified Unity projection.']}
    temporary = output / 'index.tmp.json'
    temporary.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(output / 'index.json')
    print(json.dumps({'songs': len(songs), 'events': sum(len(s['events']) for s in songs.values()),
                      'assets': len(assets), 'bytes': sum((output / (asset + '.png')).stat().st_size for asset in assets)}))


if __name__ == '__main__':
    main()
