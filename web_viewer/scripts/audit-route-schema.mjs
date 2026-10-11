// Read-only route schema audit: which URL parameters can each view serialize?
//  - "emitted (dirty state)": every navigation ref holds a value, then currentArchiveRoute() -> buildArchiveUrl().
//    Anything a view emits here that it does not own is stale-state leakage.
//  - "survives (saturated URL)": every query key set on the URL, parsed and rebuilt (what normalize keeps).
// Usage: node scripts/audit-route-schema.mjs [--json]
import { ref } from 'vue'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
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
  filterQuery: 'q', currentScenarioFile: 'a.json', currentScenarioStartStep: 1, currentScenarioEndStep: 9, currentPreviewCue: 'cue1', storyDetailParentView: 'story_catalog',
  portalFrom: '?view=idols&category=idol', portalScope: '001tom', portalQuery: 'x', homeFrom: '?view=portal', returnViewAfterPlayer: 'event_detail',
}
const QUERY_VALUES = { view: '', pick: 'profile', category: 'idol', story_mode: 'search', work_mode: 'lines', mobile_mode: 'phone', event_scope: 'fixed_unit_event',
  availability: 'playable', sort: 'title', song_scope: 'movie', gasha_type: 'growing_fes', collection_kind: 'items', return: 'event_detail', parent: 'unit_detail',
  from: '?view=story_catalog', portal_from: '?view=idols&category=idol', home_from: '?view=portal', scenario: 'a.json', start_step: '1', end_step: '9', at_step: '3',
  reading: 'doc1', reading_mode: 'bilingual', reading_scope: 'chapter', play_mode: 'segment', story_type: 'main', event_kind: 'fixed_unit_event', event_sort: 'oldest' }

// DRAFT per-view ownership (proposal, derived from the page contracts and generic builder; each entry still needs the
// owning page confirmed before it is enforced). Context-only params (from/portal_from/home_from) are excluded: they
// now live in history state and are written to the URL only by legacy builders.
const CATALOG = ['q']
const DRAFT = {
  welcome: [], idol_picker: ['pick'], portal: ['portal_scope', 'q'], home: ['home_idol', 'home_cue', 'home_costume'],
  idols: ['category', 'idol', 'unit_filter', 'q'], groups: ['category', 'idol'], files: ['category', 'idol', 'group'],
  episode_zero_units: [], episodes: ['unit'], idol_detail: ['category', 'idol'],
  cards: ['idol', 'q', 'rarity', 'card_attribute', 'asset_state', 'relation_state'], card_detail: ['card'],
  event_catalog: ['event_kind', 'event_sort', 'event_page'], event_detail: ['event', 'parent', 'category', 'unit'],
  collection_catalog: ['entity', 'collection_kind', 'collection_category', 'collection_idol', 'collection_unit', 'collection_attribute', 'collection_page'],
  photo_catalog: ['photo_idol', 'photo'], picture_studio: ['photo_idol', 'photo'], gashas: ['gasha_type'], gasha_detail: ['gasha', 'parent'],
  song_catalog: ['song_scope'], song_detail: ['song', 'song_scope', 'parent', 'unit'], chart_lab: ['song', 'song_scope'], chibi_stage: ['song', 'song_scope', 'stage'],
  experiments: [], about: [], archive_status: [], spine_lab: [],
  story_catalog: ['story_mode', 'story_type', 'event_scope', 'availability', 'sort', 'idol', 'q'],
  external_story_resources: [], story_collection: ['story_type', 'story_section', 'story', 'parent', 'idol'], story_detail: ['story', 'story_type', 'story_section', 'parent'],
  seasonal_campaign: ['story_type', 'story_section', 'idol'], work_archive: ['idol', 'story', 'work_mode', 'story_type'],
  idol_story_archive: ['idol', 'story_type', 'story_section', 'episode'], mobile_archive: ['idol', 'unit', 'mobile_mode', 'mobile_scenario'],
  unit_catalog: [], unit_detail: ['unit'],
  reader: ['reading', 'reading_row', 'reading_mode', 'reading_scope', 'reading_rev'],
  'player(return=reader)': ['reading', 'reading_row', 'reading_mode', 'reading_scope', 'reading_rev', 'scenario', 'start_step', 'end_step', 'at_step', 'play_mode', 'return'],
  'player(return=event_detail)': ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return', 'event', 'parent', 'category', 'unit'],
  'player(return=files)': ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return', 'category', 'idol', 'group'],
}
const LEGACY_CONTEXT = new Set(['from', 'portal_from', 'home_from'])
const extras = (list, name) => list.filter(key => !(DRAFT[name] || []).includes(key) && !LEGACY_CONTEXT.has(key))
const params = url => [...new Set([...url.searchParams.keys()])].filter(key => key !== 'view').sort()
const views = [...VALID_VIEWS].sort()

function emitted(viewName, returnView) {
  const state = useArchiveNavigationState()
  for (const [key, value] of Object.entries(DIRTY)) if (state[key] && 'value' in state[key]) state[key].value = value
  state.view.value = viewName
  if (returnView) state.returnViewAfterPlayer.value = returnView
  return params(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()))
}
function survives(viewName, returnView) {
  const url = new URL('http://localhost/')
  for (const key of ROUTE_QUERY_KEYS) url.searchParams.set(key, QUERY_VALUES[key] ?? `${key}-x`)
  url.searchParams.set('view', viewName)
  if (returnView) url.searchParams.set('return', returnView)
  return params(buildArchiveUrl('http://localhost/', readArchiveRoute(url)))
}

const rows = views.flatMap(name => name === 'player'
  ? ['reader', 'event_detail', 'files'].map(returnView => ({ view: `player(return=${returnView})`, emitted: emitted(name, returnView), survives: survives(name, returnView) }))
  : [{ view: name, emitted: emitted(name), survives: survives(name) }])
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
else {
  console.log('view | draft-owned | emitted extras (dirty state) | survives extras (saturated URL)')
  for (const row of rows) console.log(`${row.view} | ${(DRAFT[row.view] || ['?']).length} | ${extras(row.emitted, row.view).length}: ${extras(row.emitted, row.view).join(' ')} | ${extras(row.survives, row.view).length}`)
  const total = key => rows.reduce((sum, row) => sum + extras(row[key], row.view).length, 0)
  console.log(`views with a draft entry: ${rows.filter(row => DRAFT[row.view]).length}/${rows.length}; extras emitted ${total('emitted')}, surviving ${total('survives')}`)
}
