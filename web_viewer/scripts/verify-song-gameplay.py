#!/usr/bin/env python3
"""Recheck identities, difficulty versions, native bytes and lossless fumen partitions."""
import json, hashlib, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'data_pipeline'))
from archive_paths import load_archive_sources
from sidem_masterdata import extract_table_rows, iter_top_records
from song_gameplay import gameplay_by_code, generate_charts

sources=load_archive_sources()
catalog=json.loads((ROOT/'public/data/song_catalog.json').read_bytes())
manifest=json.loads((ROOT/'public/data/song_charts/manifest.json').read_bytes())
audit=json.loads((ROOT/'config/song-gameplay-native-audit.v1.json').read_bytes())
pb=sources.masterdata_decoded_file.read_bytes()
assert hashlib.sha256(pb).hexdigest()==audit['decodedPbSha256']
metadata=(ROOT/'.analysis/sidem_ios_keyfiles/global-metadata.dat').read_bytes()
assert hashlib.sha256(metadata).hexdigest()==audit['metadataSha256']
schema_bytes=(ROOT.parent/'data_pipeline/schema/il2cpp_protobuf_schema.json').read_bytes()
assert hashlib.sha256(schema_bytes).hexdigest()==audit['schemaSha256']
models=json.loads(schema_bytes)['models_by_full_name']
for model,fields in audit['modelFields'].items():
    actual={str(f['number']):f['name'] for f in models[model]['fields']}
    assert all(actual[number]==name for number,name in fields.items()),model
for enum in audit['enums']:
    for member in enum['members']:
        e=member['rawEvidence']
        raw=metadata[e['defaultValueFileOffset']:e['defaultValueFileOffset']+4]
        assert raw.hex()==e['int32Hex'] and int.from_bytes(raw,'little',signed=True)==member['value']
rows=extract_table_rows(list(iter_top_records(pb)),{4,5,46,47})
expected=gameplay_by_code(rows,manifest)
assert len(rows[46])==99 and len(rows[47])==396 and len(expected)==61
for code,song in catalog['songs'].items():
    assert song['gameplay']==expected[code],code
    assert song['song_id']==song['gameplay']['sourceSongId'],code
    assert song['gameplay']['wikiLevelStatus']!='conflict_pending',code
special=catalog['songs']['drv999']['gameplay']
assert special['history']['firstImplementedOn']=='2022-04-01'
assert special['difficulties'][0]['label']=='PASSION' and special['difficulties'][0]['levelLabel']=='?'
assert catalog['songs']['unmikn']['gameplay']['history']['permanentDateStatus']=='pending'
generate_charts(sources.raw_root/'asset',catalog['songs'],check=True)
notes=sum(d['noteObjectCount'] for ds in manifest['songs'].values() for d in ds.values())
extra={code:d['5']['noteObjectCount'] for code,d in manifest['songs'].items() if '5' in d}
print(f'Gameplay verified: 61 identities, 244 displayed difficulties, {notes} original note objects; unassigned fifth blocks: {extra}')
