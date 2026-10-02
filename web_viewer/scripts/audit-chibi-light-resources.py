#!/usr/bin/env python3
"""Inspect exact built-in light prefabs without promoting unknown script fields.

Retains typed transforms, Sprite/Material bindings and unresolved MonoBehaviour
tails. Does not export a new render model or change published assets.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import UnityPy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import sha256_file


def vector(value):
    return {key: getattr(value, key) for key in ('x', 'y', 'z', 'w') if hasattr(value, key)}


def identity(reader):
    return {'serializedFile': reader.assets_file.name, 'pathId': str(reader.path_id)}


def inspect_prefab(reader):
    game_object = reader.read()
    components, children = [], []
    for link in game_object.m_Component:
        obj = link.component.deref()
        entry = {'type': obj.type.name, **identity(obj)}
        if obj.type.name == 'MonoBehaviour':
            raw = obj.get_raw_data()
            entry.update({'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
            try:
                tree = obj.read_typetree()
                entry['typetreeStatus'] = 'complete'
            except ValueError as error:
                tree = obj.read_typetree(check_read=False)
                entry['typetreeStatus'] = 'partial_unknown_custom_fields'
                entry['strictReadError'] = str(error)
                entry['rawHex'] = raw.hex()
            # Script name is resolved by its PPtr, never by an unrelated ID.
            common = obj.read(check_read=False)
            entry['scriptClass'] = common.m_Script.read().m_ClassName
            entry['commonFields'] = tree
            components.append(entry)
            continue
        value = obj.read()
        if obj.type.name == 'Transform':
            entry.update({'position': vector(value.m_LocalPosition),
                          'scale': vector(value.m_LocalScale),
                          'rotation': vector(value.m_LocalRotation)})
            for child in value.m_Children:
                children.append(inspect_prefab(child.read().m_GameObject.deref()))
        elif obj.type.name == 'SpriteRenderer':
            entry['color'] = {k: getattr(value.m_Color, k) for k in ('r', 'g', 'b', 'a')}
            entry['sortingOrder'] = value.m_SortingOrder
            if value.m_Sprite.m_PathID:
                sprite_reader = value.m_Sprite.deref()
                sprite = sprite_reader.read()
                entry['sprite'] = {'name': sprite.m_Name, **identity(sprite_reader),
                    'rect': {k: getattr(sprite.m_Rect, k) for k in ('x', 'y', 'width', 'height')},
                    'pivot': vector(sprite.m_Pivot), 'pixelsToUnits': sprite.m_PixelsToUnits}
                texture_reader = sprite.m_RD.texture.deref()
                texture = texture_reader.read()
                entry['sprite']['texture'] = {'name': texture.m_Name, **identity(texture_reader),
                    'width': texture.m_Width, 'height': texture.m_Height}
            entry['materials'] = []
            for pointer in value.m_Materials:
                material_reader = pointer.deref()
                material = material_reader.read()
                shader = material.m_Shader.read()
                entry['materials'].append({'name': material.m_Name, **identity(material_reader),
                    'shader': shader.m_ParsedForm.m_Name if hasattr(shader, 'm_ParsedForm') else shader.m_Name})
        components.append(entry)
    return {'name': game_object.m_Name, **identity(reader),
            'components': components, 'children': children}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--names', nargs='+', required=True, help='Exact root GameObject names')
    parser.add_argument('--output-file', type=Path, required=True)
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    helper_spec = importlib.util.spec_from_file_location('stage_effect_source', ROOT / 'scripts/prepare-live-chibi-stage-effects.py')
    helper = importlib.util.module_from_spec(helper_spec)
    helper_spec.loader.exec_module(helper)
    data = helper.read_unity_data(helper.find_xapk(None, sources.xapk_file))
    environment = UnityPy.load(data)
    names = set(args.names)
    prefabs = [inspect_prefab(obj) for obj in environment.objects
               if obj.type.name == 'GameObject' and obj.read().m_Name in names]
    missing = sorted(names - {prefab['name'] for prefab in prefabs})
    if missing:
        raise ValueError('Exact built-in prefabs missing: ' + ', '.join(missing))
    output = args.output_file.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schemaVersion': 1, 'status': 'typed_resource_evidence_only',
        'source': {'xapk': sources.xapk_file.name, 'xapkSha256': sha256_file(sources.xapk_file),
                   'unityDataSha256': hashlib.sha256(data).hexdigest()},
        'prefabs': prefabs}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'prefabs': len(prefabs), 'output': str(output)}))


if __name__ == '__main__':
    main()
