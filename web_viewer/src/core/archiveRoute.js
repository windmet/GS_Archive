const ROUTE_QUERY_KEYS = [
  'view',
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
  'mobile_mode',
  'mobile_scenario',
  'event_scope',
  'availability',
  'sort',
  'episode',
  'card',
  'song',
  'song_scope',
  'event',
  'gasha',
  'gasha_type',
  'rarity',
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
  'song_catalog',
  'song_detail',
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
const VALID_CATEGORIES = new Set(['main_story', 'event', 'idol', 'idol_chat', 'idol_phone', 'cards', 'episode_zero', 'extra'])
const VALID_EVENT_SCOPES = new Set(['all', 'fixed_unit_event', 'attribute_event', 'mixed_unit_event'])
const VALID_GASHA_TYPES = new Set(['all', 'standard_pickup', 'growing_fes', 'stage_step_up', 'full_roster_series'])
const VALID_STORY_AVAILABILITY = new Set(['all', 'playable', 'missing'])
const VALID_STORY_SORTS = new Set(['domain', 'title', 'resource', 'steps_desc'])
const VALID_STORY_MODES = new Set(['portal', 'search'])
const VALID_SONG_SCOPES = new Set(['all', 'movie', 'mvlive', 'layered', 'oneshot', 'special'])
const VALID_MOBILE_MODES = new Set(['personal', 'phone', 'unit', 'random'])
const VALID_RETURN_VIEWS = new Set([...VALID_VIEWS].filter(view => !['player', 'spine_lab', 'chibi_stage'].includes(view)))

const ARCHIVE_ROUTE_CONTRACTS = Object.freeze({
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
  groups: { section: 'category', required: ['category'], fallback: 'home' },
  episode_zero_units: { section: 'stories', required: [] },
  episodes: { section: 'stories', required: ['unit'], fallback: 'episode_zero_units' },
  files: { section: 'category', required: ['group'], fallback: 'home' },
  cards: { section: 'cards', required: [], fallback: 'home' },
  card_detail: { section: 'cards', required: ['card'], fallback: 'cards' },
  event_detail: { section: 'stories', required: ['event'], fallback: 'story_catalog' },
  gashas: { section: 'gashas', required: [] },
  gasha_detail: { section: 'gashas', required: ['gasha'], fallback: 'gashas' },
  song_catalog: { section: 'songs', required: [] },
  song_detail: { section: 'songs', required: ['song'], fallback: 'song_catalog' },
  player: { section: 'player', required: [], fallback: 'home' },
  spine_lab: { section: 'resources', required: [] },
  chibi_stage: { section: 'resources', required: [] },
})

const ARCHIVE_NAVIGATION = Object.freeze([
  { id: 'home', label: '首页' },
  { id: 'stories', label: '故事' },
  { id: 'songs', label: '歌曲' },
  { id: 'idols', label: '偶像' },
  { id: 'cards', label: '卡片' },
  { id: 'gashas', label: '卡池' },
  { id: 'interactions', label: '互动' },
  { id: 'resources', label: '资源' },
])

const BREADCRUMB_HIDDEN_VIEWS = new Set(['home', 'player', 'spine_lab', 'chibi_stage'])

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

export function normalizeArchiveRoute(input = {}) {
  const scenario = normalizeScenarioFile(input.scenario || '')
  const voice = clean(input.voice)
  const card = clean(input.card)
  let view = scenario ? 'player' : allowed(clean(input.view), VALID_VIEWS, 'home')
  let category = allowed(clean(input.category), VALID_CATEGORIES, '')
  let idol = clean(input.idol)

  if (view === 'idols' && category === 'idol') view = 'idol_detail'
  if (view === 'idols' && category === 'cards') view = 'cards'
  if (view === 'idols' && ['idol_chat', 'idol_phone'].includes(category)) {
    view = 'mobile_archive'
    category = ''
  }
  if (['idol_detail', 'cards', 'mobile_archive'].includes(view) && !idol) idol = '001tom'

  if (['idol_detail'].includes(view)) category = 'idol'
  if (['cards', 'card_detail'].includes(view)) category = 'cards'
  if (['episode_zero_units', 'episodes'].includes(view)) category = 'episode_zero'

  const route = {
    view,
    homeIdol: clean(input.homeIdol),
    homeCue: clean(input.homeCue),
    homeCostume: clean(input.homeCostume),
    category,
    idol,
    group: clean(input.group),
    unit: clean(input.unit),
    unitFilter: clean(input.unitFilter),
    storyType: clean(input.storyType),
    storyMode: allowed(clean(input.storyMode), VALID_STORY_MODES, 'portal'),
    storySection: clean(input.storySection),
    story: normalizeScenarioFile(input.story || ''),
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
    gasha: clean(input.gasha),
    gashaType: allowed(clean(input.gashaType), VALID_GASHA_TYPES, 'all'),
    rarity: allowed(clean(input.rarity), VALID_CARD_RARITIES, 'all'),
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

function breadcrumbTitle(entity, fallback) {
  return clean(entity?.title) || clean(entity?.id) || fallback
}

function breadcrumbFilters(route) {
  return {
    query: route.query,
    unitFilter: route.unitFilter,
    eventScope: route.eventScope,
    rarity: route.rarity,
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

  const home = { label: '资料馆', route: { view: 'home' } }
  const current = (fallback, id = '') => ({
    label: breadcrumbTitle({ title: entity.title, id: entity.id || id }, fallback),
  })

  if (['idols', 'idol_detail'].includes(route.view)) {
    const idols = {
      label: '偶像',
      route: breadcrumbRoute(route, 'idols', { idol: '', category: '' }),
    }
    return route.view === 'idols' ? [home, { label: idols.label }] : [
      home,
      idols,
      current('偶像详情', route.idol),
    ]
  }

  if (['unit_catalog', 'unit_detail'].includes(route.view)) {
    const units = { label: '组合', route: breadcrumbRoute(route, 'unit_catalog', { unit: '' }) }
    return route.view === 'unit_catalog' ? [home, { label: units.label }] : [
      home,
      units,
      current('组合详情', route.unit),
    ]
  }

  if (['cards', 'card_detail'].includes(route.view)) {
    const cards = {
      label: '卡牌',
      route: breadcrumbRoute(route, 'cards', {
        idol: route.idol,
        card: '',
        category: 'cards',
      }),
    }
    return route.view === 'cards' ? [home, { label: cards.label }] : [
      home,
      cards,
      current('卡牌详情', route.card),
    ]
  }

  if (['gashas', 'gasha_detail'].includes(route.view)) {
    const gashas = { label: '卡池', route: breadcrumbRoute(route, 'gashas', { gasha: '' }) }
    return route.view === 'gashas' ? [home, { label: gashas.label }] : [
      home,
      gashas,
      current('卡池详情', route.gasha),
    ]
  }

  if (['song_catalog', 'song_detail'].includes(route.view)) {
    const songs = { label: '歌曲', route: breadcrumbRoute(route, 'song_catalog', { song: '' }) }
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
        label: '活动',
        route: breadcrumbRoute(route, 'story_catalog', {
          storyType: 'event',
          storySection: '',
          story: '',
          event: '',
        }),
      },
      current('活动详情', route.event),
    ]
  }

  if (route.view === 'external_story_resources') {
    return [home, { label: '社区熟肉' }]
  }

  if (['story_catalog', 'story_collection', 'story_detail'].includes(route.view)) {
    const formalDomainLabels = {
      main: '主线剧情',
      extra: '额外剧情',
      birthday: '生日剧情',
    }
    const formalDomainLabel = formalDomainLabels[route.storyType] || ''
    const stories = {
      label: '剧情',
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
    items.push(current(route.view === 'story_collection' ? '故事章节' : '故事详情', route.story || route.storySection))
    return items.length <= 4 ? items : [items[0], ...items.slice(-3)]
  }

  if (route.view === 'archive_status') return [home, { label: '资源' }]
  if (route.view === 'seasonal_campaign') return [home, { label: '剧情', route: breadcrumbRoute(route, 'story_catalog') }, current('季节企划', route.storySection)]
  if (route.view === 'work_archive') return [home, { label: '剧情', route: breadcrumbRoute(route, 'story_catalog') }, current('工作档案', route.idol)]
  if (route.view === 'idol_story_archive') return [home, { label: '剧情', route: breadcrumbRoute(route, 'story_catalog') }, current('个人故事', route.idol)]
  if (route.view === 'mobile_archive') return [home, current('Mobile 通信', route.idol)]

  const fallbackDomains = {
    groups: '剧情',
    episode_zero_units: '剧情',
    episodes: '剧情',
    files: '剧情',
  }
  return [home, current(fallbackDomains[route.view] || '资料')]
}

export function readArchiveRoute(input = null) {
  const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.origin
  const current = input || (typeof window === 'undefined' ? base : window.location.href)
  const url = new URL(current, base)
  const params = url.searchParams
  return normalizeArchiveRoute({
    view: params.get('view'),
    homeIdol: clean(params.get('home_idol')),
    homeCue: clean(params.get('home_cue')),
    homeCostume: clean(params.get('home_costume')),
    category: clean(params.get('category')),
    idol: clean(params.get('idol')),
    group: clean(params.get('group')),
    unit: clean(params.get('unit')),
    unitFilter: clean(params.get('unit_filter')),
    storyType: params.get('story_type'),
    storyMode: params.get('story_mode'),
    storySection: clean(params.get('story_section')),
    story: params.get('story'),
    mobileMode: params.get('mobile_mode'),
    mobileScenario: params.get('mobile_scenario'),
    eventScope: params.get('event_scope'),
    availability: params.get('availability'),
    sort: params.get('sort'),
    episode: clean(params.get('episode')),
    card: clean(params.get('card')),
    song: clean(params.get('song')),
    songScope: params.get('song_scope'),
    event: clean(params.get('event')),
    gasha: clean(params.get('gasha')),
    gashaType: params.get('gasha_type'),
    rarity: params.get('rarity'),
    assetState: params.get('asset_state'),
    relationState: params.get('relation_state'),
    query: clean(params.get('q')),
    scenario: params.get('scenario') || params.get('file'),
    startStep: params.get('start_step'),
    endStep: params.get('end_step'),
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
  if (normalized.view === 'home' && normalized.homeIdol) url.searchParams.set('home_idol', normalized.homeIdol)
  if (normalized.view === 'home' && normalized.homeCue) url.searchParams.set('home_cue', normalized.homeCue)
  if (normalized.view === 'home' && normalized.homeCostume) url.searchParams.set('home_costume', normalized.homeCostume)
  if (normalized.category) url.searchParams.set('category', normalized.category)
  if (normalized.idol) url.searchParams.set('idol', normalized.idol)
  if (normalized.group) url.searchParams.set('group', normalized.group)
  if (normalized.unit) url.searchParams.set('unit', normalized.unit)
  if (normalized.unitFilter) url.searchParams.set('unit_filter', normalized.unitFilter)
  if (normalized.storyType) url.searchParams.set('story_type', normalized.storyType)
  if (normalized.storyMode !== 'portal') url.searchParams.set('story_mode', normalized.storyMode)
  if (normalized.storySection) url.searchParams.set('story_section', normalized.storySection)
  if (normalized.story) url.searchParams.set('story', normalized.story)
  if (normalized.mobileMode !== 'personal') url.searchParams.set('mobile_mode', normalized.mobileMode)
  if (normalized.mobileScenario) url.searchParams.set('mobile_scenario', normalized.mobileScenario)
  if (normalized.eventScope !== 'all') url.searchParams.set('event_scope', normalized.eventScope)
  if (normalized.availability !== 'all') url.searchParams.set('availability', normalized.availability)
  if (normalized.sort !== 'domain') url.searchParams.set('sort', normalized.sort)
  if (normalized.episode) url.searchParams.set('episode', normalized.episode)
  if (normalized.card) url.searchParams.set('card', normalized.card)
  if (normalized.song) url.searchParams.set('song', normalized.song)
  if (normalized.songScope !== 'all') url.searchParams.set('song_scope', normalized.songScope)
  if (normalized.event) url.searchParams.set('event', normalized.event)
  if (normalized.gasha) url.searchParams.set('gasha', normalized.gasha)
  if (normalized.gashaType !== 'all') url.searchParams.set('gasha_type', normalized.gashaType)
  if (normalized.rarity !== 'all') url.searchParams.set('rarity', normalized.rarity)
  if (normalized.assetState !== 'all') url.searchParams.set('asset_state', normalized.assetState)
  if (normalized.relationState !== 'all') url.searchParams.set('relation_state', normalized.relationState)
  if (normalized.query) url.searchParams.set('q', normalized.query)
  if (normalized.scenario) url.searchParams.set('scenario', normalized.scenario)
  if (normalized.scenario && normalized.startStep) url.searchParams.set('start_step', String(normalized.startStep))
  if (normalized.scenario && normalized.endStep) url.searchParams.set('end_step', String(normalized.endStep))
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
