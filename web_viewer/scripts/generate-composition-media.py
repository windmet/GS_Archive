#!/usr/bin/env python3
"""Exact EventData resource identities and dictionary-owned costume dependencies.

Produces small JSON candidates outside source trees; never copies media.
"""
import argparse
import json
import re
import runpy
from collections import Counter, defaultdict
from pathlib import Path

shared=runpy.run_path(str(Path(__file__).with_name('generate-domain-media.py')))
read,digest,envelope,bind_image=map(shared.get,['read','digest','envelope','bind_image'])
VIEWER,PB=shared['VIEWER'],shared['PB']

def generate(resources,out):
    public=VIEWER/'public'
    domains=public/'data/masterdata/domains'
    index=read(domains/'event_supplement_index.json')
    if index['source']['decodedPbSha256']!=PB:raise ValueError('Mixed event snapshot')
    by_name=defaultdict(list)
    for p in resources.rglob('*.png'):
        if not p.is_symlink():by_name[p.name].append(p)
    url=lambda p:'/assets/domain-images/'+p.relative_to(resources).as_posix()
    def image(name):return bind_image(by_name[name],url)
    events={}
    for event in index['entries']:
        media={}
        for role,field,prefix in [('banner','bannerResourceId','image_event_banner_'),('logo','logoResourceId','image_event_logo_'),('background','backgroundResourceId','image_event_kv_top_'),('resultBackground','resultBgResourceId','image_event_kv_result_')]:
            rid=event.get(field)
            if not rid:media[role]={'status':'resource-not-recorded'};continue
            binding=image(f'{prefix}{rid}.png')
            selector=f'{prefix}{rid}.png'
            # A second documented export family uses the same explicit resource ID.
            if role=='banner' and binding['status']=='file-not-found':
                selector=f'image_home_announce_event_{rid}_01.png';binding=image(selector)
            media[role]={**binding,'resourceId':rid,'sourceField':field,'exportName':selector}
        media['bgm']={'resourceId':event.get('bgmResourceId'),'status':'identity-only'}
        events[f'event:{event["id"]}']=media
    cards=read(public/'data/masterdata/card_index.json')['cards']
    card_images={row['resource_id']:bind_image([public/f'assets/cards/icons/image_card_icon_{row["resource_id"]}p.png'],lambda p:'/'+p.relative_to(public).as_posix()) for row in cards}
    outputs={'event_media.json':envelope('gs-event-media',entries=events,cardImages=card_images)}
    dictionary=read(public/'data/masterdata/costume_dictionary.json')
    def model_binding(model_id):
        if not re.fullmatch(r'\d{3}[a-z]{3}_\d{3}_\d{2}',model_id):raise ValueError('Unsafe model ID')
        folder=public/f'assets/spines/{model_id}'
        atlas,skel=folder/'comu.atlas',folder/'comu.skel'
        if not atlas.is_file() or not skel.is_file():return {'status':'model-files-missing'}
        text=atlas.read_bytes().decode('utf-8',errors='replace')
        size=text.find('\nsize:');start=text.rfind('\n',0,size)
        if size>=0 and start>=0:text=text[start+1:]
        pages=[];need=True
        for line in text.splitlines():
            line=line.strip()
            if not line:need=True
            elif need:
                if not pages and ':' in line:continue
                pages.append(line);need=False
        if not pages or any('/' in p or '\\' in p or p in {'.','..'} for p in pages):raise ValueError('Unsafe atlas')
        textures=[bind_image([folder/p],lambda p:'/'+p.relative_to(public).as_posix()) for p in pages]
        return {'status':'verified-local-files' if all(t['status']=='verified-local-file' for t in textures) else 'atlas-texture-missing',
            'atlas':{'url':f'/assets/spines/{model_id}/comu.atlas','sha256':digest(atlas)},
            'skeleton':{'url':f'/assets/spines/{model_id}/comu.skel','sha256':digest(skel)},'textures':textures}
    for idol in range(1,50):
        rows=[row for row in dictionary['by_model_resource_id'].values() if row['idol_numeric_id']==idol]
        models={row['model_resource_id']:model_binding(row['model_resource_id']) for row in rows}
        costumes=[{'costumeId':row['costume_id'],'idolId':idol,'modelId':row['model_resource_id'],
            'nameJa':(row.get('costume_name') or '').strip() or row['model_resource_id'],
            'sourceTables':row['source_tables'],'status':models[row['model_resource_id']]['status']} for row in rows]
        outputs[f'photo_costumes/{idol}.json']=envelope('gs-photo-costumes',idolId=idol,costumes=costumes,models=models,
            dictionarySha256=digest(public/'data/masterdata/costume_dictionary.json'))
    for name,value in outputs.items():
        target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n','utf-8')
    print(json.dumps({'outputs':len(outputs),'eventMedia':dict(Counter(v['status'] for event in events.values() for v in event.values())),
        'costumeModels':dict(Counter(m['status'] for value in outputs.values() for m in value.get('models',{}).values()))},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--resources',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    out=args.out.resolve();resources=args.resources.resolve()
    if out.exists() or out.is_relative_to(VIEWER) or out.is_relative_to(resources):raise ValueError('Use a fresh external candidate')
    generate(resources,out)
