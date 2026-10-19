"""Check unlocated Object_layer names against exact APK prefab bindings."""
import argparse,hashlib,json,runpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from live_chibi_object_keeper import object_keeper_tree
def audit():
    import UnityPy
    effects=runpy.run_path(str(ROOT/'scripts/prepare-live-chibi-stage-effects.py'),run_name='builtin_effects')
    native=runpy.run_path(str(ROOT/'scripts/audit-live-chibi-stage-objects.py'),run_name='builtin_audit')
    emitters=runpy.run_path(str(ROOT/'scripts/prepare-chibi-object-emitters.py'),run_name='builtin_emitters')
    sources=effects['load_archive_sources'](None);data=effects['read_unity_data'](sources.xapk_file);env=UnityPy.load(data)
    raw=(ROOT/'public/assets/live-chibi/object-layers/index.json').read_bytes();index=json.loads(raw)
    candidates={}
    for obj in env.objects:
        if obj.type.name!='MonoBehaviour':continue
        tree=obj.read_typetree(check_read=False)
        go=native['local_object'](obj,tree.get('m_GameObject',{}),'GameObject')
        if not go:continue
        name=go.read_typetree()['m_Name'];prefix='LiveObjectObjectLayer_'
        if name.casefold().startswith(prefix.casefold()):candidates.setdefault(name[len(prefix):].casefold(),[]).append(obj)
    assets={}
    for name in index['missing']:
        found=candidates.get(name.casefold(),[])
        if not found:continue
        assert len(found)==1,'Ambiguous APK prefab: '+name
        obj=found[0];tree=object_keeper_tree(obj)
        for field,kind in [('_particles','ParticleSystem'),('_sprites','SpriteRenderer')]:
            assert all(native['local_object'](obj,p,kind) for p in tree[field]),'Wrong keeper component type'
        entry=dict(bundle='apk:resources.assets',kind='particle' if tree['_particles'] else 'sprite',particleCount=len(tree['_particles']))
        record=native['inspect_asset'](env,name,entry,True)
        profiles=[]
        for particle in record['particles']:
            try:
                model=emitters['model'](particle,True)
                profiles.append(dict(pathId=particle['pathId'],status='profile_accepted_not_wired',partial=model.get('partial',[])))
            except Exception as error:profiles.append(dict(pathId=particle['pathId'],status='profile_rejected',reason=str(error)))
        sprites=[]
        for p in tree['_sprites']:
            renderer=native['local_object'](obj,p,'SpriteRenderer');rt=renderer.read_typetree()
            sprites.append(dict(source=native['source_ref'](renderer),sha256=hashlib.sha256(renderer.get_raw_data()).hexdigest(),
                sprite=rt['m_Sprite'],materials=[native['material_record'](renderer,m) for m in rt['m_Materials']]))
        value=obj.read(check_read=False);script=value.m_Script.read()
        assets[name]=dict(keeper=native['source_ref'](obj),keeperRawHex=obj.get_raw_data().hex(),
            keeperSha256=hashlib.sha256(obj.get_raw_data()).hexdigest(),scriptClass=script.m_ClassName,
            fields={k:tree[k] for k in ['_particles','_sprites','_groups','_keepOriginalOrder']},
            rootTransformChain=record['rootTransformChain'],particleProfiles=profiles,sprites=sprites)
    return dict(schemaVersion=1,unityDataSha256=hashlib.sha256(data).hexdigest(),objectIndexSha256=hashlib.sha256(raw).hexdigest(),
        indexedMissing=index['missing'],located=assets,stillUnlocated=[n for n in index['missing'] if n not in assets],
        boundary='Source discovery/profile audit only. No runtime index, material or texture publication; accepted profile does not prove rendered equivalence.')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--write',action='store_true');args=p.parse_args()
    result=audit();path=ROOT/'scripts/fixtures/chibi-built-in-object-sources.json'
    if args.write:path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    else:assert json.loads(path.read_text(encoding='utf8'))==result,'Built-in Object_layer source changed'
    print(json.dumps(dict(located=list(result['located']),stillUnlocated=result['stillUnlocated'],particles=sum(len(v['particleProfiles']) for v in result['located'].values()),sprites=sum(len(v['sprites']) for v in result['located'].values())),ensure_ascii=False))
