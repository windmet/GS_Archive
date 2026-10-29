// Public addresses shared by the locator, document titles and static head shells.
// Internal routes remain query-based. Add a public view only after auditing and enforcing its schema.
const SONG_CODE_PATTERN = /^[a-z0-9]{6}$/
export const PUBLIC_ROUTES = Object.freeze([
  Object.freeze({ kind: 'entity', view: 'idol_detail', prefix: 'idols', param: 'idol', implied: { category: 'idol' }, pattern: /^[0-9]{3}[a-z]{3}$/ }),
  Object.freeze({ kind: 'entity', view: 'unit_detail', prefix: 'units', param: 'unit', implied: {}, pattern: /^[0-9]{2}[a-z0-9]{3}$/ }),
  // Cards are addressed by resource_id (001tom_n01), the id every card link and read-model row carries.
  Object.freeze({ kind: 'entity', view: 'card_detail', prefix: 'cards', param: 'card', implied: {}, pattern: /^[0-9]{3}[a-z]{3}_[a-z]{1,3}[0-9]{2}$/ }),
  // Songs are addressed by their six-character song_code (brndnf, drv999), primaries and variants alike.
  Object.freeze({ kind: 'entity', view: 'song_detail', prefix: 'songs', param: 'song', implied: {}, pattern: SONG_CODE_PATTERN }),
  Object.freeze({ kind: 'entity', view: 'chart_lab', prefix: 'songs', implied: {},
    segments: [{ param: 'song', pattern: SONG_CODE_PATTERN }, { value: 'chart' }] }),
  Object.freeze({ kind: 'entity', view: 'chibi_stage', prefix: 'songs', implied: {},
    segments: [{ param: 'song', pattern: SONG_CODE_PATTERN }, { value: 'stage' }],
    queryDefaults: ({ song }) => ({ stage: `${song}_live_effect` }) }),
  // Events keep their read-model id: theater and tour events are 4 + event code (410001, 430001), every
  // other event is `event:<code>` (event:10019, event:20001). The path drops that prefix, so both forms map
  // to a path and back without the catalogue: six digits are the legacy id, five digits are a code.
  Object.freeze({ kind: 'entity', view: 'event_detail', prefix: 'events', param: 'event', implied: {}, pattern: /^(4[0-9]{5}|[1-9][0-9]{4})$/,
    fromPath: segment => segment.length === 5 ? `event:${segment}` : segment, toPath: id => id.replace(/^event:(?=[0-9]{5}$)/, '') }),
  // Gashas: announcement ids (210003, 1300012, 12007210) and ticket-only pools (ticket-<16 hex>).
  Object.freeze({ kind: 'entity', view: 'gasha_detail', prefix: 'gashas', param: 'gasha', implied: {}, pattern: /^([0-9]{6,8}|ticket-[0-9a-f]{16})$/ }),
  // An idol's 事务所 and 通信 are addressed by the idol; the cue and costume, or the mode, unit and open call, stay in the query.
  Object.freeze({ kind: 'place', section: 'home', view: 'home', prefix: 'office', param: 'home_idol', implied: {}, pattern: /^[0-9]{3}[a-z]{3}$/ }),
  Object.freeze({ kind: 'place', section: 'interactions', view: 'mobile_archive', prefix: 'mobile', param: 'idol', implied: {}, pattern: /^[0-9]{3}[a-z]{3}$/ }),
  // Story owner ids are the read-model domain and section, without slug translations.
  ...[
    ['main', /^1[0-9]{2}$/], ['unit_story', /^[1-9][0-9]*$/], ['extra', /^6[0-9]{2}$/],
    ['birthday', /^(?:[0-9]{3}[a-z]{3}|producer_birthday_common)$/],
  ].map(([domain, pattern]) => Object.freeze({ kind: 'entity', view: 'story_collection', prefix: 'stories',
    implied: { story_type: domain }, segments: [{ value: domain }, { param: 'story_section', pattern }] })),
  Object.freeze({ kind: 'entity', view: 'seasonal_campaign', prefix: 'stories', implied: {},
    segments: [{ value: 'seasonal_campaign', param: 'story_type' }, { param: 'story_section', pattern: /^(?:valentine|white_day)_[0-9]{4}$/ }] }),
  ...[['idol_story_archive', 'idol_story'], ['work_archive', 'work']].map(([view, domain]) => Object.freeze({
    kind: 'place', view, prefix: 'stories', storyKind: domain, implied: {},
    segments: [{ value: domain, param: 'story_type' }, { param: 'idol', pattern: /^[0-9]{3}[a-z]{3}$/ }],
  })),
  ...['main', 'extra', 'birthday', 'unit_story', 'event'].map(domain => Object.freeze({
    kind: 'section', view: 'story_catalog', prefix: `stories/${domain}`, section: 'stories', storyKind: domain,
    implied: { story_type: domain, story_mode: 'portal' }, defaults: { story_mode: 'portal' },
  })),
  Object.freeze({ kind: 'section', view: 'external_story_resources', prefix: 'stories/external', section: 'stories', storyKind: 'external', implied: {} }),
  // Directory roots retain their filters in the query.
  Object.freeze({ kind: 'section', view: 'idols', prefix: 'idols', section: 'idols', implied: { category: 'idol' } }),
  Object.freeze({ kind: 'section', view: 'unit_catalog', prefix: 'units', section: 'units', implied: {} }),
  Object.freeze({ kind: 'section', view: 'cards', prefix: 'cards', section: 'cards', implied: { category: 'cards' } }),
  Object.freeze({ kind: 'section', view: 'song_catalog', prefix: 'songs', section: 'songs', implied: {} }),
  Object.freeze({ kind: 'section', view: 'event_catalog', prefix: 'events', section: 'events', implied: {} }),
  Object.freeze({ kind: 'section', view: 'gashas', prefix: 'gashas', section: 'gashas', implied: {} }),
  Object.freeze({ kind: 'section', view: 'story_catalog', prefix: 'stories', section: 'stories', implied: {} }),
  Object.freeze({ kind: 'section', view: 'collection_catalog', prefix: 'items', section: 'collections', implied: { collection_kind: 'items' } }),
  Object.freeze({ kind: 'section', view: 'collection_catalog', prefix: 'honors', section: 'honors', implied: { collection_kind: 'honors' } }),
  Object.freeze({ kind: 'section', view: 'collection_catalog', prefix: 'currencies', section: 'currencies', implied: { collection_kind: 'currencies' } }),
  Object.freeze({ kind: 'section', view: 'collection_catalog', prefix: 'costumes', section: 'costumes', implied: { collection_kind: 'costumes' } }),
  Object.freeze({ kind: 'section', view: 'photo_catalog', prefix: 'photos', section: 'photos', implied: {} }),
  Object.freeze({ kind: 'section', view: 'unused_archive', prefix: 'unused', section: 'unused', implied: {} }),
  // Tool entry names confirmed in D1; portal and experimental pages keep query addresses.
  Object.freeze({ kind: 'section', view: 'live', prefix: 'live', section: 'live', implied: {} }),
  Object.freeze({ kind: 'section', view: 'studio', prefix: 'studio', section: 'studio', implied: {} }),
  Object.freeze({ kind: 'section', view: 'about', prefix: 'about', section: 'about', implied: {} }),
  Object.freeze({ kind: 'section', view: 'archive_status', prefix: 'status', section: 'resources', implied: {} }),
  Object.freeze({ kind: 'section', view: 'score_archive', prefix: 'scores', section: 'scores', implied: {} }),
])

