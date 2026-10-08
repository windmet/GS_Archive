import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ARCHIVE_NAVIGATION, archiveSectionForRoute, buildArchiveSourceQuery, buildArchiveUrl, buildPortalReturnQuery, readArchiveRoute, readArchiveSourceRoute, readHomeReturnRoute, readPortalReturnRoute } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { ARCHIVE_NAVIGATION_GROUPS, buildNavigationGroups } from '../src/core/archiveNavigationGroups.js'

// Six reader destinations; readers never see the build-status section, maintainers get it under 工具.
const maintainerGroups = buildNavigationGroups(true)
const readerGroups = buildNavigationGroups(false)
assert.deepEqual(readerGroups.map(group => group.label), ['故事', '偶像与卡片', '歌曲', '活动与卡池', '收藏', '工具'])
assert.deepEqual(readerGroups.map(group => group.items.length), [2, 2, 1, 2, 3, 1])
assert.deepEqual(maintainerGroups.map(group => group.items.length), [2, 2, 1, 2, 3, 2])
assert.ok(!readerGroups.some(group => group.items.some(item => item.id === 'resources')))
assert.ok(readerGroups.every(group => group.items.every(item => item.label !== group.label || group.items.length === 1)), 'a destination never lists a section with its own name')
assert.deepEqual(ARCHIVE_NAVIGATION_GROUPS.map(group => group.items.length), [2, 2, 1, 2, 3, 1], 'default module export is the reader view')
assert.deepEqual(maintainerGroups.flatMap(group => group.items.map(item => item.id)).sort(), ARCHIVE_NAVIGATION.filter(item => item.id !== 'home').map(item => item.id).sort())

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
assert.deepEqual(ARCHIVE_NAVIGATION.map(item=>item.id),
  ['home','stories','songs','idols','cards','gashas','interactions','events','collections','honors','photos','experiments','resources'],
  'desktop taxonomy includes the published event, collection, photo and experiment destinations')

for (const portalFrom of ['', '?view=cards&rarity=SSR&q=Jupiter']) {
  const portalSource = buildArchiveSourceQuery({ view: 'portal', portalFrom })
  const detail = readArchiveRoute(buildArchiveUrl('http://localhost/', {
    view: 'idol_detail', idol: '002sht', category: 'idol', sourceRoute: portalSource,
  }))
  assert.equal(detail.sourceRoute, portalSource, 'idol detail keeps a bounded Portal source on refresh')
  const restored = readArchiveSourceRoute(detail.sourceRoute)
  assert.equal(restored.view, 'portal')
  assert.equal(restored.portalFrom, portalFrom ? buildPortalReturnQuery(readPortalReturnRoute(portalFrom)) : '',
    'returning to Portal keeps its own normalized original source')
}
assert.equal(readArchiveSourceRoute('?view=portal&portal_from=%3Fview%3Dportal').portalFrom,
  '?view=home', 'nested Portal return cannot recurse')
for (const destination of [
  { view: 'welcome' },
  { view: 'idol_picker', pickTarget: 'profile' },
  { view: 'song_catalog' },
]) {
  const route = readArchiveRoute(buildArchiveUrl('http://localhost/', {
    ...destination, sourceRoute: '?view=portal&portal_from=%3Fview%3Dcards%26rarity%3DSSR',
  }))
  assert.equal(readArchiveSourceRoute(route.sourceRoute).view, 'portal', `${destination.view} retains Portal origin after refresh`)
  assert.equal(readPortalReturnRoute(readArchiveSourceRoute(route.sourceRoute).portalFrom).rarity, 'SSR')
}

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const restoreContext = {
  userPreferences: {value:{portalDefaultScope:"favorite"}},
  archiveBootstrap: {idols:[{id:"001tom"}]},
  isDirectScenarioEntry,
  ...useArchiveNavigationState(),
  navigation: createArchiveNavigationCoordinator(),
  currentScenario: { value: { steps: ['previous playback payload'] } },
  loadingPurpose: { value: 'archive-data' },
  captureActiveArchiveView: () => {},
  primeArchiveRouteComponent: () => {},
}
restoreContext.playbackController = { reset: () => { restoreContext.currentScenario.value = null } }
vm.runInNewContext(app.match(/async function applyArchiveRoute\([^]*?\n\}/)[0], restoreContext)
await restoreContext.applyArchiveRoute({ view: 'portal', portalFrom: '?view=cards&idol=001tom' })
assert.equal(restoreContext.view.value, 'portal')
assert.equal(restoreContext.currentScenario.value, null, 'history entry into portal releases retained playback payload')
assert.equal(restoreContext.portalFrom.value, '?view=cards&idol=001tom')
restoreContext.userPreferences.value.portalDefaultScope = 'all'
await restoreContext.applyArchiveRoute({view:'portal'})
assert.equal(restoreContext.portalScope.value,'all','bare portal follows saved default scope')
await restoreContext.applyArchiveRoute({view:'portal',portalScope:'001tom'})
assert.equal(restoreContext.portalScope.value,'001tom','explicit temporary lens wins over default')
// No loaders or media globals were provided: this early restoration path is isolated.
const appScript = parse(app).descriptor.scriptSetup.content
const portalBinding = parseScript(appScript,{sourceType:'module'}).program.body
  .filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations)
  .find(node=>node.id.type==='ObjectPattern'&&node.id.properties.some(property=>property.key.name==='openArchivePortal'))
