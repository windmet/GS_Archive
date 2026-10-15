import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {archiveGeneralTextCorpus} from './archive-general-text-corpus.mjs'
import {PRODUCER_NAME_WITH_P_TOKEN} from '../../src/localization/story/ProducerAddressing.js'
import {KINDS,LAZY_SHARDS,SHARD_NAMES,kindInfo,kindsWithPrompt} from './translation-domains.mjs'
import {checkTranslation,loadMemory,protectedTokens} from './translation-memory.mjs'

export const hash = value => createHash('sha256').update(value).digest('hex')
export const keyOf = row => `metadata:v1:${row.kind}:${row.field}:${hash(row.source)}`
// Shards, prompt families and labels come from the kind registry (translation-domains.mjs).
export const shards = Object.fromEntries(SHARD_NAMES.map(name => [name, kind => KINDS[kind]?.shard === name]))
// Character lines: lazily loaded, never in the bundled root overlay, batched by speaker.
export const CARD_LINE_KINDS = kindsWithPrompt('character')
// Chat lines and the producer's reply choices: conversation by conversation.
export const CHAT_KINDS = kindsWithPrompt('chat')
// The root overlay is bundled into the app; lazy shards (character lines, chats) are fetched by their pages.
export const rootOverlayEntries = entries => Object.fromEntries(Object.entries(entries).filter(([kind]) => !LAZY_SHARDS.includes(KINDS[kind]?.shard)))
export function sourceUnits(root) {
  const unique = new Map()
  for (const row of archiveGeneralTextCorpus(root)) {
    kindInfo(row.kind)
    const key = keyOf(row)
    const entry = unique.get(key) || {...row,key,references:[]}
    entry.references.push({kind:row.kind,id:row.id,field:row.field,...(row.speaker?{speaker:row.speaker}:{}),...(row.owner?{owner:row.owner}:{})})
    unique.set(key,entry)
  }
  return [...unique.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.field.localeCompare(b.field)||a.key.localeCompare(b.key))
}
export const corpusHash = units => hash(JSON.stringify(units.map(({key,sourceHash,references})=>({key,sourceHash,references}))))
export {protectedTokens}

// Checks a parsed batch return against its own local batch map, then each entry's content.
// The map is the identity: the current corpus is consulted only to flag entries whose source has
// since left it (orphan, still importable as memory). References and corpus order are never compared.
export function validateGeneralReturn(batch, value, units = []) {
  assert.equal(batch.schema,'GS-GENERAL-BATCH-V1')
  assert.equal(batch.locale,'zh-CN')
  assert.equal(value.schema,'GS-GENERAL-RETURN-V1')
  assert.equal(value.batch_id,batch.batch_id,'Wrong batch')
  assert.equal(value.source_digest,batch.source_digest,'Wrong source digest')
  assert.equal(hash(JSON.stringify(batch.rows)),batch.source_digest,'Batch map drift')
  assert(Array.isArray(value.entries),'Expected entries array')
  assert.equal(value.entries.length,batch.rows.length,'Missing/extra rows')
  const live=new Set(units.map(u=>u.key)), expected=new Map(batch.rows.map(u=>[u.key,u])), seen=new Set()
  return value.entries.map(entry=>{
    assert(Object.keys(entry).every(k=>['key','source_hash','source','translation','decision','notes'].includes(k)),'Unexpected return field')
    assert(!seen.has(entry.key),`Duplicate key ${entry.key}`);seen.add(entry.key)
    const row=expected.get(entry.key)
    assert(row,`Unknown key ${entry.key}`)
    assert.equal(row.sourceHash,hash(row.source),'Source hash drift')
    assert.equal(entry.source_hash,row.sourceHash,'Return source hash changed')
    assert.equal(entry.source,row.source,'Return altered original text')
    checkTranslation(row,entry,entry.key)
    return {...entry,kind:row.kind,field:row.field,references:row.references,status:'draft',orphan:!live.has(entry.key)}
  })
}
// Mechanical repairs that leave the reviewed wording alone (general-translation-workflow.mjs amend).
export const GENERAL_REPAIRS = {
  // Card lines before 2026-10-10 were exported with raw ●●●● and came back as ●●●●制作人.
  'producer-slot-restore': text => text.replace(/(?<!●)●{4}(?!●)制作人/gu, PRODUCER_NAME_WITH_P_TOKEN),
}
// Published translations for the current corpus, from the translation memory (translation/tm).
// Kept under this name for the generator, audit and checks; it never fails on corpus drift.
export const loadGeneralRevisions = (root, units, options) => loadMemory(root, units, options)
