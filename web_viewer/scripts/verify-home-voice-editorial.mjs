import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {parseCompactReturn} from './lib/general-translation-markdown.mjs'
import {sourceUnits,validateGeneralReturn} from './lib/general-translation-batches.mjs'
import {readMemory,checkTranslation} from './lib/translation-memory.mjs'
import {memoryBeforeTermAmendments,publishedBeforeTermAmendments} from './lib/term-amendments.mjs'

// Replay original model returns through editorial changes before checking current
// TM/publication. This protects unchanged rows as well as the targeted corrections.
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const root='translation/studio/general/returns'
// Term amendments postdate these receipts; replay against the text they replaced.
const memory=memoryBeforeTermAmendments(readMemory(process.cwd())),units=sourceUnits(process.cwd())
const published=publishedBeforeTermAmendments(read('public/translations/zh-CN/archive-general/card-lines.json').entries)
const seen=new Set()
let imported=0,reviewed=0,changes=0,pending=0,followupChanges=0,effectiveChanges=0
for(let number=1;number<=6;number++) {
 const id=`G-card-lines-20261104-${String(number).padStart(3,'0')}`,directory=`${root}/${id}`
 const receipt=read(`${directory}/import-receipt.json`)
 assert.equal(receipt.schema,'GS-GENERAL-IMPORT-SNAPSHOT-V1')
 assert.equal(receipt.batch_id,id);assert.equal(receipt.status,'draft');assert.equal(receipt.not_final,true)
 for(const [name,record] of Object.entries(receipt.files)) {
  const bytes=fs.readFileSync(`${directory}/${name}`)
  assert.equal(hash(bytes),record.sha256,`${id}/${name}`);assert.equal(bytes.length,record.bytes)
 }
 const batch=read(`${directory}/batch-map.json`)
 const replay=parseCompactReturn(batch,fs.readFileSync(`${directory}/output.original.md`,'utf8'))
 assert.deepEqual(replay,read(`${directory}/output.imported.json`))
 assert.equal(replay.entries.length,receipt.units);imported+=receipt.units
 if(fs.existsSync(`${directory}/editorial-receipt.json`)) {
  const editorial=read(`${directory}/editorial-receipt.json`),edits=read(`${directory}/edits.json`)
  assert.equal(editorial.schema,'GS-VOICE-EDITORIAL-V1');assert.equal(editorial.batch_id,id)
  assert.equal(editorial.status,'draft');assert.equal(editorial.not_final,true)
  assert.equal(editorial.import_receipt_sha256,hash(fs.readFileSync(`${directory}/import-receipt.json`)))
  assert.equal(editorial.policy_sha256,hash(fs.readFileSync('translation/studio/policy/card-line-prompt.v1.json')))
  assert.equal(editorial.user_terms_sha256,hash(fs.readFileSync('translation/studio/policy/user-approved-terms.v1.json')))
  for(const [name,record] of Object.entries(editorial.files)) {
   const bytes=fs.readFileSync(`${directory}/${name}`)
   assert.equal(hash(bytes),record.sha256);assert.equal(bytes.length,record.bytes)
  }
  assert.equal(editorial.semantic_units,replay.entries.length)
  assert.equal(editorial.edits,edits.length)
  const touched=new Set()
  for(const edit of edits) {
   assert(/^\d{3}$/.test(edit.rid));assert(!touched.has(edit.rid));touched.add(edit.rid)
   const row=replay.entries[Number(edit.rid)-1]
   assert.equal(row.key,edit.key);assert.equal(row.source,edit.source);assert.equal(row.source_hash,edit.source_hash)
   assert.equal(hash(row.source),row.source_hash);assert.equal(row.translation,edit.before)
   assert.equal(row.decision,edit.before_decision);assert.deepEqual(row.notes,edit.before_notes)
   assert(edit.reasons.length>0&&edit.reasons.every(reason=>reason.trim()))
   Object.assign(row,{translation:edit.after,decision:edit.decision,notes:edit.notes})
  }
  assert.deepEqual(replay,read(`${directory}/output.edited.json`))
  assert.deepEqual(editorial.uncertain,replay.entries.flatMap((r,i)=>r.decision==='uncertain'?[String(i+1).padStart(3,'0')]:[]))
  reviewed+=editorial.semantic_units;changes+=edits.length
 }
 const followupIndex=`${directory}/followups/index.json`
 if(fs.existsSync(followupIndex)) {
  assert(fs.existsSync(`${directory}/editorial-receipt.json`),'Follow-up requires an editorial base')
  let previousHash=hash(fs.readFileSync(`${directory}/editorial-receipt.json`))
  const stages=read(followupIndex),names=new Set()
  assert.equal(stages.schema,'GS-VOICE-FOLLOWUP-INDEX-V1');assert.equal(stages.batch_id,id)
  for(const reference of stages.stages) {
   assert(/^[a-z0-9-]+$/.test(reference.directory));assert(!names.has(reference.directory));names.add(reference.directory)
   const folder=`${directory}/followups/${reference.directory}`
   const receiptBytes=fs.readFileSync(`${folder}/receipt.json`),stage=read(`${folder}/receipt.json`)
   assert.equal(hash(receiptBytes),reference.receipt_sha256)
   assert.equal(stage.schema,'GS-VOICE-EDITORIAL-FOLLOWUP-V1');assert.equal(stage.batch_id,id)
   assert.equal(stage.previous_receipt_sha256,previousHash)
   assert.equal(stage.status,'draft');assert.equal(stage.not_final,true)
   for(const [name,record] of Object.entries(stage.files)) {
    const bytes=fs.readFileSync(`${folder}/${name}`)
    assert.equal(hash(bytes),record.sha256);assert.equal(bytes.length,record.bytes)
   }
   const edits=read(`${folder}/edits.json`),touched=new Set()
   assert.equal(edits.length,stage.edits)
   for(const edit of edits) {
    assert(/^\d{3}$/.test(edit.rid));assert(!touched.has(edit.rid));touched.add(edit.rid)
    const row=replay.entries[Number(edit.rid)-1]
    assert.equal(row.key,edit.key);assert.equal(row.source,edit.source);assert.equal(row.source_hash,edit.source_hash)
    assert.equal(row.translation,edit.before);assert.equal(row.decision,edit.before_decision);assert.deepEqual(row.notes,edit.before_notes)
    assert(edit.reasons.length>0&&edit.reasons.every(reason=>reason.trim()))
    Object.assign(row,{translation:edit.after,decision:edit.decision,notes:edit.notes})
   }
   assert.deepEqual(replay,read(`${folder}/output.edited.json`))
   followupChanges+=edits.length;previousHash=reference.receipt_sha256
  }
 }
 const baseEntries=read(`${directory}/output.imported.json`).entries
 effectiveChanges+=replay.entries.filter((row,i)=>row.translation!==baseEntries[i].translation||row.decision!==baseEntries[i].decision||JSON.stringify(row.notes)!==JSON.stringify(baseEntries[i].notes)).length
 validateGeneralReturn(batch,replay,units)
 for(let i=0;i<replay.entries.length;i++) {
  const row=replay.entries[i],source=batch.rows[i],entry=memory.get(row.key)
  assert(!seen.has(row.key));seen.add(row.key)
  checkTranslation(source,row,row.key)
  assert.equal(entry.source,row.source);assert.equal(entry.status,'draft')
  assert.equal(entry.batch,id);assert.equal(entry.translation,row.translation)
  assert.equal(entry.decision,row.decision);assert.deepEqual(entry.notes||[],row.notes)
  assert.equal(published[source.kind][source.field][row.source],row.translation)
  if(row.decision==='uncertain') pending++
 }
}
const researchFolder=`${root}/voice-research-20261104`
if(fs.existsSync(`${researchFolder}/receipt.json`)) {
 const receipt=read(`${researchFolder}/receipt.json`)
 assert.equal(receipt.schema,'GS-VOICE-EXTERNAL-RESEARCH-V1')
 assert.equal(receipt.status,'draft');assert.equal(receipt.not_final,true)
 for(const [name,record] of Object.entries(receipt.files)) {
  const bytes=fs.readFileSync(`${researchFolder}/${name}`)
  assert.equal(hash(bytes),record.sha256);assert.equal(bytes.length,record.bytes)
 }
 const decisions=read(`${researchFolder}/decisions.json`),legacy=read(`${researchFolder}/legacy-edits.json`)
 assert.equal(decisions.length,receipt.voice_units);assert.equal(legacy.length,receipt.legacy_units)
 for(const edit of decisions) {
  const entry=memory.get(edit.key)
  assert.equal(hash(edit.source),edit.source_hash)
  assert.equal(entry.source,edit.source);assert.equal(entry.translation,edit.after)
  assert.equal(entry.status,'draft');assert.equal(entry.decision,edit.decision)
  assert.deepEqual(entry.notes,edit.notes)
 }
 for(const edit of legacy) {
  assert.equal(hash(edit.before.source),edit.source_hash)
  assert.equal(edit.before.source,edit.after.source)
  assert.equal(edit.before.status,'reviewed');assert.equal(edit.after.status,'draft')
  assert.deepEqual(memory.get(edit.key),edit.after)
  assert.equal(published[edit.after.kind][edit.after.field][edit.after.source],edit.after.translation)
 }
 console.log(`PASS: external research receipt; ${decisions.length} decisions; ${legacy.length} legacy name corrections preserved and returned to draft`)
}
console.log(`PASS: ${imported} source-bound imports; ${reviewed} semantically compared; ${changes} base edits + ${followupChanges} follow-up edits replayed; ${effectiveChanges} current differences; ${pending} uncertain; all remain draft; remaining ${imported-reviewed} import-only`)
