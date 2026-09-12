import assert from 'node:assert/strict'
import { discoverReadingSources, READING_SOURCE_FILE } from '../shared/reading/ReadingCatalog.js'

const parents = [
  { file: 'unit.json', domain: 'unit_story', exists: true, resourceIds: ['part', 'missing'] },
  { file: 'birthday.json', domain: 'birthday', exists: true, resourceIds: ['birthday'] },
  { file: 'strict.json', domain: 'main', exists: true, resourceIds: ['strict'] },
]
const data = {
  'unit.json': { episodes: [{ source_scenario_id: 'part' }, { source_scenario_id: 'missing' }] },
  'episodes/part.json': { scenario_id: 'part', aggregate_source: { file: 'unit.json' } },
  'birthday.json': { scenario_id: 'birthday', steps: [] },
  'strict.json': { schema_version: 2, scenario_id: 'strict', steps: [] },
  'orphan.json': { scenario_id: 'orphan' },
}
const calls = []
const run = (publications = []) => discoverReadingSources({ catalog: { entries: parents }, publications,
  readCompiled: async file => {
    calls.push(file)
    if (!data[file]) throw Object.assign(Error('missing'), { code: 'ENOENT' })
    return { data: data[file] }
  } })
const result = await run()
assert.deepEqual(result.candidates.map(c => c.file), ['birthday.json', 'episodes/part.json'])
assert.equal(result.candidates[1].parent_file, 'unit.json')
assert.ok(!calls.includes('orphan.json'), 'unpublished files are not discovered')
assert.deepEqual(result.excluded.map(e => e.reason), ['source-read:ENOENT', 'strict-source-not-in-publication-registry'])
assert.equal((await run([{ logical_id: 'strict:published', ownership: 'native', artifacts: [{ path: 'public/data/compiled/strict.json' }] }])).candidates.length, 3)
data['episodes/part.json'].aggregate_source.file = 'wrong.json'
assert.ok((await run()).excluded.some(e => e.reason === 'episode-aggregate-identity-mismatch'))
for (const file of ['../secret.json', 'episodes/../secret.json', '/root.json', 'a/b.json']) assert.ok(!READING_SOURCE_FILE.test(file))
parents[0].file = '../secret.json'
await assert.rejects(run(), /Invalid catalog source/)
console.log('Reading catalog verified: published boundaries, whole files, strict registry, missing sources and path safety')
