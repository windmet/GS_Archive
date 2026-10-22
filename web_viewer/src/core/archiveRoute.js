import { normalizeCollectionRoute, collectionKindLabel } from './CollectionRouteState.js'
import { normalizeEventBrowseState } from './EventCatalogRouteState.js'
import { pruneToRouteSchema } from './routeSchema.js'
import { STORY_KINDS, sectionLabel } from './archiveSections.js'
import { UNIT_CODE_TO_NAME, normalizeUnitCode } from '../utils/UnitNameMap.js'
const ROUTE_QUERY_KEYS = [
  'collection_kind','collection_category','collection_idol','collection_unit','collection_attribute','collection_page',
  'event_kind','event_sort','event_page',
  'portal_from',
  'portal_scope', 'home_from',
  'from',
  'reading',
  'reading_row',
  'reading_mode',
  'reading_rev',
  'reading_scope',
  'play_mode',
  'at_step',
  'view',
  'pick',
  'home_idol',
  'home_cue',
  'home_costume',
  'category',
  'idol',
  'group',
  'unit',
  'unit_filter',
  'story_type',
  'story_mode',
  'story_section',
  'story',
  'work_mode',
  'mobile_mode',
  'mobile_scenario',
  'event_scope',
  'availability',
  'sort',
  'episode',
  'card',
  'song',
  'stage',
  'song_scope',
  'event',
  'entity',
  'photo_idol',
  'photo',
  'voices',
  'gasha',
  'gasha_type',
  'rarity',
  'card_attribute',
  'asset_state',
  'relation_state',
  'q',
  'scenario',
  'start_step',
  'end_step',
  'voice',
  'return',
  'parent',
]

const VALID_VIEWS = new Set([
  'welcome',
  'idol_picker',
  'portal',
  'reader',
  'home',
  'idols',
  'idol_detail',
  'cards',
  'card_detail',
  'event_detail',
  'event_catalog',
  'collection_catalog',
  'photo_catalog',
  'unused_archive',
  'picture_studio',
  'gashas',
  'gasha_detail',
  'song_catalog',
  'song_detail',
  'chart_lab',
  'live',
  'studio',
  'experiments',
  'about',
  'archive_status',
  'story_catalog',
  'external_story_resources',
  'story_collection',
  'story_detail',
  'seasonal_campaign',
  'work_archive',
  'idol_story_archive',
  'mobile_archive',
  'unit_catalog',
  'unit_detail',
  'player',
  'spine_lab',
  'chibi_stage',
])

const VALID_CARD_RELATION_STATES = new Set(['all', 'card_story', 'event_card', 'gasha_card', 'release_series', 'unrelated'])
const VALID_CARD_ASSET_STATES = new Set(['all', 'visible_icon', 'complete_icons', 'has_large', 'single_state', 'missing_normal'])
const VALID_CARD_RARITIES = new Set(['all', 'N', 'R', 'SR', 'SSR'])
const VALID_CATEGORIES = new Set(['idol', 'idol_chat', 'idol_phone', 'cards'])
const VALID_EVENT_SCOPES = new Set(['all', 'fixed_unit_event', 'attribute_event', 'mixed_unit_event'])
const VALID_GASHA_TYPES = new Set(['all', 'standard_pickup', 'growing_fes', 'stage_step_up', 'full_roster_series', 'ticket_named'])
const VALID_STORY_AVAILABILITY = new Set(['all', 'playable', 'missing'])
const VALID_STORY_SORTS = new Set(['domain', 'title', 'resource', 'steps_desc', 'latest'])
const VALID_STORY_MODES = new Set(['portal', 'search'])
const VALID_WORK_MODES = new Set(['stories', 'lines'])
const VALID_PICK_TARGETS = new Set(['home', 'profile', 'work', 'story', 'mobile'])
const VALID_SONG_SCOPES = new Set(['all', 'movie', 'mvlive', 'layered', 'oneshot', 'special'])
const VALID_MOBILE_MODES = new Set(['personal', 'phone', 'unit', 'random'])
// A story link (story_detail) is not a page: it opens the story's owner page, so nothing returns to it.
const VALID_RETURN_VIEWS = new Set([...VALID_VIEWS].filter(view => !['player', 'spine_lab', 'chibi_stage', 'story_detail'].includes(view)))

const ARCHIVE_ROUTE_CONTRACTS = Object.freeze({
  welcome: { section: 'home', required: [] },
  idol_picker: { section: 'home', required: ['pickTarget'], fallback: 'welcome' },
  reader: { section: 'reader', required: [], fallback: 'story_catalog' },
  portal: { section: 'portal', required: [] },
  home: { section: 'home', required: [] },
  archive_status: { section: 'resources', required: [] },
  story_catalog: { section: 'stories', required: [] },
  external_story_resources: { section: 'stories', required: [] },
  story_collection: { section: 'stories', required: ['storyType', 'storySection'], fallback: 'story_catalog' },
  story_detail: { section: 'stories', required: ['story'], fallback: 'story_catalog' },
  seasonal_campaign: { section: 'stories', required: [], fallback: 'story_catalog' },
  work_archive: { section: 'stories', required: [], fallback: 'story_catalog' },
  idol_story_archive: { section: 'stories', required: [], fallback: 'story_catalog' },
  mobile_archive: { section: 'interactions', required: [], fallback: 'home' },
  unit_catalog: { section: 'idols', required: [] },
  unit_detail: { section: 'idols', required: ['unit'], fallback: 'unit_catalog' },
  idols: { section: 'category', required: [] },
  idol_detail: { section: 'idols', required: [], fallback: 'home' },
  cards: { section: 'cards', required: [], fallback: 'home' },
  card_detail: { section: 'cards', required: ['card'], fallback: 'cards' },
  event_detail: { section: 'events', required: ['event'], fallback: 'event_catalog' },
  event_catalog: { section: 'events', required: [] },
  collection_catalog: { section: 'collections', required: [] },
  photo_catalog: { section: 'photos', required: [] },
  unused_archive: { section: 'unused', required: [] },
  picture_studio: { section: 'studio', required: [], fallback:'studio' },
  gashas: { section: 'gashas', required: [] },
  gasha_detail: { section: 'gashas', required: ['gasha'], fallback: 'gashas' },
  song_catalog: { section: 'songs', required: [] },
  song_detail: { section: 'songs', required: ['song'], fallback: 'song_catalog' },
  // Without a song the chart tool opens on its own song picker, like the Chibi stage.
  chart_lab: { section: 'live', required: [] },
  live: { section: 'live', required: [] },
  studio: { section: 'studio', required: [] },
  // Legacy `?view=experiments` links resolve to the LIVE landing page (see normalizeArchiveRoute).
  experiments: { section: 'live', required: [] },
  about: { section: 'about', required: [] },
  player: { section: 'player', required: [], fallback: 'home' },
  spine_lab: { section: 'resources', required: [] },
  chibi_stage: { section: 'live', required: [] },
})

