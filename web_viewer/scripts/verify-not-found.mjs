// Not-found policy (fixture level). The app answers every unknown path with index.html and a 200, so the only way to
// avoid a soft 404 is to tell the visitor and mark the page noindex. The decision lives in src/core/archiveNotFound.js
// and is imported here, not mirrored; each route-preparation composable must hand it a missing entity and must NOT hand
// it a transport failure. The browser counterpart is verify-not-found-browser.mjs (local only).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref } from 'vue'
import { ENTITY_NOT_FOUND, EntityNotFoundError, NOT_FOUND_NOTICE, isEntityNotFound, isUnknownArchivePath, notFoundRoute,
  resolveNotFound, setNotFoundNoindex } from '../src/core/archiveNotFound.js'
import { isBareArchiveEntry } from '../src/core/archiveStartup.js'
import { useCardNavigation } from '../src/composables/useCardNavigation.js'
import { useEventNavigation } from '../src/composables/useEventNavigation.js'
import { useGashaNavigation } from '../src/composables/useGashaNavigation.js'
import { useIdolNavigation } from '../src/composables/useIdolNavigation.js'
import { useSongNavigation } from '../src/composables/useSongNavigation.js'
import { useUnitNavigation } from '../src/composables/useUnitNavigation.js'

// 1. Which addresses name nothing. A public locator, a query-only entry and the bare roots never do.
for (const path of ['/foo-bar/', '/cards/99999999/', '/idols/999/', '/songs/zzz/', '/units/zz/', '/office/', '/mobile/x', '/a/b/c/d',
  '/cards/999zzz_n99/extra/', '/index.html/', '/foo/?utm_source=x'])
  assert.equal(isUnknownArchivePath(`https://x.test${path}`), true, `${path} is unknown`)
for (const path of ['/', '/index.html', '/?utm_source=x', '/?view=portal', '/cards/', '/cards', '/idols/001tom/', '/cards/001tom_n01/', '/songs/brndnf/',
  '/songs/brndnf/chart/', '/units/01abc/', '/events/10019/', '/gashas/210003/', '/stories/main/101/', '/office/001tom/', '/foo/?view=cards', '/status/'])
  assert.equal(isUnknownArchivePath(`https://x.test${path}`), false, `${path} is a real address`)
// The startup rule that keeps unknown paths launching the app is unchanged: they still start bare.
for (const path of ['/foo-bar/', '/cards/99999999/']) assert.equal(isBareArchiveEntry(`https://x.test${path}`), true)

// 2. The decision.
assert.equal(resolveNotFound(), null)
assert.equal(resolveNotFound({}), null)
assert.deepEqual(resolveNotFound({ unknownPath: true }), { notice: NOT_FOUND_NOTICE, noindex: true })
assert.deepEqual(resolveNotFound({ entityMissing: true }), { notice: NOT_FOUND_NOTICE, noindex: true })
assert.equal(NOT_FOUND_NOTICE, '没有找到这个页面，已回到资料馆。')
assert.deepEqual(notFoundRoute(), { view: 'portal', notFound: true })
assert.ok(isEntityNotFound(new EntityNotFoundError('x')) && !isEntityNotFound(new Error('x')) && !isEntityNotFound(null))

// 3. The noindex meta: added once, removed on leaving.
{
  const metas = []
  const head = {
    querySelector: selector => metas.find(meta => selector === 'meta[data-gs-not-found]' && meta.attrs.has('data-gs-not-found')) || null,
    append: meta => metas.push(meta),
  }
  const doc = { head, createElement: () => {
    const attrs = new Map()
    const meta = { attrs, setAttribute: (key, value) => attrs.set(key, value), remove: () => metas.splice(metas.indexOf(meta), 1) }
    return meta
  } }
  setNotFoundNoindex(doc, true); setNotFoundNoindex(doc, true)
  assert.equal(metas.length, 1, 'idempotent')
  assert.equal(metas[0].attrs.get('name'), 'robots'); assert.equal(metas[0].attrs.get('content'), 'noindex')
  setNotFoundNoindex(doc, false)
  assert.equal(metas.length, 0, 'removed on leaving')
  setNotFoundNoindex(doc, false); setNotFoundNoindex({}, true)
}

// 4. Every detail route reports a missing entity, and only a missing entity (a failed read keeps its old fallback).
const catalogEntry = { detail: 'detail', id: 'real', resource_id: 'real', catalog: { unit: { unit_code: 'real' } } }
const everything = overrides => new Proxy({ ...overrides }, { get: (target, key) => key in target ? target[key] : ref(null), has: () => true })
const failingClient = { load: async () => { throw new Error('transport down') } }
const quietly = async run => { const previous = console.error; console.error = () => {}; try { return await run() } finally { console.error = previous } }
const common = { navigation: { getLoadOptions: () => ({}), invalidate() {}, isCurrent: () => true }, readModelClient: failingClient,
  archiveBootstrap: { idols: [{ id: 'real' }], domains: {}, counts: {} }, loading: ref(false) }
