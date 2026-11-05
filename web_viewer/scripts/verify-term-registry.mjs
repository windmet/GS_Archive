// The term registry is the single project terminology source. This checks that it is well formed
// and that every term in the older frozen policy files is either migrated into it or explicitly
// superseded, so prompts projected from the registry cannot silently drop an existing decision.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { matchable, registryTrialPolicy, supersededText } from './lib/term-registry.mjs'

const root = new URL('../', import.meta.url)
const registryPath = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])) : new URL('translation/terms/registry.v1.json', root)
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const read = file => fs.readFileSync(new URL(file, root), 'utf8')

assert.equal(registry.schema, 'GS-TERM-REGISTRY-V1')
assert.equal(registry.locale, 'zh-CN')
const sources = {}
for (const [alias, file] of Object.entries(registry.frozen_sources)) sources[alias] = file.endsWith('.json') ? JSON.parse(read(file)) : read(file)
const names = JSON.parse(read(registry.name_table.file))
assert(names.entries.length > 0, 'name table is empty')
const entityIds = new Set(names.entries.map(entry => entry.entity_id))

const STATUS = new Set(['approved', 'project', 'pending'])
const decisions = new Set(registry.decisions.map(decision => decision.id))
const entries = [...registry.rules, ...registry.terms]
const supersedes = new Map(registry.supersedes.map(item => [item.id, item]))
const ids = entries.map(entry => entry.id)
assert.equal(new Set(ids).size, ids.length, 'Duplicate registry ids')
assert.equal(supersedes.size, registry.supersedes.length, 'Duplicate supersede ids')

for (const entry of entries) {
  assert(STATUS.has(entry.status), `${entry.id}: unknown status ${entry.status}`)
  assert(Array.isArray(entry.src) && entry.src.length, `${entry.id}: src is empty`)
  if (entry.status === 'pending') assert.equal(entry.zh, null, `${entry.id}: pending terms carry no rendering`)
  else {
    assert(typeof entry.zh === 'string' && entry.zh, `${entry.id}: missing zh`)
    assert(decisions.has(entry.decision), `${entry.id}: unknown decision ${entry.decision}`)
  }
  for (const form of [entry, ...(entry.family || [])])
    for (const bad of form.forbidden_zh || []) assert(!(form.zh || '').includes(bad), `${entry.id}: ${bad} is both chosen and forbidden`)
  for (const id of [...(entry.scope?.speakers || []), entry.scope?.addressee].filter(Boolean))
    assert(id === 'producer' || entityIds.has(id), `${entry.id}: unknown entity ${id}`)
  for (const id of entry.supersedes || []) assert.equal(supersedes.get(id)?.by, entry.id, `${entry.id}: supersede ${id} does not point back`)
}
for (const item of supersedes.values()) assert(ids.includes(item.by), `${item.id}: unknown target ${item.by}`)

// An unscoped approved source form may only have one rendering.
const unscoped = new Map()
for (const entry of registry.terms.filter(entry => entry.status === 'approved' && !entry.scope?.speakers))
  for (const form of [entry, ...(entry.family || [])]) for (const src of form.src) {
    assert(!unscoped.has(src) || unscoped.get(src) === form.zh, `${src}: conflicting approved renderings`)
    unscoped.set(src, form.zh)
  }

function resolve(ref) {
  const [alias, pointer] = ref.split('#')
  const source = sources[alias]
  assert(source !== undefined, `${ref}: unknown source ${alias}`)
  if (typeof source === 'string') {
    assert(source.includes(`### ${pointer} `), `${ref}: section not found`)
    return source
  }
  let value = source
  for (const part of pointer.split('/')) {
    const match = part.match(/^(\w+)=(.+)$/u)
    value = match ? value.find(item => item[match[1]] === match[2]) : value?.[part]
    assert(value !== undefined, `${ref}: not found`)
  }
  return value
}

// A migrated term keeps the old exact source form and, unless superseded, the old rendering.
const supersededSources = new Set(registry.supersedes.map(item => item.source))
const forms = entry => [entry, ...(entry.family || [])]
// The template never held renderings, so only applied policies are compared.
const migrated = new Set(), drift = []
for (const entry of entries) for (const ref of entry.migrated_from || []) {
  const old = resolve(ref)
  migrated.add(ref)
  const src = old.source_form ?? old.src
  const zh = old.chosen_rendering ?? old.zh
  if (typeof src !== 'string' || ref.startsWith('template#')) continue
  const carrier = forms(entry).find(form => form.src.includes(src))
  if (!carrier) drift.push(`${entry.id}: lost exact source form ${src} from ${ref}`)
  else if (!supersededSources.has(ref) && !(carrier.keep_source ? zh === src : (carrier.zh || '').includes(zh))) drift.push(`${entry.id}: ${ref} renders ${zh}, registry has ${carrier.zh}`)
}
assert.deepEqual(drift, [], `Migrated terms drifted:\n${drift.join('\n')}`)
for (const item of supersedes.values()) {
  const value = resolve(item.source)
  assert((typeof value === 'string' ? value : JSON.stringify(value)).includes(item.fragment), `${item.id}: fragment no longer in ${item.source}`)
  migrated.add(item.source)
}

// Every older term must be carried or superseded.
const required = [
  ...sources.trial.items.map(item => `trial#items/key=${item.key}`),
  ...sources.trial.pending_terms.map((_, index) => `trial#pending_terms/${index}`),
  ...sources.card_line.terms.map(term => `card_line#terms/src=${term.src}`),
  ...sources.user_terms.terms.map(term => `user_terms#terms/src=${term.src}`),
  ...sources.template.items.map(item => `template#items/key=${item.key}`),
]
assert(required.length > 80, `Expected the frozen policies to hold their terms, found ${required.length}`)
const missing = required.filter(ref => !migrated.has(ref))
assert.deepEqual(missing, [], `Terms neither migrated nor superseded:\n${missing.join('\n')}`)

// Prompt projections: frozen prose loses each superseded fragment, and the story trial policy
// carries every approved matchable form with its exact rendering.
for (const item of supersedes.values()) {
  assert(typeof item.replacement === 'string' && item.replacement, `${item.id}: missing replacement`)
  const value = resolve(item.source)
  if (typeof value !== 'string' || item.replacement.includes(item.fragment)) continue
  assert(!supersededText(item.source, value, registry).includes(item.fragment), `${item.id}: fragment survives projection`)
}
const trial = registryTrialPolicy(sources.trial, registry)
for (const entry of registry.terms.filter(entry => entry.status === 'approved' && !entry.keep_source && entry.kind !== 'orthography-rule'))
  for (const form of forms(entry)) for (const src of form.src.filter(matchable)) {
    const item = trial.items.find(candidate => candidate.key === `${entry.id}:${src}`)
    assert(item?.chosen_rendering === form.zh, `${entry.id}: ${src} missing from the story projection`)
  }
const approved = entries.filter(entry => entry.status === 'approved').length
console.log(`term registry ok: ${entries.length} entries (${approved} approved), ${required.length} frozen terms covered, ${supersedes.size} supersedes`)
