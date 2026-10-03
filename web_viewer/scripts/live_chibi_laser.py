"""Bounded native laser particle profile; director projection remains a preview."""
import hashlib
import math
import struct

STYLES = {3: 'fx_in_laserlight_randam_front', 4: 'fx_in_laserlight_randam_back',
          7: 'fx_in_psblts_laserlight'}

def require(ok, message):
    if not ok: raise ValueError(message)

def curve(c):
    require(c['minMaxState'] in (0, 1), 'Random laser curve unsupported')
    keys = c['maxCurve']['m_Curve']
    require(all(k['weightedMode'] == 0 for k in keys), 'Weighted laser curve unsupported')
    return {'mode': c['minMaxState'], 'scalar': c['scalar'],
            'keys': [{k: v[k] for k in ('time', 'value', 'inSlope', 'outSlope')} for v in keys]}

def system_model(p):
    m, r, main = p['modules'], p['renderer'], p['main']
    i, e = m['InitialModule'], m['EmissionModule']
    require(set(m) <= {'InitialModule', 'EmissionModule', 'ColorModule', 'SizeModule',
                       'RotationModule', 'ClampVelocityModule'}, 'Unsupported laser module')
    require(r['renderMode'] == 0 and r['alignment'] == 2 and main['looping']
            and not main['prewarm'] and main['simulationSpeed'] == 1,
            'Unsupported laser simulation/renderer')
    require(i['size3D'] and not i['rotation3D'] and i['startSpeed']['scalar'] == 0
            and i['gravityModifier']['scalar'] == 0, 'Moving laser needs a separate profile')
    if 'ClampVelocityModule' in m:
        require(m['ClampVelocityModule']['drag']['scalar'] == 0, 'Laser drag unsupported')
    require(e['rateOverTime']['scalar'] == e['rateOverDistance']['scalar'] == 0,
            'Continuous laser emission unsupported')
    mat = r['materials'][0]
    tex = mat['textures'][0]
    require(len(r['materials']) == len(mat['textures']) == 1
            and mat['shader']['name'] == 'Mobile/Particles/Additive'
            and mat['shader']['pathId'] == '950' and tex['name'] == 'laserlight_3'
            and tex['pathId'] == '885' and tex['scale'] == {'x': 1, 'y': 1}
            and tex['offset'] == {'x': 0, 'y': 0}, 'Changed native laser material')
    require(i['startColor']['minMaxState'] == 0 and m['ColorModule']['gradient']['minMaxState'] == 1,
            'Random laser color unsupported')
    g = m['ColorModule']['gradient']['maxGradient']
    require(g['m_Mode'] == 0, 'Fixed laser gradient unsupported')
    chain = p['transformChain']; q = chain[0]['rotation']
    require(all(t['scale'] == {'x': 1, 'y': 1, 'z': 1} for t in chain)
            and all(t['position']['x'] == t['position']['y'] == 0 for t in chain),
            'Translated/scaled native emitter unsupported')
    mirrored = q == {'x': 0, 'y': 1, 'z': 0, 'w': 0}
    require(mirrored or q['x'] == q['y'] == 0, 'Laser 3D rotation unsupported')
    require(all(t['rotation']['x'] == t['rotation']['y'] == 0 for t in chain[1:]),
            'Laser 3D parent rotation unsupported')
    require(all(b['cycleCount'] == 1 and b['probability'] == 1
                and b['countCurve']['minMaxState'] == 0 for b in e['m_Bursts']),
            'Random/repeating laser burst unsupported')
    return {'source': {k: p[k] for k in ('serializedFile', 'pathId', 'parameterTreeSha256')},
            'asset': tex['name'], 'texturePathId': tex['pathId'],
            'period': main['lengthInSec'], 'delay': main['startDelay']['scalar'],
            'capacity': i['maxNumParticles'], 'lifetime': curve(i['startLifetime']),
            'width': curve(i['startSize']), 'length': curve(i['startSizeY']),
            'rotation': curve(i['startRotation']), 'mirrored': mirrored,
            'angle': 2 * math.atan2(q['z'], q['w']) if not mirrored else 0,
            'prefabRootAngle': sum(2 * math.atan2(t['rotation']['z'], t['rotation']['w']) for t in chain[1:]),
            'anchorX': .5 - r['pivot']['x'], 'anchorY': .5 + r['pivot']['y'],
            'color': i['startColor']['maxColor'],
            'alpha': [{'time': g[f'atime{j}']/65535, 'value': g[f'key{j}']['a']}
                      for j in range(g['m_NumAlphaKeys'])],
            'bursts': [{'time': b['time'], 'count': int(b['countCurve']['scalar'])} for b in e['m_Bursts']],
            'sizeX': curve(m['SizeModule']['curve']) if 'SizeModule' in m else None,
            'sizeY': curve(m['SizeModule']['y'] if m['SizeModule']['separateAxes'] else m['SizeModule']['curve']) if 'SizeModule' in m else None,
            'angularVelocity': curve(m['RotationModule']['curve']) if 'RotationModule' in m else None}

