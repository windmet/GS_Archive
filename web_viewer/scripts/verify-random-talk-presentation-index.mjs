import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [mobile, presentation] = await Promise.all([
  readJson('public/data/masterdata/mobile_archive_index.json'),
  readJson('public/data/masterdata/random_talk_presentation_index.json'),
])

assert.equal(presentation.schema_version, 1)
assert.equal(presentation.meta.topic_count, mobile.meta.random_topic_count)
assert.equal(presentation.meta.intro_count, mobile.meta.random_intro_count)
assert.equal(presentation.meta.compiled_file_count, 49)
assert.equal(presentation.meta.missing_label_count, 0)

for (const topic of mobile.random_talk.topics) {
  const entry = presentation.by_topic_id[String(topic.id)]
  assert.ok(entry, `topic ${topic.id} has no presentation entry`)
  assert.equal(entry.script_label, topic.script_label)
  assert.equal(entry.compiled_file, topic.compiled_file)
  assert.ok(entry.start_step > 0, `topic ${topic.id} has an invalid start step`)
  assert.ok(entry.end_step >= entry.start_step, `topic ${topic.id} has an invalid end step`)
  assert.ok(entry.title && entry.title !== entry.script_label, `topic ${topic.id} has no readable title`)

  const scenario = await readJson(`public/data/compiled/${entry.compiled_file}`)
  assert.equal(Number(scenario.jump_points?.[entry.script_label]), entry.start_step,
    `topic ${topic.id} does not start at its authored label`)
  assert.ok(entry.end_step <= Number(scenario.total_steps || scenario.steps.length),
    `topic ${topic.id} ends outside the compiled scenario`)
}

const kirio = [1101701, 1101702, 1101703, 1101704, 1101705]
  .map(id => presentation.by_topic_id[String(id)])
assert.deepEqual(kirio.map(entry => [entry.start_step, entry.end_step]), [
  [2, 7], [8, 12], [13, 17], [18, 22], [23, 27],
])
assert.equal(kirio[0].title, 'ちょうちょさんはいつも きらきらのつやつやぞなもし。')
assert.equal(kirio[2].title.endsWith('（表情）'), true)

console.log(`Random Talk presentation: ${presentation.meta.topic_count} topics and ${presentation.meta.intro_count} intros have exact compiled label ranges`)
