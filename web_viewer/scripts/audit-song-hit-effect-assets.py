"""Follow bound prefab renderer/material PPtrs and export small local QA assets.

No public promotion or deployment. Full authored enabled particle modules are
saved for the default Auto resource set, not reduced to invented ring shapes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATA_SHA = 'fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a'
sha = lambda data: hashlib.sha256(data).hexdigest()
FIELDS = {'_touchPerfect', '_flickUpPerfect', '_flickRightPerfect', '_flickLeftPerfect', '_hold', '_touchSpecial', '_touchPSkill'}


def json_value(value):
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    if isinstance(value, bytes):
        return dict(bytesHex=value.hex())
    if isinstance(value, float) and not math.isfinite(value):
        return dict(nonFinite=str(value))
    return value


def extract(args):
    import UnityPy
    with zipfile.ZipFile(args.ipa) as package:
        data = package.read('Payload/BNEI0395.app/Data/data.unity3d')
    if sha(data) != DATA_SHA:
        raise ValueError('Different source IPA data.unity3d')
    receipt_bytes = (ROOT / 'scripts/fixtures/song-hit-effects-wiring.json').read_bytes()
    receipt = json.loads(receipt_bytes)
    if receipt['source']['dataSha256'] != DATA_SHA:
        raise ValueError('Different wiring receipt')
    env = UnityPy.load(data)
    objects = {o.path_id: o for o in env.objects if o.assets_file.name == 'resources.assets'}
    args.output.mkdir(parents=True, exist_ok=True)
    result = dict(schemaVersion=1, dataSha256=DATA_SHA, wiringReceiptSha256=sha(receipt_bytes),
        boundary='Local source exports; public asset URLs and runtime consumers are not implemented.',
        textures=[], materials=[], defaultAutoPrefabs=[], evaluation={})
    texture_ids = set()
    material_ids = set()
    for nodes in receipt['prefabs'].values():
        for node in nodes:
            for component in node['components']:
                for material in component.get('materials', []):
                    material_ids.add(material['pathId'])
                    for texture in material['textures']:
                        if texture['fileId'] != 0:
                            raise ValueError('External texture needs explicit resolution')
                        if texture['pathId']:
                            texture_ids.add(texture['pathId'])
    for path_id in sorted(texture_ids):
        obj = objects[path_id]
        texture = obj.read()
        path = args.output / f'{path_id}-{texture.m_Name}.png'
        texture.image.save(path)
        result['textures'].append(dict(pathId=path_id, name=texture.m_Name, width=texture.m_Width, height=texture.m_Height,
            format=int(texture.m_TextureFormat), sourceSha256=sha(obj.get_raw_data()), png=path.name,
            bytes=path.stat().st_size, pngSha256=sha(path.read_bytes())))
    for path_id in sorted(material_ids):
        obj = objects[path_id]
        material = obj.read()
        result['materials'].append(dict(pathId=path_id, name=material.m_Name, sourceSha256=sha(obj.get_raw_data()),
            tree=obj.read_typetree()))
    for ref in receipt['sets'][0]['refs']:
        if ref['field'] not in FIELDS:
            continue
        nodes = receipt['prefabs'][str(ref['pathId'])]
        layers = []
        for node in nodes:
            particles = []
            renderers = []
            for component in node['components']:
                obj = objects[component['pathId']]
                if component['type'] == 'ParticleSystem':
                    tree = obj.read_typetree()
                    # Retain every enabled module, including curves, bursts,
                    # gradients, UV sheets and random ranges for later consumers.
                    selected = {k: v for k, v in tree.items() if not isinstance(v, dict) or 'enabled' not in v or v['enabled']}
                    particles.append(dict(pathId=obj.path_id, sourceSha256=sha(obj.get_raw_data()), tree=selected))
                elif component['type'] == 'ParticleSystemRenderer':
                    renderers.append(dict(pathId=obj.path_id, sourceSha256=sha(obj.get_raw_data()), tree=obj.read_typetree()))
            if particles or renderers:
                layers.append(dict(pathId=node['pathId'], path=node['path'], transform=node['transform'],
                    particles=particles, renderers=renderers))
        result['defaultAutoPrefabs'].append(dict(**ref, rootTransform=nodes[0]['transform'], layers=layers))
    # These names are the Android EvaluationPanel ctor StringLiteral references
    # 0x4300e88 / 0x42ee628, resolved with the bound decrypted metadata.
    for obj in env.objects:
        if obj.type.name not in ['Sprite', 'AnimationClip']:
            continue
        value = obj.read()
        if value.m_Name == 'live_taptiming_auto' and obj.type.name == 'Sprite':
            path = args.output / f'{obj.path_id}-live_taptiming_auto.png'
            value.image.save(path)
            result['evaluation']['sprite'] = dict(file=obj.assets_file.name, pathId=obj.path_id,
                sourceSha256=sha(obj.get_raw_data()), png=path.name, pngSha256=sha(path.read_bytes()),
                width=value.image.width, height=value.image.height, tree=obj.read_typetree())
            atlas = value.m_SpriteAtlas.read()
            atlas_data = next(item for key, item in atlas.m_RenderDataMap if key == value.m_RenderDataKey)
            atlas_texture = atlas_data.texture.read()
            result['evaluation']['sprite']['atlas'] = dict(pathId=value.m_SpriteAtlas.path_id, name=atlas.m_Name,
                sourceSha256=sha(value.m_SpriteAtlas.deref().get_raw_data()),
                texturePathId=atlas_data.texture.path_id, textureName=atlas_texture.m_Name,
                textureSha256=sha(atlas_data.texture.deref().get_raw_data()),
                textureRect={key: getattr(atlas_data.textureRect, key) for key in ['x', 'y', 'width', 'height']},
                settingsRaw=atlas_data.settingsRaw)
        if value.m_Name == 'EvalAnimationAuto' and obj.type.name == 'AnimationClip':
            result['evaluation']['animation'] = dict(file=obj.assets_file.name, pathId=obj.path_id,
                sourceSha256=sha(obj.get_raw_data()), tree=obj.read_typetree())
    if set(result['evaluation']) != {'sprite', 'animation'}:
        raise ValueError('Auto evaluation sprite/animation missing')
    (args.output / 'source-assets.json').write_text(json.dumps(json_value(result), ensure_ascii=False, indent=2,
        allow_nan=False) + '\n', encoding='utf8')
    manifest = {key: result[key] for key in ['schemaVersion', 'dataSha256', 'wiringReceiptSha256', 'boundary', 'textures']}
    manifest['evaluation'] = {key: {name: value for name, value in entry.items() if name != 'tree'}
        for key, entry in result['evaluation'].items()}
    manifest['defaultAutoPrefabs'] = [dict(field=entry['field'], pathId=entry['pathId'], name=entry['name'],
        layers=[dict(path=node['path'], pathId=node['pathId'], renderers=[c for c in node['components'] if c.get('materials')])
            for node in receipt['prefabs'][str(entry['pathId'])] if node['components']]) for entry in result['defaultAutoPrefabs']]
    (args.output / 'asset-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    # A contact sheet is a QA view of decoded assets, not a new runtime texture.
    from PIL import Image, ImageDraw
    assets = [(row['name'], row['png']) for row in result['textures']]
    assets.append(('live_taptiming_auto', result['evaluation']['sprite']['png']))
    sheet = Image.new('RGB', (800, ((len(assets) + 3) // 4) * 180), '#16232c')
    draw = ImageDraw.Draw(sheet)
    for index, (name, filename) in enumerate(assets):
        im = Image.open(args.output / filename).convert('RGBA')
        im.thumbnail((180, 138))
        x, y = index % 4 * 200, index // 4 * 180
        sheet.paste(im, (x + (200-im.width)//2, y + (140-im.height)//2), im)
        draw.text((x+6, y+145), name, fill='white')
    sheet.save(args.output / 'contact-sheet.png')
    print(json.dumps(dict(textures=len(result['textures']), bytes=sum(t['bytes'] for t in result['textures']),
        materials=len(result['materials']), defaultPrefabs=len(result['defaultAutoPrefabs']),
        evaluation={key: value['pathId'] for key, value in result['evaluation'].items()})))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ipa', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    extract(parser.parse_args())
