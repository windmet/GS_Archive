#!/usr/bin/env python3
"""Export exact Penlight textures and a native render-input descriptor from XAPK.

Does not activate a speculative stage effect. CSV commands, color allocation and
camera projection remain separate acceptance work.
"""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path

from live_chibi_penlight import penlight_render_model
from live_chibi_raw_semantics import sha256_file


ROOT = Path(__file__).resolve().parents[1]


def load(filename, name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    helper = load('prepare-live-chibi-stage-effects.py', 'penlight_source')
    audit = load('audit-chibi-light-resources.py', 'penlight_audit')
    parser = argparse.ArgumentParser(description=__doc__)
    helper.add_sources_config_argument(parser)
    parser.add_argument('--xapk', type=Path)
    parser.add_argument('--output-root', type=Path, default=ROOT / 'public/assets/live-chibi/penlight')
    parser.add_argument('--evidence-file', type=Path)
    args = parser.parse_args()
    sources = helper.load_archive_sources(args.sources_config)
    xapk = helper.find_xapk(args.xapk, sources.xapk_file)
    output = args.output_root.resolve()
    if args.evidence_file and args.evidence_file.resolve() in (xapk, output / 'index.json'):
        raise ValueError('Typed evidence cannot overwrite the source or descriptor')
    data = helper.read_unity_data(xapk)
    environment = helper.UnityPy.load(data)
    names = {'LiveObjectPenlight_1', 'LiveObjectPenlight_2'}
    controllers, sprites = {}, {}
    prefabs = [audit.inspect_prefab(o, controllers, sprites) for o in environment.objects
        if o.type.name == 'GameObject' and o.read().m_Name in names]
    if len(prefabs) != len(names) or {p['name'] for p in prefabs} != names:
        raise ValueError('Missing or ambiguous native Penlight prefab')
    evidence = {'schemaVersion': 1, 'status': 'typed_resource_evidence_only',
        'source': {'xapk': xapk.name, 'xapkSha256': sha256_file(xapk),
                   'unityDataSha256': hashlib.sha256(data).hexdigest()},
        'prefabs': prefabs, 'animationEvidence': controllers, 'spriteEvidence': sprites}
    # Normalize binary vertex streams through the same typed evidence format.
    evidence_bytes = (json.dumps(evidence, ensure_ascii=False, indent=2, default=audit.json_binary) + '\n').encode('utf8')
    model = penlight_render_model(json.loads(evidence_bytes))
    model['typedEvidenceSha256'] = hashlib.sha256(evidence_bytes).hexdigest()
    objects = {(o.assets_file.name, str(o.path_id)): o for o in environment.objects}
    images, assets = {}, {}
    for sprite in model['sprites'].values():
        key = (sprite['texture']['serializedFile'], sprite['texture']['pathId'])
        if key in images:
            continue
        obj = objects[key]
        if obj.type.name != 'Texture2D':
            raise ValueError('Bound Penlight texture is not Texture2D')
        texture = obj.read()
        image = texture.image.convert('RGBA')
        image_bytes = io.BytesIO()
        image.save(image_bytes, format='PNG', optimize=True)
        name = f'{key[0]}-{key[1]}.png'
        images[key] = (name, image_bytes.getvalue())
        assets[key[0] + ':' + key[1]] = {'name': texture.m_Name, 'file': name,
            'width': image.width, 'height': image.height, 'alphaRange': list(image.getchannel('A').getextrema()),
            'source': {**sprite['texture'], 'sha256': hashlib.sha256(obj.get_raw_data()).hexdigest()},
            'pngSha256': hashlib.sha256(image_bytes.getvalue()).hexdigest()}
    model['textures'] = assets
    output.mkdir(parents=True, exist_ok=True)
    # All bindings, geometry and textures are validated before publishing.
    for name, image_bytes in images.values():
        target = output / name
        temporary = target.with_suffix('.tmp.png')
        temporary.write_bytes(image_bytes)
        temporary.replace(target)
    target = output / 'index.json'
    temporary = target.with_suffix('.tmp.json')
    temporary.write_text(json.dumps(model, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf8')
    temporary.replace(target)
    if args.evidence_file:
        args.evidence_file.parent.mkdir(parents=True, exist_ok=True)
        args.evidence_file.write_bytes(evidence_bytes)
    print(json.dumps({'output': str(output), 'textures': len(images),
        'prefabs': len(model['prefabs']), 'actors': sum(len(p['actors']) for p in model['prefabs']),
        'clips': len(model['clips']), 'status': model['status']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
