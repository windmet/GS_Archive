import json,zipfile,hashlib,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--ipa',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1]
import UnityPy
with zipfile.ZipFile(a.ipa)as z:data=z.read('Payload/BNEI0395.app/Data/data.unity3d')
env=UnityPy.load(data);obj={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
src=json.loads((root/'scripts/fixtures/song-track-native-effects.json').read_bytes());r=dict(schemaVersion=1,source=src['source'],defaultIndex=2,layers={})
assert hashlib.sha256(data).hexdigest()==src['source']['dataSha256'], 'Different source IPA data'
for k,role in [('2','swipe_left'),('3','swipe_up'),('4','swipe_right')]:
 rows=[]
 for l in src['defaultPrefabs']['layers'][k]:
  go=obj[l['pathId']].read().m_GameObject.read()
  renderer=next(c.component.deref() for c in go.m_Component if c.component.type.name=='ParticleSystemRenderer')
  material=renderer.read().m_Materials[0].read()
  shader=material.m_Shader.deref()
  blend=shader.read_typetree()['m_ParsedForm']['m_SubShaders'][0]['m_Passes'][0]['m_State']['rtBlend0']
  tex=l['materials'][0]['properties']['m_TexEnvs'][0][1]['m_Texture']['m_PathID']
  uv=obj[l['pathId']].read_typetree()['UVModule']
  nx,ny=uv['tilesX'],uv['tilesY']
  advance=uv['frameOverTime'];progress=advance['scalar']*(advance['maxCurve']['m_Curve'][0]['value'] if advance['minMaxState']==1 else 1)
  frame=int(((uv['startFrame']['scalar']+progress*uv['cycles'])%1)*nx*ny)
  im=obj[tex].read().image;w,h=im.width//nx,im.height//ny
  urls=[f'/assets/song-chart-hints/native2/'+(f'blur-{i}.png'if tex==876 else f'frame-{i}.png') for i in range(nx*ny)]
  url=urls[frame]
  if tex==876:
   for i,path in enumerate(urls):
    left=i%nx*w;top=i//nx*h
    dst=root/'public'/path.lstrip('/');im.crop((left,top,left+w,top+h)).save(dst)
  rows.append(dict(nodeId=l['pathId'],sha256=l['sha256'],chain=l['chain'],period=l['settings']['lengthInSec'],prewarm=l['settings']['prewarm'],lifetime=l['initial']['startLifetime']['scalar'],size=l['initial']['startSize']['scalar'],rotation=l['initial']['startRotation']['scalar'],startColor=l['initial']['startColor']['maxColor'],gradient=l['color']['gradient'],velocity=l['velocity'],bursts=l['emission']['m_Bursts'],shape=l['shape'],url=url,sortingOrder=renderer.read_typetree()['m_SortingOrder'],rendererSha256=hashlib.sha256(renderer.get_raw_data()).hexdigest(),shaderPathId=shader.path_id,shaderSha256=hashlib.sha256(shader.get_raw_data()).hexdigest(),blend=dict(src=blend['srcBlend']['val'],dst=blend['destBlend']['val'])))
  rows[-1]['textureCell']=dict(textureId=tex,tilesX=nx,tilesY=ny,frame=frame,width=w,height=h)
  rows[-1]['uv']=uv;rows[-1]['urls']=urls
 r['layers'][role]=sorted(rows,key=lambda row:row['sortingOrder'])
(root/'config/song-flick-motion.v1.json').write_text(json.dumps(r,separators=(',',':'))+'\n',encoding='utf8')
