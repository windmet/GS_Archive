"""Replay Object_layer Sprite source identities without exporting images.

Requires local RAW and the decrypted native ELF. This records provenance and
serialized defaults, not native frame scheduling or rendered parity.
"""
import argparse
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct

import UnityPy

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'scripts/fixtures/chibi-object-sprite-sources.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def collect(native_elf):
    spec = importlib.util.spec_from_file_location('object_layers', ROOT / 'scripts/prepare-live-chibi-object-layers.py')
    layers = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(layers)
    sources = layers.load_archive_sources(None)
    index_bytes = (ROOT / 'public/assets/live-chibi/object-layers/index.json').read_bytes()
    index = json.loads(index_bytes)
    assets = {name: entry for name, entry in index['assets'].items() if entry['kind'] in ('sprite', 'mixed')}
    records = {}
    for bundle in sorted({entry['bundle'] for entry in assets.values()}):
        data = (sources.raw_root / 'asset' / bundle).read_bytes()
        env = UnityPy.load(data)
        objects = {o.path_id: o for o in env.objects}
        for name, entry in sorted(assets.items()):
            if entry['bundle'] != bundle:
                continue
            keeper, _, _ = layers.find_keeper(env, objects, name)
            if keeper is None:
                raise ValueError('Missing exact keeper: ' + name)
            sprites = []
            for pointer in keeper['_sprites']:
                if not pointer['m_PathID']:
                    continue
                if pointer['m_FileID']:
                    raise ValueError('External renderer needs explicit resolution: ' + name)
                obj = objects[pointer['m_PathID']]
                renderer = obj.read()
                if not renderer.m_Sprite.path_id:
                    continue
                color = renderer.m_Color
                go = renderer.m_GameObject.deref()
                sprites.append(dict(serializedFile=obj.assets_file.name, pathId=str(obj.path_id),
                    rawSha256=sha(obj.get_raw_data()), gameObjectPathId=str(go.path_id),
                    name=go.read().m_Name, color={k: float(getattr(color, k)) for k in ['r', 'g', 'b', 'a']},
                    enabled=bool(renderer.m_Enabled), activeSelf=bool(go.read().m_IsActive)))
            if len(sprites) != len(entry['instances']):
                raise ValueError('RAW/index renderer count differs: ' + name)
            for source, instance in zip(sprites, entry['instances']):
                if source['name'] != instance['name'] or round(source['color']['a'], 6) != instance['alpha']:
                    raise ValueError('RAW/index initial color differs: ' + name)
            records[name] = dict(bundle=bundle, bundleSha256=sha(data), sprites=sprites,
                particleCount=entry['particleCount'], groupCount=entry['groupCount'])

    from live_chibi_object_commands import object_layer_events
    from live_chibi_raw_semantics import text_asset_payload
    songs = json.loads((ROOT / 'public/assets/live-chibi/choreography/index.json').read_bytes())['songs']
    command_samples = {}
    for code in ['cfprde', 'grwsml']:
        bundle = 'song_' + code + '.unity3d'
        data = (sources.raw_root / 'asset' / bundle).read_bytes()
        matches = [o for o in UnityPy.load(data).objects if o.type.name == 'TextAsset'
            and o.read().m_Name == code + '_live_effect']
        if len(matches) != 1:
            raise ValueError('Missing unique representative RAW script: ' + code)
        obj = matches[0]
        payload = text_asset_payload(obj.read())
        events = object_layer_events(list(csv.reader(io.StringIO(payload.decode('utf-8-sig')))))
        published = next(s for s in songs if s['id'] == code + '_live_effect')['objectLayerEvents']
        if events != published:
            raise ValueError('Representative RAW/published object commands differ: ' + code)
        command_samples[code + '_live_effect'] = dict(bundle=bundle, bundleSha256=sha(data),
            serializedFile=obj.assets_file.name, pathId=str(obj.path_id), rawSha256=sha(obj.get_raw_data()),
            payloadSha256=sha(payload), objectLayerEvents=events)

    elf = native_elf.read_bytes()
    phoff = struct.unpack_from('<Q', elf, 32)[0]
    size, count = struct.unpack_from('<HH', elf, 54)
    segments = [struct.unpack_from('<IIQQQQQQ', elf, phoff + i * size) for i in range(count)]

    def window(start, end):
        p = next(p for p in segments if p[0] == 1 and p[3] <= start < end <= p[3] + p[5])
        offset = p[2] + start - p[3]
        return dict(start=hex(start), end=hex(end), sha256=sha(elf[offset:offset + end - start]))

    # Bound to actual function ranges, not to hand-written formulas.
    methods = [
        ('ObjectLayer.PlayEffect', 0x2220db8, 0x2221150),
        ('ObjectLayer.EraseEffect', 0x2221150, 0x2221364),
        ('ObjectLayer.PlaySprite', 0x1c9e288, 0x1c9e388),
        ('ObjectLayer.EraseSprite', 0x1c9def4, 0x1c9dfe4),
        ('ObjectLayer.EraseSpriteComplete', 0x1c9e114, 0x1c9e144),
        ('Container.Create', 0x221a470, 0x221a670),
        ('DOTween.cctor', 0x13eff0c, 0x13f0058),
        ('DOTween.InitSettings', 0x13f01e0, 0x13f0884),
        ('Sprite.DOFade', 0x18fc1e0, 0x18fc36c),
        ('Sprite.DOFadeGetter', 0x18fc3ac, 0x18fc3c8),
        ('Sprite.DOFadeSetter', 0x18fc3c8, 0x18fc3e4),
        ('TweenManager.AddActiveTween', 0x18062e4, 0x18065a0),
        ('TweenManager.Update', 0x1807be8, 0x1808048),
        ('TweenManager.ReorganizeActiveTweens', 0x18077d0, 0x1807a70),
        ('DOTween.ToAlpha', 0x13f1a6c, 0x13f1b4c),
        ('ColorPlugin.EvaluateAndApply', 0x13efae8, 0x13efd44),
        ('Tween.DoGoto', 0x1802b6c, 0x1802e70),
        ('EaseManager.Evaluate', 0x13eed70, 0x13ef8a0),
    ]
    settings = json.loads((ROOT / 'scripts/fixtures/chibi-pinspotlight-native-chain.json').read_text(encoding='utf8'))
    if sha(elf) != settings['elfSha256'] or settings['defaultEase'] != 6:
        raise ValueError('Native binary/default settings source changed')
    return dict(schemaVersion=1, objectIndexSha256=sha(index_bytes), elfSha256=sha(elf),
        defaultEase=dict(value=6, name='OutQuad', settingsRawSha256=settings['dotweenSettingsSha256'],
            sourceReceipt='chibi-pinspotlight-native-chain.json'),
        methods={name: window(start, end) for name, start, end in methods}, assets=records,
        commandSamples=command_samples,
        status='source-audit-only; native frame replay and runtime correction pending')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    result = collect(args.native_elf)
    if args.write:
        FIXTURE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    elif result != json.loads(FIXTURE.read_text(encoding='utf8')):
        raise ValueError('Sprite source audit drifted')
    print(json.dumps(dict(assets=len(result['assets']), sprites=sum(len(a['sprites']) for a in result['assets'].values()),
        status=result['status'])))


if __name__ == '__main__':
    main()
