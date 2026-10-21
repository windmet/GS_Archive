"""Publish source-bound APK Object_layer entries without rewriting the RAW index.

Default replays JSON and PNG bytes without writing. --write publishes this batch.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from live_chibi_object_keeper import object_keeper_tree
from live_chibi_native_particle_mask import native_mask_tree,native_particle_texture_sampling
from live_chibi_sprite_geometry import sprite_geometry
from live_chibi_object_transform import relative_matrix,decompose

sha=lambda b:hashlib.sha256(b).hexdigest()
def require(value,why):
    if not value:raise ValueError(why)

def extract():
    effects=runpy.run_path(str(ROOT/'scripts/prepare-live-chibi-stage-effects.py'),run_name='effects')
    audit=runpy.run_path(str(ROOT/'scripts/audit-live-chibi-stage-objects.py'),run_name='audit')
    emitter=runpy.run_path(str(ROOT/'scripts/prepare-chibi-object-emitters.py'),run_name='emitter')
    sources=effects['load_archive_sources'](None)
    unity=effects['read_unity_data'](sources.xapk_file);env=effects['UnityPy'].load(unity)
    source=json.loads((ROOT/'scripts/fixtures/chibi-built-in-object-sources.json').read_text(encoding='utf8'))
    index=(ROOT/'public/assets/live-chibi/object-layers/index.json').read_bytes()
    require(sha(unity)==source['unityDataSha256'] and sha(index)==source['objectIndexSha256'],'Built-in source changed')
    objects={str(o.path_id):o for o in env.objects};entries={};models={};textures={};images={};records=[];mask_evidence=[];sprite_evidence=[]
    def png(image):
        buffer=io.BytesIO();image.convert('RGBA').save(buffer,format='PNG',optimize=True)
        payload=buffer.getvalue();digest=sha(payload);file=f'/data/stage-built-in-objects/{digest[:24]}.png'
        images[file]=payload
        return dict(file=file,width=image.width,height=image.height,bytes=len(payload),pngSha256=digest)
    def particle_texture(path):
        obj=objects[path];key=f'{obj.assets_file.name}:{path}'
        if key not in textures:
            texture=obj.read()
            textures[key]={**png(texture.image), 'source':audit['source_ref'](obj),
                'rawSha256':sha(obj.get_raw_data()),'nativeSampling':native_particle_texture_sampling(texture)}
        return key
    # The same serialized field order is retained by an actual typed RAW mask.
    typed_env=effects['UnityPy'].load(str(sources.raw_root/'asset/song_tkstp1.unity3d'))
    typed_mask=next(o for o in typed_env.objects if o.type.name=='MonoBehaviour' and '_isMaskingEnabled' in o.read_typetree())
    typed_evidence=dict(rawHex=typed_mask.get_raw_data().hex(),tree=typed_mask.read_typetree(),source=audit['source_ref'](typed_mask))
    shader_fixture=json.loads((ROOT/'scripts/fixtures/chibi-laser-shader.json').read_text(encoding='utf8'))
    require(sha(objects['950'].get_raw_data())==shader_fixture['shaderSha256'],'Built-in additive shader changed')
    for name,original in source['located'].items():
        keeper=objects[original['keeper']['pathId']]
        require(sha(keeper.get_raw_data())==original['keeperSha256'],'Built-in keeper changed')
        tree=object_keeper_tree(keeper);root=keeper.read(check_read=False).m_GameObject.deref();root_id=root.path_id
        require(not tree['_groups'],'Unsupported built-in object group')
        kind='particle' if tree['_particles'] else 'sprite'
        record=audit['inspect_asset'](env,name,dict(bundle='apk:resources.assets',kind=kind,particleCount=len(tree['_particles'])),True)
        records.append(record)
        entry=dict(id=name,bundle='apk:resources.assets',kind=kind,particleCount=len(tree['_particles']),spriteCount=len(tree['_sprites']),
            groupCount=0,keepOriginalOrder=tree['_keepOriginalOrder'],textures=[],instances=[],source=original['keeper'])
        if kind=='sprite':
            saved={}
            for pointer in tree['_sprites']:
                renderer=objects[str(pointer['m_PathID'])];value=renderer.read();sprite=value.m_Sprite.read();sprite_reader=value.m_Sprite.deref()
                material=audit['material_record'](renderer,renderer.read_typetree()['m_Materials'][0])
                require(len(value.m_Materials)==1 and material['shader']['pathId']=='950' and material['shader']['serializedFile']=='resources.assets','Unsupported built-in Sprite material')
                require(value.m_Enabled and not value.m_FlipX and not value.m_FlipY and value.m_DrawMode==0,'Unsupported built-in Sprite renderer')
                sprite_id=str(sprite_reader.path_id)
                if sprite_id not in saved:
                    image=sprite.image.convert('RGBA');geometry=sprite_geometry(sprite,*image.size)
                    metadata=dict(id=sprite_id,name=sprite.m_Name,**png(image),**geometry,pixelsPerUnit=sprite.m_PixelsToUnits)
                    entry['textures'].append(metadata);saved[sprite_id]=metadata
                    sprite_evidence.append(dict(sprite=audit['source_ref'](sprite_reader),spriteSha256=sha(sprite_reader.get_raw_data()),geometry=geometry,material=material))
                go=value.m_GameObject.read();transform=next(p.component.read() for p in go.m_Component if p.component.deref().type.name=='Transform')
                instance=dict(name=go.m_Name,texture=sprite_id,**decompose(relative_matrix(transform,root_id)),
                    tint=sum(round(getattr(value.m_Color,k)*255)<<(16-i*8) for i,k in enumerate('rgb')),
                    alpha=value.m_Color.a,sortingOrder=value.m_SortingOrder,blendMode='native-additive-950')
                entry['instances'].append(instance)
            # No Animator or executable animation is serialized in either root.
            descendants={o.path_id for o in env.objects if o.type.name=='GameObject' and any(t['pathId']==record['rootTransformChain'][0]['pathId'] for t in audit['transform_chain'](o))}
            require(not any(o.type.name=='Animator' and o.read().m_GameObject.m_PathID in descendants for o in env.objects),'Built-in Sprite animation requires a consumer')
            entry['nativeSpriteShader']=shader_fixture
        else:
            systems=[];masks=[]
            root_transform=record['rootTransformChain'][-1]['pathId']
            wanted={emitter['model'](p,True)['maskTexture'] for p in record['particles']} - {None}
            for obj in env.objects:
                if obj.type.name!='MonoBehaviour':continue
                value=obj.read(check_read=False)
                if not value.m_Script.m_PathID or not value.m_GameObject.m_PathID:continue
                script=value.m_Script.read()
                if (script.m_Namespace,script.m_ClassName)!=('ToJ','Mask'):continue
                chain=audit['transform_chain'](value.m_GameObject.deref())
                if not chain or chain[-1]['pathId']!=root_transform:continue
                mask=native_mask_tree(obj)
                require(mask['_isMaskingEnabled']==mask['_useMaskAlphaChannel']==1 and mask['_clampAlphaHorizontally']==mask['_clampAlphaVertically']==0 and mask['mainTex']['m_FileID']==0 and mask['mainTexTiling']==dict(x=1,y=1) and mask['mainTexOffset']==dict(x=0,y=0),'Unsupported built-in mask')
                texture=str(mask['mainTex']['m_PathID']);require(texture in wanted,'Unexpected built-in mask texture')
                masks.append(dict(source=audit['source_ref'](obj),chain=chain,texture=particle_texture(texture)))
                mask_evidence.append(dict(source=audit['source_ref'](obj),rawHex=obj.get_raw_data().hex(),tree=mask,chain=chain))
            for particle in record['particles']:
                system=emitter['model'](particle,True)
                require(not system.get('partial'),'Partial built-in particle profile')
                for field in ['texture','maskTexture']:
                    if system[field]:system[field]=particle_texture(system[field])
                if system['maskTexture']:require(sum(m['texture']==system['maskTexture'] for m in masks)==1,'Missing/ambiguous built-in particle mask')
                systems.append(system)
            models[name]=dict(profile='native-planar-emitters-v2',bundle=entry['bundle'],bundleSha256=sha(unity),
                particleCount=entry['particleCount'],keeper=record['keeper'],systems=systems,deferred=[],masks=masks)
        entries[name]=entry
    data=dict(schemaVersion=1,contract='apk-built-in-objects-v1',objectIndexSha256=sha(index),unityDataSha256=sha(unity),assets=entries,
        emitters=dict(schemaVersion=1,objectIndexSha256=sha(index),assets=models,textures=textures))
    fixture=dict(objects=records,masks=mask_evidence,typedMask=typed_evidence,sprites=sprite_evidence,unityDataSha256=sha(unity))
    return data,fixture,images

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');args=parser.parse_args()
    data,fixture,images=extract()
    for file,value in [('public/data/stage-built-in-objects.json',data),('scripts/fixtures/chibi-built-in-object-runtime.json',fixture)]:
        path=ROOT/file
        if args.write:path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
        else:require(json.loads(path.read_text(encoding='utf8'))==value,'Built-in replay changed: '+file)
    for file,payload in images.items():
        path=ROOT/'public'/file.lstrip('/')
        if args.write:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload)
        else:require(path.read_bytes()==payload,'Built-in PNG replay changed')
    print(json.dumps(dict(assets=len(data['assets']),systems=sum(len(m['systems']) for m in data['emitters']['assets'].values()),textures=len(images),bytes=sum(map(len,images.values())),written=args.write)))
if __name__=='__main__':main()
