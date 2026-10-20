// Public path locators: /idols/<id>/, /units/<code>/, /cards/<resource_id>/, /songs/<song_code>/, /events/<id>/, /gashas/<id>/, /office/<idol>/ and /mobile/<idol>/ read as their
// detail routes and the section roots (/idols/, /cards/, /items/, …) as their catalogues; the address bar writes
// them, and every internal query form (buildArchiveUrl, source frames, restoration keys) is unchanged.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VALID_VIEWS, buildArchiveUrl, buildPublicArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
import { isBareArchiveEntry, resolveArchiveStartup } from '../src/core/archiveStartup.js'
import { buildArchiveViewContext } from '../src/core/archiveViewRestoration.js'
import { loadEntitySources } from './generate-entity-head-shells.mjs'
import { fileURLToPath } from 'node:url'

const read = href => readArchiveRoute(href, { history: false })
const idol = { view: 'idol_detail', idol: '001tom' }
const unit = { view: 'unit_detail', unit: '01jup' }
const card = { view: 'card_detail', card: '001tom_ssr01' }
const song = { view: 'song_detail', song: 'brndnf' }
const event = { view: 'event_detail', event: '410018' }
const same = (a, b, message) => assert.equal(buildArchiveUrl('http://localhost/', a).search, buildArchiveUrl('http://localhost/', b).search, message)

