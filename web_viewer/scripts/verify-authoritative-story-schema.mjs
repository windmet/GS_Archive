import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async relativePath => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
const schema = await readJson('schemas/compiled-scenario-v2-authoritative.schema.json')
const compatibilitySchema = await readJson('schemas/compiled-scenario-v2.schema.json')
const fixture = await readJson('fixtures/story-runtime/authoritative-v2-minimal.json')

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

try {
  const migratedCollection = await readJson('public/data/compiled/episodes/1_4_001_01_a.json')
  assert.equal(
    validate(migratedCollection),
    false,
    'the first text-identity migration must not be mislabeled as authoritative Runtime v2 output',
  )
  assert.ok(
    validate.errors.some(error => error.keyword === 'required' || error.keyword === 'additionalProperties'),
    'mounted migration candidate must retain an explicit compatibility-schema classification',
  )
  console.log('Mounted 1_4_001_01 candidate classified as compatibility input (expected).')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  console.log('Mounted migration candidate classification skipped: 1_4_001_01_a is not present.')
}

console.log('Authoritative story schema: strict output contract and compatibility boundary verified.')
