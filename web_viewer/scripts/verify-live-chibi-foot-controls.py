"""Verify RAW Foot_Color controls and five exact skeleton unit bindings."""
import argparse
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import UnityPy
from live_chibi_foot_colors import foot_color_events

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare', ROOT / 'scripts/prepare-live-chibi-assets.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
parser = argparse.ArgumentParser()
parser.add_argument('--write', action='store_true')
prepare.add_sources_config_argument(parser)
args = parser.parse_args()
sources = prepare.load_archive_sources(args.sources_config)
records = prepare.load_raw_live_semantics(sources.raw_root / 'asset')['choreography']
path = ROOT / 'public/assets/live-chibi/choreography/index.json'
index = json.loads(path.read_text(encoding='utf-8'))
count = erased = 0
for song in index['songs']:
    rows = list(csv.reader(io.StringIO(records[song['id']]['payload'].decode('utf-8-sig'))))
    expected = foot_color_events(rows)
    assert expected == foot_color_events([list(reversed(row)) for row in rows]), song['id']
    assert len(expected) == len(song['characterLightEvents']), song['id']
    if args.write:
        song['characterLightEvents'] = expected
    else:
        assert song['characterLightEvents'] == expected, song['id']
    count += len(expected)
    erased += sum(e['hide'] for e in expected)
fixture = json.loads((ROOT / 'scripts/fixtures/chibi-native-skeleton-units.json').read_text())
for item in fixture['bodies']:
    bundle = sources.raw_root / 'asset' / item['bundle']
    assert hashlib.sha256(bundle.read_bytes()).hexdigest() == item['bundleSha256']
    env = UnityPy.load(str(bundle))
    asset = next(o for o in env.objects if str(o.path_id) == item['assetPathId'])
    assert hashlib.sha256(asset.get_raw_data()).hexdigest() == item['assetSha256']
    assert asset.read_typetree()['scale'] == item['scale']
    skeleton = next(o for o in env.objects if str(o.path_id) == item['skeletonPathId'])
    payload = skeleton.read().m_Script
    if not isinstance(payload, bytes):
        payload = payload.encode('utf-8', errors='surrogateescape')
    published = (ROOT / f'public/assets/live-chibi/setup/body-{item["bodyType"]}.skel').read_bytes()
    assert payload == published
    assert hashlib.sha256(published).hexdigest() == item['skeletonSha256']
if args.write:
    path.write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'PASS RAW Foot_Color: {count} commands, {erased} immediate erases, five skeleton scale/hash bindings')
