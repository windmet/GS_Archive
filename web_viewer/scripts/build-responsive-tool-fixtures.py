"""A2 tools: real source IDs plus SYNTHETIC schema-bounded compositions, no corpus writes."""
from pathlib import Path
import json,hashlib
base=Path(__file__).resolve().parents[1];boot=json.loads((base/'readmodels/bootstrap.inline.json').read_text(encoding='utf-8'));release=boot['release'];pages=Path('E:/Web_build/GS_Archive_Domain_Work/rm-release-20261030b/pages');root=pages/'_catalog/v'/release
refs=[]
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def ref(p,ptr,value,metric):return {'metric':metric,'source':str(p),'jsonPointer':ptr,'release':release,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'originalValue':value,'provenance':'REAL'}
rows=[]
for p in sorted((root/'photos/catalog').glob('*.json')):rows.extend(read(p)['data']['rows'])
materialrow=next(r for r in rows if r['id']=='materials');mp=pages/materialrow['detail']['url'].lstrip('/');mv=read(mp)['data']['view'];actorrow=next(r for r in rows if r['id']!='materials');ap=pages/actorrow['detail']['url'].lstrip('/');av=read(ap)['data']['view'];m=mv['materials'];a=av['actor'];pose=a['poses'][0];model=av['media']['entries'][f"poses:{pose['id']}"]['preset']['modelId'];spot=m['spots'][0]['id'];scene=m['sceneIdsBySpotId'][str(spot)][0]
baseDoc={'schemaVersion':2,'background':{'spotId':spot,'sceneId':scene,'zoom':1},'actors':[],'stickers':[],'frameId':None,'filterId':None}
def composition(actors,stickers):
 d=json.loads(json.dumps(baseDoc));d['actors']=[{'instanceId':f'qa-actor-{i}','idolId':a['idolId'],'modelId':model,'layoutBasis':'source-bounds','poseId':pose['id'],'faceId':a['faces'][0]['id'],'x':0.3+(i%3)*0.2,'y':0.97,'scale':1,'rotation':0,'poseTime':None,'faceTime':0} for i in range(actors)];d['stickers']=[{'instanceId':f'qa-sticker-{i}','stickerId':m['stickers'][i%len(m['stickers'])]['id'],'x':0.1+(i%8)*0.1,'y':0.1+(i//8)*0.15,'scale':0.8,'rotation':0} for i in range(stickers)];return d
refs.extend([ref(mp,'/data/view/materials',m,'studio-real-material-library'),ref(ap,'/data/view/actor',a,'studio-real-actor-identity')])
materialExtrema=[]
for category in ['spots','scenes','stickers','frames','filters']:
 values=m.get(category,[])
 if values:
  i,v=max(enumerate(values),key=lambda t:len(t[1].get('name','')));r=ref(mp,f'/data/view/materials/{category}/{i}/name',v.get('name',''),'longest-studio-'+category);r.update(measuredValue=len(v.get('name','')),comparedValues=len(values));materialExtrema.append(r)
charts=[];songDetails=[]
for p in (root/'songs/detail').glob('*.json'):
 d=read(p)['data'];songDetails.append((p,d))
 for i,diff in enumerate(d.get('view',{}).get('gameplay',{}).get('difficulties',[])):
  if diff.get('chart'):charts.append((p,d,i,diff))
selected={}
for metric,key in [('longest-chart-ticks','maxTick'),('densest-chart-notes','noteObjectCount')]:
 p,d,i,diff=max(charts,key=lambda t:t[3]['chart'].get(key,0));r=ref(p,f'/data/view/gameplay/difficulties/{i}/chart/{key}',diff['chart'][key],metric);r['comparedValues']=len(charts);refs.append(r);selected[metric]={'songCode':d['song']['song_code'],'title':d['view']['title'],'difficulties':d['view']['gameplay']['difficulties'],'initialDifficulty':diff['type'],'sourceRef':r}
p,d=songDetails[0];selected['normal']={'songCode':d['song']['song_code'],'title':d['view']['title'],'difficulties':d['view']['gameplay']['difficulties'],'initialDifficulty':d['view']['gameplay']['difficulties'][0]['type']}
output={'release':release,'studio':{'sourceRefs':refs[:2],'materialNameExtrema':materialExtrema,'normal':composition(1,0),'one':composition(1,0),'empty':baseDoc,'worst':composition(6,32),'dense':composition(6,32),'provenance':'SYNTHETIC composition/positions; real material IDs, schema upper bounds actors=6/stickers=32; not a real saved user composition'},'chart':selected,'chartSourceRefs':refs[2:],'scope':'Pinned source chart descriptor extrema; browser chart bytes still require hash validation. GPU, export allocation limits and real-device FPS not implied.'}
(base/'scripts/fixtures/responsive/tools.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Photo real counts',mv['index']['counts'],'charted difficulties',len(charts),'tool extrema',[(k,v['sourceRef']['originalValue']) for k,v in selected.items() if 'sourceRef'in v])
