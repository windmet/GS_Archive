const STORAGE_KEY = 'sidem-story-read-progress'
const SCHEMA_VERSION = 1

function stablePart(value, fallback) {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function createReadKey({ scenarioId, sourceHash, stepId } = {}) {
  if (!Number.isInteger(stepId) || stepId < 0) throw new RangeError('stepId must be a non-negative integer')
  return [
    stablePart(scenarioId, 'unknown-scenario'),
    stablePart(sourceHash, 'no-source-hash'),
    `step-${stepId}`,
  ].join(':')
}

export class ReadProgressRepository {
  constructor({ storage, key = STORAGE_KEY } = {}) {
    if (storage === undefined) {
      try { storage = globalThis.localStorage } catch (_) { storage = null }
    }
    this.storage = storage
    this.key = key
    this._loaded = false
    this._keys = new Set()
  }

  _ensureLoaded() {
    if (this._loaded) return
    this._loaded = true
    try {
      const parsed = JSON.parse(this.storage?.getItem?.(this.key) || 'null')
      if (parsed?.schema_version === SCHEMA_VERSION && Array.isArray(parsed.read_keys)) {
        this._keys = new Set(parsed.read_keys.filter(key => typeof key === 'string'))
      }
    } catch (_) {
      this._keys = new Set()
    }
  }

  _persist() {
    try {
      this.storage?.setItem?.(this.key, JSON.stringify({
        schema_version: SCHEMA_VERSION,
        read_keys: [...this._keys],
      }))
    } catch (_) {
      // Read tracking is optional and must never interrupt playback.
    }
  }

  has(identity) {
    this._ensureLoaded()
    return this._keys.has(typeof identity === 'string' ? identity : createReadKey(identity))
  }

  mark(identity) {
    this._ensureLoaded()
    const key = typeof identity === 'string' ? identity : createReadKey(identity)
    const changed = !this._keys.has(key)
    this._keys.add(key)
    if (changed) this._persist()
    return key
  }

  clear() {
    this._loaded = true
    this._keys.clear()
    try { this.storage?.removeItem?.(this.key) } catch (_) {}
  }

  get size() {
    this._ensureLoaded()
    return this._keys.size
  }
}
