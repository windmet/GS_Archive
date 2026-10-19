"""Native Spotlight getters, independently of the legacy index field names."""
import csv
import hashlib
import io
import json
import re
import struct
from pathlib import Path


def int32(value):
    value = str(value or '').strip()
    if not re.fullmatch(r'[+-]?[0-9]+', value): return 0
    number = int(value)
    return number if -2147483648 <= number <= 2147483647 else 0


def f32(value): return struct.unpack('<f',struct.pack('<f',value))[0]


def spotlight_command(row):
    hide = row.get('value101') == '1'
    event = dict(time=float(row['time']),id=int32(row.get('value1')),hide=hide,stagePosition=None)
    if hide:
        event['duration'] = f32(f32(int32(row.get('value102')))/1000)*1000
        return event
    event.update(targetSlot=int32(row.get('value2')),x=int32(row.get('value3')),y=int32(row.get('value4')),
        scale=f32(f32(int32(row.get('value6')))/1000),duration=500,
        beamColor=(row.get('value5') or '').strip() or None,
        environmentColor=(row.get('value7') or '').strip() or None,
        environmentOpacity=int32(row.get('value8')),depth=int32(row.get('value9')))
    return event


def native_spotlight_data(root, sources):
    import UnityPy
    path=root/'public/assets/live-chibi/choreography/index.json'
    index=json.loads(path.read_text(encoding='utf8'))
    songs={s['id']:s for s in index['songs']}; tracks={}
    for code in sorted({s['songCode'] for s in songs.values()}):
        bundle=sources.raw_root/f'asset/song_{code}.unity3d'
        digest=hashlib.sha256(bundle.read_bytes()).hexdigest()
        for asset in UnityPy.load(str(bundle)).objects:
            if asset.type.name!='TextAsset': continue
            text=asset.read()
            if text.m_Name not in songs: continue
            payload=text.m_Script
            if isinstance(payload,str): payload=payload.encode('utf8')
            events=[]; song=songs[text.m_Name]
            stage_map={int(m['performerSlot']):int(m['stagePosition']) for m in song['stagePositionMap']}
            for number,row in enumerate(csv.DictReader(io.StringIO(payload.decode('utf-8-sig'))),2):
                if row.get('type')!='Spotlight': continue
                event=spotlight_command(row)
                event['sourceRow']=number
                if not event['hide']: event['stagePosition']=stage_map.get(event['targetSlot'])
                events.append(event)
            events.sort(key=lambda e:(e['time'],e['id']))
            assert [(e['time'],e['id'],e['hide']) for e in events]==[(e['time'],e['id'],e['hide']) for e in song.get('spotlightEvents',[])]
            tracks[song['id']]=dict(source=song['source'],songCode=code,
                raw=dict(bundle=bundle.name,bundleSha256=digest,textAsset=text.m_Name,
                         serializedFile=asset.assets_file.name,pathId=str(asset.path_id),textSha256=hashlib.sha256(payload).hexdigest()),events=events)
    assert len(tracks)==len(songs)==118
    return dict(schemaVersion=1,contract='native-spotlight-v1',
                choreographyIndexSha256=hashlib.sha256(path.read_bytes()).hexdigest(),songs=tracks)
