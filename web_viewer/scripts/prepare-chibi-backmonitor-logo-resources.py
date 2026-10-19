"""Bind native Backmonitor logo dictionary resources without song/movie lists."""
import argparse,hashlib,json,runpy,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--write',action='store_true');p.add_argument('--native-elf',type=Path,required=True);a=p.parse_args()
e=runpy.run_path(str(ROOT/'scripts/prepare-live-chibi-stage-effects.py'),run_name='logo_resources')
import UnityPy
from PIL import Image
from live_chibi_backmonitor_logo import extract_logo_source,logo_model
sha=lambda b:hashlib.sha256(b).hexdigest()
s=e['load_archive_sources'](None);data=e['read_unity_data'](s.xapk_file);env=UnityPy.load(data)
objects={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
base=extract_logo_source(env);logo_model(base)
models={};assets={}
for pid in [1832,2797]:
    obj=objects[pid];t=obj.read_typetree();rd=t['m_RD'];name=t['m_Name'];texture=objects[rd['texture']['m_PathID']]
    assert t['m_Rect']==dict(x=0,y=0,width=1200,height=800) and t['m_Pivot']==dict(x=.5,y=.5) and t['m_PixelsToUnits']==100
    assert struct.unpack('<12f',rd['m_VertexData']['m_DataSize'][:48])==(-6,4,0,6,4,0,-6,-4,0,6,-4,0)
    assert rd['uvTransform']==dict(x=100,y=600,z=100,w=400) and list(rd['m_IndexBuffer'])==[0,0,1,0,2,0,2,0,1,0,3,0]
    identity=f'resources.assets:{texture.path_id}';filename=sha(identity.encode())[:24]+'.png';path=ROOT/'public/data/stage-backmonitor-logos'/filename
    image=texture.read().image.convert('RGBA')
    if a.write:path.parent.mkdir(parents=True,exist_ok=True);image.save(path)
    else:assert Image.open(path).convert('RGBA').tobytes()==image.tobytes(),'Native logo PNG pixels changed'
    assets[name]=dict(file='/data/stage-backmonitor-logos/'+filename,pngSha256=sha(path.read_bytes()),bytes=path.stat().st_size,
        source=dict(serializedFile='resources.assets',spritePathId=str(pid),spriteSha256=sha(obj.get_raw_data()),texturePathId=str(texture.path_id),textureSha256=sha(texture.get_raw_data())))
    models[name]=dict(width=1200,height=800,layers=[dict(asset=name)])
assert set(models)=={'live_backmonitor_movie_logo_m','live_backmonitor_movie_logo_passion'}
elf=a.native_elf.read_bytes();assert sha(elf)=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
# These method windows are below the ELF data-segment offset discontinuity.
methods=[dict(name=n,address=hex(start),sha256=sha(elf[start:end])) for n,start,end in [
    ('PrepareEffect.LoadLogo',0x2218308,0x2218530),('LoadLogoSpriteIfNeeded',0x2218530,0x22186e0),
    ('PlayEffect.SetLogo',0x22186e0,0x2218894),('SetLogoSpriteIfNeeded',0x2218a74,0x2218b64),
    ('LoadLogoCallback',0x1bbc76c,0x1bbc7dc)]]
result=dict(contract='native-backmonitor-logo-dictionary-v1',defaultAsset=base['sprite']['name'],models=models,assets=assets,
    source=dict(unityDataSha256=sha(data),elfSha256=sha(elf),methods=methods),clockStatus='reference_phase_animator_origin_pending')
out=ROOT/'src/core/chibiBackmonitorLogoResources.json'
if a.write:out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
else:assert json.loads(out.read_text(encoding='utf8'))==result,'Native logo resources changed'
print(f'Native logo dictionary: {len(models)} Sprite/Texture bindings and pixels match')
