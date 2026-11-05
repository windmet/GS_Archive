// Projections of translation/terms/registry.v1.json for translation prompts. Prompts read terms only
// through here; the frozen policy files keep their bytes for historical receipts, and their prose is
// passed through supersededText so a replaced rule never reaches a new prompt.
import fs from 'node:fs'

const REGISTRY = new URL('../../translation/terms/registry.v1.json', import.meta.url)
let cached
export function loadTermRegistry() {
  if (!cached) {
    const bytes = fs.readFileSync(REGISTRY)
    cached = { ...JSON.parse(bytes), bytes }
  }
  return cached
}

const compact = text => String(text).replace(/\s+/gu, '')
// Descriptive forms (人名＋っち) document a pattern; they are never matched against source text.
export const matchable = src => !/[＋（）…]/u.test(src)

/** Every rendering a prompt may use: approved and project terms, families flattened. */
export function promptTerms(registry = loadTermRegistry()) {
  const terms = []
  for (const entry of registry.terms) {
    if (entry.status === 'pending') continue
    for (const form of [entry, ...(entry.family || [])]) {
      const zh = entry.keep_source && form === entry ? null : form.zh
      for (const src of form.src.filter(matchable))
        terms.push({ id: entry.id, status: entry.status, src, zh: zh ?? src,
          speakers: entry.scope?.speakers || null, note: form === entry ? entry.note || '' : '' })
    }
  }
  return terms
}

// Batch planning re-renders a growing batch after every row, so hits are memoized per line.
const lineHits = new WeakMap()
function hitsFor(registry, source, speaker) {
  if (!lineHits.has(registry)) lineHits.set(registry, { terms: promptTerms(registry).map(term => ({ ...term, key: compact(term.src) })), lines: new Map() })
  const { terms, lines } = lineHits.get(registry)
  const id = `${speaker}\u0001${source}`
  if (!lines.has(id)) {
    const text = compact(source)
    lines.set(id, terms.filter(term => (!term.speakers || term.speakers.includes(speaker)) && text.includes(term.key)))
  }
  return lines.get(id)
}

/** Terms whose source form occurs in a row said by a speaker the term applies to. */
export function termsForRows(rows, registry = loadTermRegistry()) {
  const hits = new Map()
  for (const row of rows) for (const term of hitsFor(registry, row.source, row.speaker)) hits.set(term.src, term)
  // A longer form (パッションの像) also contains its root (パッション); list both, longest first.
  return [...hits.values()].sort((a, b) => b.src.length - a.src.length || a.src.localeCompare(b.src))
}

/** Frozen prose with the registry's replacements applied, e.g. ref `card_line#speakers/040ren`. */
export function supersededText(ref, text, registry = loadTermRegistry()) {
  let result = text
  for (const item of registry.supersedes.filter(item => item.source === ref)) {
    if (!result.includes(item.fragment)) throw new Error(`${item.id}: fragment absent from ${ref}`)
    result = result.replaceAll(item.fragment, item.replacement)
  }
  return result
}

/**
 * The story Studio trial-policy shape (V3 consumers read items, proper_name_exceptions,
 * pending_terms, meaningful_kana and the global lists), built from the registry. Renderings with
 * alternatives (发掘／邀请／招募) are listed without a source form, so they never become an exact
 * QA requirement.
 */
export function registryTrialPolicy(frozen, registry = loadTermRegistry()) {
  const items = [], exceptions = []
  for (const entry of registry.terms) {
    if (entry.status === 'pending' || entry.kind === 'orthography-rule') continue
    if (entry.keep_source) { exceptions.push(...entry.src); continue }
    const scope = [entry.kind, entry.scope?.speakers && `说话人 ${entry.scope.speakers.join('/')}`,
      entry.scope?.addressee && `对象 ${entry.scope.addressee}`, entry.scope?.context].filter(Boolean).join(' · ')
    for (const form of [entry, ...(entry.family || [])]) {
      if (form.zh === form.src[0]) exceptions.push(...form.src)
      const required = [form === entry ? entry.note : '', form.forbidden_zh?.length && `不用 ${form.forbidden_zh.join('、')}`,
        form === entry && entry.not_this_term?.length && `不适用：${entry.not_this_term.join('；')}`].filter(Boolean).join('；')
      for (const src of form.src.filter(matchable)) {
        const exact = !form.zh.includes('／')
        items.push({ key: `${entry.id}:${src}`, editorial_status: entry.status === 'approved' ? 'user-approved' : 'project-trial',
          public_approval: false, scope, chosen_rendering: form.zh, required,
          ...(exact ? { source_form: src } : {}), ...(entry.scope?.speakers ? { actor_ids: entry.scope.speakers } : {}),
          target_term: { entity_id: `term:${entry.id}`, entity_type: entry.kind, canonical_ja: entry.src[0] } })
      }
    }
  }
  const kana = registry.terms.find(entry => entry.kind === 'orthography-rule' && entry.id === 'meaningful-kana')
  return {
    schema: 'GS-TERM-REGISTRY-TRIAL-V1', revision: registry.revision, editorial_status: 'term-registry', public_approval: false,
    items,
    global_required: frozen.global_required.map((rule, index) => supersededText(`trial#global_required/${index}`, rule, registry)),
    global_forbidden: frozen.global_forbidden.map((rule, index) => supersededText(`trial#global_forbidden/${index}`, rule, registry)),
    pending_terms: registry.terms.filter(entry => entry.status === 'pending').map(entry => entry.src.join('/')),
    proper_name_exceptions: [...new Set(exceptions)],
    meaningful_kana: (kana?.src || []).map(source => ({ source_form: source, retained_form: source.replace(/[『』]/gu, '') })),
  }
}

/** Rules decided after the frozen prompts were written, as prompt lines. */
export function addedRuleLines(registry = loadTermRegistry(), frozenDecision = 'D-trial-r33') {
  return registry.rules.filter(rule => rule.status !== 'pending' && rule.decision !== frozenDecision)
    .map(rule => `${rule.src.join('／')} → ${rule.zh}${rule.note ? `。${rule.note}` : ''}`)
}
