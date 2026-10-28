import { readFileSync, readdirSync } from 'node:fs'
import { PUBLIC_ROUTES } from '../src/core/publicRoutes.js'
// Route ownership, public-address enforcement and the stale player-return guard.
import assert from 'node:assert/strict'
import { ENFORCED_ROUTE_VIEWS, ROUTE_SCHEMA, ownedRouteParams } from '../src/core/routeSchema.js'
import { ARCHIVE_ROUTE_CONTRACTS, ROUTE_QUERY_KEYS, VALID_VIEWS, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'

// No public view may bypass the audited parameter ownership table.
for (const route of PUBLIC_ROUTES) assert.ok(ENFORCED_ROUTE_VIEWS.has(route.view), `${route.view}: public address requires enforced schema`)
// Components must use navigation helpers rather than hard-coded query addresses.
function checkComponents(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = new URL(entry.name, directory)
    if (entry.isDirectory()) checkComponents(new URL(entry.name + '/', directory))
    else if (/\.(vue|[cm]?js|tsx?)$/.test(entry.name)) assert.ok(!readFileSync(file, 'utf8').includes('?view='), `${file.pathname}: use public route/navigation helpers`)
  }
}
checkComponents(new URL('../src/components/', import.meta.url))

// Every view is covered; player is covered per audited return view.
for (const view of VALID_VIEWS) assert.ok(ownedRouteParams(view, ''), `schema covers ${view}`)
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
  unit: 'unit', card: 'card', event: 'event', gasha: 'gasha', song: 'song' }
for (const [view, contract] of Object.entries(ARCHIVE_ROUTE_CONTRACTS)) {
  const owned = ownedRouteParams(view, '')
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
    for (const route of PUBLIC_ROUTES.filter(route => route.kind === 'section' && route.view === view)) for (const key of Object.keys(route.implied)) owned.add(key)
    const read = readArchiveRoute(stale(view, { category: 'idol', story_type: 'main', pick: 'profile', collection_kind: 'items', from: '?view=story_catalog' }))
    assert.equal(read.view, view === 'idols' ? 'idol_detail' : view, `${view}: an old URL with extras still opens the page`)
    const written = buildArchiveUrl('http://localhost/', read)
    const writtenOwned = read.view === 'idol_detail' ? new Set(ownedRouteParams(read.view)) : owned
    const keys = [...new Set([...written.searchParams.keys()])].filter(key => key !== 'view' && key !== 'from')
    assert.deepEqual(keys.filter(key => !writtenOwned.has(key)), [], `${view}: no non-owned parameter is written`)
    const state = useArchiveNavigationState(); state.view.value = view; state.currentCardId.value = 'card1'; state.currentEventId.value = '10001'; state.currentGashaId.value = '210003'
    state.currentStoryDomain.value = 'main'; state.currentStorySection.value = '101'; state.filterQuery.value = 'q'; state.currentCharacterId.value = '001tom'; state.currentSongId.value = 'song1'
    const emitted = buildArchiveUrl('http://localhost/', state.currentArchiveRoute())
    const emittedOwned = emitted.searchParams.get('view') === 'idol_detail' ? new Set(ownedRouteParams('idol_detail')) : owned
    assert.deepEqual([...emitted.searchParams.keys()].filter(key => key !== 'view' && !emittedOwned.has(key)), [], `${view}: dirty state writes only the view and its own parameters`)
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
    state.currentCardId.value = '001tom_ssr01'; state.currentEventId.value = '10011'; state.view.value = 'card_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=card_detail&card=001tom_ssr01')
    const oldCard = readArchiveRoute('http://localhost/?view=card_detail&category=cards&idol=001tom&card=001tom_ssr01&event=10011&q=q', { history: false })
    assert.equal(oldCard.view, 'card_detail'); assert.equal(oldCard.card, '001tom_ssr01')
    assert.equal(buildArchiveUrl('http://localhost/', oldCard).search, '?view=card_detail&card=001tom_ssr01', 'an old card link is shortened on write')
    state.currentSongId.value = 'brndnf'; state.currentSongScope.value = 'unit'; state.songParentView.value = 'unit_detail'; state.view.value = 'song_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=song_detail&song=brndnf')
    const oldSong = readArchiveRoute('http://localhost/?view=song_detail&song=brndnf&song_scope=unit&parent=unit_detail&unit=01jup&idol=001tom', { history: false })
    assert.equal(oldSong.view, 'song_detail'); assert.equal(oldSong.song, 'brndnf')
    assert.equal(buildArchiveUrl('http://localhost/', oldSong).search, '?view=song_detail&song=brndnf', 'an old song link is shortened on write')
    // An event keeps only its opened-from fields (moved to history state on write), never list filters.
    state.currentEventId.value = '410018'; state.eventParentView.value = 'card_detail'; state.currentCardId.value = '001tom_ssr01'; state.view.value = 'event_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=event_detail&category=idol&idol=001tom&card=001tom_ssr01&event=410018&parent=card_detail')
    const oldEvent = readArchiveRoute('http://localhost/?view=event_detail&event=410018&q=x&story_type=event&rarity=SSR&parent=card_detail&card=001tom_ssr01', { history: false })
    assert.equal(buildArchiveUrl('http://localhost/', oldEvent).search, '?view=event_detail&card=001tom_ssr01&event=410018&parent=card_detail', 'an old event link drops its list filters on write')
    const old = readArchiveRoute('http://localhost/?view=idol_detail&idol=001tom&unit_filter=1&q=x&card=c&story_type=main', { history: false })
    assert.equal(old.view, 'idol_detail'); assert.equal(old.idol, '001tom')
    assert.equal(buildArchiveUrl('http://localhost/', old).search, '?view=idol_detail&category=idol&idol=001tom', 'an old idol link is shortened on write')
    // 其他语音 keeps its shelf (?voices=) and nothing else; another view never carries it.
    state.currentVoiceShelf.value = 'live-result'; state.view.value = 'unused_archive'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=unused_archive&voices=live-result')
    assert.equal(readArchiveRoute('http://localhost/unused/?voices=live-result&q=x', { history: false }).voiceShelf, 'live-result')
    state.view.value = 'cards'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.has('voices'), false)
    // 配乐 likewise keeps only its shelf (?sound=).
    state.currentSoundShelf.value = 'se'; state.view.value = 'score_archive'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=score_archive&sound=se')
    assert.equal(readArchiveRoute('http://localhost/scores/?sound=se&q=x', { history: false }).soundShelf, 'se')
    state.view.value = 'cards'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.has('sound'), false)
  }
  // A story directory keeps its audited story filter.
  assert.ok(buildArchiveUrl('http://localhost/', { view: 'story_catalog', storyType: 'main', query: 'x' }).searchParams.has('story_type'))
  // An event_detail without an event falls back to the catalog without throwing.
  assert.doesNotThrow(() => buildArchiveUrl('http://localhost/', { view: 'event_detail' }))
}
console.log(`Route schema: ${Object.keys(ROUTE_SCHEMA).length} view entries cover all ${VALID_VIEWS.size} views; parameters are route keys; contract requirements are owned; stale player return stays out of other URLs ; enforced views are pruned`)
