import { collectionKindLabel } from '../core/CollectionRouteState.js'
// Browser tab titles. Pages published at a path locator (idol, unit, card, song, event and gasha detail) carry their entity name,
// section roots (/cards/, /items/, …) their section name, the
// same title the static head shell for that path ships (scripts/generate-entity-head-shells.mjs); every other
// page keeps the site title from index.html.
export const ARCHIVE_SITE_TITLE = 'GS Archive · SideM GROWING STARS 资料馆'
export const ENTITY_TITLE_VIEWS = Object.freeze(new Set(['idol_detail', 'unit_detail', 'card_detail', 'song_detail', 'event_detail', 'gasha_detail']))
export const SECTION_TITLES = Object.freeze({ idols: '偶像', unit_catalog: '组合', cards: '卡片', song_catalog: '歌曲', event_catalog: '活动',
  gashas: '卡池', story_catalog: '故事', photo_catalog: '摄影资源', unused_archive: '其他语音存档' })

// The collection catalogue is four sections, /items/, /honors/, /currencies/ and /costumes/.
export function archiveSectionTitle(view, collectionKind = 'items') {
  if (view === 'collection_catalog') return collectionKindLabel(collectionKind)
  return SECTION_TITLES[view] || ''
}

export function archiveEntityTitle(name) {
  return `${name} · GS Archive`
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
