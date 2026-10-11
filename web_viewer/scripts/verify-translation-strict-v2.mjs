import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'
import { compareAuthoritativeRuntimeProjection } from './lib/authoritative-scenario-compiler.mjs'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'
import { bytesHash, identityIssues } from './audit-reading-diagnostics.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const read=file=>fs.readFile(new URL('../'+file,import.meta.url))
const json=async file=>JSON.parse(await read(file))
let totalDocuments=0,totalRows=0
// 2026-09-30-raw-selection-flow-001 deliberately re-published the 399 choice files with
// repaired choice targets. Such files must match that later recorded release; every other
// parity check below still runs, only the rollback choice-target comparison is waived.
const releaseDir='public/data/publication/releases/'
const releaseNames=(await fs.readdir(new URL('../'+releaseDir,import.meta.url))).filter(name=>name.endsWith('.json')).sort()
async function laterPublications(after) {
  const byPath=new Map()
  for(const name of releaseNames.filter(name=>name>after)) for(const entry of (await json(releaseDir+name)).entries||[])
    for(const artifact of entry.published||[]) byPath.set(artifact.path.replace(/^web_viewer[/]/,''),{release:name,sha256:artifact.sha256})
  return byPath
}
let superseded=0
for(const choice of [false,true]) {
const backup=await json(`docs/GS_TRANSLATION_STRICT_V2${choice?'_CHOICE':''}_BACKUP_20260929.json`)
assert.equal(bytesHash(await read(backup.rollback_archive.path)),`sha256:${backup.rollback_archive.sha256}`)
const archive=JSON.parse(execFileSync('python',['-c',
  'import zipfile,json,sys,hashlib; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n:{"data":json.loads(z.read(n)),"sha256":hashlib.sha256(z.read(n)).hexdigest()} for n in z.namelist()}))',
  backup.rollback_archive.path],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}))
assert.equal(Object.keys(archive).length,backup.files.length)
for(const file of backup.files) assert.equal(archive[file.path.replace(/^web_viewer\//,'')].sha256,file.sha256)
const release=await json(`public/data/publication/releases/2026-09-29-story-translation-strict-v2-${choice?'002':'001'}.json`)
const later=await laterPublications(`2026-09-29-story-translation-strict-v2-${choice?'002':'001'}.json`)
const manifest=await json('public/data/reading/manifest.json')
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv)
const validate=ajv.compile(await json('schemas/compiled-scenario-v2-authoritative.schema.json'))
const knownIdolIds=new Set((await json('public/data/masterdata/idol_unit_dictionary.json')).idols.map(x=>x.idol_code))
let textRows=0
for(const item of release.entries) {
  const artifact=item.published[0],file=artifact.path.replace(/^web_viewer\//,'')
  const bytes=await read(file), strict=JSON.parse(bytes), old=archive[file].data
  let republished=null
  if(bytesHash(bytes)!==`sha256:${artifact.sha256}`) {
    republished=later.get(file)
    assert.ok(republished,`${file} differs from strict-v2 and no later release records it`)
    assert.equal(bytesHash(bytes),`sha256:${republished.sha256}`,`${file} differs from ${republished.release}`)
    superseded++
  }
  assert.ok(validate(strict),JSON.stringify(validate.errors))
  assert.equal(strict.scenario_id,old.scenario_id)
  const comparable=structuredClone(strict),normalized=normalizeScenario(old)
  if(choice) for(const [i,step] of comparable.steps.entries()) if(step.type==='choice') step.flow.choice_id=normalized.steps[i].flow.choice_id
  assert.deepEqual(compareAuthoritativeRuntimeProjection(old,comparable).differences.filter(d=>!d.startsWith('source.raw_')&&!/^steps\[\d+\]\.text$/.test(d)),[],file)
  const audio=data=>data.steps.map(s=>[s.dialogue?.voice||null,s.dialogue?.lip||null,s.lipSync??null])
  assert.deepEqual(audio(strict),audio(old),file)
  const targets=data=>data.steps.map(s=>(s.options||[]).map(o=>o.target_step_id??o.step_id))
  if(!republished) assert.deepEqual(targets(strict),targets(old),file)
  if(!choice) assert.ok(!strict.steps.some(s=>s.options)&&!old.steps.some(s=>s.options))
  const entry=manifest.entries.find(e=>'public/data/compiled/'+e.source_file===file)
  assert.ok(entry,file)
  const readingBytes=await read('public/data/reading/'+entry.file), doc=JSON.parse(readingBytes)
  assert.equal(bytesHash(readingBytes),entry.sha256);assert.equal(bytesHash(bytes),entry.source_sha256)
  const before=createReadingDocument(old,{documentId:entry.document_id,logicalId:entry.logical_id,file:entry.source_file,sha256:entry.source_sha256,knownIdolIds})
  const rows=d=>d.rows.map(r=>[r.kind,r.source_text,r.speaker?.sourceName,r.anchor.step_id,r.anchor.step_index])
  // The repaired choice flow records choice rows as choice_metadata; text, speaker and anchors stay exact.
  const choiceKind=row=>republished&&/^choice_/.test(row[0])?['choice',...row.slice(1)]:row
  assert.deepEqual(rows(doc).map(choiceKind),rows(before).map(choiceKind),file)
  for(const row of doc.rows.filter(r=>r.source_text)) {
    assert.deepEqual(identityIssues(row.source_text,row.text_ref),[],file);textRows++
  }
}
assert.equal(release.entries.length,choice?399:137);assert.equal(textRows,choice?4030:964)
totalDocuments+=release.entries.length;totalRows+=textRows
}
console.log(`Strict-v2 translation batches verified: ${totalDocuments} exact rollback sources (${superseded} re-published later with repaired choice targets), ${totalRows} identities, schema/Reader/runtime/audio/choice-target parity; only declared choice identity enrichment`)
