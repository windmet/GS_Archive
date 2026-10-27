import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ARCHIVE_NAVIGATION, archiveSectionForRoute, buildArchiveSourceQuery, buildArchiveUrl, buildPortalReturnQuery, readArchiveRoute, readArchiveSourceRoute, readHomeReturnRoute, readPortalReturnRoute } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { ARCHIVE_NAVIGATION_GROUPS, buildNavigationGroups } from '../src/core/archiveNavigationGroups.js'

// Seven reader destinations; readers never see the build-status section, maintainers get it as an eighth.
const maintainerGroups = buildNavigationGroups(true)
const readerGroups = buildNavigationGroups(false)
assert.deepEqual(readerGroups.map(group => group.label), ['剧情与通信', '偶像与卡片', '歌曲与配乐', '活动与卡池', '图鉴', 'LIVE', '摄影工作台'])
assert.deepEqual(readerGroups.map(group => group.items.length), [2, 2, 2, 2, 6, 1, 1])
assert.deepEqual(maintainerGroups.map(group => group.label), ['剧情与通信', '偶像与卡片', '歌曲与配乐', '活动与卡池', '图鉴', 'LIVE', '摄影工作台', '资源'])
assert.ok(!readerGroups.some(group => group.items.some(item => item.id === 'resources')))
assert.ok(readerGroups.every(group => group.items.every(item => item.label !== group.label || group.items.length === 1)), 'a destination never lists a section with its own name')
assert.deepEqual(ARCHIVE_NAVIGATION_GROUPS.map(group => group.items.length), [2, 2, 2, 2, 6, 1, 1], 'default module export is the reader view')
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
  // Detail pages published at a path (card, song) return as their identity; their own source rides along.
  const returned = readPortalReturnRoute(portal.portalFrom)
  assert.deepEqual(returned, readArchiveRoute(buildArchiveUrl('http://localhost/', source)), `return must retain ${query}`)
  for (const key of ['card', 'song']) if (source[key]) assert.equal(returned[key], source[key], `return keeps the ${key}`)
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
  ['home','stories','songs','scores','idols','cards','gashas','interactions','events','collections','honors','currencies','costumes','photos','unused','live','studio','resources'],
  'desktop taxonomy includes the published event, collection, photo resource, unused voice archive, LIVE and photo studio destinations')

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
  'collectionReadModelDetail','songReadModelDetail']) context[name] = {value:null}
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

// The address always names the portal lens, so a shared link opens the same view for anyone; a lens equal to
// what following the favorite shows is restored as that default, so a refreshed page keeps following.
const shownNav = useArchiveNavigationState({ portalScopeShown: () => '040ren' })
shownNav.view.value = 'portal'
assert.equal(buildArchiveUrl('http://localhost/', shownNav.currentArchiveRoute()).searchParams.get('portal_scope'), '040ren', 'a following lens is written out')
shownNav.portalScope.value = 'all'
assert.equal(buildArchiveUrl('http://localhost/', shownNav.currentArchiveRoute()).searchParams.get('portal_scope'), 'all', 'an explicit lens wins')
assert.match(app, /useArchiveNavigationState\(\{ portalScopeShown: \(\) => preferredArchiveIdol\.value\?\.id \|\| 'all' \}\)/, 'App names the lens an empty scope shows')
restoreContext.preferredArchiveIdol = { value: { id: '001tom' } }
restoreContext.archiveBootstrap.idols.push({ id: '040ren' })
restoreContext.userPreferences.value.portalDefaultScope = 'favorite'
await restoreContext.applyArchiveRoute({ view: 'portal', portalScope: '001tom' })
assert.equal(restoreContext.portalScope.value, '', 'the favorite lens read back from the address keeps following')
await restoreContext.applyArchiveRoute({ view: 'portal', portalScope: '040ren' })
assert.equal(restoreContext.portalScope.value, '040ren', 'another idol stays a temporary lens')
await restoreContext.applyArchiveRoute({ view: 'portal', portalScope: 'all' })
assert.equal(restoreContext.portalScope.value, 'all', 'the all-archive lens stays explicit while a favorite exists')
restoreContext.preferredArchiveIdol = { value: null }
await restoreContext.applyArchiveRoute({ view: 'portal', portalScope: 'all' })
assert.equal(restoreContext.portalScope.value, '', 'without a favorite the all-archive address is the default view')

