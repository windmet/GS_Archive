// Compare real group-scope candidates with mounted parent/episode consumers.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual as equal} from 'node:util'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {createReadingDocument} from '../shared/reading/ReadingDocument.js'
import {normalizeScenario} from '../shared/story/ScenarioNormalizer.js'
import {compareAuthoritativeRuntimeProjection} from './lib/authoritative-scenario-compiler.mjs'
import {bytesHash,identityIssues} from './audit-reading-diagnostics.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
if(!process.argv[2])throw Error('Pass the explicit mounted-group candidate directory')
const candidateRoot=path.resolve(root,process.argv[2])
const read=file=>fs.readFile(path.resolve(root,file))
const json=async file=>JSON.parse(await read(file))
const ledger=await json(path.join(candidateRoot,'ledger.json'))
const manifest=await json('public/data/reading/manifest.json')
if(bytesHash(await read('public/data/reading/manifest.json'))!==ledger.manifest_sha256)throw Error('Reader manifest drift')
const knownIdolIds=new Set((await json('public/data/masterdata/idol_unit_dictionary.json')).idols.map(i=>i.idol_code))
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv)
const validate=ajv.compile(await json('schemas/compiled-scenario-v2-authoritative.schema.json'))
const results=[]
for(const group of ledger.groups) {
 if(bytesHash(await read('public/data/compiled/'+group.parent_file))!==group.parent_sha256)throw Error('Parent drift')
 if(group.status!=='group-candidate'){results.push({parent_file:group.parent_file,status:'compile-blocked',error:group.error});continue}
 for(const artifact of group.artifacts) {
  const file=artifact.file,bytes=await read(path.join(candidateRoot,'candidates',file)),strict=JSON.parse(bytes)
  if(bytesHash(bytes)!==artifact.sha256)throw Error('Group candidate drift')
  const oldBytes=await read('public/data/compiled/'+file),old=JSON.parse(oldBytes)
  const entry=manifest.entries.find(e=>e.source_file===file)
  if(entry&&entry.source_sha256!==bytesHash(oldBytes))throw Error('Mounted source drift')
  const options={documentId:entry?.document_id||old.scenario_id,logicalId:entry?.logical_id||'story-collection:'+old.scenario_id,file,sha256:bytesHash(oldBytes),knownIdolIds}
  const before=createReadingDocument(old,options),after=createReadingDocument(strict,{...options,sha256:artifact.sha256})
  const row=r=>[r.kind,r.source_text,r.speaker?.sourceName,r.anchor.step_id,r.anchor.step_index]
  const beforeRows=before.rows.map(row),afterRows=after.rows.map(row)
  const record={file,parent_file:group.parent_file,topology:file.startsWith('episodes/')?'episode':'parent',
    source_sha256:bytesHash(oldBytes),candidate_sha256:artifact.sha256,document_id:entry?.document_id,
    old_rows:beforeRows.length,next_rows:afterRows.length,text_rows:before.rows.filter(r=>r.source_text).length,
    row_parity:equal(beforeRows,afterRows),reader_status_parity:before.status===after.status,
    schema_valid:validate(strict)}
  if(!record.schema_valid)record.schema_errors=structuredClone(validate.errors)
  const normalized=normalizeScenario(old),comparable=structuredClone(strict)
  // Permit only upgrading legacy choice IDs; targets are independently compared.
  for(const [i,step] of comparable.steps.entries())if(step.type==='choice'&&normalized.steps[i]?.type==='choice')step.flow.choice_id=normalized.steps[i].flow.choice_id
  record.runtime_differences=compareAuthoritativeRuntimeProjection(old,comparable).differences.filter(d=>!d.startsWith('source.raw_')&&!/^steps\[\d+\]\.text$/.test(d))
  const details=[]
  const diff=(a,b,p)=>{
    if(equal(a,b))return
    if(a&&b&&typeof a==='object'&&typeof b==='object') {
      for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],`${p}.${k}`)
    } else details.push({path:p,before:a??null,after:b??null})
  }
  const view=s=>Object.fromEntries(['step_id','type','entry_snapshot','settled_snapshot','flow','episode_index','episode_part','chara_id','auto_advance','duration','hide_dialogue','lipSync'].map(k=>[k,s?.[k]]).concat([['cues',(s?.cues||[]).map(({evidence,...cue})=>cue)]]))
  for(const d of record.runtime_differences){const m=/^steps\[(\d+)\]$/.exec(d);if(m)diff(view(normalized.steps[+m[1]]),view(comparable.steps[+m[1]]),d);else details.push({path:d})}
  record.runtime_details=details
  const audio=s=>s.steps.map(t=>[t.dialogue?.voice||null,t.dialogue?.lip||null,t.lipSync??null])
  const targets=s=>s.steps.map(t=>(t.options||[]).map(o=>o.target_step_id??o.step_id))
  record.audio_parity=equal(audio(old),audio(strict));record.choice_target_parity=equal(targets(old),targets(strict))
  record.identity_issues=after.rows.filter(r=>r.source_text).flatMap(r=>identityIssues(r.source_text,r.text_ref))
  record.existing_identity_drift=before.rows.flatMap((r,i)=>r.text_ref&&!equal(r.text_ref,after.rows[i]?.text_ref)?[i]:[])
  record.speaker_conflicts=before.rows.flatMap((r,i)=>r.speaker?.entityId&&!equal(r.speaker,after.rows[i]?.speaker)?[i]:[])
  if(!record.row_parity){const index=beforeRows.findIndex((r,i)=>!equal(r,afterRows[i]));record.first_row_drift={index,before:beforeRows[index],after:afterRows[index]}}
  record.status=!record.schema_valid?'invalid-schema':record.identity_issues.length?'invalid-identity':!record.row_parity?'row-drift':
    record.existing_identity_drift.length||record.speaker_conflicts.length?'existing-identity-drift':
    record.runtime_differences.length||!record.audio_parity||!record.choice_target_parity||!record.reader_status_parity?'runtime-drift':'parity'
  results.push(record)
 }
}
const summary={groups:ledger.groups.length,by_topology:{}}
for(const topology of ['parent','episode']) {
 const rows=results.filter(r=>r.topology===topology)
 summary.by_topology[topology]=Object.fromEntries([...new Set(rows.map(r=>r.status))].map(status=>[status,{documents:rows.filter(r=>r.status===status).length,text_rows:rows.filter(r=>r.status===status).reduce((n,r)=>n+r.text_rows,0)}]))
}
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 compilation_scope:'mounted-group',publication_status:'not-published',manifest_sha256:ledger.manifest_sha256,summary,results}
await fs.writeFile(path.join(candidateRoot,'comparison.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(summary,null,2))
