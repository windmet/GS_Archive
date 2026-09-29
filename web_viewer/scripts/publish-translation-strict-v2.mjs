// Default is read-only preflight. --apply publishes the exact-parity standalone batch.
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { bytesHash } from './audit-reading-diagnostics.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = file => fs.readFile(path.resolve(root,file))
const json = async file => JSON.parse(await read(file))
const serialize = value => Buffer.from(JSON.stringify(value,null,2)+'\n')
const hash = bytes => bytesHash(bytes).slice(7)
const head = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const choiceIdentities=process.argv.includes('--choice-identities')
const releaseId = `2026-09-29-story-translation-strict-v2-${choiceIdentities?'002':'001'}`
const releasePath = `public/data/publication/releases/${releaseId}.json`
const backupManifest = `docs/GS_TRANSLATION_STRICT_V2${choiceIdentities?'_CHOICE':''}_BACKUP_20260929.json`
const backupRoot = `.analysis/translation-strict-v2/prepublish${choiceIdentities?'-choice':''}`
const audit = await json('.analysis/translation-identity-backfill/audit.json')
const manifest = await json('public/data/reading/manifest.json')
const registryPath = 'public/data/authoritative_story_publications.json'
const registry = await json(registryPath)
const ledger = await json('.analysis/local-story-strict-v2-r2/ledger.json')
if (audit.head !== head || audit.manifest_sha256 !== bytesHash(await read('public/data/reading/manifest.json')) ||
    audit.candidate_ledger_sha256 !== bytesHash(await read('.analysis/local-story-strict-v2-r2/ledger.json'))) throw Error('Audit baseline drift')
