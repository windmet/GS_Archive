import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = path.join(process.cwd(), 'public', 'data', 'masterdata', 'work_story_index.json')
const data = JSON.parse(fs.readFileSync(source, 'utf8'))

assert.equal(data.schema_version, 1)
assert.equal(data.meta.idol_count, 49)
assert.equal(data.meta.scene_line_count, 441)
assert.equal(data.meta.short_story_count, 196)
assert.equal(data.meta.compiled_resource_count, 637)
assert.equal(data.meta.missing_resource_count, 0)
const reading = JSON.parse(fs.readFileSync('public/data/reading/manifest.json', 'utf8')).entries
const workReading = new Map(reading.filter(entry => entry.domain === 'work' && entry.status === 'ready').map(entry => [entry.source_file, entry]))
const reachable = new Set()

for (const idol of data.idols) {
  assert.equal(idol.scene_lines.length, 9, `${idol.idol_code} must have nine scene lines`)
  assert.equal(idol.short_stories.length, 4, `${idol.idol_code} must have four short stories`)
  for (const item of [...idol.short_stories, ...idol.scene_lines]) {
    assert.ok(workReading.has(item.compiled_file), `work reading ${item.compiled_file}`)
    reachable.add(item.compiled_file)
  }
}
assert.deepEqual(reachable, new Set(workReading.keys()), 'all ready work documents have natural page entries')

const touma = data.by_idol_code['001tom']
assert.ok(touma)
assert.deepEqual(
  touma.short_stories.map(entry => entry.title),
  [
    '大衆向けアニメのお仕事',
    '古典劇の舞台に出演するお仕事',
    'チョコレート系菓子のCMのお仕事',
    'スポーツニュース番組のレポーターのお仕事',
  ],
)

console.log('Work story index verified: 49 idols, 441 scene lines, 196 short stories, 0 missing resources.')
