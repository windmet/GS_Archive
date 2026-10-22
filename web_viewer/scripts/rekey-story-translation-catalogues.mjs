// Re-keys per-part story translation catalogues to the text catalogue their recompiled source names.
// Run after the Reader documents are regenerated. Every entry moves byte-for-byte; nothing is retranslated.
// It also writes the supersession record that lets the review verifiers follow the moved evidence.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { SUPERSESSION_FILE, serializeCatalogue } from './lib/studio-source-supersessions.mjs'

const apply = process.argv.includes('--apply')
const git = (...args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'buffer', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const baseCommit = git('rev-parse', 'HEAD').toString().trim()
const atBase = file => JSON.parse(git('show', `${baseCommit}:web_viewer/${file}`))
const readJson = async file => JSON.parse(await fs.readFile(path.join(projectRoot, file), 'utf8'))
const scenarios = 'public/translations/zh-CN/scenarios'
const catalogueOf = doc => doc.text_catalog_id || doc.scenario_id

const baseEntries = new Map(atBase('public/data/reading/manifest.json').entries.map(entry => [entry.document_id, entry]))
const liveEntries = (await readJson('public/data/reading/manifest.json')).entries
const moves = new Map()
for (const entry of liveEntries) {
  const base = baseEntries.get(entry.document_id)
  if (!base) continue
  const live = await readJson(`public/data/reading/${entry.file}`)
  const from = catalogueOf(atBase(`public/data/reading/${base.file}`))
  const to = catalogueOf(live)
  if (from === to) continue
  let bytes
  try { bytes = git('show', `${baseCommit}:web_viewer/${scenarios}/${from}.json`) } catch { continue }
  const overlay = JSON.parse(bytes)
  assert.equal(serializeCatalogue(overlay), bytes.toString(), `Catalogue is not in canonical form: ${from}`)
  assert.equal(overlay.source_raw_hash, live.source.raw_hash, `RAW hash differs from the recompiled source: ${from}`)
  assert(Object.keys(overlay.entries).every(id => id.split(':')[3] === from), `Catalogue holds another part's units: ${from}`)
  const group = moves.get(to) || []
  group.push({ from, from_sha256: sha256(bytes), units: Object.keys(overlay.entries).length, overlay })
  moves.set(to, group)
}

const catalogues = []
const writes = []
for (const [to, group] of moves) {
  assert.throws(() => git('show', `${baseCommit}:web_viewer/${scenarios}/${to}.json`), `Target catalogue already published: ${to}`)
  const [first] = group
  assert(group.every(item => item.overlay.source_raw_hash === first.overlay.source_raw_hash), `Mixed RAW hashes: ${to}`)
  const entries = {}
  for (const item of group) {
    for (const [id, value] of Object.entries(item.overlay.entries)) {
      assert(!(id in entries), `Duplicate unit: ${id}`)
      entries[id] = value
    }
    catalogues.push({ from: item.from, from_sha256: item.from_sha256, units: item.units, to })
  }
  writes.push([to, serializeCatalogue({ schema_version: 1, locale: first.overlay.locale, scenario_id: to,
    source_raw_hash: first.overlay.source_raw_hash, entries })])
}

// Reviewed documents whose Reader or compiled source changed; their receipts keep the old hashes.
const documents = []
const reviews = path.join(projectRoot, 'translation/studio/reviews')
const live = new Map(liveEntries.map(entry => [entry.document_id, entry]))
const moved = new Map(catalogues.map(item => [item.from, item.to]))
for (const dir of (await fs.readdir(reviews)).sort()) {
  let batch
  try { batch = JSON.parse(await fs.readFile(path.join(reviews, dir, 'batch-map.json'), 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') continue
    throw error
  }
  for (const doc of batch.documents) {
    const now = live.get(doc.document_id)
    if (!now) continue // retired; covered by translation/studio/retirements
    if (now.sha256 === doc.reader_sha256 && now.source_sha256 === doc.compiled_sha256) continue
    const base = baseEntries.get(doc.document_id)
    assert.equal(base.sha256, doc.reader_sha256, `Receipt Reader evidence drifted before this change: ${doc.document_id}`)
    assert.equal(base.source_sha256, doc.compiled_sha256, `Receipt compiled evidence drifted before this change: ${doc.document_id}`)
    documents.push({ batch: dir, document_id: doc.document_id,
      from: { reader_sha256: doc.reader_sha256, compiled_sha256: doc.compiled_sha256, catalogue: doc.evidence.scenario_id },
      to: { reader_sha256: now.sha256, compiled_sha256: now.source_sha256,
        catalogue: moved.get(doc.evidence.scenario_id) || doc.evidence.scenario_id } })
  }
}

const record = { schema_version: 1, date: '2026-10-21', base_commit: baseCommit,
  reason: 'The story corpus was recompiled from RAW (scripts/recompile-story-corpus-candidate.py). Every Reader text_ref and its source hash is unchanged, so no unit was retranslated. The recompile names the collection text catalogue for every episode, as strict v2 sources already did, so per-part catalogues move into their collection catalogue entry for entry, and reviewed documents move to the new Reader and compiled hashes.',
  catalogues, documents }
if (apply) {
  for (const [to, bytes] of writes) await fs.writeFile(path.join(projectRoot, scenarios, `${to}.json`), bytes, { flag: 'wx' })
  for (const item of catalogues) await fs.rm(path.join(projectRoot, scenarios, `${item.from}.json`))
  await fs.mkdir(path.dirname(path.join(projectRoot, SUPERSESSION_FILE)), { recursive: true })
  await fs.writeFile(path.join(projectRoot, SUPERSESSION_FILE), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' })
}
console.log(JSON.stringify({ base_commit: baseCommit.slice(0, 8), catalogues: catalogues.length, targets: writes.length,
  units: catalogues.reduce((total, item) => total + item.units, 0), documents: documents.length, applied: apply }))