// U1–U4: path and legacy query forms read as the same route.
for (const href of ['http://x/idols/001tom/', 'http://x/idols/001tom', 'http://x/?view=idol_detail&idol=001tom', 'http://x/?view=idols&category=idol&idol=001tom']) {
  const route = read(href)
  assert.equal(route.view, 'idol_detail', href); assert.equal(route.idol, '001tom', href); assert.equal(route.category, 'idol', href)
}
for (const href of ['http://x/units/01jup/', 'http://x/units/01jup', 'http://x/?view=unit_detail&unit=01jup']) {
  const route = read(href)
  assert.equal(route.view, 'unit_detail', href); assert.equal(route.unit, '01jup', href)
}
// Cards: older links carried the list filters and the parent event; they still read as the same card.
for (const href of ['http://x/cards/001tom_ssr01/', 'http://x/cards/001tom_ssr01', 'http://x/?view=card_detail&card=001tom_ssr01',
  'http://x/?view=card_detail&category=cards&idol=001tom&card=001tom_ssr01&event=10011&q=q']) {
  const route = read(href)
  assert.equal(route.view, 'card_detail', href); assert.equal(route.card, '001tom_ssr01', href); assert.equal(route.category, 'cards', href)
}
// Songs: older links carried the catalogue scope and the idol or unit the song was opened from.
for (const href of ['http://x/songs/brndnf/', 'http://x/songs/brndnf', 'http://x/?view=song_detail&song=brndnf',
  'http://x/?view=song_detail&category=idol&idol=001tom&song=brndnf&song_scope=unit&parent=unit_detail&unit=01jup']) {
  const route = read(href)
  assert.equal(route.view, 'song_detail', href); assert.equal(route.song, 'brndnf', href)
}
// Events: theater and tour events keep their six-digit id, the rest drop the event: prefix of their id.
for (const [href, id] of [['http://x/events/410018/', '410018'], ['http://x/events/430001', '430001'], ['http://x/events/10019/', 'event:10019'],
  ['http://x/?view=event_detail&event=event%3A10019', 'event:10019'],
  ['http://x/?view=event_detail&event=410018&parent=card_detail&card=001tom_ssr01&category=cards&idol=001tom&unit=01jup&q=q&story_type=event', '410018']]) {
  const route = read(href)
  assert.equal(route.view, 'event_detail', href); assert.equal(route.event, id, href)
}
// Every real idol and unit publishes a path and reads back (unit codes are not all letters: W is 05w00).
{
  const bootstrap = JSON.parse(readFileSync(new URL('../readmodels/bootstrap.inline.json', import.meta.url), 'utf8'))
  const units = [...new Set(bootstrap.idols.map(entry => entry.unitCode).filter(Boolean))]
  assert.ok(bootstrap.idols.length >= 49 && units.length >= 16, 'bootstrap lists the idols and units')
  for (const entry of bootstrap.idols) {
    assert.equal(buildPublicArchiveUrl('http://x/', { view: 'idol_detail', idol: entry.id }).pathname, `/idols/${entry.id}/`, entry.id)
    assert.equal(read(`http://x/idols/${entry.id}/`).idol, entry.id, entry.id)
  }
  for (const code of units) {
    assert.equal(buildPublicArchiveUrl('http://x/', { view: 'unit_detail', unit: code }).pathname, `/units/${code}/`, code)
    assert.equal(read(`http://x/units/${code}/`).unit, code, code)
  }
  // Every published card (the tutorial copies with card_id 9xxxxxx reuse a real card's resource_id).
  const cards = JSON.parse(readFileSync(new URL('../public/data/masterdata/card_index.json', import.meta.url), 'utf8')).cards
    .filter(entry => entry.card_id < 9000000)
  assert.equal(cards.length, 826)
  for (const entry of cards) {
    assert.equal(buildPublicArchiveUrl('http://x/', { view: 'card_detail', card: entry.resource_id }).pathname, `/cards/${entry.resource_id}/`, entry.resource_id)
    assert.equal(read(`http://x/cards/${entry.resource_id}/`).card, entry.resource_id, entry.resource_id)
  }
  // Every song with a detail page: the catalogue's primaries and their variants (drv999).
  const songs = Object.keys(JSON.parse(readFileSync(new URL('../public/data/song_catalog.json', import.meta.url), 'utf8')).songs)
  assert.equal(songs.length, 61)
  for (const code of songs) {
    assert.equal(buildPublicArchiveUrl('http://x/', { view: 'song_detail', song: code }).pathname, `/songs/${code}/`, code)
    assert.equal(read(`http://x/songs/${code}/`).song, code, code)
  }
  // Every event in the read model, both id forms.
  const { events } = loadEntitySources(fileURLToPath(new URL('..', import.meta.url)))
  assert.equal(events.length, 59)
  for (const { id } of events) {
    const segment = id.replace(/^event:/, '')
    assert.equal(buildPublicArchiveUrl('http://x/', { view: 'event_detail', event: id }).pathname, `/events/${segment}/`, id)
    assert.equal(read(`http://x/events/${segment}/`).event, id, id)
  }
}
// U5: a query view wins over the path (old links, relative ?view=… links followed from a path page).
{
  const route = read('http://x/idols/001tom/?view=cards&idol=002sht')
  assert.equal(route.view, 'cards'); assert.equal(route.idol, '002sht')
}
// U6: anything that is not an exact locator reads like the bare entry, without throwing.
for (const href of ['http://x/idols/xyz/', 'http://x/idols/001tom/extra/', 'http://x/units/1/', 'http://x/songs/brnd/', 'http://x/songs/BRNDNF/', 'http://x/songs/brndnf1/',
  'http://x/events/event:10019/', 'http://x/events/510001/', 'http://x/events/1001/', 'http://x/events/01001/', 'http://x/events/4100181/',
  'http://x/cards/1101001/', 'http://x/cards/001tom/', 'http://x/cards/001TOM_n01/', 'http://x/IDOLS/001tom/', 'http://x/IDOLS/',
  'http://x/gashas/12345/', 'http://x/gashas/ticket-02B623E0ABC38CE0/', 'http://x/gashas/ticket-1/', 'http://x/items/x/', 'http://x/library/']) {
  same(read(href), read('http://x/'), href)
}
// Gashas: announcement ids and ticket-only pools; where the gasha was opened from stays out of the address.
for (const id of ['210003', '1300012', '12007210', 'ticket-02b623e0abc38ce0']) {
  assert.equal(buildPublicArchiveUrl('http://x/', { view: 'gasha_detail', gasha: id }).href, `http://x/gashas/${id}/`, id)
  const route = read(`http://x/gashas/${id}/`)
  assert.equal(route.view, 'gasha_detail', id); assert.equal(route.gasha, id, id)
}
// An idol's 事务所 and 通信: the idol is the path; the cue and costume, or the mode, unit and open call, stay in the query.
for (const [route, href] of [
  [{ view: 'home', homeIdol: '010pie' }, 'http://x/office/010pie/'],
  [{ view: 'home', homeIdol: '010pie', homeCue: 'c1', homeCostume: '010pie_002_00' }, 'http://x/office/010pie/?home_cue=c1&home_costume=010pie_002_00'],
  [{ view: 'mobile_archive', idol: '010pie' }, 'http://x/mobile/010pie/'],
  [{ view: 'mobile_archive', idol: '010pie', mobileMode: 'unit', unit: '04hig' }, 'http://x/mobile/010pie/?unit=04hig&mobile_mode=unit'],
]) {
  const url = buildPublicArchiveUrl('http://x/', route)
  assert.equal(url.pathname, new URL(href).pathname, href)
  assert.deepEqual([...url.searchParams].sort(), [...new URL(href).searchParams].sort(), href)
  same(read(url.href), read(buildArchiveUrl('http://x/', route).href), href)
}
// Fields the pages do not own (a story, card or event the route object still carries) are pruned, not published.
const stray = { group: 'g1', unitFilter: '1', storyType: 'event', storySection: 's', episode: 'e1', card: '001tom_ssr01', song: 'brndnf', event: '410018', gasha: '210003', voice: 'v', parentView: 'cards' }
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'home', homeIdol: '010pie', ...stray }).href, 'http://x/office/010pie/')
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'mobile_archive', idol: '010pie', ...stray }).href, 'http://x/mobile/010pie/')
// Without an idol there is nothing to address: the office stays a query, and an empty or malformed idol is the bare entry.
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'home' }).href, 'http://x/?view=home')
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'mobile_archive', idol: 'idol-1' }).pathname, '/')
for (const href of ['http://x/office/', 'http://x/office/10pie/', 'http://x/office/010PIE/', 'http://x/mobile/', 'http://x/mobile/10pie/', 'http://x/mobile/010PIE/', 'http://x/mobile/010pie/x/']) {
  same(read(href), read('http://x/'), href)
}
// Section roots: the catalogue is its path, its filters stay in the query, and an implied identity must match.
for (const [route, href] of [
  [{ view: 'idols', category: 'idol' }, 'http://x/idols/'], [{ view: 'unit_catalog' }, 'http://x/units/'], [{ view: 'cards', rarity: 'SSR' }, 'http://x/cards/?rarity=SSR'],
  [{ view: 'song_catalog' }, 'http://x/songs/'], [{ view: 'event_catalog' }, 'http://x/events/'], [{ view: 'gashas' }, 'http://x/gashas/'],
  [{ view: 'story_catalog' }, 'http://x/stories/'], [{ view: 'photo_catalog' }, 'http://x/photos/'],
  [{ view: 'collection_catalog', collection: { kind: 'items' } }, 'http://x/items/'],
  [{ view: 'collection_catalog', collection: { kind: 'honors' } }, 'http://x/honors/'],
  [{ view: 'collection_catalog', collection: { kind: 'currencies' } }, 'http://x/currencies/'],
  [{ view: 'collection_catalog', collection: { kind: 'costumes' } }, 'http://x/costumes/'],
  [{ view: 'collection_catalog', entity: 'currency:free-gem' }, 'http://x/currencies/?entity=currency%3Afree-gem'],
  [{ view: 'collection_catalog', entity: 'costume:001tom_002_00' }, 'http://x/costumes/?entity=costume%3A001tom_002_00'],
  [{ view: 'collection_catalog', entity: 'item:10501' }, 'http://x/items/?entity=item%3A10501'],
]) {
  assert.equal(buildPublicArchiveUrl('http://x/', route).href, href, href)
  same(read(href), read(buildArchiveUrl('http://x/', route).href), href)
  same(read(href.replace(/\/(\?|$)/, '$1')), read(href), `${href} without its trailing slash`)
}
// Other query parameters on a path still read (e.g. a debug flag); a path never adds a second identity.
assert.equal(read('http://x/idols/001tom/?q=x').idol, '001tom')

