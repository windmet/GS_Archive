// Route schema consistency (report-only: nothing prunes URLs against ROUTE_SCHEMA yet) and the stale player-return guard.
import assert from 'node:assert/strict'
import { ROUTE_SCHEMA, ownedRouteParams } from '../src/core/routeSchema.js'
import { ARCHIVE_ROUTE_CONTRACTS, ROUTE_QUERY_KEYS, VALID_VIEWS, buildArchiveUrl } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'

// Every view is covered; player is covered per audited return view.
for (const view of VALID_VIEWS) assert.ok(ownedRouteParams(view, view === 'player' ? 'files' : ''), `schema covers ${view}`)
for (const key of Object.keys(ROUTE_SCHEMA)) {
  const view = key.startsWith('player:') ? 'player' : key
  assert.ok(VALID_VIEWS.has(view), `schema entry ${key} names a real view`)
}
// Schema parameters are real route keys, listed once per view.
const known = new Set(ROUTE_QUERY_KEYS)
for (const [key, params] of Object.entries(ROUTE_SCHEMA)) {
  assert.equal(new Set(params).size, params.length, `${key} lists a parameter once`)
  for (const param of params) assert.ok(known.has(param), `${key}: ${param} is a route query key`)
  for (const context of ['from', 'portal_from', 'home_from']) assert.ok(!params.includes(context), `${key}: ${context} lives in history state`)
}
// Required route fields are owned by their view.
const QUERY_OF = { pickTarget: 'pick', storyType: 'story_type', storySection: 'story_section', story: 'story', category: 'category',
  group: 'group', unit: 'unit', card: 'card', event: 'event', gasha: 'gasha', song: 'song' }
for (const [view, contract] of Object.entries(ARCHIVE_ROUTE_CONTRACTS)) {
  const owned = ownedRouteParams(view, view === 'player' ? 'files' : '')
  for (const field of contract.required) {
    assert.ok(QUERY_OF[field], `${view}: required field ${field} has a query mapping`)
    assert.ok(owned.includes(QUERY_OF[field]), `${view}: required ${field} is owned by its schema entry`)
  }
}
// A stale player return must not leak into another page's address (it only means something for the player).
{
  const state = useArchiveNavigationState()
  state.returnViewAfterPlayer.value = 'event_detail'
  // Satisfy every view's required fields so no route falls back to another view.
  for (const [key, value] of Object.entries({ currentPickTarget: 'profile', currentCategoryId: 'idol', currentEventId: '10001', currentCardId: 'card1', currentGashaId: 'g1',
    currentSongId: 'song1', currentStoryFile: 'a.json', currentStoryDomain: 'main', currentStorySection: '101', currentArchiveUnitCode: '01jup' })) state[key].value = value
  state.currentGroup.value = { id: 'g' }
  for (const view of VALID_VIEWS) {
    if (view === 'player') continue
    state.view.value = view
    assert.ok(!buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.has('return'), `${view} URL carries no player return`)
  }
  state.view.value = 'player'; state.currentScenarioFile.value = 'a.json'
  assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.get('return'), 'event_detail', 'the player still records its return view')
}
console.log(`Route schema: ${Object.keys(ROUTE_SCHEMA).length} view entries cover all ${VALID_VIEWS.size} views; parameters are route keys; contract requirements are owned; stale player return stays out of other URLs (report-only, no pruning)`)
