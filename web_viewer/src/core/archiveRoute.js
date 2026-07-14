const ROUTE_QUERY_KEYS = [
  'view',
  'category',
  'idol',
  'group',
  'unit',
  'unit_filter',
  'story_type',
  'event_scope',
  'availability',
  'sort',
  'episode',
  'card',
  'event',
  'gasha',
  'gasha_type',
  'rarity',
  'asset_state',
  'relation_state',
  'q',
  'scenario',
  'voice',
  'return',
  'parent',
]

const VALID_VIEWS = new Set([
  'home',
  'idols',
  'idol_detail',
  'groups',
  'episode_zero_units',
  'episodes',
  'files',
  'cards',
  'card_detail',
  'event_detail',
  'gashas',
  'gasha_detail',
  'archive_status',
  'story_catalog',
  'unit_catalog',
  'unit_detail',
  'player',
  'spine_lab',
])

const VALID_CARD_RELATION_STATES = new Set(['all', 'card_story', 'event_card', 'gasha_card', 'release_series', 'unrelated'])
const VALID_CARD_ASSET_STATES = new Set(['all', 'visible_icon', 'complete_icons', 'has_large', 'single_state', 'missing_normal'])
const VALID_CARD_RARITIES = new Set(['all', 'N', 'R', 'SR', 'SSR'])
const VALID_CATEGORIES = new Set(['main_story', 'event', 'idol', 'idol_chat', 'idol_phone', 'cards', 'episode_zero', 'extra'])
const VALID_EVENT_SCOPES = new Set(['all', 'fixed_unit_event', 'attribute_event', 'mixed_unit_event'])
const VALID_GASHA_TYPES = new Set(['all', 'standard_pickup', 'growing_fes', 'stage_step_up', 'full_roster_series'])
const VALID_STORY_AVAILABILITY = new Set(['all', 'playable', 'missing'])
const VALID_STORY_SORTS = new Set(['domain', 'title', 'resource', 'steps_desc'])
const VALID_RETURN_VIEWS = new Set([...VALID_VIEWS].filter(view => !['player', 'spine_lab'].includes(view)))

const ARCHIVE_ROUTE_CONTRACTS = Object.freeze({
  home: { section: 'home', required: [] },
  archive_status: { section: 'resources', required: [] },
  story_catalog: { section: 'stories', required: [] },
  unit_catalog: { section: 'idols', required: [] },
  unit_detail: { section: 'idols', required: ['unit'], fallback: 'unit_catalog' },
  idols: { section: 'category', required: [] },
  idol_detail: { section: 'idols', required: ['idol'], fallback: 'idols' },
  groups: { section: 'category', required: ['category'], fallback: 'home' },
  episode_zero_units: { section: 'stories', required: [] },
  episodes: { section: 'stories', required: ['unit'], fallback: 'episode_zero_units' },
  files: { section: 'category', required: ['group'], fallback: 'home' },
  cards: { section: 'cards', required: ['idol'], fallback: 'idols' },
  card_detail: { section: 'cards', required: ['card'], fallback: 'cards' },
  event_detail: { section: 'stories', required: ['event'], fallback: 'story_catalog' },
  gashas: { section: 'gashas', required: [] },
  gasha_detail: { section: 'gashas', required: ['gasha'], fallback: 'gashas' },
  player: { section: 'player', required: [], fallback: 'home' },
  spine_lab: { section: 'resources', required: [] },
})

const ARCHIVE_NAVIGATION = Object.freeze([
  { id: 'home', label: '首页' },
  { id: 'stories', label: '故事' },
  { id: 'idols', label: '偶像' },
  { id: 'cards', label: '卡片' },
  { id: 'gashas', label: '卡池' },
  { id: 'interactions', label: '互动' },
  { id: 'resources', label: '资源' },
])

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

export function normalizeArchiveRoute(input = {}) {
  const scenario = normalizeScenarioFile(input.scenario || '')
  const voice = clean(input.voice)
  const card = clean(input.card)
  let view = scenario ? 'player' : allowed(clean(input.view), VALID_VIEWS, 'home')
  let category = allowed(clean(input.category), VALID_CATEGORIES, '')

  if (['idol_detail'].includes(view)) category = 'idol'
  if (['cards', 'card_detail'].includes(view)) category = 'cards'
  if (['episode_zero_units', 'episodes'].includes(view)) category = 'episode_zero'

  const route = {
    view,
    category,
    idol: clean(input.idol),
    group: clean(input.group),
    unit: clean(input.unit),
    unitFilter: clean(input.unitFilter),
    storyType: clean(input.storyType),
    eventScope: clean(input.storyType) === 'event'
      ? allowed(clean(input.eventScope), VALID_EVENT_SCOPES, 'all')
      : 'all',
    availability: allowed(clean(input.availability), VALID_STORY_AVAILABILITY, 'all'),
    sort: allowed(clean(input.sort), VALID_STORY_SORTS, 'domain'),
    episode: clean(input.episode),
    card,
    event: clean(input.event),
    gasha: clean(input.gasha),
    gashaType: allowed(clean(input.gashaType), VALID_GASHA_TYPES, 'all'),
    rarity: allowed(clean(input.rarity), VALID_CARD_RARITIES, 'all'),
    assetState: allowed(clean(input.assetState), VALID_CARD_ASSET_STATES, 'all'),
    relationState: allowed(clean(input.relationState), VALID_CARD_RELATION_STATES, 'all'),
    query: clean(input.query),
    scenario,
    voice,
    returnView: allowed(clean(input.returnView), VALID_RETURN_VIEWS, ''),
    parentView: allowed(clean(input.parentView), VALID_RETURN_VIEWS, ''),
  }

  const contract = ARCHIVE_ROUTE_CONTRACTS[view]
  if (view === 'player' && !scenario && !(voice && card)) view = contract.fallback
  else if (contract?.required.some(key => !route[key])) view = contract.fallback
  route.view = view || 'home'
  return route
}

