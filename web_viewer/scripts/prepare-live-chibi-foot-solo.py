"""Publish source-bound solo/global foot commands without rewriting shared assets."""
import argparse,csv,hashlib,io,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'data_pipeline'))
from archive_paths import load_archive_sources
from live_chibi_raw_semantics import load_raw_live_semantics
from live_chibi_foot_colors import addressed_foot_color_events

def extract():
    index_path=ROOT/'public/assets/live-chibi/choreography/index.json'
    index_bytes=index_path.read_bytes();index=json.loads(index_bytes)
    sources=load_archive_sources(None)
    records=load_raw_live_semantics(sources.raw_root/'asset')['choreography']
    songs={};solo_count=0
    for song in index['songs']:
        record=records[song['source'].removesuffix('.csv')]
        rows=list(csv.reader(io.StringIO(record['payload'].decode('utf-8-sig',errors='surrogateescape'))))
        events=addressed_foot_color_events(rows)
        count=sum(event['solo'] for event in events)
        if not count:continue
        assert record['bundles']==[f'song_{song["songCode"]}.unity3d']
        assert hashlib.sha256(record['payload']).hexdigest()==record['sha256']
        songs[song['id']]={'songCode':song['songCode'],'source':song['source'],'events':events,
            'raw':{key:record[key] for key in ['name','sha256','bundles','bundleSha256']}}
        solo_count+=count
    assert index_path.read_bytes()==index_bytes,'Changed choreography'
    return {'schemaVersion':1,'choreographyIndexSha256':hashlib.sha256(index_bytes).hexdigest(),
        'soloEventCount':solo_count,'eventCount':sum(len(track['events']) for track in songs.values()),'songs':songs}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true')
    args=parser.parse_args();data=extract();out=ROOT/'public/data/stage-foot-solo.json'
    if args.write:out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    else:assert json.loads(out.read_text(encoding='utf8'))==data,'Changed solo foot source binding'
    print(json.dumps({'arrangements':len(data['songs']),'solo':data['soloEventCount'],'events':data['eventCount']}))
