// Read-only route schema audit: which URL parameters can each view serialize?
//  - "emitted (dirty state)": every navigation ref holds a value, then currentArchiveRoute() -> buildArchiveUrl().
//    Anything a view emits here that it does not own is stale-state leakage.
//  - "survives (saturated URL)": every query key set on the URL, parsed and rebuilt (what normalize keeps).
// Usage: node scripts/audit-route-schema.mjs [--json]
import { ref } from 'vue'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { SECTION_PATH_ROUTES } from '../src/core/publicRoutes.js'
import { ROUTE_SCHEMA } from '../src/core/routeSchema.js'
import { buildArchiveUrl, readArchiveRoute, VALID_VIEWS, ROUTE_QUERY_KEYS } from '../src/core/archiveRoute.js'

const DIRTY = {
  currentPickTarget: 'profile', detailSourceRoute: '?view=story_catalog', readingDocumentId: 'doc1', readingRowId: 'row1',
  readingMode: 'bilingual', readingRevision: 'sha256:abc', readingScope: 'chapter', currentScenarioInitialStep: 3,
  storyCollectionParentView: 'story_catalog', songParentView: 'song_catalog', eventParentView: 'unit_detail', gashaParentView: 'story_collection',
  homeSelectedId: '001tom', homeSelectedCue: 'c1', homeSelectedCostume: 'm1', currentCategoryId: 'idol', currentCharacterId: '001tom',
  currentArchiveUnitCode: '01jup', currentIdolUnitFilter: '01jup', currentStoryDomain: 'main', currentStoryMode: 'search', currentStorySection: '101',
  currentStoryFile: 'a.json', currentWorkMode: 'lines', currentMobileMode: 'phone', currentMobileScenarioId: 'ms1', currentEventScope: 'fixed_unit_event',
  currentStoryAvailability: 'playable', currentStorySort: 'title', currentEpisodeId: '5', currentCardId: 'card1', currentSongId: 'song1', stageTargetId: 'stage1',
  currentSongScope: 'movie', currentEventId: '10001', currentEntityKey: 'ent', currentPhotoIdol: '001tom', currentPhotoEntity: 'p1', currentGashaId: 'g1',
  currentGashaCategory: 'growing_fes', currentCardRarity: 'ssr', currentCardAttribute: 'dance', currentCardAssetState: 'ready', currentCardRelationState: 'linked',
  filterQuery: 'q', currentScenarioFile: 'a.json', currentScenarioStartStep: 1, currentScenarioEndStep: 9, currentPreviewCue: 'cue1',
  portalFrom: '?view=idols&category=idol', portalScope: '001tom', portalQuery: 'x', homeFrom: '?view=portal', returnViewAfterPlayer: 'event_detail',
}
const QUERY_VALUES = { view: '', pick: 'profile', category: 'idol', story_mode: 'search', work_mode: 'lines', mobile_mode: 'phone', event_scope: 'fixed_unit_event',
  availability: 'playable', sort: 'title', song_scope: 'movie', gasha_type: 'growing_fes', collection_kind: 'items', return: 'event_detail', parent: 'unit_detail',
  from: '?view=story_catalog', portal_from: '?view=idols&category=idol', home_from: '?view=portal', scenario: 'a.json', start_step: '1', end_step: '9', at_step: '3',
  reading: 'doc1', reading_mode: 'bilingual', reading_scope: 'chapter', play_mode: 'segment', story_type: 'main', event_kind: 'fixed_unit_event', event_sort: 'oldest' }

const DRAFT = Object.fromEntries(Object.entries(ROUTE_SCHEMA).map(([key, list]) => [key.replace(/^player:(.*)$/, 'player(return=$1)'), [...new Set([...list, ...SECTION_PATH_ROUTES.filter(route => route.view === key).flatMap(route => Object.keys(route.implied))])]]))
const LEGACY_CONTEXT = new Set(['from', 'portal_from', 'home_from'])
const extras = (list, name) => list.filter(key => !(DRAFT[name] || []).includes(key) && !LEGACY_CONTEXT.has(key))
const params = url => [...new Set([...url.searchParams.keys()])].filter(key => key !== 'view').sort()
const views = [...VALID_VIEWS].sort()

function emitted(viewName, returnView) {
  const state = useArchiveNavigationState()
  for (const [key, value] of Object.entries(DIRTY)) if (state[key] && 'value' in state[key]) state[key].value = value
  state.view.value = viewName
  if (returnView) state.returnViewAfterPlayer.value = returnView
  return buildArchiveUrl('http://localhost/', state.currentArchiveRoute())
}
function survives(viewName, returnView) {
  const url = new URL('http://localhost/')
  for (const key of ROUTE_QUERY_KEYS) if (viewName === 'player' || key !== 'scenario') url.searchParams.set(key, QUERY_VALUES[key] ?? `${key}-x`)
  url.searchParams.set('view', viewName)
  if (returnView) url.searchParams.set('return', returnView)
  return buildArchiveUrl('http://localhost/', readArchiveRoute(url))
}

// Legacy idols+idol normalizes to idol_detail: audit against the page actually serialized.
const schemaName = url => url.searchParams.get('view') === 'player' ? `player(return=${url.searchParams.get('return') || ''})` : url.searchParams.get('view')
function row(name, returnView = '') {
  const output = emitted(name, returnView), normalized = survives(name, returnView)
  return { view: name === 'player' ? `player(return=${returnView})` : name, emitted: params(output), survives: params(normalized), emittedSchema: schemaName(output), survivesSchema: schemaName(normalized) }
}
const rows = views.flatMap(name => name === 'player' ? [...Object.keys(ROUTE_SCHEMA).filter(key => key.startsWith('player:')).map(key => key.slice(7)), ''].map(returnView => row(name, returnView)) : [row(name)])
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
else {
  console.log('view | draft-owned | emitted extras (dirty state) | survives extras (saturated URL)')
  for (const row of rows) console.log(`${row.view} | ${(DRAFT[row.view] || ['?']).length} | ${extras(row.emitted, row.emittedSchema).length}: ${extras(row.emitted, row.emittedSchema).join(' ')} | ${extras(row.survives, row.survivesSchema).length}`)
  const total = key => rows.reduce((sum, row) => sum + extras(row[key], row[`${key}Schema`]).length, 0)
  console.log(`views with a draft entry: ${rows.filter(row => DRAFT[row.view]).length}/${rows.length}; extras emitted ${total('emitted')}, surviving ${total('survives')}`)
}
