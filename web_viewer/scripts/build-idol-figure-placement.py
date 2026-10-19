"""Native ADV figure placement from the RAW costume bundles (client 2.6.10).

Skeleton figures: every costume_<model>.unity3d prefab root is a centre-anchored RectTransform at x = 0 with
localScale 1 and a SkeletonDataAsset scale of 1/300; IdolFigureSkeleton.EditPlacement keeps the prefab's own
anchoredPosition, so the only per-model value is the root y. The checks below fail loudly if a bundle breaks
that shape instead of silently recording it.

Texture figures (silhouettes.unity3d, and costume bundles that hold only a Sprite): IdolFigureTexture uses
Image.SetNativeSize, so the drawn rect is the sprite rect at 100 px per unit; the site PNG is the packed texture
rect, placed inside that rect at textureRectOffset (measured from the bottom-left). The rect's bottom-centre sits
at the IdolOtherInfoSetting positionY of the model's idol, or -640 when the idol has none.

Usage: python scripts/build-idol-figure-placement.py [RAW asset dir]
Writes public/data/idolsetting/idol_figure_placement.json.
"""
import glob
import json
import math
import os
import sys

import UnityPy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else r'E:/Web_build/SideM_Archived/RAW/asset'
OUT = os.path.join(ROOT, 'public', 'data', 'idolsetting', 'idol_figure_placement.json')
SKELETON_SCALE = 1 / 300
OTHER_SETTINGS = os.path.join(ROOT, 'public', 'data', 'idolsetting', 'other')
TEXTURE_DEFAULT_POSITION_Y = -640


def close(a, b, eps=1e-4):
    return abs(a - b) <= eps


def texture_entry(model, sprite):
    rd = sprite.m_RD
    setting = os.path.join(OTHER_SETTINGS, f'idol_other_stg_{model[:6]}.json')
    position_y = TEXTURE_DEFAULT_POSITION_Y
    if os.path.exists(setting):
        with open(setting, encoding='utf-8') as handle:
            position_y = json.load(handle)['positionY']
    return {
        'positionY': position_y,
        'size': [round(sprite.m_Rect.width, 3), round(sprite.m_Rect.height, 3)],
        'offset': [round(rd.textureRectOffset.x, 3), round(rd.textureRectOffset.y, 3)],
        'image': [math.ceil(rd.textureRect.width - 1e-3), math.ceil(rd.textureRect.height - 1e-3)],
    }


def main():
    skeletons, textures, problems = {}, {}, []
    for path in sorted(glob.glob(os.path.join(RAW, 'costume_*.unity3d'))):
        model = os.path.basename(path)[len('costume_'):-len('.unity3d')]
        root = None
        scale = None
        sprites = []
        for obj in UnityPy.load(path).objects:
            if obj.type.name == 'RectTransform':
                rect = obj.read()
                if not rect.m_Father.m_PathID:
                    root = rect
            elif obj.type.name == 'Sprite':
                sprites.append(obj.read())
            elif obj.type.name == 'MonoBehaviour':
                try:
                    tree = obj.read_typetree()
                except Exception:
                    continue
                if 'scale' in tree and 'skeletonJSON' in tree:
                    scale = tree['scale']
        if root is None:
            if len(sprites) == 1:
                textures[model] = texture_entry(model, sprites[0])
            else:
                problems.append(f'{model}: no prefab root and {len(sprites)} sprites')
            continue
        shape = [
            close(root.m_AnchorMin.x, 0.5), close(root.m_AnchorMin.y, 0.5),
            close(root.m_AnchorMax.x, 0.5), close(root.m_AnchorMax.y, 0.5),
            close(root.m_AnchoredPosition.x, 0), close(root.m_LocalScale.x, 1), close(root.m_LocalScale.y, 1),
            scale is not None and close(scale, SKELETON_SCALE, 1e-7),
        ]
        if not all(shape):
            problems.append(f'{model}: unexpected prefab root {shape}')
            continue
        skeletons[model] = round(root.m_AnchoredPosition.y, 3)
    for obj in UnityPy.load(os.path.join(RAW, 'silhouettes.unity3d')).objects:
        if obj.type.name == 'Sprite':
            sprite = obj.read()
            textures[sprite.m_Name] = texture_entry(sprite.m_Name, sprite)
    if problems:
        raise SystemExit('\n'.join(problems))
    data = {
        'schema': 'GS-IDOL-FIGURE-PLACEMENT-V1',
        'source': 'RAW costume_*.unity3d prefab roots and silhouettes.unity3d sprites (client 2.6.10)',
        'skeletons': dict(sorted(skeletons.items())),
        'textures': dict(sorted(textures.items())),
    }
    with open(OUT, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(',', ':'))
        handle.write('\n')
    print(f'{len(skeletons)} skeleton figures, {len(textures)} texture figures -> {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
