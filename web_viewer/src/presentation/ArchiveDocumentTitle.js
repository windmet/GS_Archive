// Browser tab titles. Pages published at a path locator (idol, unit and card detail) carry their entity name, the
// same title the static head shell for that path ships (scripts/generate-entity-head-shells.mjs); every other
// page keeps the site title from index.html.
export const ARCHIVE_SITE_TITLE = 'GS Archive · SideM GROWING STARS 资料馆'
export const ENTITY_TITLE_VIEWS = Object.freeze(new Set(['idol_detail', 'unit_detail', 'card_detail']))

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
  if (!ENTITY_TITLE_VIEWS.has(view)) return ARCHIVE_SITE_TITLE
  const name = String(entityName || '').trim()
  return name ? archiveEntityTitle(name) : null
}
