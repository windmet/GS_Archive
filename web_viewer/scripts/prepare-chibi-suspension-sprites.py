"""Bind every authored NewSuspensionlight Sprite replacement to typed RAW sprites.

Default is a non-writing replay; --write publishes the bounded custom sprites.
The shared APK prefab/material and the default sprite remain in stage-effects.
"""
import argparse
import collections
import hashlib
import io
import json
from pathlib import Path
import sys

import UnityPy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import load_archive_sources
from live_chibi_raw_semantics import sha256_file
from live_chibi_sprite_geometry import sprite_geometry


def extract():
    sources = load_archive_sources(None)
    base = ROOT / 'public/assets/live-chibi'
    index_path = base / 'stage-effects/index.json'
    index = json.loads(index_path.read_text(encoding='utf-8'))
    default = index['newSuspensionlight']['layers'][0]['asset']
    names = collections.Counter()
    tracks, song_assets = {}, {}
    for song, descriptor in index['newSuspensionlightSongs'].items():
        payload = (base / descriptor['file']).read_bytes()
        track = json.loads(payload)
        if track['source'] != descriptor['source'] or len(track['events']) != descriptor['eventCount']:
            raise ValueError('Suspension track identity/count mismatch: ' + song)
        tracks[song] = hashlib.sha256(payload).hexdigest()
        song_assets[song] = []
        for event in track['events']:
            if event['command'] == 'NewSuspensionlight_create' and not event['erase'] and event['values'][1]:
                names[event['values'][1]] += 1
                if event['values'][1] not in song_assets[song]:
                    song_assets[song].append(event['values'][1])
    wanted = names.keys() - {default}
    sprites, images = {}, {}
    # Search typed Sprites across source bundles. Do not infer ownership from a
    # filename or substitute a similarly named Texture2D for the loaded Sprite.
    for bundle in sorted((sources.raw_root / 'asset').glob('song_*.unity3d')):
        environment = UnityPy.load(str(bundle))
        for obj in environment.objects:
            if obj.type.name != 'Sprite':
                continue
            sprite = obj.read()
            if sprite.m_Name not in wanted:
                continue
            name = sprite.m_Name
            if name in sprites:
                raise ValueError('Ambiguous native suspension sprite: ' + name)
            texture = sprite.m_RD.texture.deref()
            if texture.type.name != 'Texture2D' or sprite.m_PixelsToUnits <= 0:
                raise ValueError('Invalid native suspension texture/units')
            image = sprite.image.convert('RGBA')
            geometry = sprite_geometry(sprite, *image.size)
            buffer = io.BytesIO()
            image.save(buffer, format='PNG', optimize=True)
            png = buffer.getvalue()
            digest = hashlib.sha256(png).hexdigest()
            file = f'/data/stage-new-suspension-sprites/{digest[:24]}.png'
            sprites[name] = {
                'file': file, 'width': image.width, 'height': image.height,
                'bytes': len(png), 'pngSha256': digest,
                'anchorX': geometry['pivot']['x'], 'anchorY': geometry['pivot']['y'],
                'pixelsToUnits': sprite.m_PixelsToUnits,
                'source': {'bundle': bundle.name, 'bundleSha256': sha256_file(bundle),
                    'serializedFile': obj.assets_file.name, 'spritePathId': str(obj.path_id),
                    'spriteSha256': hashlib.sha256(obj.get_raw_data()).hexdigest(),
                    'texturePathId': str(texture.path_id),
                    'textureSha256': hashlib.sha256(texture.get_raw_data()).hexdigest(),
                    'geometry': geometry},
            }
            images[file] = png
    if sprites.keys() != wanted:
        raise ValueError('Unresolved custom suspension sprites: ' + str(wanted - sprites.keys()))
    return {'schemaVersion': 1, 'contract': 'native-new-suspension-sprites-v1',
        'stageEffectIndexSha256': sha256_file(index_path), 'trackSha256': tracks, 'songAssets': song_assets,
        'createAssets': dict(sorted(names.items())), 'sprites': sprites}, images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    data, images = extract()
    target = ROOT / 'public/data/stage-new-suspension-sprites.json'
    if args.write:
        for file, payload in images.items():
            path = ROOT / 'public' / file.lstrip('/')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    else:
        if json.loads(target.read_text(encoding='utf-8')) != data:
            raise ValueError('Native suspension sprite replay differs from published data')
        for file, payload in images.items():
            if (ROOT / 'public' / file.lstrip('/')).read_bytes() != payload:
                raise ValueError('Native suspension sprite PNG replay mismatch: ' + file)
    print(json.dumps({'sprites': len(images), 'bytes': sum(map(len, images.values())),
        'createAssets': data['createAssets'], 'written': args.write}))


if __name__ == '__main__':
    main()
