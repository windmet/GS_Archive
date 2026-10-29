import { PUBLIC_PATH_ROUTES, SECTION_PATH_ROUTES } from '../core/publicRoutes.js'
import { collectionKindLabel } from '../core/CollectionRouteState.js'
import { sectionLabel, STORY_KINDS } from '../core/archiveSections.js'
// Browser tab titles. Pages published at a path locator (idol, unit, card, song, event and gasha detail, and an idol's
// 事务所 and 通信) carry their entity name,
// section roots (/cards/, /items/, …) their section name, the
// same title the static head shell for that path ships (scripts/generate-entity-head-shells.mjs); every other
// page keeps the site title from index.html.
const COLLECTION_PAGE_LABEL = '图鉴'
export const ARCHIVE_SITE_TITLE = 'GROWING STARS 资料馆 · 偶像大师 SideM'
export const ENTITY_TITLE_VIEWS = Object.freeze(new Set(PUBLIC_PATH_ROUTES.map(route => route.view)))
const IDOL_PLACE_SECTIONS = Object.freeze(Object.fromEntries(PUBLIC_PATH_ROUTES.filter(route => route.kind === 'place').map(route => [route.view, route])))
export const SECTION_TITLES = Object.freeze(Object.fromEntries(SECTION_PATH_ROUTES.filter(route => route.view !== 'collection_catalog' &&
  (!route.storyKind || route.view === 'external_story_resources'))
  .map(route => [route.view, route.storyKind ? STORY_KINDS[route.storyKind].label : sectionLabel(route.section)])))

// The collection catalogue is four sections, /items/, /honors/, /currencies/ and /costumes/.
export function archiveSectionTitle(view, collectionKind = 'items') {
  if (view === 'collection_catalog') return collectionKindLabel(collectionKind)
  return SECTION_TITLES[view] || ''
}

// 图鉴 is one page of six categories: its tab titles name the category and then the page.
const COLLECTION_VIEWS = new Set(['collection_catalog', 'photo_catalog', 'unused_archive'])
export function archiveTabSectionTitle(view, collectionKind = 'items') {
  const name = archiveSectionTitle(view, collectionKind)
  return name && COLLECTION_VIEWS.has(view) ? `${name} · ${COLLECTION_PAGE_LABEL}` : name
}

export function archiveEntityTitle(name) {
  return `${name} · GROWING STARS 资料馆`
}

export function archiveIdolPlaceName(view, idolName) {
  const place = IDOL_PLACE_SECTIONS[view]
  return idolName && place ? `${idolName}${place.storyKind ? ' ' : ' · '}${place.storyKind ? STORY_KINDS[place.storyKind].label : sectionLabel(place.section)}` : ''
}

export function archiveSongChartName(title) {
  return title ? `${title} · 谱面` : ''
}

// A card title is shared by many idols (【起跑线】 ×49), so the card's name carries its idol.
export function archiveCardName(title, idolName) {
  return title && idolName ? `【${title}】${idolName}` : ''
}

// Returns null while an entity page has no name yet, so the caller keeps the current title (the shell's)
// instead of flashing the site title during loading.
export function archiveDocumentTitle(view, entityName = '') {
  if (view === 'collection_catalog' || SECTION_TITLES[view]) return archiveEntityTitle(entityName || archiveTabSectionTitle(view))
  if (!ENTITY_TITLE_VIEWS.has(view)) return ARCHIVE_SITE_TITLE
  const name = String(entityName || '').trim()
  return name ? archiveEntityTitle(name) : null
}
