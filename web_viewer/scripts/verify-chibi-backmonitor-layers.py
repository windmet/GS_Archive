"""Re-extract native renderer bindings and shader oracle; --write refreshes payloads."""
import argparse
import hashlib
import importlib.util
import json
import re
import tempfile
from pathlib import Path
import UnityPy
from live_chibi_backmonitor_layers import extract_backmonitor_layers
from live_chibi_backmonitor_geometry import backmonitor_geometry

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('effects', ROOT/'scripts/prepare-live-chibi-stage-effects.py')
effects = importlib.util.module_from_spec(spec)
spec.loader.exec_module(effects)
parser = argparse.ArgumentParser()
effects.add_sources_config_argument(parser)
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
sources = effects.load_archive_sources(args.sources_config)
data = effects.read_unity_data(effects.find_xapk(None, sources.xapk_file))
env = UnityPy.load(data)
geometry=backmonitor_geometry(env)
geometry['unityDataSha256']=hashlib.sha256(data).hexdigest()
assert geometry == json.loads((ROOT/'scripts/fixtures/chibi-backmonitor-geometry.json').read_text(encoding='utf8'))
fixture_path = ROOT/'scripts/fixtures/chibi-backmonitor-renderers.json'
index_path = ROOT/'public/assets/live-chibi/stage-effects/index.json'
with tempfile.TemporaryDirectory(prefix='chibi-backmonitor-') as tmp:
    model, assets = extract_backmonitor_layers(env, Path(tmp))
    programs = {}
    for role in ['noise', 'glow']:
        pid = int(assets['native_backmonitor_'+role]['source']['rendererPathId'])
        renderer = next(o for o in env.objects if o.path_id == pid and o.assets_file.name == 'resources.assets').read()
        shader = renderer.m_Materials[0].deref().read().m_Shader.deref()
        exported = shader.read().export()
        assert 'vs_COLOR0 = clamp(vs_COLOR0, 0.0, 1.0);' in exported
        fragment = re.findall(r'#ifdef FRAGMENT\s*#version 300 es(.*?void main\(\).*?\n\})', exported, re.S)[0]
        tail = fragment.split('SV_Target0;', 1)[1].replace('texture(', 'texture2D(').replace('SV_Target0 =', 'gl_FragColor =')
        programs[role] = dict(fragmentTail=tail, vertexColorClamp=True, shaderSha256=hashlib.sha256(shader.get_raw_data()).hexdigest())
    fixture = dict(unityDataSha256=hashlib.sha256(data).hexdigest(), model=model, assets=assets, nativePrograms=programs)
    if args.write:
        fixture_path.write_text(json.dumps(fixture, indent=2)+'\n', encoding='utf-8')
        index = json.loads(index_path.read_text(encoding='utf-8'))
        index['backmonitorLayers'] = model
        index['assets'].update(assets)
        index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
        for asset in assets.values():
            target = ROOT/'public/assets/live-chibi'/asset['file']
            target.write_bytes((Path(tmp)/target.name).read_bytes())
    else:
        assert fixture == json.loads(fixture_path.read_text(encoding='utf-8'))
        index = json.loads(index_path.read_text(encoding='utf-8'))
        assert index['backmonitorLayers'] == model
        for key, asset in assets.items():
            assert index['assets'][key] == asset
            assert hashlib.sha256((ROOT/'public/assets/live-chibi'/asset['file']).read_bytes()).hexdigest() == asset['pngSha256']
print('Native backmonitor bindings, stage orders, shader sources and three PNG hashes verified')