// U7–U8: public addresses. Locator views become paths without view/identity/implied category; others go to `/`.
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', idol).href, 'http://x/idols/001tom/')
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', unit).href, 'http://x/units/01jup/')
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', card).href, 'http://x/cards/001tom_ssr01/')
// The list filters and parent event of a card opened from a filtered list or an event stay out of its address.
assert.equal(buildPublicArchiveUrl('http://x/', { ...card, category: 'cards', idol: '001tom', event: '10011', portalQuery: 'q' }).href, 'http://x/cards/001tom_ssr01/')
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', song).href, 'http://x/songs/brndnf/')
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', event).href, 'http://x/events/410018/')
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'event_detail', event: 'event:20001' }).href, 'http://x/events/20001/')
// An id outside both forms stays a query address instead of publishing a path that reads back differently.
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'event_detail', event: 'event:x' }).pathname, '/')
// Nor do the catalogue scope or the idol / unit page a song was opened from.
assert.equal(buildPublicArchiveUrl('http://x/', { ...song, category: 'idol', idol: '001tom', songScope: 'unit', parentView: 'unit_detail', unit: '01jup', query: 'q' }).href, 'http://x/songs/brndnf/')
{
  const url = buildPublicArchiveUrl('http://x/idols/001tom/', { view: 'cards', idol: '001tom' })
  assert.equal(url.pathname, '/cards/'); assert.equal(url.searchParams.get('view'), null); assert.equal(url.searchParams.get('idol'), '001tom')
}
assert.equal(buildPublicArchiveUrl('http://x/units/01jup/', { view: 'about' }).href, 'http://x/?view=about')
// An id outside the locator pattern keeps the query form rather than inventing a path.
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'idol_detail', idol: 'idol-1' }).pathname, '/')

