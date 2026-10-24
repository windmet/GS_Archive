import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  hitEffectsConfig,
  resolveSongNoteHitType,
  resolveNativeHitType,
  lookupSongHitEffectPrefab,
  lookupSongHoldEffectPrefab,
  createSongChartHitEffectPool,
} from '../src/presentation/SongChartHitEffectSelection.js'

const receipt = JSON.parse(readFileSync(new URL('./fixtures/song-hit-effects-wiring.json', import.meta.url)))

// 1. Source parity
for (const key of ['elfSha256', 'metadataSha256', 'dataSha256']) {
  assert.equal(hitEffectsConfig.source[key], receipt.source[key], `Source ${key}`)
}
assert.equal(hitEffectsConfig.sets.length, 4)
assert.equal(Object.keys(hitEffectsConfig.prefabs).length, 51)

// 2. 96 ARM64 ShowHitEffect cases
for (const c of receipt.selection.showHitEffect) {
  const hitType = resolveNativeHitType(c)
  if (c.resuming) {
    assert.equal(hitType, null, 'Resuming suppresses transient hit effect')
  } else {
    assert.equal(hitType, c.selected.hitType, `Native hitType for noteType=${c.noteType}, skill=${c.producerSkill}, special=${c.special}`)
  }
}

// 3. 224 Prefab lookups across 4 sets
for (const lookup of receipt.selection.prefabLookups) {
  const setIndex = hitEffectsConfig.sets.findIndex(s => s.name === lookup.set) + 1
  const result = lookupSongHitEffectPrefab({ setIndex, hitType: lookup.hitType, evaluation: lookup.evaluation })
  const expectedPathId = lookup.pathId === 0 ? null : lookup.pathId
  assert.equal(result ? result.pathId : null, expectedPathId, `Prefab lookup for set=${lookup.set}, hitType=${lookup.hitType}, eval=${lookup.evaluation}`)
}

// 4. Role to hitType mapping & Large Hold tail independence
assert.equal(resolveSongNoteHitType({ role: 'p_skill' }), 5, 'p_skill -> 5')
assert.equal(resolveSongNoteHitType({ role: 'sp' }), 6, 'sp -> 6')
assert.equal(resolveSongNoteHitType({ role: 'swipe_up' }), 1, 'swipe_up -> 1')
assert.equal(resolveSongNoteHitType({ role: 'swipe_right' }), 2, 'swipe_right -> 2')
assert.equal(resolveSongNoteHitType({ role: 'swipe_left' }), 3, 'swipe_left -> 3')
assert.equal(resolveSongNoteHitType({ role: 'normal' }), 0, 'normal -> 0')
assert.equal(resolveSongNoteHitType({ role: 'middle' }), 0, 'middle -> 0')

// Verify LARGE_HOLD head vs tail:
const largeHoldHead = { id: '10-head', role: 'p_skill', endpoint: 'head', lane: 2 }
const largeHoldTail = { id: '10-tail', role: 'normal', endpoint: 'tail', lane: 2 }
assert.equal(resolveSongNoteHitType(largeHoldHead), 5, 'Large hold head has P-skill effect')
assert.equal(resolveSongNoteHitType(largeHoldTail), 0, 'Large hold normal tail must NOT inherit P-skill')

// 5. Multi-event pool lifecycle and lane feedback
const pool = createSongChartHitEffectPool({ setIndex: 1 })

// Simultaneous notes on different lanes at the same instant
const simultaneousGroup = {
  seconds: 1.0,
  events: [
    { id: '1-head', sourceIndex: 1, endpoint: 'head', role: 'normal', lane: 0 },
    { id: '2-head', sourceIndex: 2, endpoint: 'head', role: 'swipe_up', lane: 4 },
  ],
}

const state1 = pool.advance(1.0, [simultaneousGroup])
assert.equal(state1.hits.length, 2, 'Both simultaneous events are independently instantiated')
assert.equal(new Set(state1.hits.map(h => h.instanceId)).size, 2, 'Each instance has unique ID')
assert.equal(state1.laneAlphas[0], 1.0, 'Lane 0 flashed to 1.0')
assert.equal(state1.laneAlphas[4], 1.0, 'Lane 4 flashed to 1.0')
assert.equal(state1.laneAlphas[2], 0, 'Untouched lane remains 0')
assert.equal(state1.autoEval.active, true, 'Auto evaluation badge activated')

// Advance 0.25 seconds (decay: 2.0/s -> 1.0 - 0.25 * 2.0 = 0.5)
const state2 = pool.advance(1.25)
assert.equal(state2.hits.length, 2, 'Hits still alive at 0.25s')
assert.ok(Math.abs(state2.laneAlphas[0] - 0.5) < 1e-4, 'Lane 0 alpha decayed to 0.5')
assert.ok(Math.abs(state2.laneAlphas[4] - 0.5) < 1e-4, 'Lane 4 alpha decayed to 0.5')

// Advance past lane flash lifetime (0.5s) and hit max lifetime (0.7s)
const state3 = pool.advance(1.55)
assert.equal(state3.laneAlphas[0], 0, 'Lane flash decayed to 0')
const state4 = pool.advance(1.75)
assert.equal(state4.hits.length, 0, 'Hits pruned after max lifetime (0.7s)')

// Seek discontinuity clears all transient instances & flashes
pool.advance(2.0, [{ seconds: 2.0, events: [{ id: '3-head', sourceIndex: 3, role: 'sp', lane: 2 }] }])
assert.equal(pool.advance(2.0).hits.length, 1)
const seekState = pool.seek(1.5, [{ sourceIndex: 99, lane: 1.5, age: 0.5, remaining: 1.0 }])
assert.equal(seekState.hits.length, 0, 'Seek clears transient hit effects')
assert.deepEqual(seekState.laneAlphas, [0, 0, 0, 0, 0], 'Seek clears lane flashes')
assert.equal(seekState.holds.length, 1, 'Seek preserves active hold effects')
assert.equal(seekState.holds[0].lane, 1.5, 'Hold effect lane is preserved')

// Hold effect lookup
const holdPrefab = lookupSongHoldEffectPrefab({ setIndex: 1 })
assert.equal(holdPrefab.field, '_hold')
assert.equal(holdPrefab.pathId, 32265)
assert.equal(holdPrefab.name, 'fx_in_touch_circle_hold')
assert.ok(holdPrefab.looping)

console.log('Hit effect selection & pool verified: 96 ARM64 cases, 224 prefab lookups, multi-event lifecycle, lane flash decay, and hold persistence passed.')
