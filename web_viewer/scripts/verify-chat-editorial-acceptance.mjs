import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {parseCompactReturn} from './lib/general-translation-markdown.mjs'
import {sourceUnits,validateGeneralReturn} from './lib/general-translation-batches.mjs'
import {readMemory,checkTranslation} from './lib/translation-memory.mjs'
import {protectProducerAddressingForTranslation,restoreProducerAddressingAfterTranslation} from '../src/localization/story/ProducerAddressing.js'

// Preserve the imported editorial returns. Acceptance is a separately logged
// transition, replayed after the original model -> editorial output evidence.
const directory='translation/studio/general/acceptance/chats-002-012-20261031'
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const receipt=read(`${directory}/receipt.json`),amendments=read(`${directory}/edits.json`)
assert.equal(receipt.schema,'GS-GENERAL-ACCEPTANCE-V1')
assert.equal(hash(fs.readFileSync(`${directory}/edits.json`)),receipt.edits_sha256)
assert.equal(hash(fs.readFileSync('translation/studio/policy/card-line-prompt.v1.json')),receipt.policy_sha256)
assert.equal(amendments.length,receipt.edits)
const byKey=new Map(amendments.map(row=>[row.key,row]))
assert.equal(byKey.size,amendments.length,'acceptance keys cannot repeat')
const units=sourceUnits(process.cwd()),memory=readMemory(process.cwd())
const published=read('public/translations/zh-CN/archive-general/chats.json')
const seen=new Set()
let count=0
for(const [id,base] of Object.entries(receipt.bases)) {
  const directory=`translation/studio/general/returns/${id}`
  const originalReceipt=read(`${directory}/receipt.json`)
  assert.equal(hash(fs.readFileSync(`${directory}/receipt.json`)),base.receipt_sha256)
  assert.equal(hash(fs.readFileSync(`${directory}/output.edited.json`)),base.edited_sha256)
  for(const [name,record] of Object.entries(originalReceipt.files)) {
    const bytes=fs.readFileSync(`${directory}/${name}`)
    assert.equal(hash(bytes),record.sha256,`${id}/${name} hash`)
    assert.equal(bytes.length,record.bytes,`${id}/${name} bytes`)
  }
  const batch=read(`${directory}/batch-map.json`),edited=read(`${directory}/output.edited.json`)
  const original=parseCompactReturn(batch,fs.readFileSync(`${directory}/output.original.md`,'utf8'))
  const touched=new Set()
  for(const edit of read(`${directory}/edits.json`)) {
    assert(!touched.has(edit.rid));touched.add(edit.rid)
    const row=original.entries[Number(edit.rid)-1]
    assert.equal(row.key,edit.key);assert.equal(row.source_hash,edit.source_hash);assert.equal(row.source,edit.source)
    // Some later editorial logs retain the model's protected marker spelling in
    // before. Restore only with the exact source's validated slots, never a loose replace.
    const before=edit.before.includes('{{GS_ADDRESS:')
      ? restoreProducerAddressingAfterTranslation(edit.before,protectProducerAddressingForTranslation(row.source)) : edit.before
    assert.equal(row.translation,before)
    Object.assign(row,{translation:edit.after,decision:edit.decision,notes:edit.notes})
  }
  assert.deepEqual(original,edited,`${id}: original editorial replay`)
  const entries=validateGeneralReturn(batch,edited,units)
  for(let index=0;index<entries.length;index++) {
    const row=entries[index],amendment=byKey.get(row.key)
    let translation=row.translation,decision=row.decision,notes=row.notes
    if(amendment) {
      assert.equal(amendment.batch,Number(id.slice(-3)))
      assert.equal(amendment.rid,String(index+1).padStart(3,'0'))
      assert.equal(amendment.source,row.source);assert.equal(amendment.source_hash,row.source_hash)
      assert.equal(amendment.before,translation);assert.equal(amendment.before_decision,decision)
      assert.deepEqual(amendment.before_notes,notes)
      translation=amendment.after;decision=amendment.decision;notes=amendment.notes
      checkTranslation(row,{translation,decision,notes},row.key)
      seen.add(row.key)
    }
    const entry=memory.get(row.key)
    assert(entry,`${id}/${index+1}: missing TM`)
    assert.equal(entry.source,row.source);assert.equal(entry.translation,translation)
    assert.equal(entry.decision,decision);assert.deepEqual(entry.notes||[],notes)
    assert.equal(entry.status,'draft');assert.equal(entry.batch,id)
    assert.equal(published.entries[row.kind][row.field][row.source],translation)
    assert.equal(published.source_hashes[row.source],`sha256:${row.source_hash}`)
  }
  count+=entries.length
}
assert.equal(count,receipt.scope.identity_verified)
assert.equal(seen.size,amendments.length)
console.log(`PASS: ${count} chat source bindings, immutable receipts and original editorial replay; ${seen.size} acceptance corrections match draft TM and publication`)