// U9: for every view, the public address reads back as the same route as the internal query form.
const sample = {
  idol_detail: idol, unit_detail: unit, idols: { view: 'idols', unitFilter: '1' }, cards: { view: 'cards', idol: '001tom', rarity: 'SSR' },
  card_detail: card, event_detail: event,
  song_detail: song, gasha_detail: { view: 'gasha_detail', gasha: 'ticket-02b623e0abc38ce0' },
  collection_catalog: { view: 'collection_catalog', collection: { kind: 'honors', category: '' } },
  reader: { view: 'reader', reading: 'doc1' }, player: { view: 'player', scenario: 'a.json' }, home: { view: 'home', homeIdol: '001tom' },
}
for (const view of VALID_VIEWS) {
  const route = sample[view] || { view }
  const internal = read(buildArchiveUrl('http://x/', route).href)
  const published = read(buildPublicArchiveUrl('http://x/idols/001tom/', route).href)
  same(published, internal, `${view} reads the same through its public address`)
}

// U10: the internal query form of the five detail views is exactly the post-L0 identity query.
assert.equal(buildArchiveUrl('http://x/idols/002sht/', idol).search, '?view=idol_detail&category=idol&idol=001tom')
assert.equal(buildArchiveUrl('http://x/', unit).search, '?view=unit_detail&unit=01jup')
assert.equal(buildArchiveUrl('http://x/', card).search, '?view=card_detail&card=001tom_ssr01')
assert.equal(buildArchiveUrl('http://x/', song).search, '?view=song_detail&song=brndnf')
assert.equal(buildArchiveUrl('http://x/', event).search, '?view=event_detail&event=410018')
// The internal form of an event keeps where it was opened from (source frames, the player); only the address drops it.
assert.equal(buildArchiveUrl('http://x/', { ...event, parentView: 'card_detail', card: '001tom_ssr01', query: 'q' }).search, '?view=event_detail&card=001tom_ssr01&event=410018&parent=card_detail')
// Restoration keys do not depend on which address form the page was opened with.
assert.equal(buildArchiveViewContext('http://x/idols/001tom/').routeKey, buildArchiveViewContext('http://x/?view=idol_detail&idol=001tom').routeKey)

