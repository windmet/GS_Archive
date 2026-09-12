import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { buildArchiveSourceQuery, readArchiveSourceRoute, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'

const roundTrip = route => readArchiveRoute(buildArchiveUrl('http://localhost/', route))
const source = route => readArchiveSourceRoute(roundTrip(route).sourceRoute)
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const state = useArchiveNavigationState()
const card = { resource_id: '002sht_sr01', character_id: '002sht', card_id: 42 }
const unit = { unit_code: '01jup', unit_id: 1 }
const context = vm.createContext({
  ...state, buildArchiveSourceQuery,
  songCatalogData: { value: { songs: { brndnf: {} } } },
  idolUnitData: { value: { units: [unit], by_idol_code: { '002sht': {}, '003hok': {} } } },
  cardMap: { value: new Map([[card.resource_id, card]]) },
  cardIndexData: { value: { cards: [card] } },
  currentArchiveUnit: { value: unit },
  normalizedPrimaryIdol: code => code,
  commitView: view => { state.view.value = view },
})
const handlers = ['captureDetailSource', 'openSong', 'openSongIdol', 'openSongUnit',
  'openPrimaryIdol', 'openArchiveUnit', 'openUnitMember', 'openUnitCards', 'openIdolDomain',
  'openEventIdol', 'openEventUnit', 'openGasha', 'openGashaCard', 'openEventCard',
  'openMobileCard', 'openStoryIdol', 'openRelatedCard', 'openEventDetail']
for (const name of handlers) {
  const code = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(code, name)
  vm.runInContext(code, context)
}
const fixtures = [
  ['song_detail', 'openSongIdol', '002sht', 'idol_detail'],
  ['song_detail', 'openSongUnit', '01jup', 'unit_detail'],
  ['idol_detail', 'openSong', 'brndnf', 'song_detail'],
  ['unit_detail', 'openSong', 'brndnf', 'song_detail'],
  ['unit_detail', 'openUnitMember', { idol_code: '002sht' }, 'idol_detail'],
  ['unit_detail', 'openUnitCards', undefined, 'idols'],
  ['idol_detail', 'openIdolDomain', 'cards', 'cards'],
  ['event_detail', 'openEventIdol', { idol_code: '002sht' }, 'idol_detail'],
  ['event_detail', 'openEventUnit', unit, 'unit_detail'],
  ['card_detail', 'openGasha', { id: '1300011' }, 'gasha_detail'],
  ['gasha_detail', 'openGashaCard', { card_resource_id: card.resource_id }, 'card_detail'],
  ['event_detail', 'openEventCard', { card_resource_id: card.resource_id }, 'card_detail'],
  ['mobile_archive', 'openMobileCard', 42, 'card_detail'],
  ['story_detail', 'openStoryIdol', '002sht', 'idol_detail'],
  ['card_detail', 'openRelatedCard', card, 'card_detail'],
  ['idol_detail', 'openEventDetail', { event_id: 430018 }, 'event_detail'],
]
for (const [view, handler, arg, target] of fixtures) {
  for (const [key, ref] of Object.entries(useArchiveNavigationState())) {
    if (key !== 'currentArchiveRoute') state[key].value = ref.value
  }
  Object.assign(state.currentGroup, { value: null })
  state.view.value = view
  state.currentCharacterId.value = '003hok'
  state.currentArchiveUnitCode.value = '01jup'
  state.currentSongId.value = 'brndnf'
  state.currentEventId.value = '430018'
  state.currentGashaId.value = '1300011'
  state.currentCardId.value = '003hok_sr10'
  state.currentStoryFile.value = 'example.json'
  state.filterQuery.value = 'preserve me'
  state.detailSourceRoute.value = buildArchiveSourceQuery({ view: 'song_catalog', query: 'BRAND' })
  const before = roundTrip(state.currentArchiveRoute())
  context[handler](arg)
  const after = roundTrip(state.currentArchiveRoute())
  assert.equal(after.view, target, handler)
  assert.deepEqual(source(after), before, `${handler}: exact prior identity, filters and ancestors`)
}

// A real relation chain must survive a fresh URL parse at every level.
const journey = [
  { view: 'song_catalog', query: 'BRAND' },
  { view: 'song_detail', song: 'brndnf' },
  { view: 'idol_detail', idol: '002sht' },
  { view: 'unit_detail', unit: '01jup' },
  { view: 'event_detail', event: '430018' },
  { view: 'card_detail', card: '002sht_sr01', idol: '002sht' },
  { view: 'gasha_detail', gasha: '1300011' },
]
let route = roundTrip(journey[0])
const expected = [route]
for (const next of journey.slice(1)) {
  route = roundTrip({ ...next, sourceRoute: buildArchiveSourceQuery(route) })
  expected.push(route)
}
for (let i = expected.length - 2; i >= 0; i--) {
  route = roundTrip(source(route))
  assert.deepEqual(route, expected[i], `refresh and pop to ${journey[i].view}`)
}
for (const returnView of ['unit_detail', 'story_collection', 'mobile_archive', 'files', 'reader']) {
  const player = roundTrip({ view: 'player', scenario: 'example.json', returnView,
    reading: 'document', sourceRoute: buildArchiveSourceQuery(expected[3]) })
  assert.deepEqual(source(player), expected[3], `playback carrier ${returnView}`)
}
const grid = roundTrip({ view: 'idols', category: 'cards', unitFilter: '1' })
assert.equal(grid.view, 'idols', 'unit card grid must not refresh to default Touma cards')
assert.equal(grid.idol, '')
assert.equal(roundTrip({ ...grid, unitFilter: '' }).view, 'idols', 'All filter remains the member grid')

// Bound growth, accept old URLs, reject unsafe origins and tolerate broken tails.
route = roundTrip(journey[1])
for (let i = 0; i < 100; i++) {
  route = roundTrip({ view: 'idol_detail', idol: `idol-${i}`, sourceRoute: buildArchiveSourceQuery(route) })
  assert.ok(route.sourceRoute.length <= 8192)
}
let depth = 0
while (route.sourceRoute) { route = source(route); depth++ }
assert.equal(depth, 16)
const old = '?view=unit_detail&unit=01jup&from=' + encodeURIComponent('?view=song_detail&song=brndnf')
assert.equal(source(readArchiveSourceRoute(old)).song, 'brndnf')
for (const bad of ['https://example.com/', '?view=player&scenario=x.json', '?view=portal', '?view=invalid', '?' + 'x'.repeat(8192)]) {
  assert.equal(roundTrip({ view: 'idol_detail', sourceRoute: bad }).sourceRoute, undefined)
}
assert.equal(readArchiveSourceRoute('?view=song_detail&song=brndnf&via=broken').song, 'brndnf')
console.log(`Archive relation navigation: ${fixtures.length} production edges, seven-page refresh chain, playback carriers and bounded legacy URL handling passed`)

// The shell Back and embedded Reader/Portal Back must share their owner.
let returned = ''
const dispatch = vm.createContext({ view: { value: 'reader' }, detailSourceRoute: { value: '?view=unit_detail&unit=01jup' },
  closeStoryReader: () => { returned = 'reader' }, closeArchivePortal: () => { returned = 'portal' },
  restoreDetailSource: () => { returned = 'source' }, goHome: () => {} })
vm.runInContext(app.match(/function goArchiveBack\([^]*?\n\}/)[0], dispatch)
dispatch.goArchiveBack(); assert.equal(returned, 'reader')
dispatch.view.value = 'portal'; dispatch.goArchiveBack(); assert.equal(returned, 'portal')
dispatch.view.value = 'idol_detail'; dispatch.goArchiveBack(); assert.equal(returned, 'source')