export const PUBLIC_PATH_ROUTES = Object.freeze(PUBLIC_ROUTES.filter(route => route.kind !== 'section'))
export const SECTION_PATH_ROUTES = Object.freeze(PUBLIC_ROUTES.filter(route => route.kind === 'section'))
export const ARCHIVE_SECTION_PATHS = Object.freeze(SECTION_PATH_ROUTES.map(route => route.prefix))

// All path consumers use these descriptors, including the original two-segment identities.
export function publicRouteSegments(route) {
  return [...route.prefix.split('/').map(value => ({ value })), ...(route.segments ||
    (route.param ? [{ param: route.param, pattern: route.pattern, fromPath: route.fromPath, toPath: route.toPath }] : []))]
}

export function matchPublicRoute(route, pathname) {
  const match = /^\/([^/]+(?:\/[^/]+)*)\/?$/.exec(pathname)
  if (!match) return null
  const parts = match[1].split('/'), segments = publicRouteSegments(route)
  if (parts.length !== segments.length) return null
  const params = { ...route.implied, view: route.view }
  for (const [index, segment] of segments.entries()) {
    const value = parts[index]
    if (segment.value !== undefined) {
      if (value !== segment.value) return null
      if (segment.param) params[segment.param] = value
      continue
    }
    if (!segment.pattern.test(value)) return null
    params[segment.param] = segment.fromPath ? segment.fromPath(value) : value
  }
  return params
}

export function publicRoutePath(route, params) {
  const valueOf = key => (typeof params.get === 'function' ? params.get(key) : params[key]) ?? route.defaults?.[key]
  if (!Object.entries(route.implied).every(([key, value]) => valueOf(key) === value)) return null
  const parts = []
  for (const segment of publicRouteSegments(route)) {
    if (segment.value !== undefined) { parts.push(segment.value); continue }
    const raw = valueOf(segment.param) || '', value = segment.toPath ? segment.toPath(raw) : raw
    if (!segment.pattern.test(value)) return null
    parts.push(value)
  }
  return `/${parts.join('/')}/`
}

// Only path locators supply these defaults. Explicit query selections always win.
export function publicRouteQueryDefaults(route, params) {
  return route.queryDefaults?.(typeof params.get === 'function' ? Object.fromEntries(params) : params) || {}
}