def laser_model(root, prefabs):
    raw = bytes.fromhex(root['rawHex'])
    require(hashlib.sha256(raw).hexdigest() == root['sha256'], 'Changed native laser script')
    require(struct.unpack_from('<i', raw, 32)[0] == 9, 'Changed native laser style array')
    models = {}
    for prefab in prefabs:
        style = prefab['style']
        if style not in STYLES: continue
        ref = struct.unpack_from('<iq', raw, 36 + (style - 1) * 12)
        require(ref == (0, int(prefab['pointerPathId'])) and prefab['name'] == STYLES[style]
                and prefab['scriptClass'] == 'LiveObjectLightParticleEffect', 'Wrong native laser style binding')
        child_raw = bytes.fromhex(prefab['rawHex'])
        require(struct.unpack_from('<i', child_raw, 32)[0] == len(prefab['systems']) == 4,
                'Changed laser particle count')
        by_id = {int(p['pathId']): p for p in prefab['systems']}
        systems = [system_model(by_id[struct.unpack_from('<iq', child_raw, 36 + j * 12)[1]]) for j in range(4)]
        require(struct.unpack_from('<i', child_raw, 84)[0] == 0, 'Laser animator array unsupported')
        models[str(style)] = {'name': prefab['name'], 'scriptPathId': prefab['pointerPathId'],
                             'scriptSha256': hashlib.sha256(child_raw).hexdigest(),
                             'defaultDuration': struct.unpack_from('<f', child_raw, 88)[0], 'systems': systems}
    require(set(models) == {'3', '4', '7'}, 'Incomplete bounded laser profiles')
    return {'status': 'native_particle_inputs_reference_director_projection',
            'scriptPathId': root['pathId'], 'scriptSha256': root['sha256'], 'styles': models}

def extract_laser_model(environment, particle_audit):
    owner = next(o for o in environment.objects if o.type.name == 'MonoBehaviour'
                 and o.path_id == 106566 and o.assets_file.name == 'resources.assets')
    raw = owner.get_raw_data()
    root = {'pathId': str(owner.path_id), 'rawHex': raw.hex(), 'sha256': hashlib.sha256(raw).hexdigest()}
    prefabs = []
    for style in STYLES:
        ref = struct.unpack_from('<iq', raw, 36 + (style - 1) * 12)
        require(ref[0] == 0, 'External laser style unsupported')
        obj = owner.assets_file.objects[ref[1]]
        value = obj.read(check_read=False); go = value.m_GameObject.deref(); child_raw = obj.get_raw_data()
        systems = [particle_audit.particle_record(obj, {'m_FileID': 0,
                    'm_PathID': struct.unpack_from('<iq', child_raw, 36 + j * 12)[1]}, True) for j in range(4)]
        prefabs.append({'style': style, 'pointerPathId': str(obj.path_id), 'name': go.read().m_Name,
                        'scriptClass': value.m_Script.read().m_ClassName, 'rawHex': child_raw.hex(), 'systems': systems})
    return laser_model(root, prefabs), {'root': root, 'prefabs': prefabs}
