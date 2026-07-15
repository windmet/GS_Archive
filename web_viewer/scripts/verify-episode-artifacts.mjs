import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const compiledRoot = path.join(root, 'public', 'data', 'compiled')
const episodeRoot = path.join(compiledRoot, 'episodes')
const readJson = file => readFile(file, 'utf8').then(JSON.parse)
const manifest = await readJson(path.join(episodeRoot, 'manifest.json'))
const aggregateFiles = (await readdir(compiledRoot)).filter(file => file.endsWith('.json') && !['manifest.json', 'voice_index.json', 'index.json'].includes(file))

let aggregateCount = 0
let expectedEpisodeCount = 0
for (const aggregateFile of aggregateFiles) {
  const aggregate = await readJson(path.join(compiledRoot, aggregateFile))
  if ((aggregate.episodes || []).length < 2) continue
  aggregateCount += 1
  expectedEpisodeCount += aggregate.episodes.length

  for (const boundary of aggregate.episodes) {
    const episodeFile = `${boundary.source_scenario_id}.json`
    assert.ok(manifest.files.includes(episodeFile), `${episodeFile} is absent from the episode manifest`)
    const episode = await readJson(path.join(episodeRoot, episodeFile))
    const sourceSteps = aggregate.steps.slice(boundary.start_step_index, boundary.end_step_index + 1)
    assert.equal(episode.total_steps, boundary.step_count, `${episodeFile} has the wrong step count`)
    assert.equal(episode.steps.length, sourceSteps.length, `${episodeFile} lost source steps`)
    assert.deepEqual(
      episode.steps.map(step => [step.type, step.dialogue?.speaker || '', step.dialogue?.text || '', step.dialogue?.voice || '']),
      sourceSteps.map(step => [step.type, step.dialogue?.speaker || '', step.dialogue?.text || '', step.dialogue?.voice || '']),
      `${episodeFile} changed authored playback content`,
    )
    for (const step of episode.steps) {
      assert.ok(step.step_id >= 1 && step.step_id <= episode.total_steps, `${episodeFile} has an invalid local step id`)
      for (const option of step.options || []) {
        assert.ok(option.step_id >= 1 && option.step_id <= episode.total_steps, `${episodeFile} has a cross-episode choice`)
      }
    }
  }
}

assert.equal(manifest.count, manifest.files.length)
assert.equal(manifest.count, expectedEpisodeCount)
console.log(`Episode artifacts: ${manifest.count} episodes from ${aggregateCount} aggregate scenarios verified`)
