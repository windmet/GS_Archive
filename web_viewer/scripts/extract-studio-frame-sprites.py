#!/usr/bin/env python3
"""Read native studio frame Sprite rects from local RAW bundles; write JSON only.

StudioRoot.AddFrame sets localScale = one and calls Image.SetNativeSize, so each
part is drawn at its Sprite m_Rect (100 ppu on a 100 reference-ppu canvas). Some
archived part files hold only the packed textureRect; the offset recorded here
puts those pixels back where the native rect has them.
"""
import argparse
import json
from pathlib import Path
import re

import UnityPy

NAME = re.compile(r'^image_picturestudio_frame_(\d{4})_(0[12])$')


def inspect(raw_dir):
    sprites = {}
    for bundle in sorted(Path(raw_dir).glob('image_picturestudio_frame_*.unity3d')):
        for obj in UnityPy.load(str(bundle)).objects:
            if obj.type.name != 'Sprite':
                continue
            sprite = obj.read()
            if not NAME.match(sprite.m_Name):
                continue
            if sprite.m_PixelsToUnits != 100:
                raise ValueError(f'Unexpected pixels per unit: {sprite.m_Name}')
            rect, packed, offset = sprite.m_Rect, sprite.m_RD.textureRect, sprite.m_RD.textureRectOffset
            sprites[sprite.m_Name] = {
                'bundle': bundle.name,
                'width': rect.width,
                'height': rect.height,
                # Unity measures the packed offset from the bottom-left; the web draws from the top-left.
                'packed': {
                    'x': round(offset.x, 4),
                    'y': round(rect.height - offset.y - packed.height, 4),
                    'width': round(packed.width, 4),
                    'height': round(packed.height, 4),
                },
            }
    if not sprites:
        raise ValueError('No native studio frame sprites found')
    return {
        'schemaVersion': 1,
        'kind': 'gs-studio-native-frame-sprites',
        'source': {
            'runtime': 'StudioRoot.AddFrame: localScale = one, Image.SetNativeSize',
            'canvas': 'CanvasScaler reference height 720, reference pixels per unit 100',
        },
        'sprites': dict(sorted(sprites.items())),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw-dir', required=True, help='Directory holding image_picturestudio_frame_*.unity3d')
    parser.add_argument('--output', default='src/core/studio-native-frame-sprites.json')
    args = parser.parse_args()
    Path(args.output).write_text(json.dumps(inspect(args.raw_dir), ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