try { await read(releasePath); throw Error('Release exists') } catch(e) { if(e.code !== 'ENOENT') throw e }
const approved = audit.results.filter(r => r.status === (choiceIdentities?'choice-identity-parity':'exact-identity-parity') && r.topology === 'standalone')
if (!approved.length) throw Error('No exact-parity standalone sources')
const artifact = (file,bytes) => ({path:`web_viewer/${file}`,url:`/${file.replace(/^public\//,'')}`,bytes:bytes.length,sha256:hash(bytes)})
const writes=[], backups=[], entries=[], registrations=[]
const bundles = new Set()
for(const proof of approved) {
  const entry = manifest.entries.find(e=>e.document_id === proof.document_id)
  const candidate = ledger.entries.find(c=>c.candidate === proof.candidates[0])
  if(!entry || !candidate || proof.candidates.length!==1) throw Error('Missing audited identity')
  const file = `public/data/compiled/${entry.source_file}`
  if(!/^[A-Za-z0-9_-]+\.json$/.test(entry.source_file)) throw Error('Only standalone files may be published')
  if(registry.entries.some(e=>e.artifacts.some(a=>a.path===file))) throw Error(`Already owned: ${file}`)
  const oldBytes = await read(file), readingBytes = await read(`public/data/reading/${entry.file}`)
  const bytes = await read(`.analysis/local-story-strict-v2-r2/candidates/${candidate.candidate}`)
  if(bytesHash(oldBytes)!==proof.source_sha256 || bytesHash(readingBytes)!==proof.reading_sha256 ||
    bytesHash(bytes)!==proof.candidate_sha256 || bytesHash(bytes)!==candidate.candidate_sha256) throw Error(`Hash drift: ${file}`)
  if(!bundles.has(candidate.bundle)) {
    if(bytesHash(await fs.readFile(path.join(ledger.raw_root,'asset',candidate.bundle)))!==candidate.bundle_sha256) throw Error('RAW drift')
    bundles.add(candidate.bundle)
  }
  const strict = JSON.parse(bytes), old = JSON.parse(oldBytes)
  if(!choiceIdentities && (strict.steps.some(s=>s.options) || old.steps.some(s=>s.options))) throw Error('This first batch excludes choices')
  const runtimeAllowed=choiceIdentities ? proof.choice_target_parity && proof.runtime_difference_fields.length && proof.runtime_difference_fields.every(f=>f.endsWith('.flow.choice_id')) : !proof.runtime_differences.length
  if(strict.schema_version!==2 || strict.scenario_id!==old.scenario_id || !proof.row_parity || !proof.audio_parity ||
    !runtimeAllowed || proof.identity_issues.length || proof.speaker_identity_conflicts.length) throw Error('Parity gate failed')
  const logicalId = `story:${strict.scenario_id}`
  if(registry.entries.some(e=>e.logical_id===logicalId) || registrations.some(e=>e.logical_id===logicalId)) throw Error('Logical identity collision')
  writes.push([file,bytes]); backups.push([file,oldBytes])
  entries.push({logical_id:logicalId,domain:'story',source:{archive_relative_path:`asset/${candidate.bundle}`,
    sha256:candidate.bundle_sha256.slice(7),objects:[{type:'TextAsset',name:`scenario_${candidate.part}`,container_path:candidate.container_path,path_id:null}]},
    semantic_evidence:[{product:'story_catalog',key:entry.scenario_id,evidence:'Catalog-owned standalone; hash-bound crosswalk exact row, speaker name, runtime and audio parity'}],
    transform:{tool:'local-story-strict-v2-r2 + publish-translation-strict-v2.mjs',contract_version:2},
    published:[artifact(file,bytes)],consumers:['Story Runtime','ReadingDocument','translation preflight'],
    comparison:{state:'parity-verified',evidence:[`audit-translation-crosswalk.mjs: ${proof.status}; speaker identity enrichment reported separately`,...(choiceIdentities?['Only flow.choice_id changes; all choice targets and row/step/audio order unchanged']:[]),'RAW bundle, candidate, Reader and mounted compiled SHA-256 verified']},
    browser_acceptance:{state:'not-tested',tested_url:null,tested_at:null,tested_commit:null,environment:null,evidence:[]},
    previous_state:{kind:'unmanaged-existing',release_id:null,artifacts:[artifact(file,oldBytes)],evidence:[`Git baseline ${head}`,backupManifest]},
    rollback_evidence:{performed:false,backup_manifest:null,restored_artifacts:[],final_republish_verified:false}})
  registrations.push({logical_id:logicalId,kind:'standalone',scenario_id:strict.scenario_id,ownership:{state:'ledger-governed',release_id:releaseId},
    artifacts:[{path:file,role:'standalone'}],evidence:[`publication release ${releaseId}`,'Translation crosswalk exact row/runtime/audio parity']})
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'preflight',documents:writes.length,text_rows:approved.reduce((n,r)=>n+r.missing_rows,0),release_id:releaseId},null,2))
if(!process.argv.includes('--apply')) process.exit(0)
// Preserve every replaced byte and the registry before touching mounted sources.
backups.push([registryPath,await read(registryPath)])
for(const [file,bytes] of backups) {
  const target=path.join(root,backupRoot,file)
  await fs.mkdir(path.dirname(target),{recursive:true})
  await fs.writeFile(target,bytes,{flag:'wx'})
}
await fs.writeFile(path.join(root,backupManifest),serialize({schema_version:1,release_id:releaseId,source_commit:head,
  recovery:'Restore exact compiled and registry bytes from rollback archive; restore baseline Reader; regenerate derived models and record a rollback release.',
  files:backups.map(([file,bytes])=>artifact(file,bytes))}))
for(const [file,bytes] of writes) await fs.writeFile(path.join(root,file),bytes)
registry.entries.push(...registrations)
await fs.writeFile(path.join(root,registryPath),serialize(registry))
await fs.writeFile(path.join(root,releasePath),serialize({schema_version:2,release_id:releaseId,created_at:new Date().toISOString(),prepared_from_commit:head,
  transaction_kind:'backfill',scope:{kind:'batch',ids:registrations.map(e=>e.scenario_id)},entries}))
