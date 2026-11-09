import { isArchiveLocatorPath } from './archiveRoute.js'

// The site is a single-page app and Pages answers every unknown path with index.html and a 200. An address that names
// nothing therefore still starts the archive (see archiveStartup.js); this module is the one place that decides when
// that start is a "not found", what the visitor is told, and that search engines must not index it as a page.
export const NOT_FOUND_NOTICE = '没有找到这个页面，已回到资料馆。'
const NOINDEX_ATTRIBUTE = 'data-gs-not-found'

/** A route-preparation result: the requested entity is not in its catalogue. Never a transport failure. */
export const ENTITY_NOT_FOUND = 'entity-not-found'

export class EntityNotFoundError extends Error {
  constructor(message) { super(message); this.name = 'EntityNotFoundError' }
}
export const isEntityNotFound = error => error?.name === 'EntityNotFoundError'

/** The route every missing entity lands on: the archive portal, where the notice is shown. */
export const notFoundRoute = () => ({ view: 'portal', notFound: true })

// `/`, `/index.html` and any query-only entry are the app itself. Any other path that is not a public locator
// (/foo-bar/, /cards/99999999/, /idols/999/) addresses nothing.
export function isUnknownArchivePath(input) {
  const url = new URL(input, 'http://localhost/')
  if (['/', '/index.html'].includes(url.pathname)) return false
  return !isArchiveLocatorPath(url.pathname + url.search)
}

/** What a not-found start or restore shows. `null` means the page is genuine and nothing is added. */
export function resolveNotFound({ unknownPath = false, entityMissing = false } = {}) {
  return unknownPath || entityMissing ? { notice: NOT_FOUND_NOTICE, noindex: true } : null
}

/** Adds or removes the robots noindex meta in document.head; safe to call repeatedly. */
export function setNotFoundNoindex(doc, on) {
  const head = doc?.head
  if (!head) return
  const existing = head.querySelector(`meta[${NOINDEX_ATTRIBUTE}]`)
  if (!on) { existing?.remove(); return }
  if (existing) return
  const meta = doc.createElement('meta')
  meta.setAttribute('name', 'robots')
  meta.setAttribute('content', 'noindex')
  meta.setAttribute(NOINDEX_ATTRIBUTE, '')
  head.append(meta)
}
