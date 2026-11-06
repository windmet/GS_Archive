// Term backfills (translation/studio/amendments/*-terms.json) must stay replayable: every story edit
// undoes to its logged base bytes, every TM edit is live and source-bound, and each edit names
// approved registry terms whose forbidden renderings it no longer contains.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadTermAmendments, catalogueBeforeTermAmendments, memoryBeforeTermAmendments } from './lib/term-amendments.mjs'
import { readMemory } from './lib/translation-memory.mjs'
import { loadTermRegistry } from './lib/term-registry.mjs'

const amendments = loadTermAmendments()
assert(amendments.length, 'No term amendments found')
const registry = loadTermRegistry()
const approved = new Map(registry.terms.filter(entry => entry.status === 'approved').map(entry => [entry.id, entry]))
const forbiddenOf = id => { const entry = approved.get(id); return [...(entry.forbidden_zh || []), ...(entry.family || []).flatMap(form => form.forbidden_zh || [])] }
const checkEdit = (edit, label) => {
  assert.notEqual(edit.before, edit.after, `No-op term edit ${label}`)
  assert(edit.terms?.length, `Term edit names no terms ${label}`)
  for (const id of edit.terms) {
    assert(approved.has(id), `Term edit names an unapproved term ${id} ${label}`)
    for (const bad of forbiddenOf(id)) assert(!edit.after.includes(bad), `Term edit keeps forbidden ${bad} ${label}`)
  }
}

// Content first, so a bad edit is named for what it says rather than for failing to replay.
for (const amendment of amendments) {
  for (const record of amendment.story) for (const edit of record.edits) checkEdit(edit, edit.unit_id)
  for (const edit of amendment.memory) checkEdit(edit, edit.key)
}

let story = 0
// A catalogue amended by several files replays through every newer file first, so each record is
// checked against the chain that ends at its own file.
for (const [index, amendment] of amendments.entries()) for (const record of amendment.story) {
  const bytes = fs.readFileSync(`public/translations/zh-CN/scenarios/${record.scenario_id}.json`)
  const chain = [amendment, ...amendments.slice(index + 1)]
  catalogueBeforeTermAmendments(record.scenario_id, bytes, chain)
  // A forged before text, or drifted live bytes, must not reconstruct.
  const forged = structuredClone(amendment)
  forged.story.find(item => item.scenario_id === record.scenario_id).edits[0].before += '别的文字'
  assert.throws(() => catalogueBeforeTermAmendments(record.scenario_id, bytes, [forged, ...chain.slice(1)]), `forged before accepted ${record.scenario_id}`)
  assert.throws(() => catalogueBeforeTermAmendments(record.scenario_id, Buffer.from(`${bytes} `), chain), `drifted bytes accepted ${record.scenario_id}`)
  story += record.edits.length
}

const memory = readMemory(process.cwd())
memoryBeforeTermAmendments(memory)
let tm = 0
for (const amendment of amendments) for (const edit of amendment.memory) {
  const entry = memory.get(edit.key)
  assert.equal(entry.kind, edit.kind, `Term edit kind drift ${edit.key}`)
  assert.equal(entry.field, edit.field, `Term edit field drift ${edit.key}`)
  tm++
}
const drifted = new Map(memory)
const [first] = amendments[0].memory
drifted.set(first.key, { ...memory.get(first.key), translation: `${first.after}。` })
assert.throws(() => memoryBeforeTermAmendments(drifted), 'a TM entry edited after the backfill must not replay')

console.log(`Term amendments: ${amendments.length} file(s), ${story} story units and ${tm} TM entries replay to their pre-backfill bytes; no edit keeps a forbidden rendering`)
