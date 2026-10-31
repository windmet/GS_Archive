"""Reading corpus extrema with exact source-hash-matched overlays; not release completeness proof."""
from pathlib import Path
import json,hashlib
base=Path(__file__).resolve().parents[1];boot=json.loads((base/'readmodels/bootstrap.inline.json').read_text(encoding='utf-8'));public=Path('E:/Web_build/SideM_Archived/web_viewer/public');release=boot['release'];rows=[];docs=[];translation_count=0
for p in sorted((public/'data/reading').glob('*.json')):
 d=json.loads(p.read_text(encoding='utf-8'));tp=public/'translations/zh-CN/scenarios'/p.name;t=json.loads(tp.read_text(encoding='utf-8')) if tp.exists() else {};docs.append((p,d));translation_count+=int(tp.exists())
 for i,r in enumerate(d.get('rows',[])):
  if not isinstance(r.get('source_text'),str):continue
  ref=r.get('text_ref') or {};overlay=t.get('entries',{}).get(ref.get('unit_id'));matched=overlay if overlay and overlay.get('source_hash')==ref.get('source_hash') else None
  rows.append({'file':p,'pointer':f'/rows/{i}','row':r,'translationFile':tp,'overlay':matched})
def source(p,ptr,v):return {'source':str(p),'jsonPointer':ptr,'originalValue':v,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'release':release,'provenance':'REAL','scope':'Local reading/translation corpus, release association unproven'}
def project(r):return {'row':r['row'],'overlay':r['overlay'],'sourceRefs':[source(r['file'],r['pointer'],r['row'])]+([source(r['translationFile'],'/entries/'+r['row']['text_ref']['unit_id'].replace('~','~0').replace('/','~1'),r['overlay'])] if r['overlay'] else [])}
metrics={};conditions={'longest-dialogue':lambda r:r['row'].get('kind')=='dialogue','longest-synopsis':lambda r:r['row'].get('kind')=='synopsis','longest-title':lambda r:r['row'].get('kind')=='title','translation-longer':lambda r:r['overlay'] and len(r['overlay']['text'])>len(r['row']['source_text']),'original-longer':lambda r:r['overlay'] and len(r['row']['source_text'])>len(r['overlay']['text']),'no-translation':lambda r:not r['overlay'],'no-speaker':lambda r:not r['row'].get('speaker') or r['row'].get('speaker',{}).get('kind')=='none'}
for key,condition in conditions.items():
 choices=[r for r in rows if condition(r)]
 if choices:
  longest=max(choices,key=lambda r:len(r['overlay']['text']) if key=='translation-longer' else len(r['row']['source_text']));metrics[key]={'metric':key,'measuredValue':len(longest['overlay']['text']) if key=='translation-longer' else len(longest['row']['source_text']),'comparedValues':len(choices),'data':project(longest)}
p,d=max(docs,key=lambda t:len(t[1].get('rows',[])));dense=[project(r) for r in rows if r['file']==p];longest_translation=max([r for r in rows if r['overlay']],key=lambda r:len(r['overlay']['text']));metrics['longest-translation']={'metric':'longest-translation','measuredValue':len(longest_translation['overlay']['text']),'comparedValues':sum(bool(r['overlay']) for r in rows),'data':project(longest_translation)}
player_rows=[r for r in rows if r['row'].get('kind')=='dialogue' and not r['row'].get('presentation') and (r['row'].get('text_ref') or {}).get('source',{}).get('field_kind')=='dialogue']
player_metrics={}
for key,condition in {'longest-player-dialogue':lambda r:True,'player-translation-longer':lambda r:r['overlay'] and len(r['overlay']['text'])>len(r['row']['source_text']),'player-original-longer':lambda r:r['overlay'] and len(r['row']['source_text'])>len(r['overlay']['text']),'player-no-translation':lambda r:not r['overlay']}.items():
 choices=[r for r in player_rows if condition(r)]
 if choices:
  r=max(choices,key=lambda r:len(r['overlay']['text']) if key=='player-translation-longer' else len(r['row']['source_text']));player_metrics[key]={'metric':key,'measuredValue':len(r['overlay']['text']) if key=='player-translation-longer' else len(r['row']['source_text']),'comparedValues':len(choices),'data':project(r)}
result={'release':release,'scope':'Local corpus only; not release-complete claim','component':'ReadingTranscriptRow / StorySynopsisCard / AdvUI with real resolver','readingFiles':len(docs),'translationFiles':translation_count,'playerNormal':[project(r) for r in player_rows[:3]],'playerWorst':[r['data'] for r in player_metrics.values()],'playerExtrema':list(player_metrics.values()),'textRows':len(rows),'normal':[project(r) for r in rows[:3]],'worst':[e['data'] for e in metrics.values()],'dense':dense,'largestDocument':source(p,'/rows',d['rows']),'extremeEntities':list(metrics.values()),'synthetic':'Empty/One trim rows; Missing removes optional speaker/overlay; Delayed/Error test fixture boundary only'}
(base/'scripts/fixtures/responsive/reading.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('reading',len(docs),'text rows',len(rows),'matched',sum(bool(r['overlay'])for r in rows),'largest document rows',len(d['rows']),'extrema',[(k,v['measuredValue'])for k,v in metrics.items()])
