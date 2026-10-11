"""Source-backed song gameplay metadata and lossless, lazy chart partitions.

Tracks 1..20 form four blocks of five lanes. Four songs also have an unassigned
fifth block, retained separately. This structural mapping is
checked against every note's start lane; tick is deliberately not seconds.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORY = ROOT / 'config/song-release-evidence.v1.json'
CHART_ROOT = ROOT / 'public/data/song_charts'
NOTE_TYPES = {'SMALL','LARGE','FLICK_LEFT','FLICK_UP','FLICK_RIGHT','HOLD',
              'VARIABLE_HOLD','LARGE_HOLD','LARGE_VARIABLE_HOLD','SPECIAL'}
END_TYPES = {'END_NORMAL','END_FLICK_LEFT','END_FLICK_UP','END_FLICK_RIGHT'}
LABELS = {1:'EASY',2:'NORMAL',3:'HARD',4:'EXPERT'}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def encode(value):
    return (json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')

def partition_chart(raw, code):
    notes = {i:[] for i in range(1,5)}
    tempos = []
    for index,event in enumerate(raw['timeline']):
        if event['track'] == 0 and 'tempo' in event:
            if event['tempo'] <= 0 or event['tick'] < 0:
                raise ValueError(f'{code}: invalid tempo')
            tempos.append(dict(event))
            continue
        track = event['track']
        if event.get('type') not in NOTE_TYPES or not 1 <= track <= 25:
            raise ValueError(f'{code}: unsupported event {event}')
        if event['start'] != (track-1)%5 or not 0 <= event['end'] <= 4:
            raise ValueError(f'{code}: track/lane mismatch')
        if event['tick'] < 0 or event['duration'] < 0:
            raise ValueError(f'{code}: negative tick/duration')
        if 'endtype' in event and event['endtype'] not in END_TYPES:
            raise ValueError(f'{code}: unsupported hold end')
        poly = event.get('poly',[])
        if poly:
            ticks = [p['subtick'] for p in poly]
            if ticks != sorted(ticks) or ticks[0] != 0 or ticks[-1] != event['duration']:
                raise ValueError(f'{code}: incomplete slide control points')
            if any(not 0 <= p['posx'] <= 4 for p in poly):
                raise ValueError(f'{code}: out of range slide')
        notes.setdefault(1+(track-1)//5,[]).append({'sourceIndex':index,**event})
    tempos.sort(key=lambda e:e['tick'])
    if not tempos or tempos[0]['tick'] != 0:
        raise ValueError(f'{code}: missing initial tempo')
    return notes,tempos

def gameplay_by_code(rows, manifest):
    history = json.loads(HISTORY.read_text(encoding='utf-8'))['entries']
    difficulties = {}
    for row in rows[47]:
        difficulties.setdefault(row['2'],[]).append(row)
    result = {}
    selected = {row['4']:row for row in rows[46]}
    for row in selected.values():
        code = row['4']
        group = row['2']
        entries = sorted(difficulties[group],key=lambda r:r['3'])
        if [r['3'] for r in entries] != [1,2,3,4]:
            raise ValueError(f'{code}: incomplete difficulty group')
        h = history[code]
        wiki_levels = h.get('wikiLevelResolution',{}).get('levels',h['wikiLevels'])
        level_conflict = wiki_levels is not None and [r['4'] for r in entries] != wiki_levels
        condition = row.get('14',{})
        kind = condition.get('1',0)
        if kind not in (1,102):
            raise ValueError(f'{code}: unknown release condition {condition}')
        section = condition.get('2') if kind == 102 else None
        story = next((r for r in rows[5] if r['1']==section),None) if section else None
        chapter = next((r for r in rows[4] if story and r['1']==story['2']),None)
        if section and (not story or not chapter):
            raise ValueError(f'{code}: unresolved story condition')
        current = '当前主数据：已开放' if kind==1 else f"阅读主线 {chapter['2']} {story['3']}（至 EPISODE10）"
        result[code] = {
            'difficultyGroupId':group,
            'sourceSongId':row['1'],
            'alternateGroups':[{'songId':r['1'],'groupId':r['2']} for r in rows[46] if r['4']==code and r['1']!=row['1']],
            'history':h,
            'wikiLevelStatus':'conflict_pending' if level_conflict else 'resolved_song_page' if h.get('wikiLevelResolution') else 'matched' if h['wikiLevels'] else 'special_display_override',
            'releaseCondition':{'raw':condition,'label':current,'storySectionId':section},
            'sourceTables':[46,47,4,5] if section else [46,47],
            'difficulties':[
                {'id':r['1'],'type':r['3'],
                 'label':'PASSION' if code=='drv999' and r['3']==1 else LABELS[r['3']],
                 'level':r['4'],'levelLabel':'?' if code=='drv999' and r['3']==1 else str(r['4']),
                 'maxCombo':r['8'],'releaseCondition':r.get('5',{}),
                 'chart':manifest['songs'][code][str(r['3'])]} for r in entries],
        }
    return result

def generate_charts(asset_root, codes, check=False):
    import UnityPy
    manifest = {'schemaVersion':1,'timeUnit':'native_tick','trackMapping':'five_tracks_per_difficulty',
                'audioAlignment':'unverified','unassignedTrackBlocks':{},'songs':{}}
    pending = {}
    for code in sorted(codes):
        bundle = asset_root / f'song_{code}.unity3d'
        assets = [o.read() for o in UnityPy.load(str(bundle)).objects if o.type.name=='TextAsset']
        fumen = [a for a in assets if a.m_Name==f'{code}_fumen']
        if len(fumen)!=1:
            raise ValueError(f'{code}: expected one fumen')
        source = fumen[0].m_Script
        source_bytes = source.encode('utf-8',errors='surrogateescape') if isinstance(source,str) else bytes(source)
        raw = json.loads(source_bytes)
        partitions,tempos = partition_chart(raw,code)
        manifest['songs'][code] = {}
        for difficulty,notes in partitions.items():
            chart = {'schemaVersion':1,'songCode':code,'difficultyType':difficulty,'timeUnit':'native_tick',
                     'source':{'textAsset':f'{code}_fumen','sha256':digest(source_bytes),'version':raw['version']},
                     'masterdataDifficultyMatched':difficulty<=4,
                     'offset':raw['offset'],'offsetUnit':'unverified','laneCount':5,'tempos':tempos,'notes':notes,
                     'maxTick':max((n['tick']+n['duration'] for n in notes),default=0),
                     'noteObjectCount':len(notes)}
            data = encode(chart)
            name = f'{code}-{difficulty}.json'
            pending[name] = data
            manifest['songs'][code][str(difficulty)] = {'url':f'/data/song_charts/{name}',
                'sha256':digest(data),'bytes':len(data),'noteObjectCount':len(notes),'maxTick':chart['maxTick']}
            if difficulty>4:
                manifest['unassignedTrackBlocks'][code]={'trackRange':[21,25],'noteObjectCount':len(notes),'reason':'no_matching_masterdata_difficulty'}
    pending['manifest.json'] = encode(manifest)
    if check:
        actual = {p.name for p in CHART_ROOT.glob('*.json')}
        if actual != set(pending):
            raise ValueError('Chart file set differs')
        for name,data in pending.items():
            if (CHART_ROOT/name).read_bytes()!=data:
                raise ValueError(f'Stale chart: {name}')
    else:
        CHART_ROOT.mkdir(parents=True,exist_ok=True)
        unexpected = {p.name for p in CHART_ROOT.glob('*.json')} - set(pending)
        if unexpected:
            raise ValueError(f'Review obsolete chart files: {unexpected}')
        for name,data in pending.items():
            (CHART_ROOT/name).write_bytes(data)
    print(f"Charts {'verified' if check else 'generated'}: {len(codes)} songs, {len(pending)-1} track blocks (244 mapped difficulties), {sum(map(len,pending.values()))} bytes")
    return manifest
