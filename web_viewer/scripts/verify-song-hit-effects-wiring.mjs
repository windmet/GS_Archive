import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const receipt = JSON.parse(readFileSync(new URL('./fixtures/song-hit-effects-wiring.json', import.meta.url)))
const native = JSON.parse(readFileSync(new URL('../config/song-track-native-effects.v1.json', import.meta.url)))
for (const key of ['elfSha256', 'metadataSha256', 'dataSha256']) assert.equal(receipt.source[key], native.source[key])
assert.equal(receipt.selection.showHitEffect.length, 96)
for (const c of receipt.selection.showHitEffect) {
  const expected = c.resuming ? null : { lane: 2.25,
    hitType: c.producerSkill ? 5 : c.special ? 6 : [0, 0, 3, 1, 2, 0, 0, 0, 0, 0, 0, 7][c.noteType], evaluation: 4 }
  assert.deepEqual(c.selected, expected, 'native ShowHitEffect: resuming suppression, skill precedence, note type mapping')
}
assert.equal(receipt.selection.prefabLookups.length, 224)
assert.equal(receipt.sets.length, 4)
assert.equal(Object.keys(receipt.prefabs).length, 51)
for (const set of receipt.sets) {
  assert.equal(set.refs.length, 24)
  const path = field => set.refs.find(r => r.field === field).pathId
  for (const lookup of receipt.selection.prefabLookups.filter(r => r.set === set.name)) {
    const prefix = ['_touch', '_flickUp', '_flickRight', '_flickLeft', '_touch'][lookup.hitType]
    const suffix = ['Slow', 'Fast', 'Good', 'Great', 'Perfect'][lookup.evaluation - 2]
    const expected = lookup.hitType === 5 ? path('_touchPSkill') : lookup.hitType === 6 ? path('_touchSpecial')
      : prefix && suffix ? path(prefix + suffix) : path('_nullTap')
    assert.equal(lookup.pathId, expected, 'native prefab selection with authored resource references')
  }
  for (const ref of set.refs) if (ref.pathId) assert.ok(receipt.prefabs[String(ref.pathId)])
}
function particles(pathId) {
  return receipt.prefabs[String(pathId)].flatMap(n => n.components.filter(c => c.type === 'ParticleSystem'))
}
assert.equal(particles(14650).length, 9, 'default ordinary PERFECT has nine authored systems')
assert.ok(particles(14650).every(p => !p.looping && p.playOnAwake))
assert.equal(particles(32265).length, 5, 'default hold has five authored systems')
assert.ok(particles(32265).every(p => p.looping))
assert.deepEqual(receipt.sets.map(s => s.useParseCamera), [true, true, false, true])
console.log('Hit-effect wiring receipts: 96 ARM64 ShowHitEffect cases, 224 native prefab lookups, four sets/51 prefabs; nine transient and five continuous default layers verified. No Unity/GPU or Web effect rendering claim.')
