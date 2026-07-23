import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { normalizeScenario } from '../src/core/story-runtime/ScenarioNormalizer.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schema = JSON.parse(await readFile(path.join(root, 'schemas', 'compiled-scenario-v2-authoritative.schema.json'), 'utf8'))
const compatibilityFixture = JSON.parse(await readFile(path.join(root, 'fixtures', 'story-runtime', 'compatibility-v1-authoritative-source.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
ajv.addSchema(schema)

const schemaRef = fragment => ({ $ref: `${schema.$id}#/$defs/${fragment}` })
const validateSnapshot = ajv.compile(schemaRef('snapshot'))
const actionContracts = new Map([
  ['camera.transform', { channel: 'camera', payload: ajv.compile(schemaRef('cameraPayload')) }],
  ['background.change', { channel: 'background', payload: ajv.compile(schemaRef('backgroundPayload')) }],
  ['se.play', { channel: 'se', payload: ajv.compile(schemaRef('sePayload')) }],
  ['screen.directional_wipe', { channel: 'screen', payload: ajv.compile(schemaRef('directionalWipePayload')) }],
  ['screen.fade', { channel: 'screen', payload: ajv.compile(schemaRef('screenFadePayload')) }],
  ['spine.body.play', { channel: /^spine:[^:]+:body$/u, payload: ajv.compile(schemaRef('spineMotionPayload')) }],
  ['spine.face.set', { channel: /^spine:[^:]+:face$/u, payload: ajv.compile(schemaRef('spineExpressionPayload')) }],
  ['spine.neck.play', { channel: /^spine:[^:]+:neck$/u, payload: ajv.compile(schemaRef('spineExpressionPayload')) }],
  ['spine.neck.stop', { channel: /^spine:[^:]+:neck$/u, payload: ajv.compile(schemaRef('spineStopPayload')) }],
  ['spine.visual.tint', { channel: /^spine:[^:]+:visual:tint$/u, payload: ajv.compile(schemaRef('spineTintPayload')) }],
])

function assertChannel(contract, cue, label) {
  const passed = typeof contract.channel === 'string'
    ? cue.channel === contract.channel
    : contract.channel.test(cue.channel)
  assert.equal(passed, true, `${label}: ${cue.action} has invalid channel ${cue.channel}`)
}

function valueCategory(key, value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'string') {
    if (key === 'type') return `string:${value}`
    return value.length ? 'string:nonempty' : 'string:empty'
  }
  if (typeof value === 'number') return value < 0 ? 'number:negative' : 'number:nonnegative'
  return typeof value
}

function shapeSignature(value) {
  return Object.entries(value || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${key}:${valueCategory(key, entry)}`)
    .join('|')
}

function verifyScenario(input, label, totals) {
  const scenario = normalizeScenario(input)
  for (const [stepIndex, step] of scenario.steps.entries()) {
    for (const [snapshotKind, snapshot] of [
      ['entry_snapshot', step.entry_snapshot],
      ['settled_snapshot', step.settled_snapshot],
    ]) {
      totals.snapshots += 1
      const signature = shapeSignature(snapshot)
      if (!totals.snapshotShapes.has(signature)) {
        assert.equal(
          validateSnapshot(snapshot),
          true,
          `${label}: step ${stepIndex + 1} ${snapshotKind}: ${ajv.errorsText(validateSnapshot.errors, { separator: '\n' })}`,
        )
        totals.snapshotShapes.add(signature)
      }
    }
    for (const [cueIndex, cue] of (step.cues || []).entries()) {
      const cueLabel = `${label}: step ${stepIndex + 1} cue ${cueIndex + 1}`
      const contract = actionContracts.get(cue.action)
      assert.ok(contract, `${cueLabel}: unknown action ${cue.action}`)
      assertChannel(contract, cue, cueLabel)
      totals.cues += 1
      totals.actions.add(cue.action)
      const signature = `${cue.action}|${shapeSignature(cue.payload)}`
      if (!totals.payloadShapes.has(signature)) {
        assert.equal(
          contract.payload(cue.payload),
          true,
          `${cueLabel}: ${ajv.errorsText(contract.payload.errors, { separator: '\n' })}`,
        )
        totals.payloadShapes.add(signature)
      }
    }
  }
  totals.scenarios += 1
}

async function collectScenarioFiles(directory, output = []) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return output
    throw error
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectScenarioFiles(absolute, output)
      continue
    }
    if (!entry.name.endsWith('.json')) continue
    if (['manifest.json', 'index.json', 'voice_index.json', 'archive_verification.json'].includes(entry.name)) continue
    output.push(absolute)
  }
  return output
}

const totals = {
  scenarios: 0,
  snapshots: 0,
  cues: 0,
  actions: new Set(),
  snapshotShapes: new Set(),
  payloadShapes: new Set(),
}
verifyScenario(compatibilityFixture, 'tracked compatibility fixture', totals)

const compiledRoot = path.join(root, 'public', 'data', 'compiled')
const mountedFiles = await collectScenarioFiles(compiledRoot)
for (const file of mountedFiles) {
  const input = JSON.parse(await readFile(file, 'utf8'))
  if (!Array.isArray(input.steps)) continue
  verifyScenario(input, path.relative(root, file), totals)
}

console.log('Authoritative Runtime shape verification passed.')
console.log(`  ${totals.scenarios} scenarios, ${totals.snapshots} snapshots, ${totals.cues} cues`)
console.log(`  ${totals.snapshotShapes.size} snapshot shapes, ${totals.payloadShapes.size} action/payload shapes`)
console.log(`  actions: ${[...totals.actions].sort().join(', ')}`)