// Route sections that have a navigation entry; their names come from archiveSections.js.
const ARCHIVE_NAVIGATION = Object.freeze(['home', 'stories', 'songs', 'idols', 'cards', 'gashas', 'interactions', 'events',
  'collections', 'honors', 'currencies', 'costumes', 'photos', 'unused', 'live', 'studio', 'resources']
  .map(id => Object.freeze({ id, label: sectionLabel(id) })))

const BREADCRUMB_HIDDEN_VIEWS = new Set(['home', 'portal', 'reader', 'player', 'spine_lab', 'chibi_stage'])
const SOURCE_ROUTE_FORBIDDEN_VIEWS = new Set(['reader', 'player', 'spine_lab', 'chibi_stage', 'chart_lab'])
const MAX_SOURCE_DEPTH = 16
const MAX_SOURCE_LENGTH = 8192

export function ownsArchiveSource(view, returnView = '') {
  // A player without a return page (a shared scenario link) still carries where it was opened from.
  if (view === 'player') return returnView !== 'player' && (!returnView || ownsArchiveSource(returnView))
  return VALID_VIEWS.has(view) && !['home', 'portal'].includes(view)
}

// A launcher return is a bounded, local archive query, never an external URL.
// Strip nesting before normalization so a shared portal URL cannot recurse.
export function readPortalReturnRoute(query) {
  if (typeof query !== 'string' || !query.startsWith('?') || query.length > 8192) return normalizeArchiveRoute({ view: 'home' })
  const url = new URL(query, 'http://localhost/')
  url.searchParams.delete('portal_from')
  url.searchParams.delete('home_from')
  if (['portal', 'player', 'spine_lab', 'chibi_stage'].includes(url.searchParams.get('view')) || url.searchParams.has('scenario') || url.searchParams.has('file')) return normalizeArchiveRoute({ view: 'home' })
  const route = readArchiveRoute(url)
  return route.view === 'player' ? normalizeArchiveRoute({ view: 'home' }) : route
}

export function buildPortalReturnQuery(route) {
  if (['portal', 'player', 'spine_lab', 'chibi_stage'].includes(route.view)) return ''
  return buildArchiveUrl('http://localhost/', { ...route, homeFrom: '' }).search
}

// A Home visit can return only to a bounded portal context, never to another Home visit.
export function readHomeReturnRoute(query) {
  if (typeof query !== 'string' || !query.startsWith('?') || query.length > 8192) return null
  const url = new URL(query, 'http://localhost/')
  if (url.searchParams.get('view') !== 'portal') return null
  url.searchParams.delete('home_from')
  return readArchiveRoute(url)
}

// Keep the immediate source plus a flat tail of canonical queries. Flat encoding
// avoids exponentially escaped nested `from` URLs; oldest entries expire first.
function sourceFrames(query) {
  const frames = []
  let pending = [query]
  while (pending.length && frames.length < MAX_SOURCE_DEPTH) {
    const next = pending.shift()
    if (typeof next !== 'string' || !next.startsWith('?') || next.length > MAX_SOURCE_LENGTH) break
    const url = new URL(next, 'http://localhost/')
    const nested = url.searchParams.get('from')
    const tail = url.searchParams.get('via')
    url.searchParams.delete('from')
    url.searchParams.delete('via')
    const view = url.searchParams.get('view') || 'home'
    if (view !== 'portal') url.searchParams.delete('portal_from')
    if (!VALID_VIEWS.has(view) || SOURCE_ROUTE_FORBIDDEN_VIEWS.has(view) ||
        url.searchParams.has('scenario') || url.searchParams.has('file')) break
    const route = readArchiveRoute(url)
    if (route.view !== view) break
    frames.push(buildArchiveUrl('http://localhost/', route).search || '?view=home')
    if (tail) {
      try {
        const entries = JSON.parse(tail)
        if (Array.isArray(entries)) pending = entries.slice(0, MAX_SOURCE_DEPTH - frames.length)
      } catch { break }
    } else if (nested) pending.unshift(nested) // Accept older single-source URLs.
  }
  return frames
}

function packSourceFrames(frames) {
  const kept = frames.slice(0, MAX_SOURCE_DEPTH)
  while (kept.length) {
    const url = new URL(kept[0], 'http://localhost/')
    if (kept.length > 1) url.searchParams.set('via', JSON.stringify(kept.slice(1)))
    if (url.search.length <= MAX_SOURCE_LENGTH) return url.search
    kept.pop()
  }
  return ''
}

export function readArchiveSourceRoute(query) {
  const frames = sourceFrames(query)
  if (!frames.length) return normalizeArchiveRoute({ view: 'home' })
  const route = readArchiveRoute(new URL(frames[0], 'http://localhost/'))
  const tail = packSourceFrames(frames.slice(1))
  if (tail && ownsArchiveSource(route.view)) route.sourceRoute = tail
  return route
}

