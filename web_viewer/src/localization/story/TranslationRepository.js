const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/
const ID_PATTERN = /^[A-Za-z0-9._-]+$/
const UNIT_ID_PATTERN = /^story-text:v1:[A-Za-z0-9._-]+:[A-Za-z0-9._-]+:cmd-[0-9]{6}:[A-Za-z0-9._-]+:[0-9]{3}$/
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/
const ENTRY_STATUSES = new Set(['draft', 'reviewed', 'final'])
const ENTRY_CHECKS = new Set(['terminology', 'character_voice', 'layout', 'source_verified'])
const TOP_LEVEL_KEYS = new Set(['schema_version', 'locale', 'scenario_id', 'source_raw_hash', 'entries'])
const ENTRY_KEYS = new Set(['source_hash', 'text', 'status', 'translator', 'reviewer', 'notes', 'checks'])

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function unexpectedKeys(record, allowed, path, errors) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unexpected property`)
  }
}

function emptyOverlay(scenarioId, locale) {
  return Object.freeze({
    schema_version: 1,
    locale,
    scenario_id: scenarioId,
    source_raw_hash: null,
    entries: Object.freeze({}),
  })
}

/** Runtime validation mirrors the strict static overlay schema without adding a dependency. */
export function validateStoryTranslationOverlay(value, { scenarioId, locale } = {}) {
  const errors = []
  if (!isRecord(value)) return { valid: false, errors: ['$: expected object'] }
  unexpectedKeys(value, TOP_LEVEL_KEYS, '$', errors)

  if (value.schema_version !== 1) errors.push('$.schema_version: expected 1')
  if (typeof value.locale !== 'string' || !LOCALE_PATTERN.test(value.locale)) {
    errors.push('$.locale: invalid BCP 47 locale')
  }
  if (locale && value.locale !== locale) errors.push(`$.locale: expected ${locale}`)
  if (typeof value.scenario_id !== 'string' || !ID_PATTERN.test(value.scenario_id)) {
    errors.push('$.scenario_id: invalid canonical id')
  }
  if (scenarioId && value.scenario_id !== scenarioId) {
    errors.push(`$.scenario_id: expected ${scenarioId}`)
  }
  if (typeof value.source_raw_hash !== 'string' || !HASH_PATTERN.test(value.source_raw_hash)) {
    errors.push('$.source_raw_hash: invalid sha256')
  }
  if (!isRecord(value.entries)) {
    errors.push('$.entries: expected object')
  } else {
    for (const [unitId, entry] of Object.entries(value.entries)) {
      const path = `$.entries[${JSON.stringify(unitId)}]`
      if (!UNIT_ID_PATTERN.test(unitId)) errors.push(`${path}: invalid unit id`)
      if (!isRecord(entry)) {
        errors.push(`${path}: expected object`)
        continue
      }
      unexpectedKeys(entry, ENTRY_KEYS, path, errors)
      if (typeof entry.source_hash !== 'string' || !HASH_PATTERN.test(entry.source_hash)) {
        errors.push(`${path}.source_hash: invalid sha256`)
      }
      if (typeof entry.text !== 'string' || entry.text.length === 0) {
        errors.push(`${path}.text: expected non-empty string`)
      }
      if (!ENTRY_STATUSES.has(entry.status)) errors.push(`${path}.status: invalid status`)
      for (const key of ['translator', 'reviewer']) {
        if (entry[key] !== undefined && entry[key] !== null && typeof entry[key] !== 'string') {
          errors.push(`${path}.${key}: expected string or null`)
        }
      }
      if (entry.notes !== undefined && (!Array.isArray(entry.notes) || entry.notes.some(note => typeof note !== 'string'))) {
        errors.push(`${path}.notes: expected string array`)
      }
      if (entry.checks !== undefined) {
        if (!Array.isArray(entry.checks)
          || entry.checks.some(check => !ENTRY_CHECKS.has(check))
          || new Set(entry.checks).size !== entry.checks.length) {
          errors.push(`${path}.checks: invalid or duplicate check`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

function defaultFetch() {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('TranslationRepository requires fetch or an injected fetch implementation')
  }
  return globalThis.fetch.bind(globalThis)
}

export class TranslationRepository {
  constructor({
    baseUrl = '/translations',
    assetRevision = '1',
    fetchImpl = null,
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '')
    this.assetRevision = String(assetRevision)
    this.fetchImpl = fetchImpl || defaultFetch()
    this._cache = new Map()
    this._overlays = new Map()
    this._diagnostics = new Map()
  }

  _key(scenarioId, locale) {
    return `translation:1:${locale}:${scenarioId}:${this.assetRevision}`
  }

  _url(scenarioId, locale) {
    const path = `${this.baseUrl}/${encodeURIComponent(locale)}/scenarios/${encodeURIComponent(scenarioId)}.json`
    return this.assetRevision ? `${path}?rev=${encodeURIComponent(this.assetRevision)}` : path
  }

  async loadScenario({ scenarioId, locale, signal } = {}) {
    if (!ID_PATTERN.test(scenarioId || '')) throw new TypeError('Invalid scenarioId')
    if (!LOCALE_PATTERN.test(locale || '')) throw new TypeError('Invalid locale')
    const key = this._key(scenarioId, locale)
    if (this._overlays.has(key)) return this._overlays.get(key)
    if (this._cache.has(key)) return this._cache.get(key)

    const pending = this._load({ key, scenarioId, locale, signal })
    this._cache.set(key, pending)
    try {
      return await pending
    } catch (error) {
      this._cache.delete(key)
      throw error
    }
  }

  async _load({ key, scenarioId, locale, signal }) {
    const url = this._url(scenarioId, locale)
    let response
    try {
      response = await this.fetchImpl(url, { signal })
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      return this._storeFailure({
        key, scenarioId, locale, url,
        code: 'translation_invalid',
        errors: [`fetch failed: ${error?.message || String(error)}`],
      })
    }

    if (response?.status === 404) {
      return this._storeFailure({
        key, scenarioId, locale, url,
        code: 'translation_missing',
        errors: [],
      })
    }
    if (!response?.ok) {
      return this._storeFailure({
        key, scenarioId, locale, url,
        code: 'translation_invalid',
        errors: [`HTTP ${response?.status ?? 'unknown'}`],
      })
    }

    let overlay
    try {
      overlay = JSON.parse(await response.text())
    } catch (error) {
      return this._storeFailure({
        key, scenarioId, locale, url,
        code: 'translation_invalid',
        errors: [`invalid JSON: ${error?.message || String(error)}`],
      })
    }
    const validation = validateStoryTranslationOverlay(overlay, { scenarioId, locale })
    if (!validation.valid) {
      return this._storeFailure({
        key, scenarioId, locale, url,
        code: 'translation_invalid',
        errors: validation.errors,
      })
    }

    this._overlays.set(key, overlay)
    this._diagnostics.set(key, Object.freeze({
      code: 'translation_ready',
      scenarioId,
      locale,
      url,
      entryCount: Object.keys(overlay.entries).length,
      errors: Object.freeze([]),
    }))
    return overlay
  }

  _storeFailure({ key, scenarioId, locale, url, code, errors }) {
    const overlay = emptyOverlay(scenarioId, locale)
    this._overlays.set(key, overlay)
    this._diagnostics.set(key, Object.freeze({
      code,
      scenarioId,
      locale,
      url,
      entryCount: 0,
      errors: Object.freeze([...errors]),
    }))
    return overlay
  }

  getEntry({ scenarioId, locale, unitId } = {}) {
    const overlay = this._overlays.get(this._key(scenarioId, locale))
    return overlay?.entries?.[unitId] ?? null
  }

  getDiagnostics({ scenarioId, locale } = {}) {
    return this._diagnostics.get(this._key(scenarioId, locale)) ?? null
  }

  invalidate({ scenarioId, locale } = {}) {
    const key = this._key(scenarioId, locale)
    this._cache.delete(key)
    this._overlays.delete(key)
    this._diagnostics.delete(key)
  }

  clear() {
    this._cache.clear()
    this._overlays.clear()
    this._diagnostics.clear()
  }
}
