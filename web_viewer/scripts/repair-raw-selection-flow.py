"""Build and optionally apply RAW-proven metadata repairs to mounted scenarios.

No scene recompilation: every old step, text unit, audio path and target must
remain equal after removing the added classification and flow evidence.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys
import copy
import subprocess

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent / 'data_pipeline'))
from sidem_scenario.control_flow import annotate_raw_control_flow, digest, encoded

def run(audit_root, apply=False):
    inventory=json.loads((audit_root / 'raw-selection-inventory.json').read_bytes())
    if inventory['summary']['errors']: raise ValueError('RAW inventory has errors')
    records=[]
    for row in inventory['records']:
        data=(audit_root / row['raw_file']).read_bytes()
        if digest(data)!=row['raw_sha256']: raise ValueError('Extracted RAW hash drift')
        records.append({**row,'raw':json.loads(data)})
    manifest=json.loads((ROOT / 'public/data/reading/manifest.json').read_bytes())
    files=sorted({e[k] for e in manifest['entries'] for k in ['source_file','parent_file']})
    ledger={'schema_version':1,'input_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'raw_summary':inventory['summary'],'files':[],'issues':[]}
    for file in files:
        target=ROOT / 'public/data/compiled' / file; old_bytes=target.read_bytes(); old=json.loads(old_bytes)
        if not any(s.get('type')=='choice' for s in old['steps']): continue
        candidate,issues=annotate_raw_control_flow(old,records)
        ledger['issues'].extend({'file':file,**issue} for issue in issues)
        if any(i['code'] in {'uncovered-or-overlapping-compiled-branch','compiled-command-not-unique'} for i in issues):
            from sidem_scenario.compiler import ScenarioCompiler
            from sidem_scenario.resources import LocalScenarioResources
            resources=LocalScenarioResources(lipsync_root=audit_root/'missing-media',background_root=audit_root/'missing-media',audio_root=audit_root/'missing-media')
            wanted={o.get('text_ref',{}).get('source',{}).get('part_id') for s in old['steps'] for o in s.get('options',[])}
            for record in records:
                if record['part'] not in wanted or 'emission_trace' in record: continue
                compiler=ScenarioCompiler(record['raw'],old.get('text_catalog_id',old['scenario_id']),record['part'],record['source_file'],resources=resources)
                trace=compiler.compile()['steps']
                record['emission_trace']=[{'type':s['type'],'command_end':s['evidence']['command_end'], 'text_command':s.get('dialogue',{}).get('text_ref',{}).get('source',{}).get('command_index')} for s in trace]
            candidate,issues=annotate_raw_control_flow(old,records)
            ledger['issues']=[i for i in ledger['issues'] if i['file']!=file]
            ledger['issues'].extend({'file':file,**issue} for issue in issues)
        # Existing and candidate runtime/text payloads must be exactly identical.
        stripped=copy.deepcopy(candidate); stripped.pop('reading_control_flow',None)
        baseline=copy.deepcopy(old); baseline.pop('reading_control_flow',None)
        for value in [stripped,baseline]:
            for step in value['steps']:
                for option in step.get('options',[]):
                    option.pop('detail_kind',None); option.pop('target_kind',None)
        for new_step,old_step in zip(stripped['steps'],baseline['steps']):
            for new_option,old_option in zip(new_step.get('options',[]),old_step.get('options',[])):
                if 'label' not in old_option: new_option.pop('label',None)
                for key in ['target_step_id','step_id']:
                    if key in old_option: new_option[key]=old_option[key]
        if stripped!=baseline: raise ValueError('Unapproved step/text/audio mutation: '+file)
        if old==candidate: continue
        output=audit_root / 'candidates' / file; output.parent.mkdir(parents=True,exist_ok=True)
        data=encoded(candidate); output.write_bytes(data)
        ledger['files'].append({'file':file,'old_sha256':digest(old_bytes),'sha256':digest(data),
            'forks':len(candidate.get('reading_control_flow',{}).get('forks',[])),
            'target_repairs':[{'choice_index':i,'option_index':j,'before':o.get('target_step_id',o.get('step_id')),'after':candidate['steps'][i]['options'][j].get('target_step_id',candidate['steps'][i]['options'][j].get('step_id'))} for i,s in enumerate(old['steps']) for j,o in enumerate(s.get('options',[])) if o.get('target_step_id',o.get('step_id')) != candidate['steps'][i]['options'][j].get('target_step_id',candidate['steps'][i]['options'][j].get('step_id'))],
            'markers':sum(o.get('detail_kind')=='presentation-marker' for s in candidate['steps'] for o in s.get('options',[]))})
    ledger['summary']={'mounted_files_scanned':len(files),'changed_files':len(ledger['files']),
        'forks':sum(f['forks'] for f in ledger['files']),'markers':sum(f['markers'] for f in ledger['files']),
        'issues':dict(Counter(issue['code'] for issue in ledger['issues']))}
    (audit_root / 'repair-ledger.json').write_bytes(encoded(ledger))
    if apply:
        verified_bundles=set()
        for row in inventory['records']:
            bundle=ROOT.parent / 'RAW/asset' / row['bundle']
            # Verify each bundle once immediately before publication.
            if row['bundle'] in verified_bundles: continue
            if digest(bundle.read_bytes())!=row['bundle_sha256']: raise ValueError('RAW bundle drift')
            verified_bundles.add(row['bundle'])
        for row in ledger['files']:
            target=ROOT / 'public/data/compiled' / row['file']
            if digest(target.read_bytes())!=row['old_sha256']: raise ValueError('Mounted baseline drift: '+row['file'])
            data=(audit_root / 'candidates' / row['file']).read_bytes()
            if digest(data)!=row['sha256']: raise ValueError('Candidate drift')
        # Persist every backup before the first mutation; restore the written
        # portion on failure. A partial transaction cannot become the baseline.
        for row in ledger['files']:
            target=ROOT / 'public/data/compiled' / row['file']
            backup=audit_root / 'before' / row['file']; backup.parent.mkdir(parents=True,exist_ok=True)
            with backup.open('xb') as handle: handle.write(target.read_bytes())
        written=[]
        try:
            for row in ledger['files']:
                target=ROOT / 'public/data/compiled' / row['file']
                temporary=target.with_suffix('.raw-flow.tmp')
                temporary.write_bytes((audit_root / 'candidates' / row['file']).read_bytes())
                temporary.replace(target); written.append(row)
        except Exception:
            for row in reversed(written):
                (ROOT / 'public/data/compiled' / row['file']).write_bytes((audit_root / 'before' / row['file']).read_bytes())
            raise
    print(json.dumps(ledger['summary'],indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-root',type=Path,required=True); parser.add_argument('--apply',action='store_true')
    args=parser.parse_args(); run(args.audit_root.resolve(),args.apply)
