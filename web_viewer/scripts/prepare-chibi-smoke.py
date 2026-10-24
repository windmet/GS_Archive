"""Publish the source-bound six-system Smoke preview; no upload or deployment."""
import argparse, hashlib, io, json, runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sha = lambda b: hashlib.sha256(b).hexdigest()
encode = lambda x: (json.dumps(x, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf8')

def extract():
    audit = runpy.run_path(str(ROOT / 'scripts/audit-chibi-smoke.py'), run_name='smoke_source')
    source_path = ROOT / 'scripts/fixtures/chibi-smoke-source.json'
    source = json.loads(source_path.read_text(encoding='utf8'))
    assert audit['extract'](source['managed']) == source, 'Changed RAW Smoke source'
    helpers = runpy.run_path(str(ROOT / 'scripts/prepare-chibi-object-emitters.py'), run_name='smoke_curves')
    w = helpers['w']
    fx = runpy.run_path(str(ROOT / 'scripts/prepare-live-chibi-stage-effects.py'), run_name='smoke_textures')
    config = fx['load_archive_sources'](None)
    env = fx['UnityPy'].load(fx['read_unity_data'](config.xapk_file))
    objects = {str(o.path_id): o for o in env.objects if o.assets_file.name == 'resources.assets'}
    textures, images = {}, {}
    for key, expected in source['textures'].items():
        obj = objects[key]
        image = obj.read().image.convert('RGBA')
        assert sha(obj.get_raw_data()) == expected['rawSha256'] and sha(image.tobytes()) == expected['rgbaSha256']
        buffer = io.BytesIO(); image.save(buffer, format='PNG', optimize=True)
        raw = buffer.getvalue(); path = f'/data/stage-smoke/{sha(raw)[:24]}.png'
        textures[key] = dict(file=path, width=image.width, height=image.height, pngSha256=sha(raw),
                             bytes=len(raw), nativeSampling=expected['sampling'], source=expected['source'])
        images[path] = raw
    systems = []
    for p in source['particles']:
        m, main, renderer = p['modules'], p['main'], p['renderer']
        i, e, s = m['InitialModule'], m['EmissionModule'], m['ShapeModule']
        assert renderer['alignment'] == 1 and main['moveWithTransform'] == 1 and main['scalingMode'] == 0
        assert main['simulationSpeed'] == 1 and not main['prewarm'] and main['startDelay']['scalar'] == 0
        assert s['type'] == 12 and s['radius']['mode'] == 0
        assert e['rateOverTime']['minMaxState'] == 0 and e['rateOverDistance']['scalar'] == 0 and not e['m_Bursts']
        assert not i['rotation3D'] and i['startSpeed']['minMaxState'] == 0 and i['startLifetime']['minMaxState'] in (0,3)
        assert all(t['scale'] == dict(x=1,y=1,z=1) and t['rotation'] == dict(x=0,y=0,z=0,w=1) for t in p['transformChain'])
        assert set(m) <= {'InitialModule','EmissionModule','ShapeModule','SizeModule','RotationModule','ColorModule','UVModule','ClampVelocityModule'}
        assert m['ColorModule']['gradient']['minMaxState'] == 1
        mat = renderer['materials'][0]
        assert len(renderer['materials']) == 1 and mat['shader']['pathId'] == '951'
        assert all(t['scale'] == dict(x=1,y=1) and t['offset'] == dict(x=0,y=0) for t in mat['textures'])
        curve = helpers['initial_curve']
        uv = m.get('UVModule'); limit = m.get('ClampVelocityModule')
        if uv:
            assert uv['mode'] == uv['timeMode'] == uv['animationType'] == 0 and uv['cycles'] == 1
            assert uv['flipU'] == uv['flipV'] == 0
        if limit:
            assert not limit['separateAxis'] and not limit['inWorldSpace'] and limit['drag']['scalar'] == 0
        model = dict(source={k:p[k] for k in ['serializedFile','pathId','parameterTreeSha256']}, name=p['name'],
            smokeBinding='native-smoke-static-local-v1', alignment=1, chain=p['transformChain'], sortingOrder=renderer['sortingOrder'],
            duration=main['lengthInSec'], looping=main['looping'], prewarm=False, delay=dict(mode=0,value=0,min=0),
            capacity=i['maxNumParticles'], rate=e['rateOverTime']['scalar'], bursts=[], shape=s,
            lifetime=curve(i['startLifetime']), speed=curve(i['startSpeed']), size=curve(i['startSize']),
            sizeY=curve(i['startSizeY']) if i['size3D'] else None, rotation=curve(i['startRotation']), gravity=curve(i['gravityModifier']),
            randomizeRotationDirection=i['randomizeRotationDirection'],
            color=i['startColor']['maxColor'], colorMin=i['startColor']['minColor'], colorMode=i['startColor']['minMaxState'],
            colorGradient=w.gradient(i['startColor']['maxGradient']), colorOverLife=w.gradient(m['ColorModule']['gradient']['maxGradient']),
            sizeOverLife=curve(m['SizeModule']['curve']) if 'SizeModule' in m else None, sizeOverLifeY=None,
            angularVelocity=curve(m['RotationModule']['curve']) if 'RotationModule' in m else None,
            uv=dict(columns=uv['tilesX'],rows=uv['tilesY'],cycles=uv['cycles'],startFrame=curve(uv['startFrame']),frameOverTime=curve(uv['frameOverTime'])) if uv else None,
            limit=dict(profile='native-lifetime-magnitude-v1',dampen=limit['dampen'],curve=curve(limit['magnitude'])) if limit else None,
            rendererBounds=dict(profile='native-smoke-screen-size-v1',min=p['rendererBounds']['m_MinParticleSize'],max=p['rendererBounds']['m_MaxParticleSize']),
            texture=next(t['pathId'] for t in mat['textures'] if t['property']=='_MainTex'),blend='normal')
        systems.append(model)
    tracks = {}
    for key, song in source['songs'].items():
        events = []
        for command in song['commands']:
            values = command['values']; hide = values['value101'] == '1'
            events.append(dict(time=command['time'],hide=hide,variant=int(values['value1']),
                               depth=0 if hide else int(values['value3']),sourceRow=command['sourceRow']))
        tracks[key] = dict(songCode=song['songCode'],source=song['source'],raw=song['raw'],events=events)
    proofs = {name:sha((ROOT / f'scripts/fixtures/chibi-smoke-{name}-native.json').read_bytes()) for name in ['billboard','edge','motion','side','uv']}
    data = dict(schemaVersion=1,contract='source-linked-smoke-preview-v1',choreographyIndexSha256=source['choreographyIndexSha256'],
        sourceSha256=sha(source_path.read_bytes()),nativeProofs=proofs,textures=textures,systems=systems,
        groups={str(g['variant']):g['systems'] for g in source['groups']},songs=tracks,
        boundary='Source-linked Web preview: deterministic Web seeds and 60Hz simulation, static local emitter hierarchy, StopEmitting lifetime tails. Native clock/RNG, full restart parity and GPU/original-video parity remain unverified.')
    spatial = json.loads((ROOT / 'src/data/chibiObjectSpatialBinding.json').read_text(encoding='utf8'))
    payload = encode(data)
    binding = dict(profile='native-smoke-static-local-v1',dataSha256=sha(payload),sourceSha256=data['sourceSha256'],
        choreographyIndexSha256=data['choreographyIndexSha256'],sourceContextSha256=spatial['sourceContextSha256'],stageScaleXY=spatial['stageScaleXY'],
        systems={p['source']['pathId']:dict(source=p['source'],chain=p['chain'],bounds=p['rendererBounds']) for p in systems},arrangements=list(tracks))
    return payload, encode(binding), images

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');args=parser.parse_args()
    data,binding,images=extract()
    outputs={ROOT/'public/data/stage-smoke.json':data,ROOT/'src/data/chibiSmokeBinding.json':binding,
             **{ROOT/'public'/path.lstrip('/'):raw for path,raw in images.items()}}
    for path,raw in outputs.items():
        if args.write:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        else:assert path.read_bytes()==raw, f'Changed Smoke output: {path}'
    print(json.dumps(dict(systems=6,groups=2,commands=5,textures=len(images),bytes=sum(map(len,outputs.values())))))