export function archiveSectionForRoute(route) {
  const normalized = normalizeArchiveRoute(route)
  const section = ARCHIVE_ROUTE_CONTRACTS[normalized.view]?.section || 'stories'
  if (section !== 'category') return section
  if (normalized.category === 'cards') return 'cards'
  if (['idol_chat', 'idol_phone'].includes(normalized.category)) return 'interactions'
  if (normalized.category === 'idol') return 'idols'
  return 'stories'
}

export function readArchiveRoute(input = null) {
  const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.origin
  const current = input || (typeof window === 'undefined' ? base : window.location.href)
  const url = new URL(current, base)
  const params = url.searchParams
  return normalizeArchiveRoute({
    view: params.get('view'),
    category: clean(params.get('category')),
    idol: clean(params.get('idol')),
    group: clean(params.get('group')),
    unit: clean(params.get('unit')),
    unitFilter: clean(params.get('unit_filter')),
    storyType: params.get('story_type'),
    eventScope: params.get('event_scope'),
    availability: params.get('availability'),
    sort: params.get('sort'),
    episode: clean(params.get('episode')),
    card: clean(params.get('card')),
    event: clean(params.get('event')),
    gasha: clean(params.get('gasha')),
    gashaType: params.get('gasha_type'),
    rarity: params.get('rarity'),
    assetState: params.get('asset_state'),
    relationState: params.get('relation_state'),
    query: clean(params.get('q')),
    scenario: params.get('scenario') || params.get('file'),
    voice: clean(params.get('voice')),
    returnView: clean(params.get('return')),
    parentView: clean(params.get('parent')),
  })
}

export function buildArchiveUrl(input, route) {
  const url = new URL(input, typeof window === 'undefined' ? 'http://localhost/' : window.location.origin)
  const normalized = normalizeArchiveRoute(route)
  for (const key of ROUTE_QUERY_KEYS) url.searchParams.delete(key)
  url.searchParams.delete('file')

  if (normalized.view !== 'home') url.searchParams.set('view', normalized.view)
  if (normalized.category) url.searchParams.set('category', normalized.category)
  if (normalized.idol) url.searchParams.set('idol', normalized.idol)
  if (normalized.group) url.searchParams.set('group', normalized.group)
  if (normalized.unit) url.searchParams.set('unit', normalized.unit)
  if (normalized.unitFilter) url.searchParams.set('unit_filter', normalized.unitFilter)
  if (normalized.storyType) url.searchParams.set('story_type', normalized.storyType)
  if (normalized.eventScope !== 'all') url.searchParams.set('event_scope', normalized.eventScope)
  if (normalized.availability !== 'all') url.searchParams.set('availability', normalized.availability)
  if (normalized.sort !== 'domain') url.searchParams.set('sort', normalized.sort)
  if (normalized.episode) url.searchParams.set('episode', normalized.episode)
  if (normalized.card) url.searchParams.set('card', normalized.card)
  if (normalized.event) url.searchParams.set('event', normalized.event)
  if (normalized.gasha) url.searchParams.set('gasha', normalized.gasha)
  if (normalized.gashaType !== 'all') url.searchParams.set('gasha_type', normalized.gashaType)
  if (normalized.rarity !== 'all') url.searchParams.set('rarity', normalized.rarity)
  if (normalized.assetState !== 'all') url.searchParams.set('asset_state', normalized.assetState)
  if (normalized.relationState !== 'all') url.searchParams.set('relation_state', normalized.relationState)
  if (normalized.query) url.searchParams.set('q', normalized.query)
  if (normalized.scenario) url.searchParams.set('scenario', normalized.scenario)
  if (normalized.voice) url.searchParams.set('voice', normalized.voice)
  if (normalized.returnView && normalized.returnView !== 'files') url.searchParams.set('return', normalized.returnView)
  if (normalized.parentView) url.searchParams.set('parent', normalized.parentView)
  return url
}

export function writeArchiveRoute(route, { replace = false } = {}) {
  const url = buildArchiveUrl(window.location.href, route)
  const state = { ...window.history.state, archiveRoute: true }
  window.history[replace ? 'replaceState' : 'pushState'](state, '', url)
}

export function onArchivePopState(handler) {
  const listener = () => handler(readArchiveRoute())
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}

export { ARCHIVE_NAVIGATION, ARCHIVE_ROUTE_CONTRACTS, ROUTE_QUERY_KEYS, VALID_VIEWS }
