"""Select current-scenario evidence without treating superseded harness attempts as product failures."""
from pathlib import Path
import json, collections
root=Path('E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a1')
base=Path(__file__).resolve().parents[2]
plan=json.loads((base/'scripts/qa/interaction-scenarios.json').read_text(encoding='utf-8'))
flows={f['id']:f for f in plan['flows']}; selected={}; obsolete=[]
for p in root.glob('run-*/transitions.json'):
 groups=collections.defaultdict(list)
 for r in json.loads(p.read_text(encoding='utf-8')):groups[(r['flow'],r['viewport']['width'],r['viewport']['height'])].append(r)
 for (flow,w,h),records in groups.items():
  if flow not in flows:continue
  steps={s['label']:s for s in flows[flow]['steps']}
  def current(r):
   s=steps.get(r['label'])
   return bool(s) and not s.get('notApplicable') and not(s.get('mobileOnly') and w>=760 or s.get('desktopOnly') and w<760) and all(s.get(k)==r['action'].get(k) for k in ['selector','text','action','expect','change'])
  if not all(current(r) for r in records):obsolete.append({'run':p.parent.name,'flow':flow,'viewport':[w,h]});continue
  for r in records:
   key=(flow,r['label'],w,h)
   if key in selected and selected[key]['time']>r['time']:continue
   selected[key]={k:r.get(k) for k in ['flow','pageId','component','label','viewport','status','reason','time','action']}
   selected[key].update(evidence=str(p),before=r.get('before',{}).get('screenshot'),after=r.get('after',{}).get('screenshot'))
report={'selection':'Latest attempt per exact viewport/current flow variant. Older assertions or actions now declared non-applicable invalidate that flow attempt, not the product. Raw attempts preserved.','obsoleteAttempts':obsolete,'records':list(selected.values())}
(base/'scripts/qa/interaction-results-20261030.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(dict(collections.Counter(r['status'] for r in selected.values())))