assert.ok(portalBinding, 'App binds portal navigation')
const bindPortalNavigation = context => vm.runInNewContext(appScript.slice(portalBinding.init.start,portalBinding.init.end),{...context,usePortalNavigation})
const nav = useArchiveNavigationState()
nav.view.value = 'cards'
nav.currentCharacterId.value = '001tom'
nav.filterQuery.value = 'Jupiter'
const navigation = createArchiveNavigationCoordinator()
let release, published = 0
const context = {
  ...nav, navigation, buildPortalReturnQuery, readPortalReturnRoute,
  archiveBootstrap: {idols:[{id:"001tom"}]}, homeVisits: new Map(),
  archiveShellVisible: { value: true },
  archiveDataReady: { value: true },
  loadCardCatalog: async () => [],
  pendingLegacyNavigation: 0,
  legacyEntryStatus: { value: '' },
  commitView: view => { navigation.invalidate(); nav.view.value = view },
  syncArchiveRoute: () => { published++ },
  applyArchiveRoute: route => navigation.run(async intent => {
    await new Promise(resolve => { release = resolve })
    if (intent.isCurrent()) nav.view.value = route.view
  }, { restoring: true }),
}
const loadCalls = []
for (const name of ['loadHomeIdol','loadIdolDetail','loadUnitCatalog','loadUnitDetail','loadGashaCatalog',
  'loadGashaDetail','loadCardDetail','loadEventDetail','loadSeasonalDetail','loadWorkDetail','loadIdolStoryDetail',
  'loadCollectionDetail','loadStoryReadModelDetail','ensureSongCatalog','loadSongDetail']) context[name] = async (...args) => {
  loadCalls.push([name,...args]); return {id:args[0],name}
}
for (const name of ['idolReadModelDetail','unitReadModelDetail','gashaReadModelDetail','cardReadModelDetail',
  'eventReadModelDetail','seasonalReadModelDetail','workReadModelDetail','idolStoryReadModelDetail',
  'collectionReadModelDetail','storyReadModelDetail','songReadModelDetail']) context[name] = {value:null}
