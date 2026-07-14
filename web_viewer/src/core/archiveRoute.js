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
  'gasha',
  'gasha_type',
  'rarity',
  'asset_state',
  'relation_state',
  'q',
  'scenario',
  'voice',
  'return',
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
const VALID_EVENT_SCOPES = new Set(['all', 'fixed_unit_event', 'attribute_event', 'mixed_unit_event'])
const VALID_GASHA_TYPES = new Set(['all', 'standard_pickup', 'growing_fes', 'stage_step_up', 'full_roster_series'])

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeScenarioFile(value) {
  const normalized = clean(value).replace(/^\/?data\/compiled\//, '')
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) return ''
  return normalized.endsWith('.json') ? normalized : `${normalized}.json`
}

export function readArchiveRoute(input = window.location.href) {
  const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.origin
  const url = new URL(input, base)
  const params = url.searchParams
  const scenario = normalizeScenarioFile(params.get('scenario') || params.get('file') || '')
  const requestedView = clean(params.get('view'))
  const requestedRelationState = clean(params.get('relation_state'))
  const requestedStoryType = clean(params.get('story_type'))
  const requestedEventScope = clean(params.get('event_scope'))
  const view = scenario
    ? 'player'
    : (VALID_VIEWS.has(requestedView) ? requestedView : 'home')

  return {
    view,
    category: clean(params.get('category')),
    idol: clean(params.get('idol')),
    group: clean(params.get('group')),
    unit: clean(params.get('unit')),
    unitFilter: clean(params.get('unit_filter')),
    storyType: requestedStoryType,
    eventScope: requestedStoryType === 'event' && VALID_EVENT_SCOPES.has(requestedEventScope)
      ? requestedEventScope
      : 'all',
    availability: clean(params.get('availability')) || 'all',
    sort: clean(params.get('sort')) || 'domain',
    episode: clean(params.get('episode')),
    card: clean(params.get('card')),
    gasha: clean(params.get('gasha')),
    gashaType: VALID_GASHA_TYPES.has(clean(params.get('gasha_type')))
      ? clean(params.get('gasha_type'))
      : 'all',
    rarity: clean(params.get('rarity')) || 'all',
    assetState: clean(params.get('asset_state')) || 'all',
    relationState: VALID_CARD_RELATION_STATES.has(requestedRelationState) ? requestedRelationState : 'all',
    query: clean(params.get('q')),
    scenario,
    voice: clean(params.get('voice')),
    returnView: clean(params.get('return')),
  }
}

export function buildArchiveUrl(input, route) {
  const url = new URL(input, typeof window === 'undefined' ? 'http://localhost/' : window.location.origin)
  for (const key of ROUTE_QUERY_KEYS) url.searchParams.delete(key)
  url.searchParams.delete('file')

  if (route.view && route.view !== 'home') url.searchParams.set('view', route.view)
  if (route.category) url.searchParams.set('category', route.category)
  if (route.idol) url.searchParams.set('idol', route.idol)
  if (route.group) url.searchParams.set('group', route.group)
  if (route.unit) url.searchParams.set('unit', route.unit)
  if (route.unitFilter) url.searchParams.set('unit_filter', route.unitFilter)
  if (route.storyType) url.searchParams.set('story_type', route.storyType)
  if (route.eventScope && route.eventScope !== 'all') url.searchParams.set('event_scope', route.eventScope)
  if (route.availability && route.availability !== 'all') url.searchParams.set('availability', route.availability)
  if (route.sort && route.sort !== 'domain') url.searchParams.set('sort', route.sort)
  if (route.episode) url.searchParams.set('episode', route.episode)
  if (route.card) url.searchParams.set('card', route.card)
  if (route.gasha) url.searchParams.set('gasha', route.gasha)
  if (route.gashaType && route.gashaType !== 'all') url.searchParams.set('gasha_type', route.gashaType)
  if (route.rarity && route.rarity !== 'all') url.searchParams.set('rarity', route.rarity)
  if (route.assetState && route.assetState !== 'all') url.searchParams.set('asset_state', route.assetState)
  if (route.relationState && route.relationState !== 'all') url.searchParams.set('relation_state', route.relationState)
  if (route.query) url.searchParams.set('q', route.query)
  if (route.scenario) url.searchParams.set('scenario', normalizeScenarioFile(route.scenario))
  if (route.voice) url.searchParams.set('voice', route.voice)
  if (route.returnView && route.returnView !== 'files') url.searchParams.set('return', route.returnView)
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

export { ROUTE_QUERY_KEYS, VALID_VIEWS }