export function buildArchiveSourceQuery(route) {
  if (!route || SOURCE_ROUTE_FORBIDDEN_VIEWS.has(route.view)) return ''
  const current = buildArchiveUrl('http://localhost/', { ...route, sourceRoute: '' }).search || '?view=home'
  return packSourceFrames([current, ...sourceFrames(route.sourceRoute)])
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeScenarioFile(value) {
  const normalized = clean(value).replace(/^\/?data\/compiled\//, '')
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) return ''
  return normalized.endsWith('.json') ? normalized : `${normalized}.json`
}

function allowed(value, values, fallback) {
  return values.has(value) ? value : fallback
}

function positiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

// The retired story file browser (groups › files, and 第零话 › episodes › files) predates the story pages.
// Its links open today's pages: a directory opens its landing, a story file its owner page through the
// story link (story_detail, resolved by core/StoryOwner.js). Its ids are frozen, so the file names are
// derived here: a main-story group is the chapter prefix, every other story group is the file itself.
const RETIRED_DIRECTORY_VIEWS = new Set(['groups', 'files', 'episodes', 'episode_zero_units'])
const RETIRED_STORY_GROUP_CATEGORIES = new Set(['event', 'episode_zero', 'idol_phone'])

function retiredDirectoryRoute(input) {
  const view = clean(input.view), category = clean(input.category), idol = clean(input.idol)
  const group = clean(input.group), unit = clean(input.unit)
  const landing = storyType => ({ view: 'story_catalog', storyType })
  if (view === 'episode_zero_units') return landing('unit_story')
  if (view === 'episodes') {
    return /^[0-9]{3}[a-z0-9]{3}$/.test(unit)
      ? { view: 'story_collection', storyType: 'unit_story', storySection: String(Number(unit.slice(0, 3))) }
      : landing('unit_story')
  }
  if (view === 'files' && group) {
    // Idol groups also held card stories and chats, which are not stories; those open the idol's own page.
    if (category === 'main_story') return { view: 'story_detail', story: `${group}_00.json` }
    if (RETIRED_STORY_GROUP_CATEGORIES.has(category) || category === 'idol' && /^1_[25]_/.test(group))
      return { view: 'story_detail', story: `${group}.json` }
  }
  if (category === 'main_story') return landing('main')
  if (category === 'event') return landing('event')
  if (category === 'extra') return landing('extra')
  if (category === 'episode_zero') return landing('unit_story')
  if (category === 'idol') return { view: 'idol_detail', idol }
  // A unit's group chat was filed under the unit's 3-digit code (001jup); it opens the unit's page.
  const chatUnit = category === 'idol_chat' && normalizeUnitCode(idol || group.match(/^8_2_x_(\w{6})_/)?.[1] || '')
  if (chatUnit && UNIT_CODE_TO_NAME[chatUnit]) return { view: 'unit_detail', unit: chatUnit }
  // The idol grid view already resolves these to the communication archive (or its idol picker).
  if (['idol_chat', 'idol_phone', 'cards'].includes(category)) return { view: 'idols', category, idol }
  return { view: 'home' }
}

export function normalizeArchiveRoute(input = {}) {
  if (!input.scenario && RETIRED_DIRECTORY_VIEWS.has(clean(input.view)))
    input = { ...input, category: '', idol: '', group: '', unit: '', ...retiredDirectoryRoute(input) }
  const scenario = normalizeScenarioFile(input.scenario || '')
  const voice = clean(input.voice)
  const card = clean(input.card)
  let view = scenario ? 'player' : allowed(clean(input.view), VALID_VIEWS, 'home')
  if (view === 'experiments') view = 'live'
  let category = allowed(clean(input.category), VALID_CATEGORIES, '')
  let idol = clean(input.idol)
  let pickTarget = allowed(clean(input.pickTarget), VALID_PICK_TARGETS, '')

  if (view === 'idols' && category === 'idol' && idol) view = 'idol_detail'
  // Without an explicit idol this is the card member grid, including its All filter.
  if (view === 'idols' && category === 'cards' && idol) view = 'cards'
  if (view === 'idols' && ['idol_chat', 'idol_phone'].includes(category)) {
    view = idol ? 'mobile_archive' : 'idol_picker'
    if (!idol) pickTarget = 'mobile'
    category = ''
  }
  if (view === 'idol_detail' && !idol) {
    view = 'idol_picker'
    pickTarget = 'profile'
  }
  if (view === 'mobile_archive' && !idol) {
    view = 'idol_picker'
    pickTarget = 'mobile'
  }
  if (view === 'work_archive' && !idol) {
    view = 'idol_picker'
    pickTarget = 'work'
  }
  if (view === 'idol_story_archive' && !idol) {
    view = 'idol_picker'
    pickTarget = 'story'
  }

  if (['idol_detail'].includes(view)) category = 'idol'
  if (['cards', 'card_detail'].includes(view)) category = 'cards'

  const route = {
    view,
    pickTarget,
    homeIdol: clean(input.homeIdol),
    homeCue: clean(input.homeCue),
    homeCostume: clean(input.homeCostume),
    category,
    idol,
    unit: clean(input.unit),
    unitFilter: clean(input.unitFilter),
    storyType: clean(input.storyType),
    storyMode: allowed(clean(input.storyMode), VALID_STORY_MODES, 'portal'),
    storySection: clean(input.storySection),
    story: normalizeScenarioFile(input.story || ''),
    workMode: allowed(clean(input.workMode), VALID_WORK_MODES, 'stories'),
    mobileMode: view === 'mobile_archive' && clean(input.category) === 'idol_phone'
      ? 'phone'
      : allowed(clean(input.mobileMode), VALID_MOBILE_MODES, 'personal'),
    mobileScenario: clean(input.mobileScenario),
    eventScope: clean(input.storyType) === 'event'
      ? allowed(clean(input.eventScope), VALID_EVENT_SCOPES, 'all')
      : 'all',
    availability: allowed(clean(input.availability), VALID_STORY_AVAILABILITY, 'all'),
    sort: allowed(clean(input.sort), VALID_STORY_SORTS, 'domain'),
    episode: clean(input.episode),
    card,
    song: clean(input.song),
    songScope: allowed(clean(input.songScope), VALID_SONG_SCOPES, 'all'),
    event: clean(input.event),
    ...(view==='event_catalog' ? {eventBrowse:normalizeEventBrowseState(input.eventBrowse)} : {}),
    ...(view==='collection_catalog' ? normalizeCollectionRoute(input) : {}),
    ...(['photo_catalog','picture_studio'].includes(view) ? {
      photoIdol:/^\d{1,4}$/.test(input.photoIdol || '') ? String(input.photoIdol) : '',
      photoEntity:/^(spots|scenes|faces|poses|stickers|frames|filters):\d+$/.test(input.photoEntity || '') ? input.photoEntity : ''} : {}),
    ...((view === 'unused_archive' || (view === 'player' && clean(input.returnView) === 'unused_archive')) && /^[a-z][a-z-]{1,23}$/.test(input.voiceShelf || '') ? { voiceShelf: input.voiceShelf } : {}),
    gasha: clean(input.gasha),
    gashaType: allowed(clean(input.gashaType), VALID_GASHA_TYPES, 'all'),
    rarity: allowed(clean(input.rarity), VALID_CARD_RARITIES, 'all'),
    ...(['Physical','Intelligence','Mental'].includes(clean(input.cardAttribute)) ? {cardAttribute:clean(input.cardAttribute)} : {}),
    assetState: allowed(clean(input.assetState), VALID_CARD_ASSET_STATES, 'all'),
    relationState: allowed(clean(input.relationState), VALID_CARD_RELATION_STATES, 'all'),
    query: clean(input.query),
    scenario,
    startStep: positiveInteger(input.startStep),
    endStep: positiveInteger(input.endStep),
    voice,
    returnView: allowed(clean(input.returnView), VALID_RETURN_VIEWS, ''),
    parentView: allowed(clean(input.parentView), VALID_RETURN_VIEWS, ''),
  }

  const contract = ARCHIVE_ROUTE_CONTRACTS[view]
  if (view === 'player' && !scenario && !(voice && (card || OFFICE_VOICE_CUE.test(voice)))) view = contract.fallback
  else if (contract?.required.some(key => !route[key])) view = contract.fallback
  route.view = view || 'home'
  if (route.view === 'chibi_stage') {
    const stageId = clean(input.stageId)
    route.stageId = /^[a-z0-9_]{1,100}$/.test(stageId) ? stageId : ''
  }
  if (route.view === 'reader' || (route.view === 'player' && route.returnView === 'reader')) {
    route.reading = /^[A-Za-z0-9_-]+$/.test(input.reading || '') ? input.reading : ''
    route.readingRow = typeof input.readingRow === 'string' && input.readingRow.length <= 240 ? input.readingRow : ''
    // Empty: follow the visitor's saved story-text choice. Only a mode that differs from it is in the URL.
    route.readingMode = ['original', 'translation', 'bilingual'].includes(input.readingMode) ? input.readingMode : ''
    route.readingScope = input.readingScope === 'chapter' ? 'chapter' : ''
    route.readingRev = /^sha256:[a-f0-9]{64}$/.test(input.readingRev || '') ? input.readingRev : ''
    if (!route.reading) route.view = 'story_catalog'
  }
  if (route.view === 'player') route.playMode = ['chapter','segment'].includes(input.playMode) ? input.playMode : ''
  if (route.view === 'player' && positiveInteger(input.initialStep)) route.initialStep = positiveInteger(input.initialStep)
  if (route.view === 'portal') {
    const portalFrom = clean(input.portalFrom)
    route.portalFrom = portalFrom ? buildPortalReturnQuery(readPortalReturnRoute(portalFrom)) : ''
    if (input.portalScope === 'all' || /^\d{3}[a-z0-9]{3}$/.test(input.portalScope || '')) route.portalScope = input.portalScope
    if (clean(input.portalQuery)) route.portalQuery = clean(input.portalQuery).slice(0, 120)
  }
  if (route.view === 'home' && clean(input.homeFrom)) {
    const source = readHomeReturnRoute(input.homeFrom)
    if (source) route.homeFrom = buildArchiveUrl('http://localhost/', source).search
  }
  if (ownsArchiveSource(route.view, route.returnView) && clean(input.sourceRoute)) {
    const frames = sourceFrames(input.sourceRoute)
    const sourceRoute = packSourceFrames(frames)
    if (sourceRoute) route.sourceRoute = sourceRoute
  }
  return route
}

export function archiveSectionForRoute(route) {
  const normalized = normalizeArchiveRoute(route)
  const section = ARCHIVE_ROUTE_CONTRACTS[normalized.view]?.section || 'stories'
  // Items and honors share one catalogue page but are separate destinations in the navigation.
  if (section === 'collections') return ({ honors:'honors', currencies:'currencies', costumes:'costumes' })[normalized.collection?.kind] || 'collections'
  if (section !== 'category') return section
  if (normalized.category === 'cards') return 'cards'
  if (['idol_chat', 'idol_phone'].includes(normalized.category)) return 'interactions'
  if (normalized.category === 'idol') return 'idols'
  return 'stories'
}

function breadcrumbTitle(entity, fallback) {
  return clean(entity?.title) || clean(entity?.id) || fallback
}

function breadcrumbFilters(route) {
  return {
    query: route.query,
    unitFilter: route.unitFilter,
    eventScope: route.eventScope,
    rarity: route.rarity,
    cardAttribute: route.cardAttribute,
    assetState: route.assetState,
    relationState: route.relationState,
    gashaType: route.gashaType,
    availability: route.availability,
    sort: route.sort,
    storyMode: route.storyMode,
    songScope: route.songScope,
  }
}

function breadcrumbRoute(route, view, overrides = {}) {
  return {
    ...breadcrumbFilters(route),
    view,
    ...overrides,
    parentView: '',
    returnView: '',
  }
}

/**
 * Build the canonical archive hierarchy for the active query route.
 * Browsing provenance (`parent` / `return`) is intentionally excluded.
 */
export function buildArchiveBreadcrumbs(inputRoute, entity = {}) {
  const route = normalizeArchiveRoute(inputRoute)
  if (BREADCRUMB_HIDDEN_VIEWS.has(route.view)) return []

  const home = { label: sectionLabel('portal'), route: { view: 'portal' } }
  // The studio is a tool, not a photo-catalogue page: it hangs from the root like LIVE.
  if (route.view === 'picture_studio') return [home, { label: sectionLabel('studio') }]
  if (['event_catalog','collection_catalog','photo_catalog'].includes(route.view)) return [home,{label:route.view==='collection_catalog' ? collectionKindLabel(route.collection?.kind) : sectionLabel({event_catalog:'events',photo_catalog:'photos'}[route.view])}]
  const current = (fallback, id = '') => ({
    label: breadcrumbTitle({ title: entity.title, id: entity.id || id }, fallback),
  })

  if (['idols', 'idol_detail'].includes(route.view)) {
    const idols = {
      label: sectionLabel('idols'),
      route: breadcrumbRoute(route, 'idols', { idol: '', category: '' }),
    }
    return route.view === 'idols' ? [home, { label: idols.label }] : [
      home,
      idols,
      current('偶像详情', route.idol),
    ]
  }

  if (['unit_catalog', 'unit_detail'].includes(route.view)) {
    const units = { label: sectionLabel('units'), route: breadcrumbRoute(route, 'unit_catalog', { unit: '' }) }
    return route.view === 'unit_catalog' ? [home, { label: units.label }] : [
      home,
      units,
      current('组合详情', route.unit),
    ]
  }

  if (['cards', 'card_detail'].includes(route.view)) {
    const cards = {
      label: sectionLabel('cards'),
      route: breadcrumbRoute(route, 'cards', {
        idol: route.idol,
        card: '',
        category: 'cards',
      }),
    }
    return route.view === 'cards' ? [home, { label: cards.label }] : [
      home,
      cards,
      current('卡片详情', route.card),
    ]
  }

  if (['gashas', 'gasha_detail'].includes(route.view)) {
    const gashas = { label: sectionLabel('gashas'), route: breadcrumbRoute(route, 'gashas', { gasha: '' }) }
    return route.view === 'gashas' ? [home, { label: gashas.label }] : [
      home,
      gashas,
      current('卡池详情', route.gasha),
    ]
  }

  if (['song_catalog', 'song_detail'].includes(route.view)) {
    const songs = { label: sectionLabel('songs'), route: breadcrumbRoute(route, 'song_catalog', { song: '' }) }
    return route.view === 'song_catalog' ? [home, { label: songs.label }] : [
      home,
      songs,
      current('歌曲详情', route.song),
    ]
  }

  if (route.view === 'event_detail') {
    return [
      home,
      {
        label: sectionLabel('events'),
        route: breadcrumbRoute(route, 'event_catalog', {
          storyType: '',
          storySection: '',
          story: '',
          event: '',
        }),
      },
      current('活动详情', route.event),
    ]
  }

  if (route.view === 'external_story_resources') {
    return [home, { label: sectionLabel('stories'), route: breadcrumbRoute(route, 'story_catalog') }, { label: STORY_KINDS.external.label }]
  }

  if (['story_catalog', 'story_collection'].includes(route.view)) {
    const formalDomainLabels = {
      main: '主线剧情',
      extra: '额外剧情',
      birthday: '生日剧情',
      unit_story: '组合前传',
      event: '活动剧情',
    }
    const formalDomainLabel = formalDomainLabels[route.storyType] || ''
    const stories = {
      label: sectionLabel('stories'),
      route: breadcrumbRoute(route, 'story_catalog', {
        storyType: '',
        storySection: '',
        story: '',
      }),
    }
    if (route.view === 'story_catalog') {
      return formalDomainLabel
        ? [home, stories, { label: formalDomainLabel }]
        : [home, { label: stories.label }]
    }

    const items = [home, stories]
    const domainLabel = clean(entity.domainLabel)
    if (domainLabel) {
      items.push({
        label: domainLabel,
        route: breadcrumbRoute(route, 'story_catalog', {
          storyType: formalDomainLabel ? route.storyType : '',
          storySection: '',
          story: '',
          storyMode: 'portal',
        }),
      })
    }
    items.push(current('故事章节', route.story || route.storySection))
    return items.length <= 4 ? items : [items[0], ...items.slice(-3)]
  }

  if (route.view === 'archive_status') return [home, { label: sectionLabel('resources') }]
  if (route.view === 'about') return [home, { label: sectionLabel('about') }]
  if (route.view === 'unused_archive') return [home, { label: sectionLabel('unused') }]
  const storyRoot = { label: sectionLabel('stories'), route: breadcrumbRoute(route, 'story_catalog') }
  if (route.view === 'seasonal_campaign') return [home, storyRoot, current('季节企划', route.storySection)]
  if (route.view === 'work_archive') return [home, storyRoot, current(STORY_KINDS.work.label, route.idol)]
  if (route.view === 'idol_story_archive') return [home, storyRoot, current(STORY_KINDS.idol_story.label, route.idol)]
  if (route.view === 'mobile_archive') return [home, current(sectionLabel('interactions'), route.idol)]

  return [home, current('资料')]
}

// Public path locators: a detail page whose address is only its identity is published as a path
// (/idols/001tom/) instead of ?view=…. Internally every route stays in query form (buildArchiveUrl, source
// frames, restoration keys); only the address bar and shareable hrefs use the path. A query `view` always
// wins, so older links and relative ?view=… links followed from a path page keep working. Add a view here
// only after it is in ENFORCED_ROUTE_VIEWS (see docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md).
const PUBLIC_PATH_ROUTES = Object.freeze([
  Object.freeze({ view: 'idol_detail', prefix: 'idols', param: 'idol', implied: { category: 'idol' }, pattern: /^[0-9]{3}[a-z]{3}$/ }),
  Object.freeze({ view: 'unit_detail', prefix: 'units', param: 'unit', implied: {}, pattern: /^[0-9]{2}[a-z0-9]{3}$/ }),
  // Cards are addressed by resource_id (001tom_n01), the id every card link and read-model row carries.
  Object.freeze({ view: 'card_detail', prefix: 'cards', param: 'card', implied: {}, pattern: /^[0-9]{3}[a-z]{3}_[a-z]{1,3}[0-9]{2}$/ }),
  // Songs are addressed by their six-character song_code (brndnf, drv999), primaries and variants alike.
  Object.freeze({ view: 'song_detail', prefix: 'songs', param: 'song', implied: {}, pattern: /^[a-z0-9]{6}$/ }),
  // Events keep their read-model id: theater and tour events are 4 + event code (410001, 430001), every
  // other event is `event:<code>` (event:10019, event:20001). The path drops that prefix, so both forms map
  // to a path and back without the catalogue: six digits are the legacy id, five digits are a code.
  Object.freeze({ view: 'event_detail', prefix: 'events', param: 'event', implied: {}, pattern: /^(4[0-9]{5}|[1-9][0-9]{4})$/,
    fromPath: segment => segment.length === 5 ? `event:${segment}` : segment, toPath: id => id.replace(/^event:(?=[0-9]{5}$)/, '') }),
  // Gashas: announcement ids (210003, 1300012, 12007210) and ticket-only pools (ticket-<16 hex>).
  Object.freeze({ view: 'gasha_detail', prefix: 'gashas', param: 'gasha', implied: {}, pattern: /^([0-9]{6,8}|ticket-[0-9a-f]{16})$/ }),
  // An idol's 事务所 and 通信 are addressed by the idol; the cue and costume, or the mode, unit and open call, stay in the query.
  Object.freeze({ view: 'home', prefix: 'office', param: 'home_idol', implied: {}, pattern: /^[0-9]{3}[a-z]{3}$/ }),
  Object.freeze({ view: 'mobile_archive', prefix: 'mobile', param: 'idol', implied: {}, pattern: /^[0-9]{3}[a-z]{3}$/ }),
])

// Section roots: a catalogue's own address is its section path (/cards/); its filters stay in the query
// (/cards/?rarity=SSR). `implied` parameters are part of the identity, as for the detail paths.
const SECTION_PATH_ROUTES = Object.freeze([
  Object.freeze({ view: 'idols', prefix: 'idols', implied: { category: 'idol' } }),
  Object.freeze({ view: 'unit_catalog', prefix: 'units', implied: {} }),
  Object.freeze({ view: 'cards', prefix: 'cards', implied: { category: 'cards' } }),
  Object.freeze({ view: 'song_catalog', prefix: 'songs', implied: {} }),
  Object.freeze({ view: 'event_catalog', prefix: 'events', implied: {} }),
  Object.freeze({ view: 'gashas', prefix: 'gashas', implied: {} }),
  Object.freeze({ view: 'story_catalog', prefix: 'stories', implied: {} }),
  Object.freeze({ view: 'collection_catalog', prefix: 'items', implied: { collection_kind: 'items' } }),
  Object.freeze({ view: 'collection_catalog', prefix: 'honors', implied: { collection_kind: 'honors' } }),
  Object.freeze({ view: 'collection_catalog', prefix: 'currencies', implied: { collection_kind: 'currencies' } }),
  Object.freeze({ view: 'collection_catalog', prefix: 'costumes', implied: { collection_kind: 'costumes' } }),
  Object.freeze({ view: 'photo_catalog', prefix: 'photos', implied: {} }),
  Object.freeze({ view: 'unused_archive', prefix: 'unused', implied: {} }),
])
// Yamamura's office system lines preview in the player without a card (src/data/officeVoicePreviews.json).
export const OFFICE_VOICE_CUE = /^4_1_101_0[0-2]_a\d{4}$/
export const ARCHIVE_SECTION_PATHS = Object.freeze(SECTION_PATH_ROUTES.map(entry => entry.prefix))

// Whether a pathname is one of the public locators (a section root or a detail path) the address bar can carry.
export function isArchiveLocatorPath(pathname) {
  return locatorQuery(new URL(pathname, 'http://localhost/')).has('view')
}

function locatorQuery(url) {
  const params = new URLSearchParams(url.searchParams)
  if (params.has('view')) return params
  const root = /^\/([a-z]+)\/?$/.exec(url.pathname)
  const section = root && SECTION_PATH_ROUTES.find(entry => entry.prefix === root[1])
  if (section) {
    params.set('view', section.view)
    for (const [key, value] of Object.entries(section.implied)) params.set(key, value)
    return params
  }
  const match = /^\/([a-z]+)\/([^/]+)\/?$/.exec(url.pathname)
  const locator = match && PUBLIC_PATH_ROUTES.find(entry => entry.prefix === match[1] && entry.pattern.test(match[2]))
  if (!locator) return params
  params.set('view', locator.view)
  params.set(locator.param, locator.fromPath ? locator.fromPath(match[2]) : match[2])
  for (const [key, value] of Object.entries(locator.implied)) params.set(key, value)
  return params
}

// Rewrites a query-form archive URL to its public address: a path for PUBLIC_PATH_ROUTES and
// SECTION_PATH_ROUTES, `/` otherwise.
function publicArchiveUrl(url) {
  const view = url.searchParams.get('view')
  const section = SECTION_PATH_ROUTES.find(entry => entry.view === view &&
    Object.entries(entry.implied).every(([key, value]) => url.searchParams.get(key) === value))
  if (section) {
    url.pathname = `/${section.prefix}/`
    url.searchParams.delete('view')
    for (const key of Object.keys(section.implied)) url.searchParams.delete(key)
    return url
  }
  const locator = PUBLIC_PATH_ROUTES.find(entry => entry.view === view)
  const identity = locator && url.searchParams.get(locator.param)
  const id = locator?.toPath ? locator.toPath(identity || '') : identity
  const implied = locator && Object.entries(locator.implied).every(([key, value]) => url.searchParams.get(key) === value)
  if (!locator || !implied || !locator.pattern.test(id || '')) {
    url.pathname = '/'
    return url
  }
  url.pathname = `/${locator.prefix}/${id}/`
  url.searchParams.delete('view')
  url.searchParams.delete(locator.param)
  for (const key of Object.keys(locator.implied)) url.searchParams.delete(key)
  return url
}

export function buildPublicArchiveUrl(input, route) {
  return publicArchiveUrl(buildArchiveUrl(input, route))
}

// `history` merges the current history entry's source: implied for the live location, opt-in for an
// explicitly passed current URL; independent links never inherit one.
export function readArchiveRoute(input = null, { history = !input } = {}) {
  const context = history ? historyNavigationContext() : {}
  const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.origin
  const current = input || (typeof window === 'undefined' ? base : window.location.href)
  const url = new URL(current, base)
  const params = locatorQuery(url)
  // Where an event Reader or an event detail was opened from rides history state, not the URL.
  const openedFrom = params.get('view') === 'reader' ? context.reader || {}
    : params.get('view') === 'event_detail' ? context.event || {}
    : params.get('view') === 'gasha_detail' ? context.gasha || {} : {}
  return normalizeArchiveRoute({
    view: params.get('view'),
    pickTarget: params.get('pick'),
    portalFrom: params.get('portal_from') ?? context.portalFrom ?? null,
    portalScope: params.get('portal_scope'),
    portalQuery: params.get('q'),
    homeFrom: params.get('home_from') ?? context.homeFrom ?? null,
    sourceRoute: params.get('from') ?? context.source ?? null,
    reading: params.get('reading'),
    readingRow: params.get('reading_row'),
    readingMode: params.get('reading_mode'),
    readingRev: params.get('reading_rev'),
    readingScope: params.get('reading_scope'),
    playMode: params.get('play_mode'),
    initialStep: params.get('at_step'),
    homeIdol: clean(params.get('home_idol')),
    homeCue: clean(params.get('home_cue')),
    homeCostume: clean(params.get('home_costume')),
    category: clean(params.get('category')) || openedFrom.category || '',
    idol: clean(params.get('idol')) || openedFrom.idol || '',
    group: clean(params.get('group')),
    unit: clean(params.get('unit')) || openedFrom.unit || '',
    unitFilter: clean(params.get('unit_filter')),
    storyType: params.get('story_type') ?? openedFrom.story_type ?? null,
    storyMode: params.get('story_mode'),
    storySection: clean(params.get('story_section')) || openedFrom.story_section || '',
    story: params.get('story'),
    workMode: params.get('work_mode'),
    mobileMode: params.get('mobile_mode'),
    mobileScenario: params.get('mobile_scenario'),
    eventScope: params.get('event_scope'),
    availability: params.get('availability'),
    sort: params.get('sort'),
    episode: clean(params.get('episode')),
    card: clean(params.get('card')) || openedFrom.card || '',
    song: clean(params.get('song')),
    stageId: params.get('stage'),
    songScope: params.get('song_scope'),
    event: clean(params.get('event')),
    eventBrowse: { kind:params.get('event_kind'), sort:params.get('event_sort'), page:params.get('event_page') },
    entity: params.get('entity'),
    collection: { kind:params.get('collection_kind'), category:params.get('collection_category'), idol:params.get('collection_idol'), unit:params.get('collection_unit'), attribute:params.get('collection_attribute'), page:params.get('collection_page') },
    photoIdol: params.get('photo_idol'),
    photoEntity: params.get('photo'),
    voiceShelf: params.get('voices'),
    gasha: clean(params.get('gasha')),
    gashaType: params.get('gasha_type'),
    rarity: params.get('rarity'),
    cardAttribute: params.get('card_attribute'),
    assetState: params.get('asset_state'),
    relationState: params.get('relation_state'),
    query: clean(params.get('q')),
    scenario: params.get('scenario') || params.get('file'),
    startStep: params.get('start_step'),
    endStep: params.get('end_step'),
    voice: clean(params.get('voice')),
    returnView: clean(params.get('return')),
    parentView: clean(params.get('parent')) || openedFrom.parent || '',
  })
}

export function buildArchiveUrl(input, route) {
  const url = new URL(input, typeof window === 'undefined' ? 'http://localhost/' : window.location.origin)
  const normalized = normalizeArchiveRoute(route)
  for (const key of ROUTE_QUERY_KEYS) url.searchParams.delete(key)
  url.searchParams.delete('file')

  url.searchParams.set('view', normalized.view)
  if (normalized.view === 'event_catalog') {
    const browse = normalizeEventBrowseState(normalized.eventBrowse)
    if (browse.kind) url.searchParams.set('event_kind', browse.kind)
    if (browse.sort !== 'newest') url.searchParams.set('event_sort', browse.sort)
    if (browse.page) url.searchParams.set('event_page', String(browse.page))
  }
  if (normalized.view === 'collection_catalog' && normalized.entity) url.searchParams.set('entity', normalized.entity)
  if (normalized.view === 'collection_catalog') {
    const c = normalized.collection
    url.searchParams.set('collection_kind', c.kind)
    for (const key of ['category','idol','unit','attribute','page']) if(c[key]) url.searchParams.set(`collection_${key}`, String(c[key]))
  }
  if (['photo_catalog','picture_studio'].includes(normalized.view) && normalized.photoIdol) url.searchParams.set('photo_idol', normalized.photoIdol)
  if (['photo_catalog','picture_studio'].includes(normalized.view) && normalized.photoEntity) url.searchParams.set('photo', normalized.photoEntity)
  if (normalized.voiceShelf) url.searchParams.set('voices', normalized.voiceShelf)
  if (normalized.pickTarget) url.searchParams.set('pick', normalized.pickTarget)
  if (normalized.view === 'reader' || (normalized.view === 'player' && normalized.returnView === 'reader')) {
    url.searchParams.set('reading', normalized.reading)
    if (normalized.readingRow) url.searchParams.set('reading_row', normalized.readingRow)
    if (normalized.readingMode) url.searchParams.set('reading_mode', normalized.readingMode)
    if (normalized.readingScope) url.searchParams.set('reading_scope', normalized.readingScope)
    if (normalized.readingRev) url.searchParams.set('reading_rev', normalized.readingRev)
    if (normalized.view === 'reader') {
      if (normalized.sourceRoute) url.searchParams.set('from', normalized.sourceRoute)
      if (normalized.category) url.searchParams.set('category', normalized.category)
      if (normalized.idol) url.searchParams.set('idol', normalized.idol)
      if (normalized.unit) url.searchParams.set('unit', normalized.unit)
      if (normalized.event) url.searchParams.set('event', normalized.event)
      if (normalized.parentView) url.searchParams.set('parent', normalized.parentView)
      if (normalized.storyType) url.searchParams.set('story_type', normalized.storyType)
      if (normalized.storySection) url.searchParams.set('story_section', normalized.storySection)
      if (normalized.storyType === 'idol_story' && normalized.episode) url.searchParams.set('episode', normalized.episode)
      if (normalized.story) url.searchParams.set('story', normalized.story)
      if (normalized.workMode !== 'stories') url.searchParams.set('work_mode', normalized.workMode)
      return url
    }
  }
  if (normalized.view === 'player' && normalized.playMode) url.searchParams.set('play_mode', normalized.playMode)
  if (normalized.view === 'player' && normalized.initialStep) url.searchParams.set('at_step', String(normalized.initialStep))
  if (normalized.view === 'portal') {
    if (normalized.portalFrom) url.searchParams.set('portal_from', normalized.portalFrom)
    if (normalized.portalScope) url.searchParams.set('portal_scope', normalized.portalScope)
    if (normalized.portalQuery) url.searchParams.set('q', normalized.portalQuery)
    return url
  }
  if (normalized.view === 'home' && normalized.homeIdol) url.searchParams.set('home_idol', normalized.homeIdol)
  if (normalized.view === 'home' && normalized.homeCue) url.searchParams.set('home_cue', normalized.homeCue)
  if (normalized.view === 'home' && normalized.homeCostume) url.searchParams.set('home_costume', normalized.homeCostume)
  if (normalized.view === 'home' && normalized.homeFrom) url.searchParams.set('home_from', normalized.homeFrom)
  if (normalized.category) url.searchParams.set('category', normalized.category)
  if (normalized.idol) url.searchParams.set('idol', normalized.idol)
  if (normalized.unit) url.searchParams.set('unit', normalized.unit)
  if (normalized.unitFilter) url.searchParams.set('unit_filter', normalized.unitFilter)
  if (normalized.storyType) url.searchParams.set('story_type', normalized.storyType)
  if (normalized.storyMode !== 'portal') url.searchParams.set('story_mode', normalized.storyMode)
  if (normalized.storySection) url.searchParams.set('story_section', normalized.storySection)
  if (normalized.story) url.searchParams.set('story', normalized.story)
  if (normalized.workMode !== 'stories') url.searchParams.set('work_mode', normalized.workMode)
  if (normalized.mobileMode !== 'personal') url.searchParams.set('mobile_mode', normalized.mobileMode)
  if (normalized.mobileScenario) url.searchParams.set('mobile_scenario', normalized.mobileScenario)
  if (normalized.eventScope !== 'all') url.searchParams.set('event_scope', normalized.eventScope)
  if (normalized.availability !== 'all') url.searchParams.set('availability', normalized.availability)
  if (normalized.sort !== 'domain') url.searchParams.set('sort', normalized.sort)
  if (normalized.episode) url.searchParams.set('episode', normalized.episode)
  if (normalized.card) url.searchParams.set('card', normalized.card)
  if (normalized.song) url.searchParams.set('song', normalized.song)
  if (normalized.view === 'chibi_stage' && normalized.stageId) url.searchParams.set('stage', normalized.stageId)
  if (normalized.songScope !== 'all') url.searchParams.set('song_scope', normalized.songScope)
  if (normalized.event) url.searchParams.set('event', normalized.event)
  if (normalized.gasha) url.searchParams.set('gasha', normalized.gasha)
  if (normalized.gashaType !== 'all') url.searchParams.set('gasha_type', normalized.gashaType)
  if (normalized.cardAttribute && normalized.cardAttribute !== 'all') url.searchParams.set('card_attribute', normalized.cardAttribute)
  if (normalized.rarity !== 'all') url.searchParams.set('rarity', normalized.rarity)
  if (normalized.assetState !== 'all') url.searchParams.set('asset_state', normalized.assetState)
  if (normalized.relationState !== 'all') url.searchParams.set('relation_state', normalized.relationState)
  if (normalized.query) url.searchParams.set('q', normalized.query)
  if (normalized.scenario) url.searchParams.set('scenario', normalized.scenario)
  if (normalized.scenario && normalized.startStep) url.searchParams.set('start_step', String(normalized.startStep))
  if (normalized.scenario && normalized.endStep) url.searchParams.set('end_step', String(normalized.endStep))
  if (normalized.voice) url.searchParams.set('voice', normalized.voice)
  if (normalized.returnView) url.searchParams.set('return', normalized.returnView)
  if (normalized.parentView) url.searchParams.set('parent', normalized.parentView)
  if (normalized.sourceRoute) url.searchParams.set('from', normalized.sourceRoute)
  return pruneToRouteSchema(url, normalized.view, normalized.returnView, ROUTE_QUERY_KEYS)
}

// How the user arrived (the Reader/Player return source, and the Portal/Home launcher returns) is
// navigation context, not page identity: the address bar keeps only the canonical page and this
// versioned record rides the history entry, so back, forward and refresh restore it. A copied URL
// carries none and falls back to its canonical parent. Older `from=`, `portal_from=` and `home_from=`
// URLs are still read; the next write moves them into history state.
const NAVIGATION_CONTEXT_KEY = 'sidemArchiveNav'
const NAVIGATION_CONTEXT_VERSION = 1
const LEGACY_SOURCE_KEY = 'sidemArchiveSource'
// Context field -> the legacy query parameter it replaced.
const NAVIGATION_CONTEXT_PARAMS = { source: 'from', portalFrom: 'portal_from', homeFrom: 'home_from' }

function localQuery(value) {
  return typeof value === 'string' && value.startsWith('?') ? value : null
}

// Fields an event Reader carries so that leaving it lands where the event was opened from.
const READER_CONTEXT_PARAMS = { parent: 'parent', category: 'category', unit: 'unit' }
// Where an event detail was opened from (/events/<id>/ keeps only the event). goBackFromEvent uses the parent
// and its identity when no source is restored, so they ride the history entry instead of the address.
const EVENT_CONTEXT_PARAMS = { parent: 'parent', category: 'category', unit: 'unit', card: 'card', idol: 'idol' }
// Where a gasha detail was opened from (/gashas/<id>/ keeps only the gasha): its parent, and the extra-story
// collection goBackFromGasha returns to.
const GASHA_CONTEXT_PARAMS = { parent: 'parent', story_type: 'story_type', story_section: 'story_section' }

function contextFrom(value, params) {
  if (!value || typeof value !== 'object') return null
  const out = {}
  for (const key of Object.keys(params)) if (typeof value[key] === 'string' && value[key] && value[key].length <= 120) out[key] = value[key]
  return Object.keys(out).length ? out : null
}

function historyNavigationContext() {
  if (typeof window === 'undefined') return {}
  const state = window.history.state
  const stored = state?.[NAVIGATION_CONTEXT_KEY]
  if (stored?.v === NAVIGATION_CONTEXT_VERSION) {
    return { ...Object.fromEntries(Object.keys(NAVIGATION_CONTEXT_PARAMS).map(key => [key, localQuery(stored[key])])),
      reader: contextFrom(stored.reader, READER_CONTEXT_PARAMS), event: contextFrom(stored.event, EVENT_CONTEXT_PARAMS),
      gasha: contextFrom(stored.gasha, GASHA_CONTEXT_PARAMS) }
  }
  return { source: localQuery(state?.[LEGACY_SOURCE_KEY]) }
}

export function writeArchiveRoute(route, { replace = false } = {}) {
  const url = buildArchiveUrl(window.location.href, route)
  const context = { v: NAVIGATION_CONTEXT_VERSION }
  for (const [key, param] of Object.entries(NAVIGATION_CONTEXT_PARAMS)) {
    const value = url.searchParams.get(param)
    if (value) context[key] = value
    url.searchParams.delete(param)
  }
  if (url.searchParams.get('view') === 'reader' && url.searchParams.get('event')) {
    const reader = {}
    for (const [key, param] of Object.entries(READER_CONTEXT_PARAMS)) {
      const value = url.searchParams.get(param)
      if (value) reader[key] = value
      url.searchParams.delete(param)
    }
    if (Object.keys(reader).length) context.reader = reader
  }
  for (const [view, key, params] of [['event_detail', 'event', EVENT_CONTEXT_PARAMS], ['gasha_detail', 'gasha', GASHA_CONTEXT_PARAMS]]) {
    if (url.searchParams.get('view') !== view) continue
    const openedFrom = {}
    for (const [field, param] of Object.entries(params)) {
      const value = url.searchParams.get(param)
      if (value) openedFrom[field] = value
      url.searchParams.delete(param)
    }
    if (Object.keys(openedFrom).length) context[key] = openedFrom
  }
  const existingEntryId = window.history.state?.sidemArchiveEntryId
  const entryId = replace && typeof existingEntryId === 'string'
    ? existingEntryId
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const state = { ...window.history.state, archiveRoute: true, sidemArchiveEntryId: entryId }
  delete state[LEGACY_SOURCE_KEY]
  if (Object.keys(context).length > 1) state[NAVIGATION_CONTEXT_KEY] = context
  else delete state[NAVIGATION_CONTEXT_KEY]
  window.history[replace ? 'replaceState' : 'pushState'](state, '', publicArchiveUrl(url))
}

export function onArchivePopState(handler) {
  const listener = () => handler(readArchiveRoute())
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}

export { ARCHIVE_NAVIGATION, ARCHIVE_ROUTE_CONTRACTS, ROUTE_QUERY_KEYS, VALID_VIEWS }
