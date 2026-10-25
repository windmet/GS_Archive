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
  tex=l['materials'][0]['properties']['m_TexEnvs'][0][1]['m_Texture']['m_PathID'];frame=round(l['uv']['startFrame']['scalar']*4)
  url=f'/assets/song-chart-hints/native2/'+(f'blur-{frame}.png'if tex==876 else f'frame-{frame}.png')
  if tex==876:
   im=obj[tex].read().image;w,h=im.width//2,im.height//2;dst=root/'public'/url.lstrip('/');im.crop((frame%2*w,frame//2*h,(frame%2+1)*w,(frame//2+1)*h)).save(dst)
  rows.append(dict(nodeId=l['pathId'],sha256=l['sha256'],chain=l['chain'],period=l['settings']['lengthInSec'],prewarm=l['settings']['prewarm'],lifetime=l['initial']['startLifetime']['scalar'],size=l['initial']['startSize']['scalar'],rotation=l['initial']['startRotation']['scalar'],startColor=l['initial']['startColor']['maxColor'],gradient=l['color']['gradient'],velocity=l['velocity'],bursts=l['emission']['m_Bursts'],shape=l['shape'],url=url))
 r['layers'][role]=rows
(root/'config/song-flick-motion.v1.json').write_text(json.dumps(r,separators=(',',':'))+'\n',encoding='utf8')
