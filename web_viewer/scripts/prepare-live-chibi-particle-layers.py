#!/usr/bin/env python3
"""Export the bounded ANYWHERE UV-burst pilot; reject other particle semantics."""
import argparse
import importlib.util
import json
import math
from pathlib import Path

import UnityPy

spec = importlib.util.spec_from_file_location('stage_audit', Path(__file__).with_name('audit-live-chibi-stage-objects.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

PROFILE = 'uv-single-burst-billboard-v1'
ASSETS = ('fx_in_anwhre_window_1', 'fx_in_anwhre_window_2')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def constant(curve):
    require(curve['minMaxState'] == 0, 'Random or curved initial parameter unsupported')
    value = float(curve['scalar'])
    require(math.isfinite(value), 'Nonfinite scalar')
    return value


def uv_curve(curve):
    mode = curve['minMaxState']
    require(mode in (0, 1), 'Random UV curves unsupported')
    scalar = float(curve['scalar'])
    keys = curve['maxCurve']['m_Curve'] if mode == 1 else []
    require(mode == 0 or bool(keys), 'Empty UV curve')
    result = []
    for key in keys:
        require(key['weightedMode'] == 0, 'Weighted UV tangents unsupported')
        values = {k: float(key[k]) for k in ('time', 'value', 'inSlope', 'outSlope')}
        require(all(math.isfinite(v) for v in values.values()), 'Nonfinite UV keys')
        require(not result or values['time'] > result[-1]['time'], 'Unordered UV keys')
        result.append(values)
    require(math.isfinite(scalar), 'Nonfinite UV scalar')
    return {'mode': mode, 'scalar': scalar, 'keys': result}


def particle_profile(particle, root):
    require(particle['status'] == 'resolved_in_bundle', 'Missing particle')
    require(set(particle['enabledModules']) == {'InitialModule', 'EmissionModule', 'UVModule'}, 'Unsupported enabled module')
    m, r = particle['main'], particle['renderer']
    i, e, u = (particle['modules'][k] for k in ('InitialModule', 'EmissionModule', 'UVModule'))
    require(particle['gameObjectActive'] and r['enabled'], 'Inactive renderer')
    require(r['renderMode'] == 0 and r['alignment'] == 2, 'Only local planar billboards supported')
    require(all(v == 0 for v in r['pivot'].values()), 'Nonzero pivot')
    require(m['looping'] and not m['prewarm'] and m['simulationSpeed'] == 1 and m['scalingMode'] == 0, 'Unsupported timing/scale')
    require(m['moveWithTransform'] == 0, 'Unsupported simulation space')
    require(not i['size3D'] and not i['rotation3D'] and not i['randomizeRotationDirection'], 'Unsupported 3D size/rotation')
    require(constant(i['startSpeed']) == constant(i['gravityModifier']) == constant(i['startRotation']) == 0, 'Moving/rotating particles unsupported')
    require(i['startColor']['minMaxState'] == 0, 'Random colors unsupported')
    require(constant(e['rateOverTime']) == constant(e['rateOverDistance']) == 0 and e['m_BurstCount'] == len(e['m_Bursts']) == 1, 'Continuous/multiple emission unsupported')
    burst = e['m_Bursts'][0]
    require(burst['time'] == 0 and burst['cycleCount'] == 1 and burst['probability'] == 1 and constant(burst['countCurve']) == 1, 'Only one deterministic burst supported')
    require(u['mode'] == u['timeMode'] == u['animationType'] == 0 and u['cycles'] == 1 and u['flipU'] == u['flipV'] == 0, 'Unsupported sheet mode')
    require(u['tilesX'] == u['tilesY'] == 4, 'Pilot requires a 4x4 sheet')
    lifetime, duration = constant(i['startLifetime']), float(m['lengthInSec'])
    require(0 < lifetime <= duration and i['maxNumParticles'] >= 1, 'Overlapping lifetimes unsupported')
    position = {'x': 0, 'y': 0, 'z': 0}
    found_root = False
    for transform in particle['transformChain']:
        if transform.get('pathId') == root['pathId'] and transform.get('serializedFile') == root['serializedFile']:
            found_root = True
            break
        require('position' in transform, 'Unresolved transform')
        require(transform['rotation'] == {'x': 0, 'y': 0, 'z': 0, 'w': 1} and transform['scale'] == {'x': 1, 'y': 1, 'z': 1}, 'Nonplanar/scale transforms unsupported')
        for axis in position:
            position[axis] += transform['position'][axis]
    require(found_root, 'Particle is outside keeper root')
    require(len(r['materials']) == 1, 'Multiple materials unsupported')
    material = r['materials'][0]
    require(material['shader']['status'] == 'resolved_in_bundle' and material['shader']['name'] == 'Mobile/Particles/Additive', 'Unsupported shader')
    require(not material['keywords'] and material['customRenderQueue'] == -1, 'Custom material pipeline unsupported')
    textures = material['textures']
    require(len(textures) == 1 and textures[0]['property'] == '_MainTex' and textures[0]['status'] == 'resolved_in_bundle', 'Unsupported texture binding')
    texture = textures[0]
    require(texture['scale'] == {'x': 1, 'y': 1} and texture['offset'] == {'x': 0, 'y': 0}, 'Texture transform unsupported')
    color = i['startColor']['maxColor']
    require(all(0 <= v <= 1 for v in color.values()), 'HDR colors unsupported')
    return {'source': {k: particle[k] for k in ('serializedFile', 'pathId', 'parameterTreeSha256')},
            'texture': texture['pathId'], 'position': position, 'size': constant(i['startSize']),
            'color': color, 'sortingOrder': r['sortingOrder'], 'duration': duration,
            'lifetime': lifetime, 'delay': constant(m['startDelay']), 'startFrame': constant(u['startFrame']),
            'frameOverTime': uv_curve(u['frameOverTime']), 'columns': 4, 'rows': 4,
            'shader': material['shader'], 'material': material['pathId']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    audit.add_sources_config_argument(parser)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    sources = audit.load_archive_sources(args.sources_config)
    out = args.output_root.resolve()
    require(not out.is_relative_to(sources.raw_root.resolve()), 'Output cannot be RAW')
    index = json.loads(sources.published_path('assets/live-chibi/object-layers/index.json').read_text(encoding='utf8'))
    bundle = sources.raw_root / 'asset' / 'song_anwhre.unity3d'
    environment = UnityPy.load(str(bundle))
    files = {o.assets_file.name: o.assets_file for o in environment.objects}
    bundle_hash = audit.file_hash(bundle)
    entries, textures = {}, {}
    for asset in ASSETS:
        entry = index['assets'][asset]
        require(entry['bundle'] == bundle.name and entry['kind'] == 'particle', 'Pilot source changed')
        record = audit.inspect_asset(environment, asset, entry, True)
        root = record['rootTransformChain'][0]
        require(root['position'] == {'x': 0, 'y': 0, 'z': 0} and root['scale'] == {'x': 1, 'y': 1, 'z': 1} and root['rotation'] == {'x': 0, 'y': 0, 'z': 0, 'w': 1}, 'Keeper root changed')
        systems = [particle_profile(p, root) for p in record['particles']]
        for system in systems:
            shader_ref = system['shader']
            shader = files[shader_ref['serializedFile']].objects[int(shader_ref['pathId'])]
            require(shader.type.name == 'Shader', 'Typed shader identity mismatch')
            parsed = shader.read_typetree()['m_ParsedForm']
            state = parsed['m_SubShaders'][0]['m_Passes'][0]['m_State']
            blend = {k: state['rtBlend0'][k]['val'] for k in ('srcBlend', 'destBlend', 'blendOp')}
            require(blend == {'srcBlend': 5, 'destBlend': 1, 'blendOp': 0} and state['zWrite']['val'] == 0 and state['culling']['val'] == 0,
                    'Shader blend/depth/culling changed')
            shader_ref['parametersSha256'] = audit.json_hash(parsed)
            shader_ref['blend'] = blend
            identity = system['texture']
            if identity in textures:
                continue
            obj = files[system['source']['serializedFile']].objects[int(identity)]
            require(obj.type.name == 'Texture2D', 'Typed texture identity mismatch')
            tex = obj.read()
            image = tex.image.convert('RGBA')
            require(image.size == (1024, 1024), 'Texture dimensions changed')
            relative = f'textures/{tex.m_Name}.png'
            require(Path(relative).name == f'{tex.m_Name}.png' and '/' not in tex.m_Name and '\\' not in tex.m_Name, 'Unsafe texture name')
            target = out / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target)
            textures[identity] = {'id': identity, 'file': f'particle-layers/{relative}', 'width': 1024,
                                  'height': 1024, 'sha256': audit.file_hash(target), **audit.source_ref(obj)}
        entries[asset] = {'profile': PROFILE, 'bundle': bundle.name, 'bundleSha256': bundle_hash,
                          'keeper': record['keeper'], 'particleCount': len(systems), 'systems': systems}
    result = {'schemaVersion': 1, 'projection': 'existing-2d-object-plane', 'assets': entries, 'textures': textures}
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.json').write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf8')
    print(json.dumps({'objects': len(entries), 'particles': sum(e['particleCount'] for e in entries.values()),
                      'textures': len(textures), 'indexSha256': audit.file_hash(out / 'index.json')}))


if __name__ == '__main__':
    main()