const current = { isCurrent: () => true }
const cases = [
  ['card', () => useCardNavigation(everything({ ...common, cardReadModelCatalog: ref([catalogEntry]), cardReadModelDetail: ref(null), cardReadModelStatus: ref('') })).prepareCardRoute,
    id => ({ view: 'card_detail', card: id }), 'cards'],
  ['unit', () => useUnitNavigation(everything({ ...common, unitReadModelCatalog: ref([catalogEntry]), unitReadModelDetail: ref(null), unitReadModelStatus: ref('') })).prepareUnitRoute,
    id => ({ view: 'unit_detail', unit: id }), 'idols'],
  ['event', () => useEventNavigation(everything({ ...common, eventReadModelCatalog: ref([catalogEntry]), eventReadModelDetail: ref(null), eventReadModelStatus: ref('') })).prepareEventRoute,
    id => ({ view: 'event_detail', event: id }), 'story_catalog'],
  ['gasha', () => useGashaNavigation(everything({ ...common, gashaReadModelCatalog: ref({ rows: [catalogEntry] }), gashaReadModelDetail: ref(null), gashaReadModelStatus: ref('') })).prepareGashaRoute,
    id => ({ view: 'gasha_detail', gasha: id }), 'gashas'],
  ['idol', () => useIdolNavigation(everything({ ...common, idolReadModelCatalog: ref({ real: catalogEntry }), idolReadModelDetail: ref(null), idolReadModelStatus: ref('') })).prepareIdolRoute,
    id => ({ view: 'idol_detail', idol: id }), 'idols'],
]
for (const [name, factory, routeFor, oldFallbackView] of cases) {
  const prepare = factory()
  const missing = await quietly(() => prepare(routeFor('nope'), current))
  assert.deepEqual(missing, notFoundRoute(), `${name}: a missing entity is not found`)
  // (An idol outside the bootstrap list is answered before any read; restoreRoute drops a superseded result itself.)
  if (name !== 'idol') assert.equal(await quietly(() => prepare(routeFor('nope'), { isCurrent: () => false })), null, `${name}: a superseded restore reports nothing`)
  const failed = await quietly(() => prepare(routeFor('real'), current))
  assert.ok(failed?.view && !failed.notFound, `${name}: a failed read is not a not-found`)
  assert.equal(failed.view, oldFallbackView, `${name}: a failed read keeps its directory fallback`)
}
{
  // An idol in the bootstrap list but not in the catalogue: the catalogue lookup itself reports it.
  const prepare = useIdolNavigation(everything({ ...common, archiveBootstrap: { idols: [{ id: 'real' }, { id: 'ghost' }], domains: {}, counts: {} },
    idolReadModelCatalog: ref({ real: catalogEntry }), idolReadModelDetail: ref(null), idolReadModelStatus: ref('') })).prepareIdolRoute
  assert.deepEqual(await quietly(() => prepare({ view: 'idol_detail', idol: 'ghost' }, current)), notFoundRoute())
  assert.equal(await quietly(() => prepare({ view: 'idol_detail', idol: 'ghost' }, { isCurrent: () => false })), null)
}
// Songs: the catalogue names the song or one of its variants, otherwise the address is wrong.
{
  const catalog = { songs: { drvalv: { song_code: 'drvalv', variants: [{ song_code: 'drv999' }] } } }
  const make = () => useSongNavigation(everything({ ...common, songReadModelCatalog: ref(catalog),
    songReadModelDetail: ref(null), songReadModelStatus: ref(''), currentSongId: ref(''), view: ref('portal') })).prepareSongRoute
  for (const routeView of ['song_detail', 'chart_lab'])
    assert.equal(await quietly(() => make()({ view: routeView, song: 'zzzzzz' }, current)), ENTITY_NOT_FOUND, `${routeView}: unknown song`)
  assert.equal(await quietly(() => make()({ view: 'song_detail', song: 'drv999' }, current)), true, 'a variant is a real song; its failed read is not a not-found')
  assert.equal(await quietly(() => make()({ view: 'song_detail', song: 'drvalv' }, current)), true)
  assert.equal(await quietly(() => make()({ view: 'chibi_stage' }, current)), true, 'the stage default is never a not-found')
}

// 5. App wiring: the restore path consumes the decision, rewrites the address, and the state ends on leaving.
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
for (const needle of ['isUnknownArchivePath(window.location.href)', 'resolveNotFound({ unknownPath: startupUnknownPath, entityMissing: Boolean(route.notFound) })',
  'song === ENTITY_NOT_FOUND ? notFoundRoute() : route', 'userPreferenceNotice.value = decision.notice', 'setNotFoundNoindex(document, decision.noindex)', 'setNotFoundNoindex(document, false)',
  'else if (notFound) writeArchiveRoute(currentArchiveRoute(), { replace: true })'])
  assert.ok(app.includes(needle), `App.vue wires: ${needle}`)
let static404 = true
try { readFileSync(new URL('../public/404.html', import.meta.url)) } catch { static404 = false }
assert.ok(!static404, 'no static 404.html: it would turn off the Pages SPA fallback')
console.log('Not found: unknown paths and missing entities (card, unit, event, gasha, idol, song) land on the portal with a notice and noindex; failed reads and real addresses are untouched; the meta leaves with the page passed')
