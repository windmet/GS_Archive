#!/usr/bin/env python3
"""Recover separately tinted static stage components from exact indexed RAW Sprites."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import UnityPy
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import sha256_file


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
        previous = json.loads((output / 'index.json').read_text(encoding='utf-8'))
        if previous.get('status') != 'raw_static_image_components':
            parser.error('Preserve unrelated index; choose a component-specific output directory')
    background_path = sources.published_path('assets/live-chibi/stage-backgrounds/index.json')
    backgrounds = json.loads(background_path.read_text(encoding='utf-8'))
    choreography = json.loads(sources.published_path('assets/live-chibi/choreography/index.json').read_text(encoding='utf-8'))
    # All statically composited components in Image_color songs are kept separate.
    # Songs whose images already use Image_layer require no duplicate resources.
    codes = {song['songCode'] for song in choreography['songs'] if song.get('imageColorEvents')}
    assets, songs = {}, {}
    output.mkdir(parents=True, exist_ok=True)
    for code in sorted(codes & backgrounds['songs'].keys()):
        entry = backgrounds['songs'][code]
        bundle = sources.raw_root / 'asset' / entry['bundle']
        if bundle.parent.resolve() != (sources.raw_root / 'asset').resolve():
            raise ValueError('Unsafe indexed bundle')
        environment = UnityPy.load(str(bundle))
        wanted = set(entry['layers'])
        sprites = {}
        for obj in environment.objects:
            if obj.type.name != 'Sprite':
                continue
            sprite = obj.read()
            if sprite.m_Name not in wanted:
                continue
            if sprite.m_Name in sprites:
                raise ValueError('Ambiguous Sprite: ' + sprite.m_Name)
            sprites[sprite.m_Name] = (obj, sprite)
        if sprites.keys() != wanted:
            raise ValueError('Missing static component Sprite: ' + code)
        composite = Image.new('RGBA', (entry['width'], entry['height']))
        for asset in entry['layers']:
            obj, sprite = sprites[asset]
            reader = sprite.m_RD.texture.deref()
            if reader.type.name != 'Texture2D':
                raise ValueError('Invalid Sprite texture type')
            image = reader.read().image.convert('RGBA')
            rect, pivot = sprite.m_Rect, sprite.m_Pivot
            if (rect.x, rect.y, rect.width, rect.height) != (0, 0, image.width, image.height):
                raise ValueError('Unsupported cropped logical canvas: ' + asset)
            if image.size != composite.size or (pivot.x, pivot.y) != (0.5, 0.5):
                raise ValueError('Component geometry differs from existing background: ' + asset)
            composite = Image.alpha_composite(composite, image)
            target = output / (asset + '.png')
            image.save(target, format='PNG', optimize=True)
            assets[asset] = {'file': 'image-components/' + target.name,
                'width': image.width, 'height': image.height, 'pngSha256': sha256_file(target),
                'pivot': {'x': pivot.x, 'y': pivot.y}, 'pixelsToUnits': sprite.m_PixelsToUnits,
                'source': {'bundle': bundle.name, 'bundleSha256': sha256_file(bundle),
                    'serializedFile': obj.assets_file.name, 'spritePathId': str(obj.path_id),
                    'texturePathId': str(reader.path_id)}}
        old = Image.open(sources.published_path('assets/live-chibi/' + entry['file'])).convert('RGBA')
        if composite.tobytes() != old.tobytes():
            raise ValueError('Recovered components do not reproduce existing composite: ' + code)
        songs[code] = {'layers': entry['layers'], 'compositePixelsSha256': hashlib.sha256(composite.tobytes()).hexdigest(),
            'compositePixelsIdentical': True}
    index = {'schemaVersion': 1, 'status': 'raw_static_image_components',
        'backgroundIndexSha256': sha256_file(background_path), 'songs': songs, 'assets': assets}
    temporary = output / 'index.tmp.json'
    temporary.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(output / 'index.json')
    print(json.dumps({'songs': len(songs), 'assets': len(assets), 'compositesIdentical': len(songs),
        'bytes': sum((output / (asset + '.png')).stat().st_size for asset in assets)}))


if __name__ == '__main__':
    main()
