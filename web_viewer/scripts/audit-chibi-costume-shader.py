#!/usr/bin/env python3
"""Read exact live material->external shader and texture PPtrs from RAW bundles."""
import argparse
import hashlib
import json
from pathlib import Path
import re

from live_chibi_costume_shader import validate_evidence


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def identity(obj):
    return {'serializedFile': obj.assets_file.name, 'pathId': str(obj.path_id),
            'sha256': hashlib.sha256(obj.get_raw_data()).hexdigest()}


def extract(raw_root, costumes):
    import UnityPy
    from UnityPy.export.ShaderConverter import export_shader
    shared = raw_root / 'shaders_and_materials.unity3d'
    materials, sources, unavailable, shader_evidence = [], [], [], None
    for costume in costumes:
        if not re.fullmatch(r'\d{3}[a-z]{3}_\d{3}_\d{2}', costume):
            raise ValueError('Expected an explicit native costume model id')
        bundle = raw_root / f'costume_{costume}.unity3d'
        env = UnityPy.load(str(bundle), str(shared))
        native_materials = [o for o in env.objects if o.type.name == 'Material' and o.read().m_Name == 'cos_Material']
        sources.append({'costume': costume, 'bundle': bundle.name, 'sha256': sha(bundle)})
        if not native_materials:
            # Lack of a live atlas is distinct from a missing supported costume.
            names = sorted(o.read().m_Name for o in env.objects if o.type.name in ('Texture2D', 'TextAsset'))
            unavailable.append({'costume': costume, 'status': 'no_live_cos_material',
                                'hasCosTexture': 'cos' in names, 'hasCosAtlas': 'cos.atlas' in names,
                                'hasComuTexture': 'comu' in names})
            continue
        if len(native_materials) != 1:
            raise ValueError('Ambiguous live costume material')
        reader = native_materials[0]
        tree = reader.read_typetree()
        native = reader.read()
        shader_reader = native.m_Shader.deref()
        shader = shader_reader.read()
        shader_tree = shader_reader.read_typetree()
        state = shader_tree['m_ParsedForm']['m_SubShaders'][0]['m_Passes'][0]['m_State']
        exported = export_shader(shader)
        program = re.search(r'SubProgram "gles3 hw_tier00 " \{\s*Keywords \{ "_BLEND_ALPHA" \}\s*"(.*?)"\s*\}', exported, re.S)
        if not program:
            raise ValueError('Observed GLES3 ALPHA source missing')
        vertex, fragment = program[1].split('#ifdef FRAGMENT', 1)
        current_shader = {**identity(shader_reader), 'name': shader_tree['m_ParsedForm']['m_Name'],
            'pass': state['m_Name'], 'variant': 'gles3 hw_tier00 _BLEND_ALPHA',
            'vertex': vertex, 'fragment': '#ifdef FRAGMENT' + fragment,
            'defaultColors': {p['m_Name']: [p[f'm_DefValue[{i}]'] for i in range(4)]
                              for p in shader_tree['m_ParsedForm']['m_PropInfo']['m_Props']
                              if p['m_Name'] in ('_BodyColor', '_SrcColor', '_DstColor')},
            'blend': {key: state['rtBlend0'][field]['val'] for key, field in
                      [('src', 'srcBlend'), ('dst', 'destBlend'), ('srcAlpha', 'srcBlendAlpha'),
                       ('dstAlpha', 'destBlendAlpha'), ('op', 'blendOp'), ('opAlpha', 'blendOpAlpha'), ('mask', 'colMask')]}}
        if shader_evidence is not None and current_shader != shader_evidence:
            raise ValueError('Costumes bind different shaders; split the audit')
        shader_evidence = current_shader
        tex = next(v for k, v in tree['m_SavedProperties']['m_TexEnvs'] if k == '_MainTex')
        texture_reader = next(v for k, v in native.m_SavedProperties.m_TexEnvs if k == '_MainTex').m_Texture.deref()
        # Also check the named typetree pointer against the actual dereference.
        floats = dict(tree['m_SavedProperties']['m_Floats'])
        colors = dict(tree['m_SavedProperties']['m_Colors'])
        materials.append({**identity(reader), 'costume': costume, 'name': tree['m_Name'],
            'keywords': tree['m_ShaderKeywords'], 'externals': [e.path for e in reader.assets_file.externals],
            'shaderPointer': tree['m_Shader'], 'texturePointer': tex['m_Texture'],
            'texture': {**identity(texture_reader), 'name': texture_reader.read().m_Name},
            'textureScale': tex['m_Scale'], 'textureOffset': tex['m_Offset'],
            'blendMode': floats['_Blend'], 'straightAlphaInput': floats['_StraightAlphaInput'],
            'rcpHeightCutOff': floats['_RcpHeightCutOff'],
            'serializedColors': {k: [colors[k][c] for c in 'rgba'] for k in ('_BodyColor', '_SrcColor', '_DstColor') if k in colors}})
    if shader_evidence is None:
        raise ValueError('No live costume shader; communication-only resources are not a stage model')
    evidence = {'schema': 1, 'sharedBundle': {'name': shared.name, 'sha256': sha(shared)},
                'sources': sources, 'shader': shader_evidence, 'materials': materials, 'unavailable': unavailable}
    evidence['contract'] = validate_evidence(evidence)
    return evidence


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-asset-root', type=Path, required=True)
    parser.add_argument('--costume', action='append', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = extract(args.raw_asset_root.resolve(strict=True), args.costume)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps(result['contract']))
