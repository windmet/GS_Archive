import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { discoverReadingSources } from '../shared/reading/ReadingCatalog.js'
import { validateReadingDocument } from '../shared/reading/ReadingContract.js'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const serialize = value => `${JSON.stringify(value, null, 2)}\n`
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'))
const check = process.argv.includes('--check')
const publications = (await read('public/data/authoritative_story_publications.json')).entries
const catalog = await read('public/data/masterdata/story_catalog.json')
const knownIdolIds = new Set((await read('public/data/masterdata/idol_unit_dictionary.json')).idols.map(idol => idol.idol_code))
const sources = new Map()
async function readCompiled(file) {
  if (!sources.has(file)) {
    const bytes = await fs.readFile(path.join(root, 'public/data/compiled', file))
    sources.set(file, { bytes, data: JSON.parse(bytes) })
  }
  return sources.get(file)
}
const { candidates: samples, excluded } = await discoverReadingSources({ catalog, publications, readCompiled })
const entries = []
const outputs = []
for (const sample of samples) {
  const { bytes, data: compiled } = await readCompiled(sample.file)
  const document = createReadingDocument(compiled, { documentId: sample.document_id,
    logicalId: sample.logical_id, file: sample.file, sha256: hash(bytes), knownIdolIds })
  document.presentation = { title: sample.title, episode_label: sample.episode_label }
  document.source.publication = sample.publication
  const output = serialize(document)
  const file = `${sample.document_id}.json`
  outputs.push([`public/data/reading/${file}`, output])
  const entry = { document_id: document.document_id, logical_id: document.logical_id,
    scenario_id: document.scenario_id, file, schema_version: document.schema_version,
    sha256: hash(output), source_sha256: document.source.sha256, source_file: document.source.file, status: document.status, row_count: document.rows.length,
    title: document.presentation.title, episode_label: document.presentation.episode_label, domain: sample.domain, parent_file: sample.parent_file }
  validateReadingDocument(document, entry)
  entries.push(entry)
}
const byDomain = {}
for (const entry of entries) { const counts = byDomain[entry.domain] ||= {}; counts[entry.status] = (counts[entry.status] || 0) + 1 }
outputs.push(['public/data/reading/coverage.json', serialize({ schema_version: 1, by_domain: byDomain, excluded })])
outputs.push(['public/data/reading/manifest.json', serialize({ schema_version: 1, entries })])
for (const [file, content] of outputs) await emit(file, content)
const counts = entries.reduce((counts, entry) => ({ ...counts, [entry.status]: (counts[entry.status] || 0) + 1 }), {})
console.log(`${check ? 'Verified' : 'Generated'} ${entries.length} reading documents: ${JSON.stringify(counts)}`)

async function emit(file, content) {
  const target = path.join(root, file)
  if (check) {
    if (await fs.readFile(target, 'utf8') !== content) throw Error(`Reading artifact differs from published source: ${file}`)
  } else {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }
}
