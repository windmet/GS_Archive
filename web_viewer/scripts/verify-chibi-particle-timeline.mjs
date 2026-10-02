import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { attachChibiParticleLayers, sampleChibiParticle, sampleParticleCurve } from '../src/core/chibiParticleTimeline.js'
import { loadChibiParticleLayer } from '../src/utils/chibiParticleLayers.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

// Tangents must influence the interpolated value, not become a linear shortcut.
const curve = { mode: 1, scalar: 0.5, keys: [
  { time: 0, value: 0, inSlope: 0, outSlope: 2 },
  { time: 1, value: 1, inSlope: 0, outSlope: 0 },
] }
assert.equal(sampleParticleCurve(curve, 0.5), 0.375)
assert.equal(sampleParticleCurve(curve, -1), 0)
assert.equal(sampleParticleCurve(curve, 2), 0.5)
const system = { delay: 0, duration: 0.98, lifetime: 0.7, columns: 4, rows: 4,
  startFrame: 0.25, frameOverTime: { mode: 0, scalar: 0, keys: [] } }
assert.deepEqual(sampleChibiParticle(system, 100, 0), { visible: true, frame: 4 })
assert.equal(sampleChibiParticle(system, 800, 0).visible, false)
assert.equal(sampleChibiParticle(system, 990, 0).visible, true)
assert.equal(sampleChibiParticle(system, 500, 600).visible, false)
assert.deepEqual(sampleChibiParticle(system, 25500, 25500), sampleChibiParticle(system, 0, 0))
// Seeking uses no random/ticker accumulator and reproduces exactly the same frame.
const beforeSeek = sampleChibiParticle({ ...system, frameOverTime: curve }, 375, 0)
sampleChibiParticle({ ...system, frameOverTime: curve }, 100000, 0)
assert.deepEqual(sampleChibiParticle({ ...system, frameOverTime: curve }, 375, 0), beforeSeek)

const json = path => JSON.parse(readFileSync(new URL(`../public/assets/live-chibi/${path}`, import.meta.url), 'utf8'))
const fixture = JSON.parse(readFileSync(new URL('./fixtures/chibi-particle-window-v1.json', import.meta.url), 'utf8'))
const published = process.argv.includes('--published-assets')
const pilot = published ? json('particle-layers/index.json') : fixture
if (published) assert.deepEqual(pilot, fixture, 'Regenerated RAW profile must match reviewed source fixture')
const objects = published ? json('object-layers/index.json') : { stats: { particles: 9 }, assets: {
  ...Object.fromEntries(Object.entries(pilot.assets).map(([name, entry]) => [name,
    { kind: 'particle', bundle: entry.bundle, particleCount: entry.particleCount }])),
  fx_in_drvalv_panel: { kind: 'particle', bundle: 'song_drvalv.unity3d', particleCount: 2 },
} }
const merged = attachChibiParticleLayers(objects, pilot)
const names = Object.keys(pilot.assets)
assert.equal(names.length, 2)
assert.equal(names.flatMap(name => pilot.assets[name].systems).length, 9)
for (const name of names) {
  assert.equal(merged.assets[name].kind, 'particle')
  assert.ok(merged.assets[name].particleAnimation)
}
assert.equal(merged.assets.fx_in_drvalv_panel, objects.assets.fx_in_drvalv_panel)
assert.deepEqual(merged.stats, objects.stats)
const coverage = buildStageVfxCoverage({ id: 'pilot', objectLayerEvents: names.map(asset => ({ asset })) }, { objectLayers: merged })
assert.equal(coverage.objectParticlePilots.length, 2)
assert.equal(coverage.objectParticleUnimplemented.length, 0)
assert.equal(coverage.status, 'partial', 'Pilot is never full Unity visual acceptance')
assert.equal(attachChibiParticleLayers(objects, null), objects)
for (const change of [entry => { entry.profile = 'unknown' }, entry => { entry.bundle = 'other.unity3d' },
  entry => { entry.systems[0].lifetime = Infinity }, entry => { entry.particleCount += 1 },
  entry => { entry.systems[0].source.serializedFile = 'wrong-CAB' },
  entry => { entry.systems[0].shader.name = 'unsupported-mask' },
  entry => { entry.systems[0].frameOverTime.keys = [] }]) {
  const altered = structuredClone(pilot)
  change(altered.assets[names[0]])
  assert.equal(attachChibiParticleLayers(objects, altered).assets[names[0]], objects.assets[names[0]])
}
// A later failed sibling load must release every successful texture.
let destroyed = 0
await assert.rejects(loadChibiParticleLayer({ systems: [{ texture: 'a' }, { texture: 'b' }],
  textures: { a: { file: 'ok' }, b: { file: 'broken' } } }, async path => {
  if (path === 'broken') throw new Error('missing texture')
  return { destroy(base) { assert.equal(base, true); destroyed++ } }
}), /missing texture/)
assert.equal(destroyed, 1)
console.log('Particle timeline: curve tangents, lifetime gaps, seeks, source/profile rejection and failed-load cleanup passed; 2 objects / 9 RAW systems')
