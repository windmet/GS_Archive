"""Select named evidence runs, verify screenshot receipts; never convert READY into product PASS."""
from pathlib import Path
import json,hashlib,collections,argparse
base=Path(__file__).resolve().parents[1];ap=argparse.ArgumentParser();ap.add_argument('--evidence',default='E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2');a=ap.parse_args();root=Path(a.evidence)
# Older phone/SMS -> AdvUI attempts, missing global reset attempts and aborted runs are deliberately excluded.
selected=['run-8XtDeg','run-HUsqbo','run-JYAXQz','run-YtspG4','run-PToiNz','run-2LGFLJ','run-WfQtat','run-Mc1gew','run-KY2yK1','run-X3Nu3X','run-MvNTCO','run-ndP9Av','run-TgEtjA','run-GEogWV','run-UJ6Pjb','run-WXlEUm'];records={};runs=[];verified=set()
selected+=['run-nPsHbh']
for mp in sorted(root.glob('run-*/manifest.json'),key=lambda p:p.stat().st_mtime):
 manifest=json.loads(mp.read_text(encoding='utf-8'))
 if manifest.get('head','').startswith('3f0ab713') and mp.parent.name!='run-6s2Qcx':selected.append(mp.parent.name)
for name in selected:
 folder=root/name;mp=folder/'measurements.json';manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'));rows=json.loads(mp.read_text(encoding='utf-8'));assert len(rows)==manifest['caseCount'],name
 runs.append({'id':name,'manifest':str(folder/'manifest.json'),'measurements':str(mp),'sha256':hashlib.sha256(mp.read_bytes()).hexdigest(),'sourceHashes':manifest['sourceHashes'],'args':manifest['args'],'capturedRecords':len(rows)})
 for r in rows:
  if name in ['run-JYAXQz','run-YtspG4'] and r['domain']=='player':continue
  for receipt in [r,r.get('recovery',{}),r.get('scrollEnd',{}),r.get('pagination',{})]:
   if receipt.get('screenshot'):
    path=folder/receipt['screenshot'];assert hashlib.sha256(path.read_bytes()).hexdigest()==receipt['screenshotSha256'],path;verified.add(str(path))
  kind='reading' if '--reading'in manifest['args'] else 'tools' if '--tools'in manifest['args'] else 'domains';lang=r.get('ready',{}).get('fixture',{}).get('language') or next((x.split('=',1)[1]for x in manifest['args']if x.startswith('--lang=')),'JP');key=(kind,r['domain'],r['mode'],r.get('metric'),r['width'],r['height'],lang,'--long'in manifest['args'],'--retry'in manifest['args'],'--export-guard'in manifest['args'],'--all-difficulties'in manifest['args'],'--open-filter'in manifest['args'],'--last-page'in manifest['args'])
  findings=r.get('detection',{}).get('findings',[]);records[key]={'run':name,'id':r['id'],'domain':r['domain'],'mode':r['mode'],'metric':r.get('metric'),'viewport':{'width':r['width'],'height':r['height']},'language':lang,'requestedUrl':r['requestedUrl'],'status':r['status'],'productVerdict':'UNREVIEWED','readyState':r.get('ready',{}).get('fixture',{}).get('status'),'reason':r.get('reason'),'screenshot':str(folder/r['screenshot']),'screenshotSha256':r['screenshotSha256'],'findings':dict(collections.Counter(f['kind']for f in findings)),'imagesPending':sum(not i['complete']for i in r.get('images',[])),'visiblePendingImages':sum(i['visible'] and not i['complete']for i in r.get('images',[])),'visibleBrokenImages':sum(i['visible'] and i['complete'] and not i['naturalWidth']for i in r.get('images',[])),'recovery':r.get('recovery'),'scrollEnd':r.get('scrollEnd'),'exportGuard':r.get('exportGuard'),'pagination':r.get('pagination'),'liveTable':r.get('liveTable'),'filterPanel':r.get('filterPanel'),'head':r['head'],'release':r['release'],'longState':r.get('longState')}
result={'scope':'Component boundary evidence, not whole-site acceptance; Reader only from older matched corpus runs; Player only after ADV/phone separation','evidenceRoot':str(root),'selectedRuns':runs,'uniqueRecords':len(records),'verifiedScreenshots':len(verified),'statusCounts':dict(collections.Counter(r['status']for r in records.values())),'records':list(records.values()),'manualReview':'See UI_AUDIT_A2_WORST_CASE_20261030.md; geometry candidates stay UNREVIEWED until named review.'}
(base/'scripts/qa/responsive-stress-results-20261030.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Selected runs',len(runs),'unique records',len(records),'screenshots verified',len(verified),result['statusCounts'])
