// Source supersessions let review receipts outlive a recompile without rewriting what reviewers saw.
// A catalogue record proves its old file is reproduced byte-for-byte from the catalogue it moved into;
// a document record binds the receipt's Reader/compiled hashes to the live ones.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { projectRoot, sha256 } from './ai-studio-source.mjs'

export const SUPERSESSION_FILE = 'translation/studio/supersessions/2026-10-21-story-recompile.json'
const scenarios = path.join(projectRoot, 'public/translations/zh-CN/scenarios')
export const serializeCatalogue = overlay => `${JSON.stringify(overlay, null, 2)}\n`

export async function loadSourceSupersessions() {
  const record = JSON.parse(await fs.readFile(path.join(projectRoot, SUPERSESSION_FILE), 'utf8'))
  assert.equal(record.schema_version, 1)
  const catalogues = new Map(record.catalogues.map(item => [item.from, item]))
  const documents = new Map(record.documents.map(item => [item.document_id, item]))
  assert.equal(catalogues.size, record.catalogues.length, 'Duplicate superseded catalogue')
  assert.equal(documents.size, record.documents.length, 'Duplicate superseded document')
  return { record, catalogues, documents }
}

// The superseded file is the moved entries of its part under its old header, in their old order.
export async function reconstructCatalogue(item) {
  const target = JSON.parse(await fs.readFile(path.join(scenarios, `${item.to}.json`), 'utf8'))
  const entries = Object.fromEntries(Object.entries(target.entries).filter(([id]) => id.split(':')[3] === item.from))
  return serializeCatalogue({ schema_version: target.schema_version, locale: target.locale, scenario_id: item.from,
    source_raw_hash: target.source_raw_hash, entries })
}

export async function verifyCatalogueSupersessions({ catalogues }) {
  const groups = new Map()
  for (const item of catalogues.values()) {
    await assert.rejects(fs.access(path.join(scenarios, `${item.from}.json`)), `Superseded catalogue is still published: ${item.from}`)
    const bytes = await reconstructCatalogue(item)
    assert.equal(sha256(bytes), item.from_sha256, `Superseded catalogue does not reproduce: ${item.from}`)
    assert.equal(Object.keys(JSON.parse(bytes).entries).length, item.units, `Superseded unit count: ${item.from}`)
    groups.set(item.to, [...(groups.get(item.to) || []), ...Object.keys(JSON.parse(bytes).entries)])
  }
  // The new catalogue holds exactly the moved entries: nothing added, nothing dropped.
  for (const [to, ids] of groups) {
    const target = JSON.parse(await fs.readFile(path.join(scenarios, `${to}.json`), 'utf8'))
    assert.equal(target.scenario_id, to)
    assert.deepEqual(Object.keys(target.entries), ids, `Re-keyed catalogue is not the union of its parts: ${to}`)
  }
  return { catalogues: catalogues.size, targets: groups.size }
}

// Receipt evidence named the old catalogue; the units themselves must be identical.
export const rebindEvidence = (evidence, catalogue) => ({ ...evidence, scenario_id: catalogue,
  text_units: evidence.text_units.map(unit => ({ ...unit, scenario_id: catalogue })) })
