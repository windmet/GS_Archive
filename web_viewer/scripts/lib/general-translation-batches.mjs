import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {parseJsonStrict} from './strict-json.mjs'
import {archiveGeneralTextCorpus} from './archive-general-text-corpus.mjs'
import {validateItemIdolNames} from './item-idol-name-policy.mjs'

export const hash = value => createHash('sha256').update(value).digest('hex')
export const keyOf = row => `metadata:v1:${row.kind}:${row.field}:${hash(row.source)}`
export const shards = {photos:k=>k==='background'||k==='background-variant'||k.startsWith('photo-'),costumes:k=>k==='costume',cards:k=>k==='card',skills:k=>['skill','skill-category','center-skill'].includes(k),items:k=>k==='item',honors:k=>k==='honor',profiles:k=>['idol-profile','unit-profile','mobile-status','work'].includes(k),'card-lines':k=>CARD_LINE_KINDS.includes(k),chats:k=>CHAT_KINDS.includes(k)}
// Character lines: lazily loaded, never in the bundled root overlay, batched by speaker.
export const CARD_LINE_KINDS = ['card-line','card-touch','call-title']
// Chat lines and the producer's reply choices: conversation by conversation.
export const CHAT_KINDS = ['chat-line','chat-choice']
// The root overlay is bundled into the app; character lines and chats live only in lazy shards.
export const rootOverlayEntries = entries => Object.fromEntries(Object.entries(entries).filter(([kind]) => !CARD_LINE_KINDS.includes(kind) && !CHAT_KINDS.includes(kind)))
export function sourceUnits(root) {
  const unique = new Map()
  for (const row of archiveGeneralTextCorpus(root)) {
    const key = keyOf(row)
    const entry = unique.get(key) || {...row,key,references:[]}
    entry.references.push({kind:row.kind,id:row.id,field:row.field,...(row.speaker?{speaker:row.speaker}:{}),...(row.owner?{owner:row.owner}:{})})
    unique.set(key,entry)
  }
  return [...unique.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.field.localeCompare(b.field)||a.key.localeCompare(b.key))
}
export const corpusHash = units => hash(JSON.stringify(units.map(({key,sourceHash,references})=>({key,sourceHash,references}))))
export function planBatches(units, limit=100, charLimit=6000) {
  const batches=[]
  for (const [domain,select] of Object.entries(shards)) {
    let rows=[], chars=0, n=0
    const finish=()=>{if(!rows.length)return;const id=`G-${domain}-${String(++n).padStart(3,'0')}`;batches.push({schema:'GS-GENERAL-BATCH-V1',batch_id:id,locale:'zh-CN',rows,source_digest:hash(JSON.stringify(rows))});rows=[];chars=0}
    for(const unit of units.filter(u=>select(u.kind))) {
      if(rows.length && (rows.length>=limit || chars+unit.source.length>charLimit))finish()
      rows.push(unit);chars+=unit.source.length
    }
    finish()
  }
  return batches
}
const sorted = values => (values||[]).sort()
export function protectedTokens(text) {
  return sorted(text.match(/<[A-Za-z][A-Za-z0-9_]*>|\[[A-Za-z][A-Za-z0-9_]*\]|\{[A-Za-z][A-Za-z0-9_]*\}|●{2,}|\d+(?:\.\d+)?/g))
}
export function validateGeneralReturn(batch, value, units) {
  assert.equal(batch.schema,'GS-GENERAL-BATCH-V1')
  assert.equal(batch.locale,'zh-CN')
  assert.equal(value.schema,'GS-GENERAL-RETURN-V1')
  assert.equal(value.batch_id,batch.batch_id,'Wrong batch')
  assert.equal(value.source_digest,batch.source_digest,'Wrong source digest')
  assert.equal(hash(JSON.stringify(batch.rows)),batch.source_digest,'Batch map drift')
  assert(Array.isArray(value.entries),'Expected entries array')
  assert.equal(value.entries.length,batch.rows.length,'Missing/extra rows')
  const current=new Map(units.map(u=>[u.key,u])), expected=new Map(batch.rows.map(u=>[u.key,u])), seen=new Set()
  const entries=value.entries.map(entry=>{
    assert(Object.keys(entry).every(k=>['key','source_hash','source','translation','decision','notes'].includes(k)),'Unexpected return field')
    assert(!seen.has(entry.key),`Duplicate key ${entry.key}`);seen.add(entry.key)
    const row=expected.get(entry.key), live=current.get(entry.key)
    assert(row && live,`Unknown/stale key ${entry.key}`)
    assert.equal(row.source,live.source,'Source changed')
    assert.equal(row.kind,live.kind,'Domain changed')
    assert.equal(row.field,live.field,'Field changed')
    assert.equal(row.sourceHash,hash(row.source),'Source hash drift')
    assert.equal(entry.source_hash,row.sourceHash,'Return source hash changed')
    assert.deepEqual(row.references,live.references,'Source references changed; re-export')
    assert.equal(entry.source,row.source,'Return altered original text')
    assert(typeof entry.translation==='string' && entry.translation.trim(),`Empty translation ${entry.key}`)
    assert(Array.isArray(entry.notes) && entry.notes.every(n=>typeof n==='string'),'notes must be string[]')
    assert(['translated','uncertain','keep-source'].includes(entry.decision),'Invalid decision')
    if(entry.decision==='keep-source')assert.equal(entry.translation,row.source,'keep-source must preserve source')
    if(entry.decision==='uncertain')assert(entry.notes.length,'Uncertainty needs a note')
    assert.deepEqual(protectedTokens(entry.translation),protectedTokens(row.source),`Number/placeholder drift ${entry.key}`)
    if(['skill','center-skill'].includes(row.kind) && row.field==='description')assert.deepEqual(entry.translation.match(/\d+(?:\.\d+)?/g),row.source.match(/\d+(?:\.\d+)?/g),'Skill number order changed')
    assert(!/<(?:script|iframe|img)\b|javascript:/i.test(entry.translation),'Unsafe markup')
    if(['item','honor'].includes(row.kind))validateItemIdolNames(row.source,entry.translation,entry.decision)
    return {...entry,kind:row.kind,field:row.field,references:row.references,status:'draft'}
  })
  return entries
}
export function loadGeneralRevisions(root, units) {
  const folder=path.join(root,'translation/studio/general/revisions'), output=new Map()
  if(!fs.existsSync(folder))return output
  for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.json')).sort()) {
    const record=parseJsonStrict(fs.readFileSync(path.join(folder,file),'utf8'),file)
    assert.equal(record.schema,'GS-GENERAL-REVISION-V1')
    assert.equal(record.not_final,true,'Revision must retain not_final')
    assert(record.translator?.trim(),'Missing translator identity')
    const entries=validateGeneralReturn(record.batch,record.return,units)
    assert.equal(record.return_sha256,hash(JSON.stringify(record.return)),'Return receipt drift')
    if(record.status==='reviewed') {
      assert.equal(record.approval?.approved,true,'Missing review approval')
      assert.equal(record.approval?.batch_id,record.batch.batch_id,'Approval bound to different batch')
      assert.equal(record.approval?.return_sha256,record.return_sha256,'Approval bound to different translation')
      assert(record.approval?.reviewer?.trim() && record.approval?.statement?.trim(),'Missing reviewer/statement')
      assert(entries.every(e=>e.decision!=='uncertain'),'Unresolved entries cannot be reviewed')
    } else assert.equal(record.status,'draft')
    for(const entry of entries) {
      assert(!output.has(entry.key),`Overlapping revision ${entry.key}; supersede old batch explicitly`)
      output.set(entry.key,{...entry,status:record.status,batch_id:record.batch.batch_id,translator:record.translator,reviewer:record.approval?.reviewer||null})
    }
  }
  return output
}
