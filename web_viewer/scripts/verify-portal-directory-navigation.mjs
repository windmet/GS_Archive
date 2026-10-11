import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { buildArchiveUrl, readArchiveRoute, buildArchiveSourceQuery, readArchiveSourceRoute } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { songMatchesIdol, storyMatchesIdol, eventMatchesIdol, idolEventIds, cardAttribute } from '../src/presentation/CatalogIdolScope.js'
import { buildPortalDesktopOverview } from '../src/presentation/ArchivePortalPresentation.js'
import { eventResources } from '../src/data/eventResourceGraph.js'
import { filterArchiveCards } from '../src/data/cardFilters.js'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'

const root = process.argv[2]
assert.ok(root, 'Supply the verified read-model root')
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const bootstrap = json(path.join(root, 'bootstrap.inline.json'))
function read(descriptor) {
  const bytes = fs.readFileSync(path.join(root, 'pages', descriptor.url.slice(1)))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256)
  return JSON.parse(bytes).data
}
const rows = domain => read(bootstrap.domains[domain]).pages.flatMap(page => read(page).rows)
const cards = rows('cards'), songs = rows('songs'), stories = rows('stories')
const events = rows('events').map(row => ({ ...row, resources: eventResources(row) }))
const idols = rows('idols'), facets = json('public/data/assets/portal_card_facets.json')
for (const idol of [null, ...bootstrap.idols]) {
  const detail = idol ? read(idols.find(row => row.id === idol.id).detail) : null
  const overview = buildPortalDesktopOverview({ bootstrap, cards, songs, stories, events, preferredIdol: idol, preferredDetail: detail })
  const selected = {
    cards: cards.filter(row => !idol || row.character_id === idol.id),
    songs: songs.filter(row => row.variant_kind === 'primary' && songMatchesIdol(row, idol)),
    stories: stories.filter(row => row.exists === true && storyMatchesIdol(row, idol)),
    events: events.filter(row => eventMatchesIdol(row, idol, idolEventIds(detail))),
  }
  for (const domain of Object.keys(selected)) {
    assert.equal(selected[domain].length, overview.footprints.find(row => row.id === domain).value, `${idol?.id || 'all'} ${domain}`)
  }
  if (idol?.id === '011min') assert.deepEqual(Object.fromEntries(Object.entries(selected).map(([key,value]) => [key,value.length])), { cards:17,songs:5,stories:47,events:3 })
}
const attributedCards = cards.map(row => ({ ...row, attribute: cardAttribute(row, facets, bootstrap.release) }))
for (const [attribute, count] of Object.entries({Physical:257, Intelligence:302, Mental:267})) {
  assert.equal(filterArchiveCards(attributedCards, { attribute }).length, count)
}
assert.equal(cardAttribute(cards[0], { ...facets, release:'stale' }, bootstrap.release), '')
assert.equal(cardAttribute({ ...cards[0], detail:{sha256:'changed'} }, facets, bootstrap.release), '')

const source = buildArchiveSourceQuery({ view:'portal', portalScope:'011min', portalQuery:'Beit' })
for (const view of ['cards','song_catalog','story_catalog','event_catalog']) {
  for (const idol of ['', '011min', '017kir']) {
    const route = readArchiveRoute(buildArchiveUrl('http://localhost/', { view, idol, sourceRoute:source, storyMode:'search', ...(view==='cards' ? {rarity:'SSR',cardAttribute:'Physical'} : {}) }))
    assert.equal(route.idol, idol)
    assert.equal(readArchiveSourceRoute(route.sourceRoute).portalScope, '011min')
    const detail = readArchiveRoute(buildArchiveUrl('http://localhost/', { view:'song_detail', song:'drvalv', sourceRoute:buildArchiveSourceQuery(route) }))
    assert.deepEqual(readArchiveSourceRoute(detail.sourceRoute), route, 'detail back retains exact directory scope and facets')
    assert.deepEqual(readArchiveRoute(buildArchiveUrl('http://localhost/', route)), route, 'refresh retains directory scope')
  }
}
assert.equal(readArchiveRoute('http://localhost/?view=cards&card_attribute=invalid').cardAttribute, undefined)
const nav = useArchiveNavigationState()
nav.view.value='cards'; nav.currentCharacterId.value='017kir'; nav.currentCardAttribute.value='Mental'
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/',nav.currentArchiveRoute())).cardAttribute, 'Mental')

// Exercise the actual handoff function with catalog adapters, including an explicit
// global lens while a favorite is saved and an invalid identity that must not open.
const app = fs.readFileSync('src/App.vue','utf8'), calls=[]
const context = {
  ...useArchiveNavigationState(),
  view:{value:'portal'}, archiveBootstrap:bootstrap,
  captureDetailSource:()=>calls.push('source'),
  openPrimaryCards:(id,filters)=>calls.push(['cards',id,filters]),
  openSongCatalog:options=>calls.push(['songs',options]),
  openStoryCatalog:options=>calls.push(['stories',options]),
  openDomainCatalog:(domain,options)=>calls.push([domain,options]),
}
vm.runInNewContext(app.match(/function openPortalDirectory\([^]*?\n\}/)[0],context)
for (const domain of ['cards','songs','stories','events']) {
  context.openPortalDirectory({domain,idolCode:'011min'})
  assert.equal(calls.at(-2),'source')
  assert.ok(JSON.stringify(calls.at(-1)).includes('011min'))
  context.openPortalDirectory({domain,idolCode:''})
  assert.ok(!JSON.stringify(calls.at(-1)).includes('011min'), 'all does not fall back to saved favorite')
}
const before=calls.length
context.openPortalDirectory({domain:'songs',idolCode:'unknown'})
context.openPortalDirectory({domain:'unknown',idolCode:'011min'})
context.view.value='home';context.openPortalDirectory({domain:'songs'})
assert.equal(calls.length,before)
const directoryState = useArchiveNavigationState()
const opened=[]
const adapters={ ...directoryState,
  songReadModelCatalog:{value:{songs:{}}},
  normalizeEventBrowseState:()=>({kind:'',sort:'newest',page:0}),
  commitView:next=>{directoryState.view.value=next;opened.push(next)},
}
bindSongNavigation(app,adapters).stop()
vm.runInNewContext(app.match(/function openDomainCatalog\([^]*?\n\}/)[0],adapters)
for(const idolCode of ['011min','017kir','']) {
  adapters.openSongCatalog({idolCode})
  assert.equal(directoryState.currentCharacterId.value,idolCode,'actual song adapter retains requested idol')
  assert.equal(directoryState.currentArchiveRoute().idol,idolCode)
  adapters.openDomainCatalog('events',{idolCode})
  assert.equal(directoryState.currentCharacterId.value,idolCode,'actual event adapter retains requested idol')
  assert.equal(directoryState.currentArchiveRoute().idol,idolCode)
}
console.log('PASS existing directory handoffs, 49-idol source count parity, Minori 17/5/47/3, source-bound attributes, refresh/detail return, global reset and invalid identities')
