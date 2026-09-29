// Identity-only dry run for complete mounted Story groups. Never mounts strict-v2 runtime candidates.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {isDeepStrictEqual as equal} from 'node:util'
import {execFileSync} from 'node:child_process'
import {createReadingDocument} from '../shared/reading/ReadingDocument.js'
import {identityIssues,bytesHash} from './audit-reading-diagnostics.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const args=process.argv.slice(2)
const at=args.indexOf('--groups')
const apply=args.includes('--apply')
if(at<0||!args[at+1]||args.length!==(apply?3:2))throw Error('Usage: node scripts/backfill-story-text-identities.mjs --groups parent.json[,parent.json...] [--apply]')
const selected=args[at+1].split(',')
if(new Set(selected).size!==selected.length||selected.some(x=>!/^[A-Za-z0-9_-]+\.json$/.test(x)))throw Error('Unsafe or duplicate group selection')
const candidateRoot=path.join(root,'.analysis/local-story-group-v2-final')
const read=file=>fs.readFile(path.join(root,file))
const json=async file=>JSON.parse(await read(file))
const ledger=await json('.analysis/local-story-group-v2-final/ledger.json')
const comparison=await json('.analysis/local-story-group-v2-final/comparison.json')
const manifestBytes=await read('public/data/reading/manifest.json')
// The global Reader manifest changes after each published batch. Each selected
// artifact is still bound to its original audit hash below.
if(comparison.manifest_sha256!==ledger.manifest_sha256)throw Error('Candidate audit provenance drift')
if(bytesHash(await read('.analysis/local-story-strict-v2-r2/ledger.json'))!==ledger.part_ledger_sha256)throw Error('RAW part crosswalk drift')
const manifest=JSON.parse(manifestBytes)
const knownIdolIds=new Set((await json('public/data/masterdata/idol_unit_dictionary.json')).idols.map(x=>x.idol_code))
const refs=new Map(),bundles=new Set(),result=[]
const patches=[],releases=[]
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const artifactRecord=(file,bytes)=>({path:`web_viewer/public/data/compiled/${file}`,url:`/data/compiled/${file}`,bytes:bytes.length,sha256:bytesHash(bytes).slice(7)})
const fields=(step)=>[
  [step.dialogue,'text_ref','source_text','text_jp','text'],
  [step.dialogue,'speaker_text_ref','speaker_source_text','speaker'],
  [step.text_time,'text_ref','source_text','text'],
  ...(step.options||[]).flatMap(x=>[[x,'text_ref','source_text','short_text','text'],[x,'detail_text_ref','detail_source_text','detail_text','detail']]),
]
const value=(obj,keys)=>keys.map(k=>obj?.[k]).find(x=>x!==undefined&&x!==null)
const strip=data=>{
  const clone=structuredClone(data)
  for(const step of clone.steps||[])for(const [obj,key] of fields(step))if(obj)delete obj[key]
  return clone
}
for(const parent of selected){
  const group=ledger.groups.find(x=>x.parent_file===parent)
  if(!group||group.status!=='group-candidate')throw Error(`Unaudited group: ${parent}`)
  const parentBytes=await read(`public/data/compiled/${parent}`)
  if(bytesHash(parentBytes)!==group.parent_sha256)throw Error(`Parent baseline drift: ${parent}`)
  const mountedParent=JSON.parse(parentBytes)
  const expectedFiles=[parent,...mountedParent.episodes.map(e=>`episodes/${e.source_scenario_id}.json`)]
  if(!equal(expectedFiles,group.artifacts.map(a=>a.file)))throw Error(`Incomplete group topology: ${parent}`)
  const sources=new Map()
  for(const source of group.sources){
    if(sources.has(source.part)||!source.container_path.endsWith(`/scenario_${source.part}.json`))throw Error(`Ambiguous RAW part: ${parent}`)
    sources.set(source.part,source)
    if(!bundles.has(source.bundle)){
      const bundle=await fs.readFile(path.join(root,'../RAW/asset',source.bundle))
      if(bytesHash(bundle)!==source.bundle_sha256)throw Error(`RAW bundle drift: ${source.bundle}`)
      bundles.add(source.bundle)
    }
  }
  const outputs=[]
  const oldArtifacts=[],newArtifacts=[]
  for(const artifact of group.artifacts){
    const file=artifact.file,oldBytes=await read(`public/data/compiled/${file}`)
    const candidateBytes=await fs.readFile(path.join(candidateRoot,'candidates',file))
    const proof=comparison.results.find(x=>x.file===file&&x.parent_file===parent)
    if(!proof||!proof.row_parity||!proof.reader_status_parity||proof.identity_issues.length||proof.existing_identity_drift.length||proof.speaker_conflicts.length||proof.source_sha256!==bytesHash(oldBytes)||proof.candidate_sha256!==artifact.sha256||bytesHash(candidateBytes)!==artifact.sha256)throw Error(`Candidate audit drift: ${file}`)
    const before=JSON.parse(oldBytes),candidate=JSON.parse(candidateBytes),after=structuredClone(before)
    if(before.scenario_id!==candidate.scenario_id||before.steps.length!==candidate.steps.length)throw Error(`Step topology drift: ${file}`)
    let added=0
    for(let i=0;i<before.steps.length;i++){
      const oldStep=before.steps[i],strictStep=candidate.steps[i],newStep=after.steps[i]
      if(oldStep.step_id!==strictStep.step_id||oldStep.type!==strictStep.type)throw Error(`Step anchor drift: ${file}#${i}`)
      const oldFields=fields(oldStep),strictFields=fields(strictStep),newFields=fields(newStep)
      if(oldFields.length!==strictFields.length)throw Error(`Text slot drift: ${file}#${i}`)
      for(let j=0;j<oldFields.length;j++){
        const [oldObj,key,...textKeys]=oldFields[j], [strictObj]=strictFields[j], [newObj]=newFields[j]
        if(Boolean(oldObj)!==Boolean(strictObj)||Boolean(oldObj)!==Boolean(newObj))throw Error(`Text container drift: ${file}#${i}/${j}`)
        if(!oldObj)continue
        const ref=strictObj[key],oldRef=oldObj[key],sourceText=value(oldObj,textKeys)
        if(oldRef&&(!ref||!equal(oldRef,ref)))throw Error(`Existing identity drift: ${file}#${i}/${j}`)
        if(!ref)continue
        if(typeof sourceText!=='string'||identityIssues(sourceText,ref).length)throw Error(`Invalid source identity: ${file}#${i}/${j}`)
        const source=sources.get(ref.source.part_id)
        if(!source||source.container_path!==ref.source.file)throw Error(`RAW coordinate drift: ${file}#${i}/${j}`)
        const signature=JSON.stringify(ref)
        if(refs.has(ref.unit_id)&&refs.get(ref.unit_id)!==signature)throw Error(`Unit ID collision: ${ref.unit_id}`)
        refs.set(ref.unit_id,signature)
        if(!oldRef){newObj[key]=structuredClone(ref);added++}
      }
    }
    if(!equal(strip(before),strip(after)))throw Error(`Non-identity runtime drift: ${file}`)
    const entry=manifest.entries.find(x=>x.source_file===file)
    if(entry&&entry.source_sha256!==bytesHash(oldBytes))throw Error(`Mounted Reader drift: ${file}`)
    if(!entry&&file!==parent)throw Error(`Missing mounted Reader: ${file}`)
    const options={documentId:entry?.document_id||before.scenario_id,logicalId:entry?.logical_id||`story-collection:${before.scenario_id}`,file,knownIdolIds}
    const oldReading=createReadingDocument(before,{...options,sha256:bytesHash(oldBytes)})
    const nextReading=createReadingDocument(after,{...options,sha256:'post-patch'})
    const shape=doc=>({status:doc.status,controls:doc.controls,rows:doc.rows.map(r=>[r.kind,r.source_text,r.speaker?.sourceName,r.anchor.step_id,r.anchor.step_index,r.anchor.row_id,r.has_voice,r.option])})
    if(!equal(shape(oldReading),shape(nextReading)))throw Error(`Reading parity drift: ${file}`)
    for(const row of nextReading.rows)if(row.source_text&&identityIssues(row.source_text,row.text_ref).length)throw Error(`Reader identity incomplete: ${file}/${row.anchor.row_id}`)
    const nextBytes=Buffer.from(JSON.stringify(after,null,2)+'\n')
    outputs.push({file,old_sha256:bytesHash(oldBytes),next_sha256:bytesHash(nextBytes),added_refs:added,reading_rows:nextReading.rows.filter(r=>r.source_text).length})
    patches.push({file,oldBytes,nextBytes})
    oldArtifacts.push(artifactRecord(file,oldBytes));newArtifacts.push(artifactRecord(file,nextBytes))
  }
  result.push({parent_file:parent,artifacts:outputs.length,added_refs:outputs.reduce((n,x)=>n+x.added_refs,0),files:outputs})
  const releaseId=`2026-09-29-story-text-identity-backfill-${String(ledger.groups.indexOf(group)+1).padStart(3,'0')}`
  const bundleNames=[...new Set(group.sources.map(x=>x.bundle))]
  if(bundleNames.length!==1)throw Error(`Multi-bundle source: ${parent}`)
  const logicalId=`story-collection:${mountedParent.scenario_id}`
  const releaseFile=`public/data/publication/releases/${releaseId}.json`
  try{await read(releaseFile);throw Error(`Release already exists: ${releaseId}`)}catch(e){if(e.code!=='ENOENT')throw e}
  releases.push({file:releaseFile,data:{schema_version:2,release_id:releaseId,created_at:new Date().toISOString(),prepared_from_commit:head,
    transaction_kind:'backfill',scope:{kind:'collection',ids:[mountedParent.scenario_id]},entries:[{
      logical_id:logicalId,domain:'story',source:{archive_relative_path:`asset/${bundleNames[0]}`,sha256:group.sources[0].bundle_sha256.slice(7),
        objects:group.sources.map(x=>({type:'TextAsset',name:`scenario_${x.part}`,container_path:x.container_path,path_id:null}))},
      semantic_evidence:[{product:'story_catalog',key:mountedParent.scenario_id,evidence:'RAW group candidate supplies text coordinates only; mounted legacy Runtime fields remain unchanged'}],
      transform:{tool:'backfill-story-text-identities.mjs',contract_version:1},published:newArtifacts,
      consumers:['Story Runtime','ReadingDocument','translation preflight'],
      comparison:{state:'parity-verified',evidence:['Identity-only: all non-identity compiled fields deep-equal before and after',
        'Reader row kind, source text, speaker source name, order, anchors, controls and status unchanged',
        'RAW bundle, source coordinates, candidate hashes and source hashes verified; strict runtime candidate not mounted']},
      browser_acceptance:{state:'not-tested',tested_url:null,tested_at:null,tested_commit:null,environment:null,evidence:[]},
      previous_state:{kind:'unmanaged-existing',release_id:null,artifacts:oldArtifacts,evidence:[`Git baseline ${head}`]},
      rollback_evidence:{performed:false,backup_manifest:null,restored_artifacts:[],final_republish_verified:false}
    }]}})
}
if(apply){
  // Persist exact previous bytes outside public before touching a mounted file.
  const backupRoot=path.join(root,'.analysis/text-identity-backfill',head.slice(0,12))
  for(const patch of patches){
    const backup=path.join(backupRoot,'public/data/compiled',patch.file)
    await fs.mkdir(path.dirname(backup),{recursive:true})
    await fs.writeFile(backup,patch.oldBytes,{flag:'wx'})
  }
  // Validate the complete batch first; keep exact old bytes until every group is written.
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
console.log(JSON.stringify({mode:apply?'applied':'dry-run',groups:result.length,artifacts:result.reduce((n,x)=>n+x.artifacts,0),added_refs:result.reduce((n,x)=>n+x.added_refs,0),result},null,2))