// One name per destination: navigation entry, breadcrumb root and browser tab agree, and every portal
// directory entry has its own glyph.
assert.equal(ARCHIVE_SECTIONS.stories.label, '剧情')
assert.equal(ARCHIVE_SECTIONS.home.label, '事务所')
for (const [view, section] of [['story_catalog', 'stories'], ['idols', 'idols'], ['unit_catalog', 'units'], ['cards', 'cards'], ['song_catalog', 'songs'],
  ['event_catalog', 'events'], ['gashas', 'gashas'], ['photo_catalog', 'photos'], ['unused_archive', 'unused'], ['score_archive', 'scores']]) {
  const crumbs = buildArchiveBreadcrumbs({ view, category: view === 'idols' ? 'idol' : view === 'cards' ? 'cards' : '' })
  assert.deepEqual(crumbs.map(item => item.label), [ARCHIVE_SECTIONS.portal.label, ARCHIVE_SECTIONS[section].label], `${view} breadcrumb`)
  // 图鉴's categories read as the category, then the page they share.
  const tabName = ['photo_catalog', 'unused_archive'].includes(view) ? `${ARCHIVE_SECTIONS[section].label} · 图鉴` : ARCHIVE_SECTIONS[section].label
  assert.equal(archiveDocumentTitle(view), `${tabName} · GROWING STARS 资料馆`, `${view} browser tab`)
}
for (const item of ARCHIVE_NAVIGATION) assert.equal(item.label, ARCHIVE_SECTIONS[item.id].label, `${item.id} navigation label`)
assert.deepEqual(buildArchiveBreadcrumbs({ view: 'picture_studio' }).map(item => item.label), ['资料馆', '摄影工作台'], 'the studio hangs from the root')
const iconSource = readFileSync(new URL('../src/components/archive/archiveNavigationIcons.js', import.meta.url), 'utf8')
for (const item of ARCHIVE_NAVIGATION_GROUPS.flatMap(group => group.items)) assert.match(iconSource, new RegExp(`[\\s,{]${item.id}\\s*:`), `${item.id} has a directory glyph`)
// Desktop sidebar: an explicit 资料馆 entry, and each root page names its group's other pages beside its title.
const shellSource = readFileSync(new URL('../src/components/archive/ArchiveShell.vue', import.meta.url), 'utf8')
assert.match(shellSource, /id: 'portal', label: sectionLabel\('portal'\), icon: LayoutGrid, target: 'portal'/, 'sidebar lists 资料馆 as an entry')
assert.doesNotMatch(shellSource + app, /siblingSections|archive-sibling-switch|root-section/, 'the title row no longer names the group beside the title: the sidebar holds every destination')
assert.match(shellSource, /props\.breadcrumbs\.slice\(1, -1\)/, 'the title row lists only the parents between the archive and the page')
assert.match(shellSource, /\['idols', 'units', 'cards'\]/, '偶像 / 组合 / 卡片 sit together in the sidebar')
assert.match(app, /else if \(section === 'units'\) openUnitCatalog\(\)/, '组合 in the switch opens the unit directory')
// Phone bar 2+1: the two homes, then one cell that opens the drawer and otherwise names the current section.
const barItems = shellSource.match(/const mobileNavigation = computed\(\(\) => \[([\s\S]*?)\n\]\)/)?.[1] || ''
assert.deepEqual([...barItems.matchAll(/\{ id: '(\w+)'/g)].map(match => match[1]), ['home', 'portal'], 'the bar holds the two homes and nothing else')
assert.match(shellSource, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/, 'the bar has three equal cells')
assert.match(shellSource, /<span class="archive-switch-label">\{\{ drawerCell\.label \}\}<component :is="drawerOpen \? ChevronDown : ChevronUp"/, 'the third cell keeps the tab layout; a caret that flips with the drawer marks it')
assert.match(shellSource, /\.archive-switch-caret \{ position: absolute;/, 'the caret does not push the label off centre')
assert.match(shellSource, /if \(drawerOpen\.value\) return \{ label: '收起'/, 'the open drawer turns the third cell into 收起')
assert.match(shellSource, /section !== 'home' && section !== 'portal' && sectionLabel\(section\)\)[\s\S]{0,40}return \{ label: sectionLabel\(section\), icon: archiveNavigationIcons\[section\]/, 'away from the homes the third cell names the current section')
assert.match(shellSource, /return \{ label: '导航', icon: Menu/, 'on the homes the third cell says 导航')
assert.match(shellSource, /:aria-expanded="drawerOpen"/, 'the third cell reports the drawer state')
// The drawer loads on first open and shows the sidebar's own destination groups.
assert.match(shellSource, /defineAsyncComponent\(\(\) => import\('\.\/ArchiveNavigationDrawer\.vue'\)\)/, 'the drawer is a lazy chunk')
assert.doesNotMatch(shellSource, /^import ArchiveNavigationDrawer/m, 'the drawer is not in the startup bundle')
assert.match(shellSource, /<ArchiveNavigationDrawer v-if="drawerOpen"[^>]*:groups="navigationGroups"/, 'the drawer renders only while open, from the sidebar groups')
const drawerSource = readFileSync(new URL('../src/components/archive/ArchiveNavigationDrawer.vue', import.meta.url), 'utf8')
assert.doesNotMatch(drawerSource, /archiveRoute|archiveNavigationGroups/, 'the drawer keeps no destination list of its own')
assert.deepEqual(drawerSource.match(/ARCHIVE_SECTIONS(?:\[[^\]]+\]\?\.\w+)?/g), ['ARCHIVE_SECTIONS', 'ARCHIVE_SECTIONS[item.id]?.blurb'], 'the drawer reads only descriptions from the dictionary')
assert.match(drawerSource, /@keydown\.esc\.prevent="emit\('close'\)"/, 'Esc closes the drawer')
// Booklet 2.0: rows in a table of contents. Groups are told apart by their sidebar titles, not by boxes.
assert.match(drawerSource.split('<script')[0], /<h2>\{\{ group\.label \}\}<\/h2>/, 'each drawer group is titled with its sidebar group name')
assert.match(drawerSource, /props\.groups\.filter\(group => \(TIER_OF_GROUP\[group\.id\] \|\| 'core'\) === id\)/, 'every drawer tier is cut from the sidebar groups')
// 图鉴 names run two to four characters; a fixed icon column and full-width rules keep them aligned, without filled cells.
assert.doesNotMatch(drawerSource.split('<style')[1], /background: var\(--gs-paper\)|border: 1px solid/, 'no filled cells or outlined cards')
assert.match(drawerSource, /\.archive-drawer-blank \{[^}]*border-bottom: 1px solid var\(--gs-line\)/, 'blank rows keep the rules running across a short group')
assert.match(drawerSource, /const TIER_OF_GROUP = \{ collection: 'collection', live: 'tools', studio: 'tools', resources: 'footer' \}/, 'catalogues, 图鉴, tools and the maintainer page each have their tier')
// The tools are players and editors, not lists: a row that says what it opens, from the dictionary, ending in ↗.
assert.match(drawerSource, /<template v-if="tier\.id === 'tools'"><small v-if="item\.blurb">\{\{ item\.blurb \}\}<\/small><ArrowUpRight /, 'tool rows carry a one-line description and ↗')
assert.match(drawerSource, /blurb: ARCHIVE_SECTIONS\[item\.id\]\?\.blurb/, 'tool descriptions come from the dictionary')
assert.deepEqual(Object.values(ARCHIVE_SECTIONS).filter(section => section.blurb).map(section => section.id), ['live', 'studio'], 'only the two tools carry a description')
// 回到页顶 and 关于本站 close the drawer as a footer line; 回到页顶 scrolls the archive scroll area.
assert.match(drawerSource, /<p class="archive-drawer-footer">[\s\S]*?<button type="button" class="archive-drawer-top" :disabled="!canScrollTop" @click="scrollToTop">回到页顶<\/button>[\s\S]*?sectionLabel\('about'\)[\s\S]*?<\/p>/, 'the footer offers 回到页顶 (disabled at the top) and 关于本站')
assert.match(drawerSource, /const scrollArea = \(\) => document\.querySelector\('\[data-archive-scroll-container\]'\)/, '回到页顶 scrolls the archive scroll area')
assert.match(drawerSource, /scrollArea\(\)\?\.scrollTo\(\{ top: 0,[^}]*\}\)\s*\n\s*emit\('close'\)/, '回到页顶 scrolls to the top and closes the drawer')
// Phone portal: following an idol, the hero comes before the index of every section; the all-archive view keeps the index first.
const overviewSource = readFileSync(new URL('../src/components/archive/ArchivePortalOverview.vue', import.meta.url), 'utf8')
const allDirectory = overviewSource.indexOf('<nav v-if="!preferredReference?.actionable" class="overview-directory"')
const hero = overviewSource.indexOf('class="overview-personal"')
const heroDirectory = overviewSource.indexOf('<nav v-if="preferredReference?.actionable" class="overview-directory"')
assert.ok(allDirectory > 0 && allDirectory < overviewSource.indexOf('class="overview-panel overview-featured"'), 'all-archive view: index above the featured section')
assert.ok(hero > 0 && heroDirectory > hero && heroDirectory < overviewSource.indexOf('class="overview-card-showcase"'), 'favorite view: index right after the hero')
// Phone layout at every width from 320 to 760, and in a narrowed desktop window: centred, one hero column,
// the same side margin as the other pages, and a directory of four columns whose rows are always full.
const tokenSource = readFileSync(new URL('../src/styles/GS_UI_TOKENS.css', import.meta.url), 'utf8')
assert.match(tokenSource, /@media \(max-width: 760px\) \{ \[data-archive-scroll-container\] \{ scrollbar-gutter: stable both-edges; \} \}/, 'a classic scrollbar reserves both sides in the phone layout')
const phoneOverview = overviewSource.slice(overviewSource.lastIndexOf('@media (max-width:760px)'))
assert.match(phoneOverview, /\.portal-overview \{ padding:var\(--gs-space-3\) var\(--gs-space-5\) /, 'the portal keeps the 16px side margin of the other pages')
assert.match(phoneOverview, /\.overview-personal \{ display:flex;align-items:stretch; \}/, 'the hero stays one column at every phone width')
assert.match(phoneOverview, /\.overview-directory \{ display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);/, 'the phone directory has four columns')
assert.doesNotMatch(phoneOverview, /\.overview-directory \{ grid-template-columns:/, 'no width changes the directory columns')
assert.equal(ARCHIVE_NAVIGATION_GROUPS.flatMap(group => group.items).length % 4, 0, 'the four-column directory has no partial row')
console.log('Navigation naming: one dictionary for entries, breadcrumbs and tabs; portal lens always in the address; phone 2+1 bar, lazy drawer and hero-first portal passed')
import { ARCHIVE_SECTIONS } from '../src/core/archiveSections.js'
import { buildArchiveBreadcrumbs } from '../src/core/archiveRoute.js'
import { archiveDocumentTitle } from '../src/presentation/ArchiveDocumentTitle.js'