Object.assign(context, bindPortalNavigation(context))
context.openArchivePortal()
assert.equal(nav.view.value, 'portal')
const captured = nav.portalFrom.value
assert.ok(captured, 'opening the portal captures its source route')
context.openArchivePortal()
assert.equal(nav.portalFrom.value, captured, 'reopening cannot overwrite return context')
let pending = context.closeArchivePortal()
await new Promise(resolve => setImmediate(resolve))
navigation.invalidate()
nav.view.value = 'gashas'
release()
await pending
assert.equal(nav.view.value, 'gashas')
assert.equal(published, 0, 'obsolete close cannot rewrite newer navigation')
pending = context.closeArchivePortal()
await new Promise(resolve => setImmediate(resolve))
release()
await pending
assert.equal(nav.view.value, 'cards')
assert.equal(published, 1)
nav.view.value = 'portal'
nav.portalFrom.value = ''
await context.closeArchivePortal()
assert.equal(nav.view.value, 'portal', 'root Portal has no synthetic return action')
assert.equal(published, 1)
// All detail-preparation branches still call their boundary and publish to the original ref.
for (const [route, loader, detail, args] of [
  [{view:'home',homeIdol:'001tom'},'loadHomeIdol',null,['001tom']],
  [{view:'idol_detail',idol:'001tom'},'loadIdolDetail','idolReadModelDetail',['001tom']],
  [{view:'unit_catalog'},'loadUnitCatalog',null,[]],
  [{view:'unit_detail',unit:'1'},'loadUnitDetail','unitReadModelDetail',['1']],
  [{view:'gashas'},'loadGashaCatalog',null,[]],
  [{view:'gasha_detail',gasha:'1'},'loadGashaDetail','gashaReadModelDetail',['1']],
  [{view:'card_detail',card:'001tom_n01'},'loadCardDetail','cardReadModelDetail',['001tom_n01']],
  [{view:'event_detail',event:'event:10020'},'loadEventDetail','eventReadModelDetail',['event:10020']],
  [{view:'seasonal_campaign',storySection:'1'},'loadSeasonalDetail','seasonalReadModelDetail',['1']],
  [{view:'work_archive',idol:'001tom'},'loadWorkDetail','workReadModelDetail',['001tom']],
  [{view:'idol_story_archive',idol:'001tom'},'loadIdolStoryDetail','idolStoryReadModelDetail',['001tom']],
  [{view:'story_collection',storyType:'main',storySection:'102'},'loadCollectionDetail','collectionReadModelDetail',['main','102']],
  [{view:'story_detail',story:'1_4_002_07.json'},'loadStoryReadModelDetail','storyReadModelDetail',['1_4_002_07.json']],
  [{view:'song_catalog',query:'BRAND'},'ensureSongCatalog',null,[]],
  [{view:'song_detail',song:'brnfld'},'loadSongDetail','songReadModelDetail',['brnfld']],
]) {
  let applied
  const scope={...context, applyArchiveRoute:async value=>{applied=value}}
  nav.portalFrom.value=buildPortalReturnQuery(route)
  loadCalls.length=0
  await bindPortalNavigation(scope).closeArchivePortal()
  assert.deepEqual(loadCalls,[[loader,...args]])
  assert.equal(applied.view,route.view)
  if(detail)assert.equal(context[detail].value?.name,loader, 'prepared detail is published to its owner')
}
// Leaving while return data loads must not bring the user back to the old source.
{
  let finishLoad, applied = 0
  nav.portalFrom.value=buildPortalReturnQuery({view:'song_catalog'})
  const scope={...context,ensureSongCatalog:()=>new Promise(resolve=>{finishLoad=resolve}),applyArchiveRoute:async()=>{applied++}}
  const pending=bindPortalNavigation(scope).closeArchivePortal()
  navigation.invalidate()
  finishLoad()
  await pending
  assert.equal(applied,0,'a superseded data load cannot restore the old source')
}
console.log('Portal navigation: preserved contexts, safe deep links, refresh, no nesting and obsolete-close suppression passed')

// Two-way visit contexts retain the selected lens and search while preventing nested cross-page cycles.
const homeFrame = {view:'home',homeIdol:'007kei',homeCue:'2_1_007_01_00_09',homeCostume:'007kei_002_00'}
const portalFrame = {view:'portal',portalFrom:buildPortalReturnQuery(homeFrame),portalScope:'040ren',portalQuery:'K.now O.nly'}
const visitingHome = readArchiveRoute(buildArchiveUrl('http://localhost/',{...homeFrame,homeIdol:'040ren',homeFrom:buildArchiveUrl('http://localhost/',portalFrame).search}))
const returnedPortal = readHomeReturnRoute(visitingHome.homeFrom)
assert.equal(returnedPortal.portalScope,'040ren')
assert.equal(returnedPortal.portalQuery,'K.now O.nly')
assert.equal(readPortalReturnRoute(returnedPortal.portalFrom).homeCue, homeFrame.homeCue)
assert.equal(readPortalReturnRoute(buildPortalReturnQuery(visitingHome)).homeFrom, undefined)
for (const bad of ['https://example.com/','//example.com/','?view=home','?view=player','?'+'x'.repeat(8193)]) assert.equal(readHomeReturnRoute(bad),null)
for (let i=0;i<50;i++) {
  const safePortal = { ...portalFrame, portalFrom:buildPortalReturnQuery(visitingHome) }
  const safeHome = readArchiveRoute(buildArchiveUrl('http://localhost/',{...visitingHome,homeFrom:buildArchiveUrl('http://localhost/',safePortal).search}))
  assert.ok(safeHome.homeFrom.length < 1000, 'repeated visits stay bounded without exponential nesting')
}
console.log('Home/Portal contexts: lens, query, cue/costume, explicit all-view, refresh, local-only bounded return passed')
// Items and honors share the collection catalogue page but are separate destinations.
assert.equal(archiveSectionForRoute({ view: 'collection_catalog', collection: { kind: 'items' } }), 'collections')
assert.equal(archiveSectionForRoute({ view: 'collection_catalog', collection: { kind: 'honors' } }), 'honors')
assert.equal(archiveSectionForRoute({ view: 'collection_catalog', entity: 'honor:1' }), 'honors', 'an honor deep link highlights 称号')
import { usePortalNavigation } from '../src/composables/usePortalNavigation.js'
import { parse } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