// U11–U12: a path is an explicit entry, never the bare entry a Home preference may take over.
assert.equal(isBareArchiveEntry('http://x/idols/001tom/'), false)
assert.equal(isBareArchiveEntry('http://x/'), true)
{
  const startup = resolveArchiveStartup('http://x/idols/001tom/', { startupPage: 'home', startupIdol: '002sht' }, ['001tom', '002sht'])
  assert.equal(startup.source, 'explicit'); assert.equal(startup.route.view, 'idol_detail'); assert.equal(startup.route.idol, '001tom')
}

// writeArchiveRoute: the address bar takes the public form, and the navigation context still moves to history state.
{
  const entries = []
  let href = 'http://x/?view=portal'
  globalThis.window = {
    location: { get href() { return href }, origin: 'http://x' },
    history: { state: null, pushState(state, _title, url) { entries.push({ state, url: String(url) }); href = String(url); this.state = state }, replaceState(state, _title, url) { entries.push({ state, url: String(url), replace: true }); href = String(url); this.state = state } },
  }
  const { writeArchiveRoute } = await import('../src/core/archiveRoute.js')
  writeArchiveRoute({ ...idol, sourceRoute: '?view=portal' })
  assert.equal(entries.at(-1).url, 'http://x/idols/001tom/')
  assert.equal(entries.at(-1).state.sidemArchiveNav?.source, '?view=portal', 'the source rides history state')
  assert.equal(readArchiveRoute().sourceRoute, '?view=portal', 'the live location reads the path and its history source')
  // Leaving a path page for a catalogue writes the section root with its filters, never /idols/001tom/?view=cards;
  // a page without a path resets to `/`.
  writeArchiveRoute({ view: 'cards', idol: '001tom' })
  assert.equal(entries.at(-1).url, 'http://x/cards/?idol=001tom')
  writeArchiveRoute({ view: 'about' })
  assert.equal(entries.at(-1).url, 'http://x/?view=about')
  writeArchiveRoute(unit, { replace: true })
  assert.equal(entries.at(-1).url, 'http://x/units/01jup/'); assert.equal(entries.at(-1).replace, true)
  // An event's address is its id; where it was opened from rides history state, so refresh keeps the cold return.
  writeArchiveRoute({ ...event, parentView: 'card_detail', card: '001tom_ssr01', category: 'cards', sourceRoute: '?view=portal' })
  assert.equal(entries.at(-1).url, 'http://x/events/410018/')
  assert.deepEqual(entries.at(-1).state.sidemArchiveNav.event, { parent: 'card_detail', category: 'cards', card: '001tom_ssr01' })
  const live = readArchiveRoute()
  assert.deepEqual([live.view, live.event, live.parentView, live.card, live.category, live.sourceRoute], ['event_detail', '410018', 'card_detail', '001tom_ssr01', 'cards', '?view=portal'])
  assert.equal(readArchiveRoute(href).parentView, '', 'a copied event link carries no placement')
  writeArchiveRoute({ view: 'event_detail', event: 'event:10019', parentView: 'unit_detail', unit: '01jup' })
  assert.equal(entries.at(-1).url, 'http://x/events/10019/')
  assert.deepEqual([readArchiveRoute().event, readArchiveRoute().parentView, readArchiveRoute().unit], ['event:10019', 'unit_detail', '01jup'])
  // A gasha keeps only its id too; the parent rides history state.
  writeArchiveRoute({ view: 'gasha_detail', gasha: '210003', parentView: 'card_detail' })
  assert.equal(entries.at(-1).url, 'http://x/gashas/210003/')
  assert.deepEqual(entries.at(-1).state.sidemArchiveNav.gasha, { parent: 'card_detail' })
  assert.deepEqual([readArchiveRoute().gasha, readArchiveRoute().parentView], ['210003', 'card_detail'])
  assert.equal(readArchiveRoute(href).parentView, '', 'a copied gasha link carries no placement')
  // Other pages never read an event placement.
  writeArchiveRoute(card)
  assert.equal(entries.at(-1).state.sidemArchiveNav, undefined); assert.equal(readArchiveRoute().parentView, '')
  delete globalThis.window
}

console.log('Archive path locators: /idols/, /units/, /cards/, /songs/, /events/, /gashas/, /office/ and /mobile/ details and the section roots read, publish and round-trip; legacy queries, query priority, startup and restoration keys unchanged')
