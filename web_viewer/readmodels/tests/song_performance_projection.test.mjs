import test from 'node:test'
import assert from 'node:assert/strict'
import { projectSongPerformance } from '../lib/projections.mjs'

test('song directories preserve confirmed performer identities without expanding detail payloads', () => {
  const row = projectSongPerformance({ performance_mapping: {
    performer_scope: 'fixed_unit', confirmed_unit: { unit_name: 'Jupiter' },
  } }, { performers: [
    { id: '001tou', displayName: '天ヶ瀬冬馬', profile: { large: 'detail-only' }, imageUrl: '/portrait' },
    { id: '003hok', displayName: '伊集院北斗' },
  ] })
  assert.deepEqual(row, { scope: 'fixed_unit', unitName: 'Jupiter', performers: [
    { id: '001tou', displayName: '天ヶ瀬冬馬' }, { id: '003hok', displayName: '伊集院北斗' },
  ] })
})

test('free formations and unknown special performers do not acquire a guessed singer or unit', () => {
  for (const scope of ['configurable_formation', 'unspecified_special', 'fixed_special_lineup']) {
    assert.deepEqual(projectSongPerformance({ performance_mapping: { performer_scope: scope } }, null),
      { scope, unitName: '', performers: [] })
  }
  assert.deepEqual(projectSongPerformance({}, undefined), { scope: '', unitName: '', performers: [] })
})
