"""Resolve forward RAW command paths, independent of label spelling or part suffix.

This adds explicit fork/join evidence to existing steps. It does not recompile
scene snapshots, audio or text identities. Unproven graphs remain unsupported.
"""
import copy
import hashlib
import json
from .commands import COMMAND_HANDLERS

SELECT = {'text_select', 'phone_select', 'talk_select'}
TEXT = {'text', 'phone_text', 'talk_text', 'talk_stamp'}
PASSIVE = {'jump_point','jump','wait','voice','phone_voice','voice_noLip','text_se_off'}

def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def content_digest(value):
    return digest(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8'))

def source_key(part, file):
    return part, str(file or '').removeprefix('assets/resources/')

def annotate_raw_control_flow(compiled, records):
    result = copy.deepcopy(compiled)
    result.pop('reading_control_flow', None)
    by_source = {}
    for record in records:
        by_source.setdefault(source_key(record['part'],record['source_file']),[]).append(record)
    steps = result['steps']; forks = []; issues = []
    for choice_index, choice in enumerate(steps):
        if choice.get('type') != 'choice': continue
        options = choice.get('options',[])
        try:
            refs = [o.get('text_ref',{}).get('source',{}) for o in options]
            if not refs: raise ValueError('empty-choice')
            key = source_key(refs[0].get('part_id'),refs[0].get('file'))
            if any(source_key(r.get('part_id'),r.get('file')) != key for r in refs): raise ValueError('mixed-choice-owner')
            owners = by_source.get(key,[])
            if len(owners) != 1: raise ValueError('raw-owner-not-unique')
            record = owners[0]; commands = record['raw']['Command']
            indices = [r['command_index'] for r in refs]
            for o,i in zip(options,indices):
                command = commands[i]; values = command['Values']
                if command['Type'] not in SELECT or values[1] != o.get('source_text',o.get('text')) or ('label' in o and values[0]!=o['label']):
                    raise ValueError('raw-choice-text-mismatch')
                o.setdefault('label',values[0])
                if command['Type'] == 'text_select' and len(values)>2 and values[2] == 'appeal':
                    if o.get('detail_source_text',o.get('detail')) != 'appeal': raise ValueError('raw-marker-mismatch')
                    o['detail_kind'] = 'presentation-marker'
            if len(options) == 1 and choice_index+1<len(steps) and (options[0].get('target_step_id',options[0].get('step_id')) == steps[choice_index+1]['step_id']):
                continue
            labels = {}
            for i,c in enumerate(commands):
                if c['Type'] == 'jump_point': labels.setdefault(c['Values'][0],[]).append(i)
            def target(label, after):
                if len(labels.get(label,[])) > 1 and any(i<=after for i in labels[label]):
                    raise ValueError('ambiguous-raw-jump-label')
                candidates = [i for i in labels.get(label,[]) if i>after]
                if not candidates: raise ValueError('missing-or-backward-raw-label')
                return candidates[0]
            # A forward command DAG includes choices inside other branches. A
            # join must postdominate every alternative, not merely be reachable.
            select_groups = {}; j = 0
            while j < len(commands):
                if commands[j]['Type'] in SELECT:
                    end = j + 1
                    while end < len(commands) and commands[end]['Type'] == commands[j]['Type']: end += 1
                    for k in range(j,end): select_groups[k] = (j,end)
                    j = end
                else: j += 1
            def successors(i):
                if i == len(commands): return []
                c = commands[i]
                if c['Type'] == 'jump': return [target(c['Values'][0],i)]
                if i in select_groups:
                    start,end = select_groups[i]
                    return list(dict.fromkeys(target(commands[k]['Values'][0],end-1) for k in range(start,end)))
                return [i+1]
            post = {}
            for i in range(len(commands),-1,-1):
                try: nexts=successors(i)
                except ValueError: nexts=[]
                post[i]={i} | (set.intersection(*(post[n] for n in nexts)) if nexts else set())
            def postdominators(i): return post[i]
            starts = [target(o['label'],max(indices)) for o in options]
            shared = set.intersection(*(postdominators(i) for i in starts))
            retries = {}
            if shared:
                join_command = min(shared)
            else:
                # A local quiz may repeat its own question. Prove each linear
                # alternative's explicit exit, including a unique backward label;
                # never turn a missing label or an arbitrary cycle into a join.
                exits = []; linear_paths = []
                for start in starts:
                    cursor = start; path = []
                    while cursor < len(commands):
                        c = commands[cursor]; path.append(cursor)
                        if c['Type'] in SELECT: raise ValueError('no-common-raw-join')
                        if c['Type'] == 'jump':
                            candidates = labels.get(c['Values'][0],[])
                            if len(candidates) != 1: raise ValueError('missing-or-ambiguous-retry-label')
                            exits.append((cursor,candidates[0])); break
                        if c['Type'] not in PASSIVE | TEXT: raise ValueError('unsupported-retry-path')
                        cursor += 1
                    else: raise ValueError('no-common-raw-join')
                    linear_paths.append(path)
                forwards = {dest for _,dest in exits if dest > max(indices)}
                if len(forwards) != 1: raise ValueError('no-common-raw-join')
                join_command = next(iter(forwards))
                for option_index,(jump,dest) in enumerate(exits):
                    if dest > max(indices):
                        if dest <= jump: raise ValueError('unsupported-retry-path')
                        continue
                    prefix = list(range(dest,min(indices)))
                    if not prefix or commands[dest]['Type'] != 'jump_point' or any(commands[c]['Type'] not in (PASSIVE | TEXT) - {'jump'} for c in prefix):
                        raise ValueError('unsupported-retry-prefix')
                    retries[option_index] = {'target_command':dest,'jump_command':jump,'label':commands[jump]['Values'][0], 'prefix_commands':prefix}
                if not retries: raise ValueError('no-common-raw-join')
            def reachable(start, stop):
                found = set(); pending = [start]
                while pending:
                    i = pending.pop()
                    if i == stop or i in found: continue
                    if i > stop: raise ValueError('conflicting-raw-join')
                    found.add(i); pending.extend(successors(i))
                return sorted(found)
            paths = linear_paths if retries else [reachable(i,join_command) for i in starts]
            suffix = []
            cursor=join_command
            while cursor<len(commands):
                suffix.append(cursor)
                if commands[cursor]['Type'] in SELECT: break
                cursor = target(commands[cursor]['Values'][0],cursor) if commands[cursor]['Type']=='jump' else cursor+1
            by_command = {}
            for i,s in enumerate(steps):
                r=s.get('dialogue',{}).get('text_ref',{}).get('source',{})
                if not r and s.get('evidence'):
                    evidence=s.get('evidence',{})
                    r={'part_id':evidence.get('source_part_id'),'file':evidence.get('source_file'),'command_index':evidence.get('command_end')}
                if source_key(r.get('part_id'),r.get('file')) == key:
                    by_command.setdefault(r.get('command_index'),[]).append(i)
                if s.get('type')=='choice':
                    refs2=[o.get('text_ref',{}).get('source',{}) for o in s.get('options',[])]
                    if refs2 and source_key(refs2[0].get('part_id'),refs2[0].get('file'))==key:
                        by_command[refs2[0]['command_index']] = [i]
            # For old outputs without step evidence, require an exact emission
            # trace match (types and all text command coordinates) before mapping
            # silent steps. Trace snapshots are never mounted.
            trace = record.get('emission_trace')
            if trace:
                part_positions = [i for i,s in enumerate(steps) if s.get('episode_index') == choice.get('episode_index')] if compiled.get('episodes') else list(range(len(steps)))
                # Source refs locate the actual part even in groups with stale episode metadata.
                anchors = [i for i,s in enumerate(steps) if source_key(s.get('dialogue',{}).get('text_ref',{}).get('source',{}).get('part_id'),s.get('dialogue',{}).get('text_ref',{}).get('source',{}).get('file')) == key]
                if anchors and compiled.get('episodes'):
                    ep = next((e for e in compiled['episodes'] if e.get('source_scenario_id')==key[0]),None)
                    if ep: part_positions = list(range(ep.get('start_step_index',ep['start_step_id']-1),ep.get('end_step_index',ep['end_step_id']-1)+1))
                trace=list(trace)
                while trace and len(trace)>len(part_positions) and trace[0]['type'] in {'title','synopsis'}: trace.pop(0)
                if len(part_positions)==len(trace) and all(steps[i]['type']==t['type'] and (not t.get('text_command') or steps[i].get('dialogue',{}).get('text_ref',{}).get('source',{}).get('command_index')==t['text_command']) for i,t in zip(part_positions,trace)):
                    for i,t in zip(part_positions,trace):
                        if t['type']!='choice': by_command[t['command_end']] = [i]
            def position(command):
                found=list(dict.fromkeys(by_command.get(command,[])))
                if len(found)!=1: raise ValueError('compiled-command-not-unique')
                return found[0]
            branches=[]
            for i,exclusive in enumerate(paths):
                emitted=[]
                for cmd_index in exclusive:
                    c=commands[cmd_index]
                    if cmd_index in by_command:
                        pos=position(cmd_index)
                        if pos not in emitted: emitted.append(pos)
                        if c['Type'] in TEXT and c['Type']!='talk_stamp' and steps[pos].get('dialogue',{}).get('source_text',steps[pos].get('dialogue',{}).get('text')) != c['Values'][1]:
                            raise ValueError('raw-branch-text-mismatch')
                    elif c['Type'] in TEXT: raise ValueError('compiled-command-not-unique')
                    elif c['Type'] in PASSIVE or c['Type'] in SELECT or c['Type'] in COMMAND_HANDLERS: pass
                    else: raise ValueError('unsupported-exclusive-command:'+c['Type'])
                emitted.sort()
                branches.append({'option_index':i,'label':options[i]['label'],'step_indices':emitted,
                    'exit_index':emitted[-1] if emitted else None,'command_indices':exclusive,
                    'step_types':[steps[p]['type'] for p in emitted], 'step_ids':[steps[p]['step_id'] for p in emitted]})
                if i in retries:
                    retry = retries[i]
                    prefix_steps = sorted({position(c) for c in retry['prefix_commands'] if c in by_command})
                    if not prefix_steps or prefix_steps != list(range(prefix_steps[0],choice_index)) or any(steps[p]['type']=='choice' for p in prefix_steps):
                        raise ValueError('uncovered-retry-prefix')
                    branches[-1]['retry'] = {k:v for k,v in retry.items() if k!='prefix_commands'}
                    branches[-1]['retry'].update({'index':prefix_steps[0],'step_id':steps[prefix_steps[0]]['step_id']})
            joins=[position(c) for c in suffix if c in by_command]
            # A part end in a group joins the first step of the next part.
            local_positions=[i for positions in by_command.values() for i in positions]
            join_index=joins[0] if joins else max(local_positions+[choice_index])+1
            covered=[j for b in branches for j in b['step_indices']]
            if not covered: join_index=choice_index+1
            if sorted(covered)!=list(range(choice_index+1,join_index)) or len(set(covered))!=len(covered):
                raise ValueError('uncovered-or-overlapping-compiled-branch')
            for o,b in zip(options,branches):
                entry_index=b['step_indices'][0] if b['step_indices'] else join_index
                expected=steps[entry_index]['step_id'] if entry_index<len(steps) else 0
                if entry_index==len(steps): o['target_kind']='end'
                target_key='target_step_id' if 'target_step_id' in o else 'step_id'
                o[target_key]=expected
            forks.append({'choice_index':choice_index,'choice_step_id':choice['step_id'],
                'join_index':join_index,'join_step_id':steps[join_index]['step_id'] if join_index<len(steps) else None,
                'join_step_type':steps[join_index]['type'] if join_index<len(steps) else 'end',
                'source_file':record['source_file'],'raw_sha256':record['raw_sha256'],
                'raw_hash_format':record.get('raw_hash_format','sha256-raw-file-v1'),
                'choice_commands':indices,'join_command':join_command,'branches':branches})
        except (ValueError,KeyError,IndexError,TypeError) as error:
            issues.append({'choice_index':choice_index,'code':str(error)})
    if forks: result['reading_control_flow']={'version':1,'base_compiled_sha256':content_digest(result),'forks':forks}
    return result,issues


def relocate_control_flow(parent, child, start, end):
    """Carry proven group paths into a local episode without leaking indexes."""
    forks = []
    for old in parent.get('reading_control_flow',{}).get('forks',[]):
        if not start <= old['choice_index'] <= end: continue
        if old['join_index'] > end+1: raise ValueError('Cross-episode branch evidence')
        fork=copy.deepcopy(old)
        fork['choice_index']-=start; fork['choice_step_id']=child['steps'][fork['choice_index']]['step_id']
        fork['join_index']-=start
        fork['join_step_id']=child['steps'][fork['join_index']]['step_id'] if fork['join_index']<len(child['steps']) else None
        fork['join_step_type']=child['steps'][fork['join_index']]['type'] if fork['join_index']<len(child['steps']) else 'end'
        for branch in fork['branches']:
            branch['step_indices']=[i-start for i in branch['step_indices']]
            branch['step_ids']=[child['steps'][i]['step_id'] for i in branch['step_indices']]
            if branch['exit_index'] is not None: branch['exit_index']-=start
            if branch.get('retry'):
                if branch['retry']['index'] < start: raise ValueError('Cross-episode retry evidence')
                branch['retry']['index']-=start
                branch['retry']['step_id']=child['steps'][branch['retry']['index']]['step_id']
        forks.append(fork)
    if forks: child['reading_control_flow']={'version':1,'base_compiled_sha256':content_digest(child),'forks':forks}
    return child
