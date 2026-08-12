import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { analyzeStorySoakReport } from './analyze-story-soak-report.mjs'

const load = async name => JSON.parse(await readFile(
  new URL(`../fixtures/story-runtime/${name}`, import.meta.url),
  'utf8',
))

const fixtureOptions = {
  minDurationMs: 90_000,
  minSamples: 4,
  minIntervalSamples: 0,
  minQuietDelayMs: 30_000,
  minViewerCycles: 1,
}

const pass = analyzeStorySoakReport(await load('soak-report-v2-pass.json'), fixtureOptions)
assert.equal(pass.verdict, 'MACHINE_GATE_PASSED_REVIEW_REQUIRED')
assert.equal(pass.evidence.viewer_cycles, 1)
assert.equal(pass.evidence.quiet_endpoint.reason, 'quiet-endpoint')

const leak = analyzeStorySoakReport(await load('soak-report-v2-quiet-leak.json'), fixtureOptions)
assert.equal(leak.verdict, 'MACHINE_GATE_FAILED')
assert(leak.failures.some(message => message.includes('audio_contexts_live')))

const insufficient = analyzeStorySoakReport(
  await load('soak-report-v1-insufficient.json'),
  fixtureOptions,
)
assert.equal(insufficient.verdict, 'INSUFFICIENT_EVIDENCE')
assert(insufficient.insufficient.some(message => message.includes('story-release-soak-v2')))
assert(insufficient.insufficient.some(message => message.includes('quiet-endpoint')))

console.log('Story soak analyzer: v2 pass, quiet leak failure and legacy insufficient evidence verified')
