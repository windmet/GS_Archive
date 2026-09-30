#!/usr/bin/env python3
"""Read native studio RectTransforms from a local XAPK; write JSON only.

MonoBehaviour runtime fields and dynamic image sizing are deliberately excluded.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import UnityPy


def inspect(source):
    with zipfile.ZipFile(source) as package:
        apk_names = [name for name in package.namelist() if name.endswith('.apk') and not Path(name).name.startswith('config.')]
        if len(apk_names) != 1:
            raise ValueError('Expected exactly one base APK')
        with zipfile.ZipFile(io.BytesIO(package.read(apk_names[0]))) as apk:
            member = 'assets/bin/Data/data.unity3d'
            binary = apk.read(member)
    environment = UnityPy.load(binary)

    def rect(go):
        matches = [item.component.deref() for item in go.m_Component if item.component.type.name == 'RectTransform']
        if len(matches) != 1:
            raise ValueError(f'Expected one native RectTransform: {go.m_Name}')
        obj = matches[0]
        fields = obj.read_typetree()
        return obj.read(), {
            'objectId': go.object_reader.path_id,
            'rectId': obj.path_id,
            'assetFile': obj.assets_file.name,
            **{key: fields[key] for key in ['m_AnchorMin', 'm_AnchorMax', 'm_AnchoredPosition', 'm_SizeDelta', 'm_Pivot', 'm_LocalScale']},
        }

    roots = []
    for obj in environment.objects:
        if obj.type.name != 'GameObject':
            continue
        go = obj.read()
        if go.m_Name != 'StudioRoot':
            continue
        transform, _ = rect(go)
        children = {child.read().m_GameObject.read().m_Name: child.read().m_GameObject.read() for child in transform.m_Children}
        if not {'LeftFrame', 'RightFrame'}.issubset(children):
            continue
        frames = {name: rect(children[name])[1] for name in ['LeftFrame', 'RightFrame']}
        roots.append({'objectId': obj.path_id, 'assetFile': obj.assets_file.name, 'unityVersion': str(obj.assets_file.unity_version), 'frames': frames})
    if not roots:
        raise ValueError('No native studio frame roots found')
    keys = ['m_AnchorMin', 'm_AnchorMax', 'm_AnchoredPosition', 'm_SizeDelta', 'm_Pivot', 'm_LocalScale']
    placements = {name: {key: row[key] for key in keys} for name, row in roots[0]['frames'].items()}
    for root in roots:
        for name, row in root['frames'].items():
            if {key: row[key] for key in keys} != placements[name]:
                raise ValueError('Native frame placements differ between studio roots')
    return {
        'schemaVersion': 1,
        'kind': 'gs-studio-native-frame-anchors',
        'source': {'package': source.name, 'baseApk': apk_names[0], 'member': member,
                   'sha256': hashlib.sha256(binary).hexdigest(), 'unityVersion': roots[0]['unityVersion']},
        'placements': placements,
        'roots': roots,
        'boundaries': {'dynamicImageSizing': 'runtime-fields-unavailable', 'resourcePairAssignment': 'thumbnail-cross-check', 'originalEffectParity': False},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    out = args.out.resolve()
    if out.exists() or out.is_relative_to(Path(__file__).resolve().parents[1]) or out == args.source.resolve():
        raise ValueError('Use a fresh external JSON candidate')
    result = inspect(args.source)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'roots': len(result['roots']), 'sourceSha256': result['source']['sha256'], 'output': str(out)}))
