#!/usr/bin/env python3
"""Generate the shared native backmonitor layout without exporting media."""
import importlib.util
import hashlib
import json
from pathlib import Path
import UnityPy
from live_chibi_backmonitor_geometry import backmonitor_geometry

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('effects', ROOT/'scripts/prepare-live-chibi-stage-effects.py')
effects = importlib.util.module_from_spec(spec)
spec.loader.exec_module(effects)
data = effects.read_unity_data(effects.load_archive_sources(None).xapk_file)
record = backmonitor_geometry(UnityPy.load(data))
record['unityDataSha256'] = hashlib.sha256(data).hexdigest()
path = ROOT/'scripts/fixtures/chibi-backmonitor-geometry.json'
path.write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
path = ROOT/'src/core/chibiBackmonitorGeometry.js'
path.write_text('// Generated from native RectTransform / Sprite bindings.\n'
    '// See prepare-live-chibi-backmonitor-geometry.py and its source-bound fixture.\n'
    'export const nativeBackmonitorGeometry = Object.freeze('
    + json.dumps(record['model'],separators=(',',':')) + ')\n',encoding='utf8')
print(json.dumps(record['model']))
