"""RAW graph regressions use exact extracted source commands, not filename rules."""
import argparse,json,sys,copy,importlib.util
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT.parent/'data_pipeline'))
from sidem_scenario.compiler import ScenarioCompiler
from sidem_scenario.resources import LocalScenarioResources
from sidem_scenario.control_flow import annotate_raw_control_flow,relocate_control_flow,digest
from sidem_scenario.authoritative import compile_authoritative_scenario

def run(audit):
 inventory=json.loads((audit/'raw-selection-inventory.json').read_bytes());assert not inventory['summary']['errors']
 resources=LocalScenarioResources(lipsync_root=audit/'none',background_root=audit/'none',audio_root=audit/'none');issues=[];types=Counter();count=0
 for r in inventory['records']:
  raw=json.loads((audit/r['raw_file']).read_bytes());before=copy.deepcopy(raw)
  compiler=ScenarioCompiler(raw,r['owner'],r['part'],r['source_file'],resources=resources)
  output=compiler.compile();candidate,errors=annotate_raw_control_flow(output,[{**r,'raw':raw}])
  assert raw==before,'RAW mutation';assert output['steps']==candidate['steps'],'repeat annotation changed steps'
  for f in candidate.get('reading_control_flow',{}).get('forks',[]):
   for b in f['branches']:assert all(0<=i<len(output['steps']) for i in b['step_indices'])
   types['nested' if any(output['steps'][i]['type']=='choice' for b in f['branches'] for i in b['step_indices']) else 'flat']+=1
  issues.extend({'part':r['part'],**i} for i in errors);count+=1
  if count%250==0:print('Verified compiler RAW parts',count,flush=True)
 # Isolated label/suffix independence, forward shared replies and RAW rejection.
 raw={'Command':[{'Type':'phone_select','Values':['unusual_08_z','A','']},{'Type':'phone_select','Values':['x-2011','B','']},{'Type':'jump_point','Values':['unusual_08_z']},{'Type':'phone_text','Values':['idol','reply A','','']},{'Type':'jump','Values':['any_common_name']},{'Type':'jump_point','Values':['x-2011']},{'Type':'phone_text','Values':['idol','reply B','','']},{'Type':'jump','Values':['any_common_name']},{'Type':'jump_point','Values':['any_common_name']},{'Type':'phone_text','Values':['idol','shared','','']}]}
 c=ScenarioCompiler(raw,'fixture','fixture_99_z','fixture_99_z.json',resources=resources).compile();assert len(c['reading_control_flow']['forks'])==1
 c['source']={'raw_path':'fixture.json','raw_hash':digest(b'fixture')};strict=compile_authoritative_scenario(c);assert strict['reading_control_flow'];assert [o['label'] for s in strict['steps'] for o in s.get('options',[])]==['unusual_08_z','x-2011']
 broken=copy.deepcopy(raw);broken['Command'][0]['Values'][0]='absent';bad=ScenarioCompiler(broken,'fixture','fixture','fixture.json',resources=resources).compile();assert not bad.get('reading_control_flow')
 terminal={'Command':[{'Type':'text_select','Values':['end_alias','end','appeal']},{'Type':'jump_point','Values':['end_alias']}]};c=ScenarioCompiler(terminal,'terminal','terminal','terminal.json',resources=resources).compile();assert c['steps'][0]['options'][0]['target_kind']=='end';assert c['steps'][0]['options'][0]['detail_kind']=='presentation-marker'
 report={'raw_parts':count,'fork_types':dict(types),'issues':issues};(audit/'compiler-acceptance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({'raw_parts':count,'fork_types':dict(types),'issues':dict(Counter(i['code'] for i in issues))},indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--audit-root',type=Path,required=True);run(p.parse_args().audit_root)
