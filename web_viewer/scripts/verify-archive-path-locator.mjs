// Public path locators: /idols/<id>/ and /units/<code>/ read as their detail routes, the address bar writes
// them, and every internal query form (buildArchiveUrl, source frames, restoration keys) is unchanged.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VALID_VIEWS, buildArchiveUrl, buildPublicArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
import { isBareArchiveEntry, resolveArchiveStartup } from '../src/core/archiveStartup.js'
import { buildArchiveViewContext } from '../src/core/archiveViewRestoration.js'

const read = href => readArchiveRoute(href, { history: false })
const idol = { view: 'idol_detail', idol: '001tom' }
const unit = { view: 'unit_detail', unit: '01jup' }
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
}
// U5: a query view wins over the path (old links, relative ?view=… links followed from a path page).
{
  const route = read('http://x/idols/001tom/?view=cards&idol=002sht')
  assert.equal(route.view, 'cards'); assert.equal(route.idol, '002sht')
}
// U6: anything that is not an exact locator reads like the bare entry, without throwing.
for (const href of ['http://x/idols/xyz/', 'http://x/idols/001tom/extra/', 'http://x/units/1/', 'http://x/songs/brndnf/', 'http://x/idols/', 'http://x/IDOLS/001tom/']) {
  same(read(href), read('http://x/'), href)
}
// Other query parameters on a path still read (e.g. a debug flag); a path never adds a second identity.
assert.equal(read('http://x/idols/001tom/?q=x').idol, '001tom')

// U7–U8: public addresses. Locator views become paths without view/identity/implied category; others go to `/`.
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', idol).href, 'http://x/idols/001tom/')
assert.equal(buildPublicArchiveUrl('http://x/?view=portal', unit).href, 'http://x/units/01jup/')
{
  const url = buildPublicArchiveUrl('http://x/idols/001tom/', { view: 'cards', idol: '001tom' })
  assert.equal(url.pathname, '/'); assert.equal(url.searchParams.get('view'), 'cards'); assert.equal(url.searchParams.get('idol'), '001tom')
}
assert.equal(buildPublicArchiveUrl('http://x/units/01jup/', { view: 'about' }).href, 'http://x/?view=about')
// An id outside the locator pattern keeps the query form rather than inventing a path.
assert.equal(buildPublicArchiveUrl('http://x/', { view: 'idol_detail', idol: 'idol-1' }).pathname, '/')

// U9: for every view, the public address reads back as the same route as the internal query form.
const sample = {
  idol_detail: idol, unit_detail: unit, idols: { view: 'idols', unitFilter: '1' }, cards: { view: 'cards', idol: '001tom', rarity: 'SSR' },
  card_detail: { view: 'card_detail', card: '001tom_ssr01' }, event_detail: { view: 'event_detail', event: '410018' },
  song_detail: { view: 'song_detail', song: 'brndnf' }, gasha_detail: { view: 'gasha_detail', gasha: '1' },
  reader: { view: 'reader', reading: 'doc1' }, player: { view: 'player', scenario: 'a.json' }, home: { view: 'home', homeIdol: '001tom' },
}
for (const view of VALID_VIEWS) {
  const route = sample[view] || { view }
  const internal = read(buildArchiveUrl('http://x/', route).href)
  const published = read(buildPublicArchiveUrl('http://x/idols/001tom/', route).href)
  same(published, internal, `${view} reads the same through its public address`)
}

// U10: the internal query form of the two detail views is exactly the post-L0 identity query.
assert.equal(buildArchiveUrl('http://x/idols/002sht/', idol).search, '?view=idol_detail&category=idol&idol=001tom')
assert.equal(buildArchiveUrl('http://x/', unit).search, '?view=unit_detail&unit=01jup')
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
  // Leaving a path page for a query page resets the path instead of writing /idols/001tom/?view=cards.
  writeArchiveRoute({ view: 'cards', idol: '001tom' })
  assert.equal(new URL(entries.at(-1).url).pathname, '/')
  writeArchiveRoute(unit, { replace: true })
  assert.equal(entries.at(-1).url, 'http://x/units/01jup/'); assert.equal(entries.at(-1).replace, true)
  delete globalThis.window
}

console.log('Archive path locators: /idols/ and /units/ read, publish and round-trip; legacy queries, query priority, startup and restoration keys unchanged')
