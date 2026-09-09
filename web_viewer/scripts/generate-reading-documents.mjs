import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const serialize = value => `${JSON.stringify(value, null, 2)}\n`
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'))
const check = process.argv.includes('--check')
const samples = (await read('config/reading-samples.v1.json')).samples
const publications = (await read('public/data/authoritative_story_publications.json')).entries
const catalog = await read('public/data/masterdata/story_catalog.json')
const entries = []
const outputs = []
for (const sample of samples) {
  if (!/^[a-zA-Z0-9_-]+$/.test(sample.document_id) || !/^episodes\/[a-zA-Z0-9_-]+\.json$/.test(sample.file)) throw Error('Invalid sample path')
  const sourcePath = `public/data/compiled/${sample.file}`
  const publication = publications.find(p => p.logical_id === sample.logical_id && p.artifacts.some(a => a.path === sourcePath && a.role === 'episode'))
  const bytes = await fs.readFile(path.join(root, sourcePath))
  const compiled = JSON.parse(bytes)
  // Legacy episodes are catalog-discoverable but outside the bounded strict
  // publication registry. Require their actual aggregate and episode relation.
  const aggregate = compiled.aggregate_source
  const chapter = catalog.collectionStructure.flatMap(s => s.chapters).find(c => c.file === aggregate?.file
    && c.episodes.some(e => e.resourceId === sample.document_id))
  if (!publication && (!chapter || sample.logical_id !== `story-collection:${aggregate?.scenario_id}`
    || compiled.schema_version === 2 || compiled.scenario_id !== sample.document_id)) throw Error(`Unrecognized published episode: ${sample.file}`)
  const document = createReadingDocument(compiled, { documentId: sample.document_id,
    logicalId: sample.logical_id, file: sample.file, sha256: hash(bytes) })
  const displayChapter = catalog.collectionStructure.flatMap(s => s.chapters).find(c =>
    `story-collection:${c.file.replace(/\.json$/, '')}` === sample.logical_id)
  const displayEpisode = displayChapter?.episodes.find(e => e.resourceId === sample.document_id)
  document.presentation = { title: displayChapter?.title ?? null, episode_label: displayEpisode?.label ?? null }
  document.source.publication = publication ? { kind: 'authoritative-registry', ownership: publication.ownership }
    : { kind: 'catalog-compatibility', aggregate_file: aggregate.file }
  const output = serialize(document)
  const file = `${sample.document_id}.json`
  outputs.push([`public/data/reading/${file}`, output])
  entries.push({ document_id: document.document_id, logical_id: document.logical_id,
    scenario_id: document.scenario_id, file, schema_version: document.schema_version,
    sha256: hash(output), source_sha256: document.source.sha256, source_file: document.source.file, status: document.status, row_count: document.rows.length })
}
outputs.push(['public/data/reading/manifest.json', serialize({ schema_version: 1, entries })])
for (const [file, content] of outputs) await emit(file, content)
console.log(`${check ? 'Verified' : 'Generated'} ${entries.length} reading documents: ${entries.map(e => `${e.document_id}=${e.status}`).join(', ')}`)

async function emit(file, content) {
  const target = path.join(root, file)
  if (check) {
    if (await fs.readFile(target, 'utf8') !== content) throw Error(`Reading artifact differs from published source: ${file}`)
  } else {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }
}
