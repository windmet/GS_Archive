"""A2: source-faithful, per-consumer extrema. Never writes candidate/public data."""
from pathlib import Path
import json, hashlib, argparse, collections
args=argparse.ArgumentParser();args.add_argument('--candidate',default='E:/Web_build/GS_Archive_Domain_Work/rm-release-20261030b');args=args.parse_args()
base=Path(__file__).resolve().parents[1];out=base/'scripts/fixtures/responsive';out.mkdir(exist_ok=True)
boot=json.loads((base/'readmodels/bootstrap.inline.json').read_text(encoding='utf-8'));release=boot['release'];candidate=Path(args.candidate);assert json.loads((candidate/'bootstrap.inline.json').read_text(encoding='utf-8'))['release']==release
root=candidate/'pages';rm=root/'_catalog/v'/release
samples=[];payloads={};counts={};files={}
def get(v,p):
 for key in p.split('/'):
  if key: v=v[int(key)] if isinstance(v,list) else v[key]
 return v
def add(metric,domain,pointer,values,kind='string',component='',purpose=''):
 valid=[]
 for file,node in values:
  try:v=get(node,pointer)
  except (KeyError,TypeError,IndexError):continue
  if isinstance(v,str) and kind=='string' or isinstance(v,list) and kind=='array' or isinstance(v,(int,float)) and kind=='number':valid.append((file,node,v))
 if not valid:return
 measure=lambda v:len(v) if kind!='number' else v
 file,node,v=max(valid,key=lambda t:measure(t[2]));ref={'metric':metric,'domain':domain,'page':domain,'component':component,'purpose':purpose,'fieldType':kind,'source':str(file.relative_to(root)).replace('\\','/'),'jsonPointer':pointer,'release':release,'sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'originalValue':v,'measuredValue':measure(v),'comparedValues':len(valid),'provenance':'REAL'}
 samples.append(ref);return file,node,v,ref
# Each selector below corresponds to a named component's actual prop, not all matching field names.
for domain in ['idols','units','cards','songs','events','gashas','items','honors','currencies','costumes','photos','stories']:
 catalog=[]
 for p in sorted((rm/domain/'catalog').glob('*.json')):
  doc=json.loads(p.read_text(encoding='utf-8'));files[str(p.relative_to(root))]=hashlib.sha256(p.read_bytes()).hexdigest()
  for i,row in enumerate(doc['data']['rows']):catalog.append((p,doc,i,row))
 counts[domain]=len(catalog)
 if domain in ['idols','units']:payloads.setdefault(domain,{})['catalogRows']=[x[3] for x in catalog]
 # catalog row pointers retained separately for each record
 field={'gashas':'display_name','photos':'nameJa','currencies':'nameJa','costumes':'nameJa','cards':'title','songs':'title','events':'title','stories':'title'}.get(domain,'name')
 component={'idols':'ArchiveIdolGrid','units':'ArchiveUnitCatalog','cards':'ArchiveCardList','songs':'ArchiveSongCatalog','events':'ArchiveEventCatalog','gashas':'ArchiveGashaCatalog','photos':'ArchivePhotoCatalog','stories':'ArchiveStoryCatalog'}.get(domain,'CollectionEntryDetails')
 if domain=='songs' and catalog:
  longest=max(catalog,key=lambda t:len(t[3]['title']));payloads['live']={'component':'ArchiveLiveChartTable','normal':[x[3]for x in catalog[:3]],'worst':[longest[3]],'dense':[x[3]for x in catalog],'sourceRefs':[]}
 if catalog:
  selected=max(catalog,key=lambda t:len(str(t[3].get(field,''))));p,doc,i,row=selected
  catalog_result=add('longest-'+domain+'-catalog-title',domain,f'/data/rows/{i}/{field}',[(p,doc)],component=component,purpose='All catalog rows ranked by this consumer title; see compared population')
  if catalog_result:samples[-1]['comparedValues']=len(catalog)
  if domain=='songs' and catalog_result:payloads['live']['sourceRefs']=[catalog_result[3]]
  if domain=='idols':payloads['idols']={'catalogRows':[x[3] for x in catalog],'component':'ArchiveIdolGrid','normal':[x[3] for x in catalog[:3]],'worst':[row],'dense':[x[3] for x in catalog],'sourceRefs':[samples[-1]]}
  if domain=='cards':payloads['cards']={'component':'ArchiveCardList','normal':[x[3] for x in catalog[:3]],'worst':[row],'dense':[x[3] for x in catalog],'sourceRefs':[samples[-1]]}
 details=[]
 for folder in ['detail','details']:
  for p in sorted((rm/domain/folder).glob('*.json')):
   doc=json.loads(p.read_text(encoding='utf-8'));files[str(p.relative_to(root))]=hashlib.sha256(p.read_bytes()).hexdigest();details.append((p,doc))
 specs={
 'idols':[('name','/data/view/profile/display_name','string'),('related-songs','/data/view/songs','array')],
 'units':[('name','/data/view/entry/unit/unit_name','string'),('members','/data/view/entry/members','array'),('songs','/data/view/songs','array')],
 'songs':[('name','/data/view/title','string'),('versions','/data/view/variants','array'),('cast','/data/view/performers','array'),('videos','/data/view/officialVideos','array'),('difficulties','/data/view/gameplay/difficulties','array')],
 'events':[('name','/data/view/identity/title','string'),('cast','/data/view/castReferences','array'),('images','/data/view/media','array'),('cards','/data/view/cards','array'),('songs','/data/view/songs','array'),('episodes','/data/view/episodes','array')],
 'gashas':[('name','/data/gasha/display_name','string'),('cards','/data/gasha/related_pickup_cards','array')],
 'stories':[('chapter-name','/data/story/title','string'),('cast','/data/view/castReferences','array')],
 'photos':[('costumes','/data/view/costumes','array'),('fields','/data/view/actor/faces','array')]
 }.get(domain,[])
 best=None;refs=[]
 for name,ptr,kind in specs:
  result=add('maximum-'+domain+'-'+name,domain,ptr,details,kind,component)
  if result:
   refs.append(result[3]);best=best or result
 if domain in ['units','songs','events','gashas'] and details:
  first=details[0];worst=best[:2] if best else first
  # Retain complete entities; additional maxima have their own source refs and payloads.
  for suffix,pair in [('normal',first),('worst',worst)]:
   node=pair[1]['data'];payloads.setdefault(domain,{'component':{'units':'ArchiveUnitCatalog','songs':'ArchiveSongDetail','events':'ArchiveEventDetail','gashas':'ArchiveGashaDetail'}[domain],'sourceRefs':refs})[suffix]=node
  payloads[domain].update(component={'units':'ArchiveUnitCatalog','songs':'ArchiveSongDetail','events':'ArchiveEventDetail','gashas':'ArchiveGashaDetail'}[domain],sourceRefs=refs)
  payloads[domain]['extremeEntities']=[{'metric':ref['metric'],'source':ref['source'],'pointer':'/data','data':next(doc['data'] for file,doc in details if str(file.relative_to(root)).replace('\\','/')==ref['source'])} for ref in refs]
 if domain in ['items','honors','currencies','costumes']:
  flat=[]
  for p,doc in details:
   for i,row in enumerate(doc['data'].get('rows',[])):flat.append((p,doc,i,row))
  refs=[]; chosen=None
  for key,kind in [('view/entry/nameJa','string'),('view/entry/descriptionText/plain','string'),('view/sources','array'),('view/usageCards','array'),('view/cards','array')]:
   valid=[]
   for p,doc,i,row in flat:
    try:v=get(row,key)
    except (KeyError,TypeError):continue
    if (isinstance(v,str) if kind=='string' else isinstance(v,list)):valid.append((p,doc,i,row,v))
   if valid:
    p,doc,i,row,v=max(valid,key=lambda x:len(x[4]));ref=add('maximum-'+domain+'-'+key.replace('/','-'),domain,f'/data/rows/{i}/'+key,[(p,doc)],kind,'CollectionEntryDetails');samples[-1]['comparedValues']=len(valid);refs.append(ref[3]);chosen=chosen or row
  if flat:payloads[domain]={'component':'CollectionEntryDetails','normal':flat[0][3]['view'],'worst':chosen['view'] if chosen else flat[0][3]['view'],'sourceRefs':refs,'extremeEntities':[{'metric':ref['metric'],'source':ref['source'],'pointer':ref['jsonPointer'].split('/view')[0]+'/view','data':get(json.loads((root/ref['source']).read_text(encoding='utf-8')),ref['jsonPointer'].split('/view')[0]+'/view')} for ref in refs]}
# Derived metrics rank the values actually shown by gallery/video/reward components.
def nested_metric(domain, metric, extractor, component):
 candidates=[]
 for folder in ['detail','details']:
  for p in sorted((rm/domain/folder).glob('*.json')):
   doc=json.loads(p.read_text(encoding='utf-8'))
   for ptr,value,size in extractor(doc):candidates.append((p,doc,ptr,value,size))
 if not candidates:return
 p,doc,ptr,value,size=max(candidates,key=lambda x:x[4]);ref={'metric':metric,'domain':domain,'page':domain,'component':component,'fieldType':'derived-consumer-value','source':str(p.relative_to(root)).replace('\\','/'),'jsonPointer':ptr,'release':release,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'originalValue':value,'measuredValue':size,'comparedValues':len(candidates),'provenance':'REAL'};samples.append(ref)
 if domain in payloads:
  payloads[domain].setdefault('sourceRefs',[]).append(ref)
  if domain in ['events','songs']:data=doc['data'];entityptr='/data'
  else:entityptr=ptr.split('/view')[0]+'/view';data=get(doc,entityptr)
  payloads[domain].setdefault('extremeEntities',[]).append({'metric':metric,'source':ref['source'],'pointer':entityptr,'data':data})
def media_values(doc):
 media=doc.get('data',{}).get('view',{}).get('media',{})
 if isinstance(media,dict):yield '/data/view/media',media,sum(bool(v.get('url')) for v in media.values() if isinstance(v,dict))
def video_values(doc):
 for i,video in enumerate(doc.get('data',{}).get('view',{}).get('officialVideos',[])):
  if isinstance(video.get('title'),str):yield f'/data/view/officialVideos/{i}/title',video['title'],len(video['title'])
def source_titles(doc):
 for i,row in enumerate(doc.get('data',{}).get('rows',[])):
  for j,source in enumerate(row.get('view',{}).get('sources',[])):
   title=source.get('event',{}).get('title') if isinstance(source.get('event'),dict) else None
   if isinstance(title,str):yield f'/data/rows/{i}/view/sources/{j}/event/title',title,len(title)
nested_metric('events','maximum-events-visible-media-bindings',media_values,'ArchiveEventDetail.gallery')
nested_metric('songs','longest-official-video-title',video_values,'ArchiveSongDetail.officialVideos')
for domain in ['items','honors','currencies']:nested_metric(domain,'longest-'+domain+'-source-event-title',source_titles,'ArchiveRewardTable')
manifest={'release':release,'legacy':boot['legacy'],'candidate':str(candidate),'catalogCounts':counts,'scannedCandidateFiles':len(files),'scope':'Named consumer fields across candidate catalog/detail shards; absent metrics must not be inferred','samples':samples,'inputHashes':files}
(out/'extremes.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for domain,payload in payloads.items():
 payload.update(domain=domain,release=release,modes=['Normal','Worst','Empty','One','Dense','Missing','Delayed','Error'],syntheticModes={'Empty':'SYNTHETIC array removal or null optional view','One':'SYNTHETIC cardinality reduction','Missing':'SYNTHETIC optional fields/images removed','Delayed':'SYNTHETIC delayed fixture boundary resolution','Error':'SYNTHETIC failed fixture loader; not a real backend failure'})
 (out/(domain+'.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('release',release,'candidate files',len(files),'samples',len(samples),'domains',list(payloads))
