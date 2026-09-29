import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { scanProducerPlaceholders, producerContext } from './lib/producer-placeholder-audit.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const read = async relative => fs.readFile(path.join(root, relative))
const manifest = JSON.parse(await read('public/data/reading/manifest.json'))
const report = { schema_version: 1, scope: { reading_documents: manifest.entries.length },
  source_rows: 0, producer_speaker_rows: 0, producer_speaker_with_placeholder: 0, literal_producer_term_rows: 0,
  literal_producer_term_without_dots: 0, occurrences: [], presentation_titles: [],
  compiled_inventory: { files: 0, files_with_candidates: 0, forms: {}, four_dot_without_role_suffix: 0 } }

for (const entry of manifest.entries) {
  const bytes = await read(`public/data/reading/${entry.file}`)
  assert.equal(sha256(bytes), entry.sha256, `Reader artifact changed: ${entry.file}`)
  const doc = JSON.parse(bytes)
  for (const row of doc.rows) {
    report.source_rows++
    if (row.speaker?.kind === 'producer') {
      assert.equal(row.speaker.sourceName, '<P>', `Unexpected producer speaker: ${entry.document_id}`)
      report.producer_speaker_rows++
    }
    if (row.source_text.includes('プロデューサー')) {
      report.literal_producer_term_rows++
      if (!row.source_text.includes('●')) report.literal_producer_term_without_dots++
    }
    const matches = scanProducerPlaceholders(row.source_text)
    if (matches.length && row.speaker?.kind === 'producer') report.producer_speaker_with_placeholder++
    for (const match of matches) {
      if (row.text_ref) assert.equal(sha256(row.source_text), row.text_ref.source_hash,
        `Stale source hash: ${entry.document_id}:${row.anchor.row_id}`)
      report.occurrences.push({ ...match, ...producerContext(row.source_text, match),
        document_id: entry.document_id, domain: entry.domain, row_kind: row.kind,
        row_id: row.anchor.row_id, speaker_kind: row.speaker?.kind || 'none',
        speaker_source_name: row.speaker?.sourceName || '',
        unit_id: row.text_ref?.unit_id || null, source_hash: row.text_ref?.source_hash || null,
        compiled_file: doc.source.file, raw_source_file: row.text_ref?.source?.file || row.anchor?.source_file || null,
        source_part_id: row.text_ref?.source?.part_id || row.anchor?.source_part_id || null,
        command_index: row.text_ref?.source?.command_index ?? row.anchor?.command_start ?? null })
    }
  }
  for (const match of scanProducerPlaceholders(entry.title)) {
    report.presentation_titles.push({ document_id: entry.document_id, domain: entry.domain,
      ...match, ...producerContext(entry.title, match) })
  }
}

async function visitCompiled(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) { await visitCompiled(file); continue }
    if (!item.name.endsWith('.json')) continue
    report.compiled_inventory.files++
    const content = await fs.readFile(file, 'utf8')
    // The raw JSON has duplicated legacy text/text_jp fields and speaker <P>
    // metadata. Count candidate literal forms here, never canonical units.
    const matches = [...content.matchAll(/●+|○{2,}|[□■]{2,}|＜P＞|\{\{[^}]+\}\}/gu)]
    if (matches.length) report.compiled_inventory.files_with_candidates++
    for (const match of matches) {
      const tally = report.compiled_inventory.forms
      tally[match[0]] = (tally[match[0]] || 0) + 1
      if (match[0] === '●●●●' && !content.slice(match.index + match[0].length).startsWith('プロデューサー'))
        report.compiled_inventory.four_dot_without_role_suffix++
    }
  }
}
await visitCompiled(path.join(root, 'public/data/compiled'))

const summary = { schema_version: 1, scope: report.scope,
  source_rows: report.source_rows, producer_speaker_rows: report.producer_speaker_rows,
  producer_speaker_with_placeholder: report.producer_speaker_with_placeholder,
  literal_producer_term_rows: report.literal_producer_term_rows,
  literal_producer_term_without_dots: report.literal_producer_term_without_dots,
  by_form: {}, by_domain: {}, identity_backed_occurrences: 0,
  presentation_title_occurrences: report.presentation_titles.length,
  presentation_title_by_form: {},
  compiled_inventory: report.compiled_inventory }
for (const item of report.occurrences) {
  summary.by_form[item.form] = (summary.by_form[item.form] || 0) + 1
  const domain = summary.by_domain[item.domain] ||= {}
  domain[item.form] = (domain[item.form] || 0) + 1
  if (item.unit_id) summary.identity_backed_occurrences++
}
for (const item of report.presentation_titles) {
  summary.presentation_title_by_form[item.form] = (summary.presentation_title_by_form[item.form] || 0) + 1
}
report.summary = summary
const output = path.join(root, '.analysis/producer-placeholder-audit.json')
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output, ...summary }, null, 2))
