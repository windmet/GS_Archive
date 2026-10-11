#!/usr/bin/env python3
"""Bind exact named exports and photo jump labels; no asset copying or playable claims."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import struct
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

VIEWER = Path(__file__).resolve().parents[1]
PB = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'

def read(path):
    return json.loads(path.read_text('utf-8-sig'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def envelope(kind, **fields):
    return dict(schemaVersion=1, kind=kind, source=dict(decodedPbSha256=PB,
        generatorVersion='gs-domain-media-v1'), **fields)

def bind_image(paths, url_for):
    paths = sorted(set(p for p in paths if p.is_file()))
    if not paths:
        return dict(status='file-not-found', runtimeVerified=False)
    hashes = {digest(p) for p in paths}
    if len(hashes) != 1:
        return dict(status='ambiguous-export', candidateCount=len(paths), runtimeVerified=False)
    p = paths[0]
    b = p.read_bytes()
    if b[:8] != b'\x89PNG\r\n\x1a\n' or len(b) < 24:
        raise ValueError(f'Invalid PNG export: {p.name}')
    width, height = struct.unpack('>II', b[16:24])
    return dict(status='verified-local-file', url=url_for(p), sha256=next(iter(hashes)),
        bytes=len(b), width=width, height=height, runtimeVerified=False)

def photo_presets(commands, actor, script_relative, script_sha):
    """Header state is explicit; each jump block is independent, never inherited from a previous choice."""
    jumps = defaultdict(list)
    for i, cmd in enumerate(commands):
        if cmd['Type'] == 'jump_point':
            jumps[cmd['Values'][0]].append(i)
    first = min((i for indexes in jumps.values() for i in indexes), default=len(commands))
    header = commands[:first]
    models = [x['Values'][:2] for x in header if x['Type'] == 'idol_model']
    positions = [x['Values'][:3] for x in header if x['Type'] == 'idol_position']
    if len(models) != 1:
        raise ValueError('Photo script must declare exactly one header model')
    code, model = models[0]
    result = {}
    for kind, cmd_type in [('poses', 'idol_animation'), ('faces', 'idol_face')]:
        for row in actor[kind]:
            label = row['animationName']
            indexes = jumps.get(label, [])
            if len(indexes) != 1:
                result[f'{kind}:{row["id"]}'] = dict(status='unresolved-script-label', label=label)
                continue
            start = indexes[0]
            end = next((i for i in range(start+1, len(commands)) if commands[i]['Type'] == 'jump_point'), len(commands))
            if any(x['Type'] not in {'wait','idol_animation','idol_face','idol_neckanimation','idol_position'} for x in commands[start+1:end]):
                result[f'{kind}:{row["id"]}'] = dict(status='unsupported-script-block', label=label)
                continue
            selected = [(i, x) for i, x in enumerate(commands[start+1:end], start+1)
                if x['Type'] in {'idol_animation', 'idol_face', 'idol_neckanimation', 'idol_position', 'idol_model'}]
            targets = [x for _, x in selected if x['Type'] == cmd_type and x['Values'][0] == code]
            if len(targets) != 1 or any(x['Values'][0] != code for _, x in selected):
                result[f'{kind}:{row["id"]}'] = dict(status='unsupported-script-block', label=label)
                continue
            result[f'{kind}:{row["id"]}'] = dict(status='script-bound-runtime-pending', label=label,
                idolCode=code, modelId=model, position=next((p[1:] for p in positions if p[0] == code), None),
                # Missing face/motion is retained as null, not a fabricated game default.
                motion=next((x['Values'][2] for _, x in selected if x['Type']=='idol_animation'), None),
                face=next((x['Values'][2] for _, x in selected if x['Type']=='idol_face'), None),
                neck=next((x['Values'][2] for _, x in selected if x['Type']=='idol_neckanimation'), None),
                commands=[dict(index=i, type=x['Type'], values=x['Values']) for i,x in selected],
                script=dict(path=script_relative, sha256=script_sha, jumpIndex=start))
    return result

def generate(resources, scenarios, out):
    domain = VIEWER / 'public/data/masterdata/domains'
    public = VIEWER / 'public'
    def source(name):
        data=read(domain/name)
        if data['source']['decodedPbSha256'] != PB:
            raise ValueError('Mixed masterdata snapshot')
        return data
    by_name=defaultdict(list)
    for p in resources.rglob('*.png'):
        if not p.is_symlink():
            by_name[p.name].append(p)
    url=lambda p: '/assets/domain-images/' + '/'.join(quote(x) for x in p.relative_to(resources).parts)
    image=lambda name: bind_image(by_name[name], url)
    public_image=lambda p: bind_image([p], lambda p:'/'+p.relative_to(public).as_posix())
    collections={}
    for kind, filename, prefix in [('item','item_catalog.json','image_item_icon_'),('honor','honor_catalog.json','image_')]:
        for row in source(filename)['entries']:
            collections[row['key']] = dict(image=image(prefix+row['resourceId']+'.png'),
                effectStatus='prefab-not-rendered' if row.get('hasPrefab') else 'none')
    materials=source('photo_materials.json')
    photo={}
    for kind in ['spots','scenes','stickers','frames','filters']:
        for row in materials[kind]:
            media={}
            if kind in ['spots','scenes']:
                media['image']=public_image(public/f'assets/bg/{row.get("backgroundResourceId", row.get("resourceId", ""))}.png')
                media['effectStatus']='effect-not-rendered' if row.get('effectResourceId') else 'none'
            elif kind=='stickers':
                media['image']=image(f'image_picturestudio_sticker_thumbnail_{row["resourceId"]}.png')
                media['full']=image(f'image_picturestudio_sticker_{row["resourceId"]}.png')
            elif kind=='frames':
                media['image']=image(f'image_picturestudio_frame_thumbnail_{row["resourceId"]}.png')
                media['layers']=[image(f'image_picturestudio_frame_{row["resourceId"]}_{n:02d}.png') for n in [1,2]]
            else:
                media['filterStatus']='original-shader-unresolved'
            photo[f'{kind}:{row["id"]}']=media
    actors={}
    script_files=defaultdict(list)
    for p in scenarios.rglob('scenario_3_4_*.json'):
        script_files[p.stem.removeprefix('scenario_')].append(p)
    for actor_id in source('photo_index.json')['actorIds']:
        actor=source(f'photo_idols/{actor_id}.json')
        script_ids={r['scenarioResourceId'] for kind in ['faces','poses'] for r in actor[kind]}
        presets={}
        for script_id in sorted(script_ids):
            candidates=script_files[script_id]
            if len(candidates)!=1:
                raise ValueError(f'Non-unique photo script {script_id}: {len(candidates)}')
            script=candidates[0]
            presets.update(photo_presets(read(script)['Command'], actor, script.relative_to(scenarios).as_posix(), digest(script)))
        media={}
        for kind in ['faces','poses']:
            for row in actor[kind]:
                key=f'{kind}:{row["id"]}'
                preset=presets[key]
                if kind=='poses':
                    bound=image(f'image_picturestudio_pose_icon_{row["iconResourceId"]}.png')
                else:
                    model=preset.get('modelId','')
                    bound=public_image(public/f'assets/spines/{model}/faces/image_photo_face_icon_{model}_face_{row["iconResourceId"]}.png')
                media[key]=dict(image=bound, preset=preset)
        cues=[]
        for sheet,cue in sorted({(v['cueSheetName'],v['cueName']) for v in actor['poseVoices']}):
            p=public/f'assets/voice/{cue}.m4a'
            cues.append(dict(cueSheetName=sheet,cueName=cue,status='verified-local-file' if p.is_file() else 'file-not-found',
                **(dict(url=f'/assets/voice/{cue}.m4a',sha256=digest(p),bytes=p.stat().st_size) if p.is_file() else {}),runtimeVerified=False))
        models={}
        for model_id in sorted({p['modelId'] for p in presets.values() if p.get('modelId')}):
            if not re.fullmatch(r'\d{3}[a-z]{3}_\d{3}_\d{2}',model_id):
                raise ValueError('Unsafe model identity')
            folder=public/f'assets/spines/{model_id}'
            atlas,skel=folder/'comu.atlas',folder/'comu.skel'
            if not atlas.is_file() or not skel.is_file():
                models[model_id]=dict(status='model-files-missing')
                continue
            # Existing runtime strips the Unity binary wrapper before the first size header.
            text=atlas.read_bytes().decode('utf-8',errors='replace')
            size_index=text.find('\nsize:')
            line_start=text.rfind('\n',0,size_index)
            if size_index>=0 and line_start>=0:
                text=text[line_start+1:]
            pages=[]
            need_page=True
            for line in text.splitlines():
                line=line.strip()
                if not line:
                    need_page=True
                elif need_page:
                    if not pages and ':' in line:
                        continue
                    pages.append(line)
                    need_page=False
            if not pages or any('/' in name or '\\' in name or name in {'.','..'} for name in pages):
                raise ValueError('Unsupported atlas pages')
            textures=[public_image(folder/name) for name in pages]
            models[model_id]=dict(status='verified-local-files' if all(p['status']=='verified-local-file' for p in textures) else 'atlas-texture-missing',
                atlas=dict(url=f'/assets/spines/{model_id}/comu.atlas',sha256=digest(atlas)),
                skeleton=dict(url=f'/assets/spines/{model_id}/comu.skel',sha256=digest(skel)),textures=textures,
                animationStatus='runtime-inspection-required')
        actors[str(actor_id)]=envelope('gs-photo-media-actor',idolId=actor_id, entries=media, voiceCues=cues,models=models)
    outputs={'collection_media.json':envelope('gs-collection-media',entries=collections),
        'photo_media.json':envelope('gs-photo-media',entries=photo)}
    outputs.update({f'photo_media_idols/{id}.json':data for id,data in actors.items()})
    for name,data in outputs.items():
        target=out/name
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n','utf-8')
    images=[m.get('image',{}) for m in collections.values()]+[m.get('image',{}) for m in photo.values()]+[m.get('image',{}) for a in actors.values() for m in a['entries'].values()]
    report=dict(imageStates=dict(Counter(m.get('status','not-applicable') for m in images)),
        presets=dict(Counter(m['preset']['status'] for a in actors.values() for m in a['entries'].values())),
        voices=dict(Counter(v['status'] for a in actors.values() for v in a['voiceCues'])),
        models=dict(Counter(m['status'] for a in actors.values() for m in a['models'].values())),
        selectedImageBytes=sum({m['url']:m['bytes'] for m in images if m.get('url')}.values()), outputFiles=len(outputs))
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resources',type=Path,required=True)
    parser.add_argument('--scenarios',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    for root in [args.resources.resolve(),args.scenarios.resolve(),VIEWER]:
        if args.out.resolve().is_relative_to(root):
            raise ValueError('Candidate must be outside source trees')
    if args.out.exists():
        raise ValueError('Use a new candidate directory; preserve previous evidence')
    print(json.dumps(generate(args.resources.resolve(),args.scenarios.resolve(),args.out.resolve()),ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
