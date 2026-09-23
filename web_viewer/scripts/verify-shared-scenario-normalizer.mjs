import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as shared from '../shared/story/ScenarioNormalizer.js'
import * as runtime from '../src/core/story-runtime/ScenarioNormalizer.js'
import { compileAuthoritativeScenario } from './lib/authoritative-scenario-compiler.mjs'

const source = await readFile(new URL('../shared/story/ScenarioNormalizer.js', import.meta.url), 'utf8')
// An isolated URL has no repository-relative resolution context. Shared normalization
// must remain usable without the frontend tree or any framework installed.
const isolated = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
assert.equal(runtime.normalizeScenario, shared.normalizeScenario)
assert.equal(runtime.normalizeLegacyScenario, shared.normalizeLegacyScenario)
assert.deepEqual(Object.keys(isolated), Object.keys(shared))
assert.doesNotMatch(source, /\b(?:window|document|localStorage|AudioContext)\b/)

for (const name of ['legacy-passion-step', 'compatibility-v1-authoritative-source', 'authoritative-v2-minimal']) {
  const input = JSON.parse(await readFile(new URL(`../fixtures/story-runtime/${name}.json`, import.meta.url), 'utf8'))
  const before = structuredClone(input)
  const result = isolated.normalizeScenario(input)
  assert.deepEqual(result, shared.normalizeScenario(input))
  assert.deepEqual(input, before)
  result.steps.length = 0
  assert.deepEqual(input, before, 'normalized output must not own the source steps array')
}
assert.throws(() => isolated.normalizeScenario({ schema_version: 99, steps: [] }), RangeError)
assert.throws(() => isolated.normalizeScenario({ schema_version: 2 }), TypeError)
assert.throws(() => isolated.normalizeLegacyScenario({}), TypeError)

const compiler = await readFile(new URL('./lib/authoritative-scenario-compiler.mjs', import.meta.url), 'utf8')
assert.doesNotMatch(compiler, /from\s+['"][^'"]*\/src\//)
assert.match(compiler, /from ['"]\.\.\/\.\.\/shared\/story\/ScenarioNormalizer\.js['"]/)
const compatibility = JSON.parse(await readFile(new URL('../fixtures/story-runtime/compatibility-v1-authoritative-source.json', import.meta.url), 'utf8'))
const artifact = compileAuthoritativeScenario(compatibility)
assert.equal(artifact.schema_version, 2)
assert.equal(artifact.steps.length, compatibility.steps.length)
console.log('Shared normalizer: isolated import, runtime identity, unchanged input, schema errors and compiler dependency boundary passed')
