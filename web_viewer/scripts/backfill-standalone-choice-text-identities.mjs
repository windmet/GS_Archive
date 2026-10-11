// Add RAW-proven text identities to the four mounted target=0 standalone stories.
// Their existing choice targets and all other Runtime fields remain untouched.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual as equal} from 'node:util'
import {createReadingDocument} from '../shared/reading/ReadingDocument.js'
import {bytesHash,identityIssues} from './audit-reading-diagnostics.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
if(process.argv.length>3||process.argv[2]&&process.argv[2]!=='--apply')throw Error('Usage: node scripts/backfill-standalone-choice-text-identities.mjs [--apply]')
const apply=process.argv.includes('--apply')
const ids=['025suz_403_2_4_025_03_09_b','033shr_402_2_4_033_02_09_a','1_x_039mcr_1_8_039_01','5_00_017_23_5_00_017_23']
const read=file=>fs.readFile(path.join(root,file))
const json=async file=>JSON.parse(await read(file))
const candidateRoot='.analysis/local-story-strict-v2-r2'
const ledgerBytes=await read(`${candidateRoot}/ledger.json`),ledger=JSON.parse(ledgerBytes)
const audit=await json('.analysis/translation-identity-backfill/audit.json')
if(audit.candidate_ledger_sha256!==bytesHash(ledgerBytes))throw Error('Candidate ledger provenance drift')
const manifest=await json('public/data/reading/manifest.json')
const knownIdolIds=new Set((await json('public/data/masterdata/idol_unit_dictionary.json')).idols.map(x=>x.idol_code))
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const refs=new Map(),patches=[],releases=[],results=[]
const fields=step=>[
  [step.dialogue,'text_ref','source_text','text_jp','text'],
  [step.dialogue,'speaker_text_ref','speaker_source_text','speaker'],
  [step.text_time,'text_ref','source_text','text'],
  ...(step.options||[]).flatMap(x=>[[x,'text_ref','source_text','short_text','text'],[x,'detail_text_ref','detail_source_text','detail_text','detail']]),
]
const value=(obj,keys)=>keys.map(k=>obj?.[k]).find(x=>x!==undefined&&x!==null)
const strip=data=>{const copy=structuredClone(data);for(const step of copy.steps||[])for(const [obj,key] of fields(step))if(obj)delete obj[key];return copy}
const artifact=(file,bytes)=>({path:`web_viewer/public/data/compiled/${file}`,url:`/data/compiled/${file}`,bytes:bytes.length,sha256:bytesHash(bytes).slice(7)})
for(const [index,id] of ids.entries()){
  const file=`${id}.json`,entry=manifest.entries.find(x=>x.document_id===id&&x.source_file===file)
  const proof=audit.results.find(x=>x.document_id===id&&x.topology==='standalone')
  const candidates=ledger.entries.filter(x=>x.candidate_scenario_id===id&&x.candidate)
  if(!entry||!proof||candidates.length!==1||proof.candidates.length!==1||proof.status!=='invalid-schema'||!proof.row_parity||!proof.text_order_parity||!proof.audio_parity||!proof.choice_target_parity||proof.identity_issues.length||proof.existing_identity_drift.length||proof.speaker_identity_conflicts.length)throw Error(`Unproven standalone: ${id}`)
  const candidate=candidates[0]
  if(candidate.status!=='schema-invalid-choice-target'||candidate.candidate!==proof.candidates[0]||
    proof.schema_errors.some(x=>!x.instancePath.endsWith('/target_step_id')||x.keyword!=='minimum'))throw Error(`Unexpected schema blocker: ${id}`)
  const oldBytes=await read(`public/data/compiled/${file}`)
  const candidateBytes=await read(`${candidateRoot}/candidates/${candidate.candidate}`)
  if(bytesHash(oldBytes)!==proof.source_sha256||entry.source_sha256!==proof.source_sha256||
    bytesHash(candidateBytes)!==candidate.candidate_sha256||proof.candidate_sha256!==candidate.candidate_sha256)throw Error(`Source/candidate drift: ${id}`)
  if(bytesHash(await fs.readFile(path.join(ledger.raw_root,'asset',candidate.bundle)))!==candidate.bundle_sha256)throw Error(`RAW bundle drift: ${id}`)
  const before=JSON.parse(oldBytes),strict=JSON.parse(candidateBytes),after=structuredClone(before)
  if(before.scenario_id!==strict.scenario_id||before.steps.length!==strict.steps.length)throw Error(`Step topology drift: ${id}`)
  let added=0
  for(let i=0;i<before.steps.length;i++){
    const oldStep=before.steps[i],strictStep=strict.steps[i],newStep=after.steps[i]
    if(oldStep.step_id!==strictStep.step_id||oldStep.type!==strictStep.type)throw Error(`Step anchor drift: ${id}#${i}`)
    const oldFields=fields(oldStep),strictFields=fields(strictStep),newFields=fields(newStep)
    if(oldFields.length!==strictFields.length)throw Error(`Text slot drift: ${id}#${i}`)
    for(let j=0;j<oldFields.length;j++){
      const [oldObj,key,...textKeys]=oldFields[j],[strictObj]=strictFields[j],[newObj]=newFields[j]
      if(Boolean(oldObj)!==Boolean(strictObj)||Boolean(oldObj)!==Boolean(newObj))throw Error(`Text container drift: ${id}#${i}/${j}`)
      if(!oldObj)continue
      const ref=strictObj[key],oldRef=oldObj[key],sourceText=value(oldObj,textKeys)
      if(oldRef&&(!ref||!equal(oldRef,ref)))throw Error(`Existing identity drift: ${id}#${i}/${j}`)
      if(!ref)continue
      if(typeof sourceText!=='string'||identityIssues(sourceText,ref).length||ref.source.part_id!==candidate.part||ref.source.file!==candidate.container_path)throw Error(`Invalid RAW identity: ${id}#${i}/${j}`)
      const signature=JSON.stringify(ref)
      if(refs.has(ref.unit_id)&&refs.get(ref.unit_id)!==signature)throw Error(`Unit ID collision: ${ref.unit_id}`)
      refs.set(ref.unit_id,signature)
      if(!oldRef){newObj[key]=structuredClone(ref);added++}
    }
  }
  if(!equal(strip(before),strip(after)))throw Error(`Non-identity Runtime drift: ${id}`)
  const options={documentId:entry.document_id,logicalId:entry.logical_id,file,knownIdolIds}
  const oldDoc=createReadingDocument(before,{...options,sha256:bytesHash(oldBytes)})
  const newDoc=createReadingDocument(after,{...options,sha256:'post-patch'})
  const shape=doc=>({status:doc.status,controls:doc.controls,rows:doc.rows.map(r=>[r.kind,r.source_text,r.speaker?.sourceName,r.anchor.step_id,r.anchor.step_index,r.anchor.row_id,r.has_voice,r.option])})
  if(!equal(shape(oldDoc),shape(newDoc))||oldDoc.status!=='unsupported')throw Error(`Reader/target parity drift: ${id}`)
  for(const row of newDoc.rows)if(row.source_text&&identityIssues(row.source_text,row.text_ref).length)throw Error(`Reader identity incomplete: ${id}`)
  const nextBytes=Buffer.from(JSON.stringify(after,null,2)+'\n')
  const releaseId=`2026-09-29-story-text-identity-standalone-${String(index+1).padStart(3,'0')}`
  const releaseFile=`public/data/publication/releases/${releaseId}.json`
  try{await read(releaseFile);throw Error(`Release exists: ${releaseId}`)}catch(e){if(e.code!=='ENOENT')throw e}
  releases.push({file:releaseFile,data:{schema_version:2,release_id:releaseId,created_at:new Date().toISOString(),prepared_from_commit:head,
    transaction_kind:'backfill',scope:{kind:'item',ids:[id]},entries:[{
      logical_id:`story:${id}`,domain:'story',source:{archive_relative_path:`asset/${candidate.bundle}`,sha256:candidate.bundle_sha256.slice(7),
        objects:[{type:'TextAsset',name:`scenario_${candidate.part}`,container_path:candidate.container_path,path_id:null}]},
      semantic_evidence:[{product:'story_catalog',key:id,evidence:'RAW-derived text coordinates only; target_step_id=0 and all mounted Runtime fields retained'}],
      transform:{tool:'backfill-standalone-choice-text-identities.mjs',contract_version:1},published:[artifact(file,nextBytes)],
      consumers:['Story Runtime','ReadingDocument','translation preflight'],
      comparison:{state:'parity-verified',evidence:['Identity-only stripped deep-equal; Reader text, speaker source name, controls and status unchanged',
        'RAW bundle and candidate hashes verified; choice target remains 0; strict Runtime candidate not mounted']},
      browser_acceptance:{state:'not-tested',tested_url:null,tested_at:null,tested_commit:null,environment:null,evidence:[]},
      previous_state:{kind:'unmanaged-existing',release_id:null,artifacts:[artifact(file,oldBytes)],evidence:[`Git baseline ${head}; exact old bytes in rollback ZIP`]},
      rollback_evidence:{performed:false,backup_manifest:null,restored_artifacts:[],final_republish_verified:false}
    }]}})
  patches.push({file,oldBytes,nextBytes})
  results.push({id,added_refs:added,reading_rows:newDoc.rows.filter(r=>r.source_text).length,
    old_sha256:bytesHash(oldBytes),next_sha256:bytesHash(nextBytes),choice_targets:before.steps.flatMap(s=>(s.options||[]).map(o=>o.target_step_id??o.step_id))})
}
if(apply){
  const backupRoot=path.join(root,'.analysis/text-identity-backfill',head.slice(0,12),'public/data/compiled')
  await fs.mkdir(backupRoot,{recursive:true})
  for(const patch of patches)await fs.writeFile(path.join(backupRoot,patch.file),patch.oldBytes,{flag:'wx'})
  const written=[]
  try{
    for(const patch of patches){await fs.writeFile(path.join(root,'public/data/compiled',patch.file),patch.nextBytes);written.push(patch)}
    for(const release of releases){await fs.writeFile(path.join(root,release.file),JSON.stringify(release.data,null,2)+'\n',{flag:'wx'});written.push(release)}
  }catch(error){
    for(const item of written.reverse()){
      if(item.oldBytes)await fs.writeFile(path.join(root,'public/data/compiled',item.file),item.oldBytes)
      else await fs.unlink(path.join(root,item.file))
    }
    throw error
  }
}
console.log(JSON.stringify({mode:apply?'applied':'dry-run',files:results.length,added_refs:results.reduce((n,x)=>n+x.added_refs,0),results},null,2))
