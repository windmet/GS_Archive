import { collectionKindLabel } from '../core/CollectionRouteState.js'
import { sectionLabel } from '../core/archiveSections.js'
// Browser tab titles. Pages published at a path locator (idol, unit, card, song, event and gasha detail, and an idol's
// 事务所 and 通信) carry their entity name,
// section roots (/cards/, /items/, …) their section name, the
// same title the static head shell for that path ships (scripts/generate-entity-head-shells.mjs); every other
// page keeps the site title from index.html.
export const ARCHIVE_SITE_TITLE = 'GS Archive · SideM GROWING STARS 资料馆'
export const ENTITY_TITLE_VIEWS = Object.freeze(new Set(['idol_detail', 'unit_detail', 'card_detail', 'song_detail', 'event_detail', 'gasha_detail',
  'home', 'mobile_archive']))
// An idol's 事务所 (/office/<idol>/) and 通信 (/mobile/<idol>/) are named for the idol and the section.
const IDOL_PLACE_SECTIONS = Object.freeze({ home: 'home', mobile_archive: 'interactions' })
export const SECTION_TITLES = Object.freeze(Object.fromEntries(Object.entries({ idols: 'idols', unit_catalog: 'units', cards: 'cards',
  song_catalog: 'songs', event_catalog: 'events', gashas: 'gashas', story_catalog: 'stories', photo_catalog: 'photos', unused_archive: 'unused', score_archive: 'scores' })
  .map(([view, section]) => [view, sectionLabel(section)])))

// The collection catalogue is four sections, /items/, /honors/, /currencies/ and /costumes/.
export function archiveSectionTitle(view, collectionKind = 'items') {
  if (view === 'collection_catalog') return collectionKindLabel(collectionKind)
  return SECTION_TITLES[view] || ''
}

export function archiveEntityTitle(name) {
  return `${name} · GS Archive`
}

export function archiveIdolPlaceName(view, idolName) {
  return idolName && IDOL_PLACE_SECTIONS[view] ? `${idolName} · ${sectionLabel(IDOL_PLACE_SECTIONS[view])}` : ''
}

// A card title is shared by many idols (【起跑线】 ×49), so the card's name carries its idol.
export function archiveCardName(title, idolName) {
  return title && idolName ? `【${title}】${idolName}` : ''
}

// Returns null while an entity page has no name yet, so the caller keeps the current title (the shell's)
// instead of flashing the site title during loading.
export function archiveDocumentTitle(view, entityName = '') {
  if (view === 'collection_catalog' || SECTION_TITLES[view]) return archiveEntityTitle(entityName || archiveSectionTitle(view))
  if (!ENTITY_TITLE_VIEWS.has(view)) return ARCHIVE_SITE_TITLE
  const name = String(entityName || '').trim()
  return name ? archiveEntityTitle(name) : null
}
