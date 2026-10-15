import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {shardOf,SHARD_NAMES} from './translation-domains.mjs'
import {validateItemIdolNames} from './item-idol-name-policy.mjs'
import {validateProducerAddressingOverlay} from '../../src/localization/story/ProducerAddressing.js'

// Translation memory: one entry per source text (key = kind, field and source hash), stored per
// shard in translation/tm/<locale>/<shard>.json. Identity is the source text alone: references,
// batches and corpus order are context, so new or reordered corpus rows never invalidate an entry.
// A source that changes gets a new key (missing); its old entry stays as an orphan until pruned.
// Git history is the audit trail; reviews.json keeps who approved which batch and in what words.
export const TM_SCHEMA = 'GS-TM-V1'
export const STATUSES = ['draft','reviewed','final']
export const DECISIONS = ['translated','uncertain','keep-source']
export const tmFolder = (root, locale = 'zh-CN') => path.join(root, 'translation/tm', locale)
const ENTRY_FIELDS = ['kind','field','source','translation','status','decision','notes','translator','reviewer','batch']

export const protectedTokens = text => (text.match(/<[A-Za-z][A-Za-z0-9_]*>|\[[A-Za-z][A-Za-z0-9_]*\]|\{[A-Za-z][A-Za-z0-9_]*\}|●{2,}|\d+(?:\.\d+)?/g) || []).sort()

// Content rules for one translation, shared by import, loading and the strict check.
export function checkTranslation({kind,field,source}, {translation,decision,notes}, key = '') {
  assert(typeof translation === 'string' && translation.trim(), `Empty translation ${key}`)
  assert(Array.isArray(notes) && notes.every(n => typeof n === 'string'), `notes must be string[] ${key}`)
  assert(DECISIONS.includes(decision), `Invalid decision ${key}`)
  if (decision === 'keep-source') assert.equal(translation, source, `keep-source must preserve source ${key}`)
  if (decision === 'uncertain') assert(notes.length, `Uncertainty needs a note ${key}`)
  assert.deepEqual(protectedTokens(translation), protectedTokens(source), `Number/placeholder drift ${key}`)
  // Same contract as story overlays: the translation keeps the source's Producer macros verbatim.
  assert(validateProducerAddressingOverlay(source, translation), `Producer slot changed ${key}`)
  if (['skill','center-skill'].includes(kind) && field === 'description')
    assert.deepEqual(translation.match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g), `Skill number order changed ${key}`)
  assert(!/<(?:script|iframe|img)\b|javascript:/i.test(translation), `Unsafe markup ${key}`)
  if (['item','honor'].includes(kind)) validateItemIdolNames(source, translation, decision)
}

export function checkEntry(key, entry) {
  assert(Object.keys(entry).every(name => ENTRY_FIELDS.includes(name)), `Unexpected TM field ${key}`)
  assert(STATUSES.includes(entry.status), `Invalid status ${key}`)
  assert(entry.translator?.trim(), `Missing translator ${key}`)
  if (entry.status !== 'draft') assert(entry.reviewer?.trim(), `Reviewed entry needs a reviewer ${key}`)
  if (entry.status !== 'draft') assert.notEqual(entry.decision, 'uncertain', `Unresolved entry cannot be reviewed ${key}`)
  checkTranslation(entry, {...entry, notes: entry.notes || []}, key)
}

export function readMemory(root, locale = 'zh-CN') {
  const folder = tmFolder(root, locale), memory = new Map()
  if (!fs.existsSync(folder)) return memory
  for (const shard of SHARD_NAMES) {
    const file = path.join(folder, `${shard}.json`)
    if (!fs.existsSync(file)) continue
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(value.schema, TM_SCHEMA, file); assert.equal(value.locale, locale, file)
    for (const [key, entry] of Object.entries(value.entries)) memory.set(key, entry)
  }
  return memory
}

// Entries are sorted by key so a re-import only diffs the lines it changed.
export function writeMemory(root, memory, locale = 'zh-CN') {
  const folder = tmFolder(root, locale); fs.mkdirSync(folder, {recursive: true})
  const byShard = new Map(SHARD_NAMES.map(shard => [shard, {}]))
  for (const key of [...memory.keys()].sort()) {
    const entry = memory.get(key)
    byShard.get(shardOf(entry.kind))[key] = Object.fromEntries(ENTRY_FIELDS.filter(name => entry[name] !== undefined && entry[name] !== null && !(Array.isArray(entry[name]) && !entry[name].length)).map(name => [name, entry[name]]))
  }
  for (const [shard, entries] of byShard) {
    const file = path.join(folder, `${shard}.json`)
    if (!Object.keys(entries).length) { if (fs.existsSync(file)) fs.rmSync(file); continue }
    fs.writeFileSync(file, JSON.stringify({schema: TM_SCHEMA, locale, entries}, null, 1) + '\n')
  }
}

// Current entries for the current corpus: what the generator publishes. Orphans (sources no longer
// in the corpus) are left out; an entry failing the content rules is reported and left out, unless
// strict, where it fails. Nothing here depends on batches or references.
export function memoryReport(root, units, {strict = false, locale = 'zh-CN'} = {}) {
  const memory = readMemory(root, locale), current = new Set(units.map(unit => unit.key))
  const live = new Map(), orphans = [...memory.keys()].filter(key => !current.has(key)), invalid = []
  // Corpus order, so published files never depend on import order.
  for (const unit of units) {
    const key = unit.key, entry = memory.get(key)
    if (!entry) continue
    try {
      assert.equal(entry.source, unit.source, `Source mismatch ${key}`)
      assert.equal(entry.kind, unit.kind, `Kind mismatch ${key}`); assert.equal(entry.field, unit.field, `Field mismatch ${key}`)
      checkEntry(key, entry)
    } catch (error) {
      if (strict) throw error
      invalid.push({key, error: error.message}); continue
    }
    live.set(key, {...entry, key, notes: entry.notes || [], references: unit.references, batch_id: entry.batch || null, reviewer: entry.reviewer || null})
  }
  if (strict) for (const key of orphans) checkEntry(key, memory.get(key))
  if (invalid.length && !strict) console.warn(`translation memory: ${invalid.length} invalid entr${invalid.length === 1 ? 'y' : 'ies'} skipped (run: node scripts/general-translation-workflow.mjs verify)`)
  return {memory, live, orphans, invalid}
}

export const loadMemory = (root, units, options) => memoryReport(root, units, options).live
