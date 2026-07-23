import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  compareAuthoritativeRuntimeProjection,
  compileAuthoritativeScenario,
} from './lib/authoritative-scenario-compiler.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async relativePath => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
const schema = await readJson('schemas/compiled-scenario-v2-authoritative.schema.json')
const compatibilitySchema = await readJson('schemas/compiled-scenario-v2.schema.json')
const fixture = await readJson('fixtures/story-runtime/authoritative-v2-minimal.json')
const compatibilityFixture = await readJson('fixtures/story-runtime/compatibility-v1-authoritative-source.json')

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validate = ajv.compile(schema)
const clone = value => JSON.parse(JSON.stringify(value))

assert.equal(validate(fixture), true, ajv.errorsText(validate.errors, { separator: '\n' }))
assert.equal(schema.additionalProperties, false)
assert.equal(schema.$defs.step.additionalProperties, false)
assert.equal(schema.$defs.dialogue.additionalProperties, false)
assert.equal(schema.$defs.choiceOption.additionalProperties, false)
assert.equal(schema.$defs.flow.additionalProperties, false)
assert.equal(schema.properties.runtime_contract.const, 'story-runtime-v2')

function rejects(mutator, expectedPath) {
  const candidate = clone(fixture)
  mutator(candidate)
  assert.equal(validate(candidate), false, `authoritative schema unexpectedly accepted ${expectedPath}`)
  assert.ok(
    validate.errors.some(error => error.instancePath === expectedPath || error.instancePath.startsWith(`${expectedPath}/`)),
    `expected validation error at ${expectedPath}, got ${ajv.errorsText(validate.errors)}`,
  )
}

rejects(value => { value.runtime_contract = 'story-runtime-v2-compat' }, '/runtime_contract')
rejects(value => { value.total_steps = 1 }, '')
rejects(value => { value.steps[0].state = {} }, '/steps/0')
rejects(value => { value.steps[0].timeline = [] }, '/steps/0')
rejects(value => { value.steps[0].dialogue.text_jp = value.steps[0].dialogue.source_text }, '/steps/0/dialogue')
rejects(value => { value.steps[0].dialogue.text_cn = '' }, '/steps/0/dialogue')
rejects(value => { delete value.steps[0].dialogue.text_ref }, '/steps/0/dialogue')

assert.equal(compatibilitySchema.additionalProperties, true, 'compatibility input schema must remain permissive during corpus migration')
assert.equal(compatibilitySchema.$defs.dialogue.additionalProperties, true)
assert.match(compatibilitySchema.$comment, /authoritative/i)

async function verifyPythonParity(input, label) {
  const compilerVersion = 'python-js-parity-v1'
  const expected = compileAuthoritativeScenario(input, { compilerVersion })
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'sidem-python-authoritative-'))
  const inputPath = path.join(temporaryDirectory, 'compatibility.json')
  const outputPath = path.join(temporaryDirectory, 'authoritative.json')
  try {
    await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
    const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
    const result = spawnSync(python, [
      path.join(root, 'scripts', 'compile-authoritative-story-candidate.py'),
      '--input', inputPath,
      '--output', outputPath,
      '--compiler-version', compilerVersion,
    ], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, `${label}: Python compiler failed\n${result.stdout}\n${result.stderr}`)
    const actual = JSON.parse(await readFile(outputPath, 'utf8'))
    assert.deepEqual(actual, expected, `${label}: Python and JavaScript authoritative projections diverged`)
    assert.equal(validate(actual), true, `${label}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

await verifyPythonParity(compatibilityFixture, 'tracked compatibility fixture')

try {
  const episodeDirectory = path.join(root, 'public', 'data', 'compiled', 'episodes')
  const episodeFiles = (await readdir(episodeDirectory))
    .filter(file => /^1_4_001_01_[a-j]\.json$/u.test(file))
    .sort()
  assert.equal(episodeFiles.length, 10, 'mounted 1_4_001_01 must contain the complete a-j collection')
  const mountedFiles = [
    'public/data/compiled/1_4_001_01.json',
    ...episodeFiles.map(file => `public/data/compiled/episodes/${file}`),
  ]
  let mountedSteps = 0
  let mountedContract = null
  for (const mountedFile of mountedFiles) {
    const mountedCollection = await readJson(mountedFile)
    const isAuthoritative = validate(mountedCollection)
    const contract = isAuthoritative ? 'authoritative' : 'compatibility'
    mountedContract ??= contract
    assert.equal(
      contract,
      mountedContract,
      `mounted 1_4_001_01 mixes ${mountedContract} and ${contract} files at ${mountedFile}`,
    )

    let authoritativeCandidate = mountedCollection
    if (!isAuthoritative) {
      assert.ok(
        validate.errors.some(error => error.keyword === 'required' || error.keyword === 'additionalProperties'),
        `${mountedFile} must retain an explicit compatibility-schema classification`,
      )
      authoritativeCandidate = compileAuthoritativeScenario(mountedCollection, {
        compilerVersion: 'verification-candidate-1',
      })
      assert.equal(
        validate(authoritativeCandidate),
        true,
        `${mountedFile}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`,
      )
      assert.deepEqual(compareAuthoritativeRuntimeProjection(mountedCollection, authoritativeCandidate), {
        passed: true,
        differences: [],
      })
      await verifyPythonParity(mountedCollection, mountedFile)
    }

    assert.equal(authoritativeCandidate.steps.some(step => 'state' in step || 'timeline' in step), false)
    assert.equal(authoritativeCandidate.steps.some(step => (
      'text' in (step.dialogue || {}) || 'text_jp' in (step.dialogue || {}) || 'text_cn' in (step.dialogue || {})
    )), false)
    mountedSteps += authoritativeCandidate.steps.length
  }
  console.log(
    mountedContract === 'authoritative'
      ? `Mounted 1_4_001_01 aggregate and a-j are authoritative Runtime v2 (${mountedSteps} manifest steps).`
      : `Mounted 1_4_001_01 aggregate and a-j compiled to strict, runtime/text-equivalent candidates (${mountedSteps} manifest steps).`,
  )
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  console.log('Mounted migration candidate classification skipped: 1_4_001_01_a is not present.')
}

console.log('Authoritative story schema: strict output contract and compatibility boundary verified.')
