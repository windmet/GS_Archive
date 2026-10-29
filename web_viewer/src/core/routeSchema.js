import { SECTION_PATH_ROUTES } from './publicRoutes.js'
// Per-view route ownership: which URL query parameters each view is expected to serialize. Entries are a DRAFT
// except for the views in ENFORCED_ROUTE_VIEWS, which buildArchiveUrl prunes to this table (see
// docs/GS_ARCHIVE_ROUTE_SCHEMA_AUDIT_20261011.md). Each entry was
// derived from the page contracts and the generic builder and still needs its owning page confirmed before
// buildArchiveUrl may prune against it. Context parameters (from, portal_from, home_from) are not listed: they
// live in the history NavigationContext. Player entries are keyed by `player:<returnView>`.
export const ROUTE_SCHEMA = Object.freeze({
  welcome: [], idol_picker: ['pick'], portal: ['portal_scope', 'q'], home: ['home_idol', 'home_cue', 'home_costume'],
  idols: ['unit_filter', 'q'], idol_detail: ['category', 'idol'],
  cards: ['idol', 'q', 'rarity', 'card_attribute', 'asset_state', 'relation_state'], card_detail: ['card'],
  event_catalog: ['idol', 'q', 'event_kind', 'event_sort', 'event_page'], event_detail: ['event', 'parent', 'category', 'unit', 'card', 'idol'],
  collection_catalog: ['q', 'entity', 'collection_kind', 'collection_category', 'collection_idol', 'collection_unit', 'collection_attribute', 'collection_page'],
  photo_catalog: ['q', 'photo_idol', 'photo'], picture_studio: ['photo_idol', 'photo'], gashas: ['gasha_type', 'q'], gasha_detail: ['gasha', 'parent', 'story_type', 'story_section'],
  song_catalog: ['idol', 'q', 'song_scope'], song_detail: ['song'], chart_lab: ['song'], chibi_stage: ['song', 'stage'],
  experiments: [], live: [], studio: [], about: [], unused_archive: ['voices'], score_archive: ['sound'], archive_status: [], spine_lab: [],
  story_catalog: ['story_mode', 'story_type', 'story_section', 'event_scope', 'availability', 'sort', 'idol', 'q'],
  external_story_resources: [], story_collection: ['story_type', 'story_section', 'story', 'parent', 'song', 'idol', 'unit', 'category'], story_detail: ['story', 'story_type', 'story_section', 'parent'],
  seasonal_campaign: ['story_type', 'story_section', 'idol'], work_archive: ['idol', 'story', 'work_mode', 'story_type'],
  idol_story_archive: ['idol', 'story_type', 'story_section', 'episode'], mobile_archive: ['idol', 'unit', 'mobile_mode', 'mobile_scenario'],
  unit_catalog: [], unit_detail: ['unit'],
  reader: ['reading', 'reading_row', 'reading_mode', 'reading_scope', 'reading_rev'],
  'player:reader': ['reading', 'reading_row', 'reading_mode', 'reading_scope', 'reading_rev', 'scenario', 'start_step', 'end_step', 'at_step', 'play_mode', 'return'],
  'player:event_detail': ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return', 'event', 'parent', 'category', 'unit'],
})

// Player entries other than the audited return views (and a player with none) fall back to the plain player scenario fields.
const PLAYER_FALLBACK = ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return']

export function routeSchemaKey(view, returnView = '') {
  return view === 'player' ? (returnView ? `player:${returnView}` : 'player') : view
}

export function ownedRouteParams(view, returnView = '') {
  return ROUTE_SCHEMA[routeSchemaKey(view, returnView)] || (view === 'player' ? PLAYER_FALLBACK : null)
}

// Views whose entry has been confirmed against their page and whose writes are pruned to it. Reading is
// unchanged: older URLs with extra parameters still parse, and the next write drops them. Grow this set one
// confirmed group at a time.
export const ENFORCED_ROUTE_VIEWS = Object.freeze(new Set([
  'about', 'unused_archive', 'score_archive', 'archive_status', 'live', 'studio', 'spine_lab', 'welcome', 'unit_catalog',
  // Detail pages whose address is only their identity; list filters ride the history source, not the URL.
  'idol_detail', 'unit_detail', 'card_detail', 'song_detail', 'chart_lab', 'chibi_stage',
  // Their address is only the event or gasha; the owned opened-from fields move to history state on write (archiveRoute.js).
  'event_detail', 'gasha_detail',
  // Story owners retain their selection; collection opener identity moves to history.
  'story_collection', 'seasonal_campaign', 'idol_story_archive', 'work_archive', 'external_story_resources',
  // Published at /office/<idol>/ and /mobile/<idol>/; App.vue applyRoute reads only their entries' fields.
  'home', 'mobile_archive',
  // Audited directory props; section identity is supplied by the public registry.
  'idols', 'cards', 'song_catalog', 'event_catalog', 'gashas', 'story_catalog', 'collection_catalog', 'photo_catalog',
]))

// Context parameters are moved into history state by writeArchiveRoute; the builder may still carry them.
const CONTEXT_PARAMS = new Set(['view', 'from', 'portal_from', 'home_from'])

export function pruneToRouteSchema(url, view, returnView = '', routeKeys = []) {
  if (!ENFORCED_ROUTE_VIEWS.has(view)) return url
  const owned = new Set(ownedRouteParams(view, returnView) || [])
  for (const route of SECTION_PATH_ROUTES) if (route.view === view) for (const key of Object.keys(route.implied)) owned.add(key)
  for (const key of routeKeys) if (!owned.has(key) && !CONTEXT_PARAMS.has(key)) url.searchParams.delete(key)
  return url
}
