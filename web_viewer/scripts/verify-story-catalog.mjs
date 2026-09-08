import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog as legacy } from '../fixtures/story-catalog/legacy-catalog-v0.mjs'
import { buildStoryCatalog, validateStoryCatalog } from '../src/data/storyCatalog.js'

const masterPath = fileURLToPath(new URL('../public/data/masterdata/story_master_index.json', import.meta.url))
const pipeline = fileURLToPath(new URL('../../data_pipeline/story_catalog.py', import.meta.url))
const read = name => JSON.parse(readFileSync(new URL(`../public/data/masterdata/${name}.json`, import.meta.url), 'utf8'))
const master = read('story_master_index'), presentation = read('story_presentation_index')
const generated = JSON.parse(execFileSync('python', [pipeline, '--input', masterPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }))
const artifact = read('story_catalog')
assert.deepEqual(artifact, generated, 'committed catalog must match the production pipeline')
for (const overlay of [null, presentation]) {
  const expected = legacy(master, overlay)
  const actual = buildStoryCatalog(generated, overlay)
  assert.equal(actual.length, expected.length)
  for (const [index, entry] of expected.entries()) {
    assert.deepEqual(actual[index], entry, `catalog property/order parity: ${entry.id}`)
  }
}
assert.throws(() => validateStoryCatalog(master), /named v1/)
for (const mutate of [
  value => { value.schema_version = 2 },
  value => { value.entries.push(value.entries[0]) },
  value => { value.entries[0].file = null },
  value => { value.entries[0].resourceIds = 'invalid' },
]) {
  const bad = structuredClone(generated); mutate(bad)
  assert.throws(() => validateStoryCatalog(bad))
}
console.log(`Story catalog: ${artifact.entries.length} entries, all-property parity with and without presentation; source digest and invalid contracts verified`)

const fixturePath = fileURLToPath(new URL('../fixtures/story-catalog/edge-cases.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const edge = JSON.parse(execFileSync('python', [pipeline, '--input', fixturePath], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }))
const overlay = { by_file: { 'shared.json': { preplay_synopsis: { title: 'Overlay', text: 'Search overlay' }, playable_step_count: 0, playable_start_index: 3 } } }
const edgeActual = buildStoryCatalog(edge, overlay)
assert.deepEqual(edgeActual, legacy(fixture, overlay))
assert.equal(edgeActual.find(entry => entry.file === 'shared.json').exists, false)
assert.ok(edgeActual.some(entry => entry.id === 'missing:main:missing'))
console.log('Story catalog edge cases: duplicates, cross-domain aliases, missing parents/files, late summaries, numeric titles and resource-like dates passed')
