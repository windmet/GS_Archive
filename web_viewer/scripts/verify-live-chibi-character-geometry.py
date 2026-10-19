"""Re-read APK-bound stage slots and all five RAW SkeletonDataAssets."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import UnityPy
from live_chibi_character_geometry import character_geometry

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
fixture = json.loads((ROOT/'scripts/fixtures/chibi-native-skeleton-units.json').read_text(encoding='utf-8'))
result = character_geometry(UnityPy.load(data), sources.raw_root/'asset', fixture)
result['unityDataSha256'] = hashlib.sha256(data).hexdigest()
fixture_path = ROOT/'scripts/fixtures/chibi-native-character-geometry.json'
module_path = ROOT/'src/core/chibiNativeCharacterGeometry.json'
if args.write:
    fixture_path.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    module_path.write_text(json.dumps(result['model'], indent=2)+'\n', encoding='utf-8')
else:
    assert result == json.loads(fixture_path.read_text(encoding='utf-8'))
    assert result['model'] == json.loads(module_path.read_text(encoding='utf-8'))
print('PASS APK LiveStage -> six idol root transforms, five RAW skeleton scale bindings and generated projection inputs')
