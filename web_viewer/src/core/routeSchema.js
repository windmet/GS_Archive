// Per-view route ownership: which URL query parameters each view is expected to serialize. Entries are a DRAFT
// except for the views in ENFORCED_ROUTE_VIEWS, which buildArchiveUrl prunes to this table (see
// docs/GS_ARCHIVE_ROUTE_SCHEMA_AUDIT_20261011.md). Each entry was
// derived from the page contracts and the generic builder and still needs its owning page confirmed before
// buildArchiveUrl may prune against it. Context parameters (from, portal_from, home_from) are not listed: they
// live in the history NavigationContext. Player entries are keyed by `player:<returnView>`.
export const ROUTE_SCHEMA = Object.freeze({
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
  'player:reader': ['reading', 'reading_row', 'reading_mode', 'reading_scope', 'reading_rev', 'scenario', 'start_step', 'end_step', 'at_step', 'play_mode', 'return'],
  'player:event_detail': ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return', 'event', 'parent', 'category', 'unit'],
  'player:files': ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return', 'category', 'idol', 'group'],
})

// Player entries other than the three audited return views fall back to the plain player scenario fields.
const PLAYER_FALLBACK = ['scenario', 'start_step', 'end_step', 'at_step', 'voice', 'play_mode', 'return']

export function routeSchemaKey(view, returnView = '') {
  return view === 'player' ? `player:${returnView || 'files'}` : view
}

export function ownedRouteParams(view, returnView = '') {
  return ROUTE_SCHEMA[routeSchemaKey(view, returnView)] || (view === 'player' ? PLAYER_FALLBACK : null)
}

// Views whose entry has been confirmed against their page and whose writes are pruned to it. Reading is
// unchanged: older URLs with extra parameters still parse, and the next write drops them. Grow this set one
// confirmed group at a time.
export const ENFORCED_ROUTE_VIEWS = Object.freeze(new Set([
  'about', 'archive_status', 'experiments', 'spine_lab', 'welcome', 'unit_catalog', 'episode_zero_units',
]))

// Context parameters are moved into history state by writeArchiveRoute; the builder may still carry them.
const CONTEXT_PARAMS = new Set(['view', 'from', 'portal_from', 'home_from'])

export function pruneToRouteSchema(url, view, returnView = '', routeKeys = []) {
  if (!ENFORCED_ROUTE_VIEWS.has(view)) return url
  const owned = new Set(ownedRouteParams(view, returnView) || [])
  for (const key of routeKeys) if (!owned.has(key) && !CONTEXT_PARAMS.has(key)) url.searchParams.delete(key)
  return url
}
