import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const compiledRoot = path.join(root, 'public', 'data', 'compiled')
const episodeRoot = path.join(compiledRoot, 'episodes')
const readJson = file => readFile(file, 'utf8').then(JSON.parse)
const sourceText = dialogue => dialogue?.source_text ?? dialogue?.text_jp ?? dialogue?.text ?? ''
const speakerText = dialogue => (
  dialogue?.speaker_source_text
  ?? dialogue?.speaker_identity?.source_name
  ?? dialogue?.speaker
  ?? ''
)
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
    const hasStrictBoundary = Number.isInteger(boundary.start_step_id) && Number.isInteger(boundary.end_step_id)
    const sourceSteps = hasStrictBoundary
      ? aggregate.steps.filter(step => step.step_id >= boundary.start_step_id && step.step_id <= boundary.end_step_id)
      : aggregate.steps.slice(boundary.start_step_index, boundary.end_step_index + 1)
    const expectedStepCount = hasStrictBoundary
      ? boundary.end_step_id - boundary.start_step_id + 1
      : boundary.step_count
    assert.equal(episode.total_steps ?? episode.steps.length, expectedStepCount, `${episodeFile} has the wrong step count`)
    assert.equal(episode.steps.length, sourceSteps.length, `${episodeFile} lost source steps`)
    assert.deepEqual(
      episode.steps.map(step => [step.type, speakerText(step.dialogue), sourceText(step.dialogue), step.dialogue?.voice || '']),
      sourceSteps.map(step => [step.type, speakerText(step.dialogue), sourceText(step.dialogue), step.dialogue?.voice || '']),
      `${episodeFile} changed authored playback content`,
    )
    for (const step of episode.steps) {
      assert.ok(step.step_id >= 1 && step.step_id <= episode.steps.length, `${episodeFile} has an invalid local step id`)
      for (const option of step.options || []) {
        const targetStepId = option.target_step_id ?? option.step_id
        assert.ok(targetStepId >= 1 && targetStepId <= episode.steps.length, `${episodeFile} has a cross-episode choice`)
      }
    }
  }
}

assert.equal(manifest.count, manifest.files.length)
assert.equal(manifest.count, expectedEpisodeCount)
console.log(`Episode artifacts: ${manifest.count} episodes from ${aggregateCount} aggregate scenarios verified`)
