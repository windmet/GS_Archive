"""Verify/add only RAW Spotlight/Pinspotlight command order; never export media."""
import argparse
import csv
import io
import importlib.util
import json
from pathlib import Path

from live_chibi_raw_semantics import load_raw_live_semantics

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare', ROOT / 'scripts/prepare-live-chibi-assets.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
args = argparse.ArgumentParser()
args.add_argument('--write', action='store_true')
prepare.add_sources_config_argument(args)
options = args.parse_args()
sources = prepare.load_archive_sources(options.sources_config)
records = load_raw_live_semantics(sources.raw_root / 'asset')['choreography']
songs, _ = prepare.read_choreography_scripts(
    {name: record['payload'] for name, record in records.items()}, prepare.MUSIC_CATALOG_PATH)
generated = {song['id']: song for song in songs}
path = ROOT / 'public/assets/live-chibi/choreography/index.json'
index = json.loads(path.read_text(encoding='utf-8'))
sidecar=json.loads((ROOT/'public/data/stage-spotlight-commands.json').read_text(encoding='utf8'))
count = 0
for song in index['songs']:
    native = generated[song['id']]
    for family in ('spotlight', 'pinspotlight'):
        if family=='spotlight':
            # Current media index uses the legacy names. Its replacement
            # sidecar has the canonical native fields and identical identity/order.
            canonical=[{k:v for k,v in e.items() if k!='sourceRow'} for e in sidecar['songs'][song['id']]['events']]
            assert canonical==native['spotlightEvents'],song['id']
            assert [(e['time'],e['id'],e['hide']) for e in song['spotlightEvents']]==[(e['time'],e['id'],e['hide']) for e in canonical]
        else:
            assert song[family + 'Events'] == native[family + 'Events'], (song['id'], family)
    if options.write:
        song['spotlightCommandOrder'] = native['spotlightCommandOrder']
    else:
        assert song['spotlightCommandOrder'] == native['spotlightCommandOrder'], song['id']
    # Independent raw-row witness: no parser helper or event-ID sorting.
    rows = csv.DictReader(io.StringIO(records[song['id']]['payload'].decode('utf-8-sig')))
    raw = [(row['type'].lower(), float(row['time']), float(row['value1']))
           for row in rows if row['type'] in ('Spotlight', 'Pinspotlight')]
    expected = sorted(raw, key=lambda row: row[1])
    actual = [(item['family'], native[item['family'] + 'Events'][item['index']]['time'],
               native[item['family'] + 'Events'][item['index']]['id'])
              for item in native['spotlightCommandOrder']]
    assert actual == expected, song['id']
    count += len(native['spotlightCommandOrder'])
if options.write:
    path.write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'PASS RAW command order: {len(index["songs"])} arrangements, {count} commands; media untouched')
