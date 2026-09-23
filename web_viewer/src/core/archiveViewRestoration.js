import { buildArchiveUrl, readArchiveRoute } from './archiveRoute.js'

const STORAGE_KEY = 'sidem:archive-view-restoration:v1'
const MAX_ENTRIES = 80
const MAX_FOCUS_ID_LENGTH = 256

function routeIdentity(href) {
  return buildArchiveUrl('http://localhost/', readArchiveRoute(href)).search
}

export function buildArchiveViewContext(href, historyState = null) {
  const routeKey = routeIdentity(href)
  const entryId = typeof historyState?.sidemArchiveEntryId === 'string'
    ? historyState.sidemArchiveEntryId.slice(0, 96)
    : ''
  return {
    routeKey,
    entryKey: entryId ? `${routeKey}#${entryId}` : '',
  }
}

function readEntries(storage) {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEntries(storage, entries) {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // Navigation must remain usable if session storage is unavailable or full.
  }
}

function normalizedState(state) {
  const scrollTop = Number.isFinite(Number(state?.scrollTop))
    ? Math.max(0, Math.round(Number(state.scrollTop)))
    : 0
  const focusId = typeof state?.focusId === 'string'
    ? state.focusId.slice(0, MAX_FOCUS_ID_LENGTH)
    : ''
  return { scrollTop, focusId }
}

export function saveArchiveViewRestoration(context, state, storage = globalThis.sessionStorage) {
  if (!context?.routeKey) return
  const value = normalizedState(state)
  const keys = [context.entryKey, context.routeKey].filter(Boolean)
  let entries = readEntries(storage).filter(entry => !keys.includes(entry?.key))
  entries = keys.map(key => ({ key, ...value })).concat(entries)
  writeEntries(storage, entries)
}

export function readArchiveViewRestoration(context, storage = globalThis.sessionStorage) {
  if (!context?.routeKey) return null
  const entries = readEntries(storage)
  const exact = context.entryKey && entries.find(entry => entry?.key === context.entryKey)
  const fallback = entries.find(entry => entry?.key === context.routeKey)
  return exact || fallback || null
}

export function captureArchiveViewState(context, {
  root = globalThis.document,
  storage = globalThis.sessionStorage,
} = {}) {
  const scrollContainer = root?.querySelector?.('[data-archive-scroll-container]')
  if (!scrollContainer) return false
  const focused = root.activeElement?.closest?.('[data-archive-focus-id]')
  saveArchiveViewRestoration(context, {
    scrollTop: scrollContainer.scrollTop,
    focusId: focused?.dataset?.archiveFocusId || '',
  }, storage)
  return true
}

function nextFrame() {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return new Promise(resolve => globalThis.requestAnimationFrame(resolve))
  }
  return Promise.resolve()
}

export async function restoreArchiveViewState(context, {
  root = globalThis.document,
  storage = globalThis.sessionStorage,
  attempts = 4,
} = {}) {
  const saved = readArchiveViewRestoration(context, storage)
  if (!saved) return false
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await nextFrame()
    const scrollContainer = root?.querySelector?.('[data-archive-scroll-container]')
    if (!scrollContainer) continue
    const focusTarget = saved.focusId
      ? [...root.querySelectorAll('[data-archive-focus-id]')]
          .find(element => element.dataset.archiveFocusId === saved.focusId)
      : null
    focusTarget?.focus?.({ preventScroll: true })
    const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
    scrollContainer.scrollTop = Math.min(saved.scrollTop, maxScroll)
    return true
  }
  return false
}

export { STORAGE_KEY as ARCHIVE_VIEW_RESTORATION_STORAGE_KEY }
