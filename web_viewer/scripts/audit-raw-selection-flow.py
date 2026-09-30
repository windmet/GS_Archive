"""Scan every local RAW scenario bundle; retain exact selection/label evidence."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_raw import extract_text_asset_records

def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def scan(raw_root, output):
    output.mkdir(parents=True, exist_ok=True)
    summary = {'bundles':0,'parts':0,'commands':0,'selection_commands':{},'third_slots':{},'non_command_assets':[],'errors':[]}
    selection_types, slots, records = Counter(), Counter(), []
    for bundle in sorted((raw_root / 'asset').glob('scenario_*.unity3d')):
        summary['bundles'] += 1
        try:
            bundle_hash = digest(bundle.read_bytes())
            for record in extract_text_asset_records(bundle):
                if not record['payload'] and record['container_path'].endswith('.txt'):
                    summary['non_command_assets'].append({'bundle':bundle.name,'file':record['container_path'],'kind':'empty-placeholder'})
                    continue
                raw = json.loads(record['payload'])
                commands = raw.get('Command')
                if not isinstance(commands,list):
                    summary['non_command_assets'].append({'bundle':bundle.name,'file':record['container_path'],'kind':'non-command-json'})
                    continue
                summary['parts'] += 1; summary['commands'] += len(commands)
                selected = [(i,c) for i,c in enumerate(commands) if c.get('Type') in {'text_select','phone_select','talk_select'}]
                if not selected: continue
                for _,c in selected:
                    selection_types[c['Type']] += 1
                    values = c.get('Values',[])
                    slot = values[2] if len(values)>2 else ''
                    slots[f"{c['Type']}:{'empty' if not slot else 'appeal' if slot == 'appeal' else 'prose'}"] += 1
                part = record['name'].removeprefix('scenario_')
                owner = Path(record['container_path']).parent.name
                relative = f'raw/{owner}/scenario_{part}.json'
                target = output / relative; target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(record['payload'])
                records.append({'bundle':bundle.name,'bundle_sha256':bundle_hash,'part':part,'owner':owner,
                    'source_file':record['container_path'],'raw_sha256':digest(record['payload']),'raw_file':relative,
                    'selections':[{'command_index':i,'type':c['Type'],'values':c['Values']} for i,c in selected],
                    'labels':[{'command_index':i,'type':c['Type'],'values':c['Values']} for i,c in enumerate(commands) if c.get('Type') in {'jump','jump_point'}]})
        except Exception as error: summary['errors'].append({'bundle':bundle.name,'error':str(error)})
        if summary['bundles'] % 200 == 0: print(f"Scanned {summary['bundles']} bundles / {summary['parts']} RAW parts",flush=True)
    summary['selection_commands'] = dict(selection_types); summary['third_slots'] = dict(slots)
    ledger = {'schema_version':1,'summary':summary,'records':records}
    (output / 'raw-selection-inventory.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-root',type=Path,default=ROOT.parent / 'RAW')
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args(); scan(args.raw_root.resolve(),args.out.resolve())
