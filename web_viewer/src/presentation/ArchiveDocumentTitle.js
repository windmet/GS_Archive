// Browser tab titles. Pages published at a path locator (idol and unit detail) carry their entity name, the
// same title the static head shell for that path ships (scripts/generate-entity-head-shells.mjs); every other
// page keeps the site title from index.html.
export const ARCHIVE_SITE_TITLE = 'GS Archive · SideM GROWING STARS 资料馆'
export const ENTITY_TITLE_VIEWS = Object.freeze(new Set(['idol_detail', 'unit_detail']))

export function archiveEntityTitle(name) {
  return `${name} · GS Archive`
}

// Returns null while an entity page has no name yet, so the caller keeps the current title (the shell's)
// instead of flashing the site title during loading.
export function archiveDocumentTitle(view, entityName = '') {
  if (!ENTITY_TITLE_VIEWS.has(view)) return ARCHIVE_SITE_TITLE
  const name = String(entityName || '').trim()
  return name ? archiveEntityTitle(name) : null
}
