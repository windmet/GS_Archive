import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './lib/ai-studio-source.mjs'

const check = process.argv.includes('--check')
if (process.argv.length > (check ? 3 : 2)) throw Error('Usage: node scripts/generate-ai-studio-benchmark.mjs [--check]')
const domains = ['main', 'unit_story', 'idol_story', 'event', 'birthday', 'extra', 'work', 'card_scenarios']
const indexes = await loadStudioIndexes(), pool = new Map(domains.map(domain => [domain, []]))
for (const entry of indexes.reading.entries) {
  // The v1 sample is fixed to these eight domains; later domains (seasonal) are not sampled.
  if (!pool.has(entry.domain)) continue
  const item = await loadStudioDocument(entry, indexes)
  for (const row of item.rows) {
    const protectedText = item.draft.entries[row.text_ref.unit_id].source
    const features = [
      ...(protectedText.includes(':producer_name}}') ? ['producer_name'] : []),
      ...(protectedText.includes(':producer_name_with_p}}') ? ['producer_name_with_p'] : []),
      ...(row.source_text.includes('プロデューサー') ? ['literal_producer'] : []),
      ...(/[\r\n]/u.test(row.source_text) ? ['line_break'] : []),
      ...(Array.from(row.source_text).length >= 70 ? ['long'] : []),
      ...(/[（(][^）)]{2,}[）)]/u.test(row.source_text) ? ['parenthetical'] : []),
    ]
    pool.get(entry.domain).push({ document_id: entry.document_id, row_id: row.anchor.row_id,
      unit_id: row.text_ref.unit_id, source_hash: row.text_ref.source_hash,
      kind: row.kind, speaker: row.speaker?.sourceName || '', source_text: row.source_text,
      protected_source: protectedText, features })
  }
}
const cases = []
for (const domain of domains) {
  const rows = pool.get(domain).sort((a, b) => {
    const left = sha256(a.unit_id), right = sha256(b.unit_id)
    return left < right ? -1 : left > right ? 1 : 0
  })
  const selected = [], ids = new Set(), documents = new Set()
  const choose = predicate => {
    const eligible = rows.filter(row => !ids.has(row.unit_id) && predicate(row))
    const next = eligible.find(row => !documents.has(row.document_id)) || eligible[0]
    if (!next) return false
    selected.push(next); ids.add(next.unit_id); documents.add(next.document_id)
    return true
  }
  for (const kind of [...new Set(rows.map(row => row.kind))].sort()) choose(row => row.kind === kind)
  for (const feature of ['producer_name', 'producer_name_with_p', 'literal_producer',
    'line_break', 'long', 'parenthetical']) choose(row => row.features.includes(feature))
  while (selected.length < 25) assert(choose(() => true), `Insufficient benchmark rows: ${domain}`)
  assert.equal(selected.length, 25)
  cases.push(...selected.map(row => ({ domain, ...row })))
}
assert.equal(cases.length, 200)
assert.equal(new Set(cases.map(row => row.unit_id)).size, cases.length)
const manifestBytes = await fs.readFile(path.join(projectRoot, 'public/data/reading/manifest.json'))
const result = { schema_version: 1, purpose: 'unreviewed translation pilot sample; no gold translations',
  reading_manifest_sha256: sha256(manifestBytes), selection: '25 deterministic source-bound rows per domain', cases }
const file = path.join(projectRoot, 'translation/benchmarks/v1/cases.json')
const content = JSON.stringify(result, null, 2) + '\n'
if (check) assert.equal((await fs.readFile(file, 'utf8')).replace(/\r\n/gu, '\n'), content,
  'Benchmark candidates drifted')
else {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content, { flag: 'wx' })
}
console.log(`AI Studio benchmark ${check ? 'verified' : 'generated'}: ${cases.length} source-bound candidates / ${domains.length} domains`)
