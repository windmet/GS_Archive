import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ARCHIVE_NAVIGATION, buildArchiveUrl, buildPortalReturnQuery, readArchiveRoute, readPortalReturnRoute } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

for (const query of [
  '?home_idol=003hok&home_cue=voice&home_costume=model',
  '?view=cards&idol=001tom&rarity=SSR&q=Jupiter',
  '?view=card_detail&card=001tom_ssr01&parent=event_detail&event=410018',
  '?view=story_collection&story_type=main&story_section=101',
  '?view=song_detail&song=grwsml&parent=unit_detail&unit=01jup',
  '?view=mobile_archive&idol=001tom&mobile_mode=phone',
]) {
  const source = readArchiveRoute(`http://localhost/${query}`)
  const nav = useArchiveNavigationState()
  nav.view.value = 'portal'
  nav.portalFrom.value = buildPortalReturnQuery(source)
  const portal = readArchiveRoute(buildArchiveUrl('http://localhost/?runtimeDebug=1&scenario=stale.json', nav.currentArchiveRoute()))
  assert.equal(portal.view, 'portal')
  assert.deepEqual(readPortalReturnRoute(portal.portalFrom), source, `return must retain ${query}`)
  const url = buildArchiveUrl('http://localhost/', portal)
  assert.equal(url.searchParams.has('scenario'), false)
  assert.deepEqual(readArchiveRoute(url), portal, 'refresh/share retains return context')
  nav.view.value = 'cards'
  assert.equal('portalFrom' in nav.currentArchiveRoute(), false, 'return context cannot leak to destination')
}
for (const bad of ['https://example.com/', '//example.com/', '?view=player&scenario=a.json', '?file=a', '?view=player&card=a&voice=b', '?view=spine_lab', '?view=portal&portal_from=%3Fview%3Dportal', '?' + 'q'.repeat(8193)]) {
  assert.equal(readPortalReturnRoute(bad).view, 'home')
}
assert.equal(readArchiveRoute('http://localhost/?view=portal').view, 'portal')
assert.equal(buildArchiveUrl('http://localhost/?view=portal&portal_from=x', { view: 'cards' }).searchParams.has('portal_from'), false)
assert.equal(ARCHIVE_NAVIGATION.length, 8, 'existing desktop taxonomy remains unchanged')

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const restoreContext = {
  ...useArchiveNavigationState(),
  navigation: createArchiveNavigationCoordinator(),
  currentScenario: { value: { steps: ['previous playback payload'] } },
  captureActiveArchiveView: () => {},
}
restoreContext.playbackController = { reset: () => { restoreContext.currentScenario.value = null } }
vm.runInNewContext(app.match(/async function applyArchiveRoute\([^]*?\n\}/)[0], restoreContext)
await restoreContext.applyArchiveRoute({ view: 'portal', portalFrom: '?view=cards&idol=001tom' })
assert.equal(restoreContext.view.value, 'portal')
assert.equal(restoreContext.currentScenario.value, null, 'history entry into portal releases retained playback payload')
assert.equal(restoreContext.portalFrom.value, '?view=cards&idol=001tom')
// No loaders or media globals were provided: this early restoration path is isolated.
const handlers = ['openArchivePortal', 'closeArchivePortal'].map(name => {
  const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source)
  return source
}).join('\n')
const nav = useArchiveNavigationState()
nav.view.value = 'cards'
nav.currentCharacterId.value = '001tom'
nav.filterQuery.value = 'Jupiter'
const navigation = createArchiveNavigationCoordinator()
let release, published = 0
const context = {
  ...nav, navigation, buildPortalReturnQuery, readPortalReturnRoute,
  archiveShellVisible: { value: true },
  commitView: view => { navigation.invalidate(); nav.view.value = view },
  syncArchiveRoute: () => { published++ },
  applyArchiveRoute: route => navigation.run(async intent => {
    await new Promise(resolve => { release = resolve })
    if (intent.isCurrent()) nav.view.value = route.view
  }, { restoring: true }),
}
vm.runInNewContext(handlers, context)
context.openArchivePortal()
assert.equal(nav.view.value, 'portal')
const captured = nav.portalFrom.value
context.openArchivePortal()
assert.equal(nav.portalFrom.value, captured, 'reopening cannot overwrite return context')
let pending = context.closeArchivePortal()
navigation.invalidate()
nav.view.value = 'gashas'
release()
await pending
assert.equal(nav.view.value, 'gashas')
assert.equal(published, 0, 'obsolete close cannot rewrite newer navigation')
pending = context.closeArchivePortal()
release()
await pending
assert.equal(nav.view.value, 'cards')
assert.equal(published, 1)
console.log('Portal navigation: preserved contexts, safe deep links, refresh, no nesting and obsolete-close suppression passed')
