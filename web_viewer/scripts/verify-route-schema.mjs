// Route schema consistency (report-only: nothing prunes URLs against ROUTE_SCHEMA yet) and the stale player-return guard.
import assert from 'node:assert/strict'
import { ENFORCED_ROUTE_VIEWS, ROUTE_SCHEMA, ownedRouteParams } from '../src/core/routeSchema.js'
import { ARCHIVE_ROUTE_CONTRACTS, ROUTE_QUERY_KEYS, VALID_VIEWS, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
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
// Enforced views serialize only their own parameters (plus context); older URLs with extras still read and are shortened on write.
{
  assert.ok([...ENFORCED_ROUTE_VIEWS].every(view => VALID_VIEWS.has(view)))
  const stale = (view, extra = {}) => {
    const url = new URL('http://localhost/'); for (const key of ROUTE_QUERY_KEYS.filter(key => key !== 'scenario')) url.searchParams.set(key, extra[key] ?? `${key}-x`)
    url.searchParams.set('view', view); return url
  }
  for (const view of ENFORCED_ROUTE_VIEWS) {
    const owned = new Set(ownedRouteParams(view))
    const read = readArchiveRoute(stale(view, { category: 'idol', story_type: 'main', pick: 'profile', collection_kind: 'items', from: '?view=story_catalog' }))
    assert.equal(read.view, view, `${view}: an old URL with extras still opens the page`)
    const written = buildArchiveUrl('http://localhost/', read)
    const keys = [...new Set([...written.searchParams.keys()])].filter(key => key !== 'view' && key !== 'from')
    assert.deepEqual(keys.filter(key => !owned.has(key)), [], `${view}: no non-owned parameter is written`)
    const state = useArchiveNavigationState(); state.view.value = view; state.currentCardId.value = 'card1'; state.currentEventId.value = '10001'
    state.currentStoryDomain.value = 'main'; state.filterQuery.value = 'q'; state.currentCharacterId.value = '001tom'
    const emitted = buildArchiveUrl('http://localhost/', state.currentArchiveRoute())
    assert.deepEqual([...emitted.searchParams.keys()].filter(key => key !== 'view' && !owned.has(key)), [], `${view}: dirty state writes only the view and its own parameters`)
  }
  // The source context a page returns through is not pruned (it moves to history state on write).
  assert.equal(buildArchiveUrl('http://localhost/', { view: 'about', sourceRoute: '?view=cards' }).searchParams.get('from')?.startsWith('?view=cards'), true)
  // Detail pages keep exactly their identity, whatever list filters were left in state.
  {
    const state = useArchiveNavigationState(); state.currentCharacterId.value = '001tom'; state.currentCategoryId.value = 'idol'
    state.currentIdolUnitFilter.value = '1'; state.filterQuery.value = 'q'; state.currentCardId.value = 'card1'; state.currentStoryDomain.value = 'main'
    state.view.value = 'idol_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=idol_detail&category=idol&idol=001tom')
    state.currentArchiveUnitCode.value = '01jup'; state.view.value = 'unit_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=unit_detail&unit=01jup')
    const old = readArchiveRoute('http://localhost/?view=idol_detail&idol=001tom&unit_filter=1&q=x&card=c&story_type=main', { history: false })
    assert.equal(old.view, 'idol_detail'); assert.equal(old.idol, '001tom')
    assert.equal(buildArchiveUrl('http://localhost/', old).search, '?view=idol_detail&category=idol&idol=001tom', 'an old idol link is shortened on write')
  }
  // A view outside the enforced set is unchanged by pruning.
  assert.ok(buildArchiveUrl('http://localhost/', { view: 'story_catalog', storyType: 'main', query: 'x' }).searchParams.has('story_type'))
  // An event_detail without an event falls back to the catalog without throwing.
  assert.doesNotThrow(() => buildArchiveUrl('http://localhost/', { view: 'event_detail' }))
}
console.log(`Route schema: ${Object.keys(ROUTE_SCHEMA).length} view entries cover all ${VALID_VIEWS.size} views; parameters are route keys; contract requirements are owned; stale player return stays out of other URLs ; enforced views are pruned`)
