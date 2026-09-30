import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {buildPublicationManifest,readReleaseFiles,stableJson} from './lib/publication-ledger.mjs'
const argument=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1]}
const audit=argument('--audit-root');if(!audit)throw Error('Supply --audit-root')
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'))
const hash=b=>createHash('sha256').update(b).digest('hex')
const ledger=await read(path.join(audit,'repair-ledger.json'))
const manifest=await read('public/data/publication/manifest.json')
const records=readReleaseFiles();const releases=new Map(records.map(r=>[r.release.release_id,r.release]))
const owners=new Map(Object.entries(manifest.by_logical_id).flatMap(([id,s])=>s.artifacts.map(a=>[a.path,id])))
const registry=await read('public/data/authoritative_story_publications.json')
const changed=new Map(ledger.files.map(f=>[`web_viewer/public/data/compiled/${f.file}`,f]))
const selected=new Set(ledger.files.map(f=>owners.get(`web_viewer/public/data/compiled/${f.file}`)||registry.entries.find(e=>e.artifacts.some(a=>a.path===`public/data/compiled/${f.file}`))?.logical_id))
if(selected.has(undefined))throw Error('Unknown publication owner')
const entries=[]
for(const id of [...selected].sort()){
 const owner=manifest.by_logical_id[id]
 let entry
 if(owner){
  entry=structuredClone(releases.get(owner.release_id).entries.find(e=>e.logical_id===id))
  entry.previous_state={kind:'governed-release',release_id:owner.release_id,artifacts:structuredClone(owner.artifacts),evidence:[]}
 }else{
  const reg=registry.entries.find(e=>e.logical_id===id)
  const oldArtifacts=[]
  for(const a of reg.artifacts){const f=changed.get(`web_viewer/${a.path}`);const b=await fs.readFile(process.argv.includes('--apply')&&f?path.join(audit,'before',f.file):a.path);oldArtifacts.push({path:`web_viewer/${a.path}`,url:a.path.replace('public',''),bytes:b.length,sha256:hash(b)})}
  const parent=await read(reg.artifacts.find(a=>a.role==='aggregate').path)
  const inventory=await read(path.join(audit,'raw-selection-inventory.json'))
  const source=inventory.records.find(r=>r.part===parent.steps.find(s=>s.options?.length).options[0].text_ref.source.part_id)
  entry={logical_id:id,domain:'story',source:{archive_relative_path:`asset/${source.bundle}`,sha256:source.bundle_sha256.slice(7),objects:inventory.records.filter(r=>r.owner===source.owner).map(r=>({type:'TextAsset',name:`scenario_${r.part}`,container_path:r.source_file,path_id:null}))},semantic_evidence:[{product:'story_catalog',key:parent.scenario_id,evidence:'Existing strict v2 aggregate and episode artifacts; RAW control-flow metadata repair only'}],published:oldArtifacts,consumers:['Story Runtime','ReadingDocument','translation preflight'],previous_state:{kind:'unmanaged-existing',release_id:null,artifacts:oldArtifacts,evidence:[`Git baseline ${ledger.input_head}`]}}
 }
 const artifacts=owner?.artifacts||entry.published
 entry.published=[]
 for(const a of artifacts){
  const f=changed.get(a.path);const relative=a.path.replace('web_viewer/public/data/compiled/','')
  const bytes=await fs.readFile(f?path.join(audit,'candidates',relative):a.path.replace('web_viewer/',''))
  if(f&&'sha256:'+hash(bytes)!==f.sha256)throw Error('Candidate hash drift')
  entry.published.push({...a,bytes:bytes.length,sha256:hash(bytes)})
 }
 entry.transform={tool:'repair-raw-selection-flow.py',contract_version:1}
 entry.comparison={state:'parity-verified',evidence:['Exact RAW source hashes and command coordinates; proven forward joins and explicit local question retries','All old text units, source hashes, dialogue, scene snapshots, audio and step identities preserved; targets follow RAW paths','Presentation metadata classification preserved; genuine long replies preserved']}
 entry.browser_acceptance={state:'not-tested',tested_url:null,tested_at:null,tested_commit:null,environment:null,evidence:[]}
 entry.rollback_evidence={performed:false,backup_manifest:null,restored_artifacts:[],final_republish_verified:false}
 entries.push(entry)
}
const releaseId=argument('--release-id')||'2026-09-30-raw-selection-flow-001'
if(!/^[a-zA-Z0-9_-]+$/.test(releaseId))throw Error('Invalid release ID')
const release={schema_version:2,release_id:releaseId,created_at:new Date().toISOString(),prepared_from_commit:ledger.input_head,transaction_kind:'supersede',scope:{kind:'batch',ids:[...selected].sort()},entries}
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv)
const valid=ajv.compile(await read('schemas/publication-release-v2.schema.json'))
if(!valid(release))throw Error(JSON.stringify(valid.errors))
await fs.writeFile(path.join(audit,'publication-candidate.json'),stableJson(release))
if(process.argv.includes('--apply')){
 for(const [artifact,f] of changed){const b=await fs.readFile(artifact.replace('web_viewer/',''));if('sha256:'+hash(b)!==f.sha256)throw Error('Mounted candidate differs')}
 await fs.writeFile(`public/data/publication/releases/${release.release_id}.json`,stableJson(release),{flag:'wx'})
 await fs.writeFile('public/data/publication/manifest.json',stableJson(buildPublicationManifest([...records,{release}])))
}
console.log(JSON.stringify({entries:entries.length,artifacts:entries.reduce((n,e)=>n+e.published.length,0),applied:process.argv.includes('--apply')}))
