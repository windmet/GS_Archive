const KEY = 'sidem.archive.reading-progress.v1'
const ID = /^[A-Za-z0-9_-]+$/
const HASH = /^sha256:[a-f0-9]{64}$/
const MODES = new Set(['original', 'translation', 'bilingual'])
function valid(entry) {
  return entry && ID.test(entry.documentId || '') && HASH.test(entry.version || '')
    && typeof entry.rowId === 'string' && entry.rowId.startsWith(`${entry.documentId}:step-`) && entry.rowId.length <= 240
    && MODES.has(entry.mode) && Number.isFinite(entry.updatedAt) && entry.updatedAt >= 0
}

export function isReadingProgressCurrent(entry, documentId, version, rows = []) {
  return !!valid(entry) && entry.documentId === documentId && entry.version === version
    && rows.some(row => row.anchor.row_id === entry.rowId)
}

/** Explicit, versioned local bookmarks; never owns the active Reader route. */
export class ReadingProgressStore {
  constructor(getStorage = () => window.localStorage, now = Date.now) {
    this.getStorage = getStorage
    this.now = now
  }
  entries(storage) {
    const raw = storage.getItem(KEY)
    if (!raw || raw.length > 256000) return []
    let value
    try { value = JSON.parse(raw) } catch { return [] }
    if (value?.schemaVersion !== 1 || !Array.isArray(value.entries)) return []
    return value.entries.filter(valid)
  }
  read(documentId) {
    try { return { ok: true, entry: this.entries(this.getStorage()).find(e => e.documentId === documentId) || null } }
    catch { return { ok: false, entry: null } }
  }
  save(entry) {
    const saved = { ...entry, updatedAt: this.now() }
    if (!valid(saved)) return { ok: false }
    try {
      const storage = this.getStorage()
      const entries = [saved, ...this.entries(storage).filter(e => e.documentId !== saved.documentId)]
        .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 100)
      storage.setItem(KEY, JSON.stringify({ schemaVersion: 1, entries }))
      return { ok: true, entry: saved }
    } catch { return { ok: false } }
  }
  remove(documentId) {
    try {
      const storage = this.getStorage()
      storage.setItem(KEY, JSON.stringify({ schemaVersion: 1, entries: this.entries(storage).filter(e => e.documentId !== documentId) }))
      return { ok: true }
    } catch { return { ok: false } }
  }
}
