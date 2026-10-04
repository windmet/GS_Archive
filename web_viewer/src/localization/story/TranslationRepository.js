import translationRelease from '../../../config/translation-release.json' with {type:'json'}
import { createBoundedTextTransport } from '../../utils/BoundedTextTransport.js'
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
    assetRevision = translationRelease.release,
    fetchImpl = null, timeoutMs = 12000,
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '')
    this.assetRevision = String(assetRevision)
    this.fetchImpl = fetchImpl || defaultFetch()
    this.transport = createBoundedTextTransport({fetchImpl:this.fetchImpl,timeoutMs})
    this._generation = new Map()
    this._epoch = 0
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
    if (signal?.aborted) throw new DOMException('Cancelled','AbortError')
    if (this._overlays.has(key)) return this._overlays.get(key)
    const epoch = this._epoch, generation = this._generation.get(key) || 0
    const url = this._url(scenarioId,locale)
    let overlay
    try {
      overlay = JSON.parse(await this.transport.load(url,{signal}))
      const validation = validateStoryTranslationOverlay(overlay,{scenarioId,locale})
      if (!validation.valid) throw Error(validation.errors.join('; '))
    } catch(error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error
      this.transport.invalidate(url)
      if ((epoch !== this._epoch || generation !== (this._generation.get(key) || 0))) throw new DOMException('Superseded','AbortError')
      return this._storeFailure({key,scenarioId,locale,url,code:error.status === 404 ? 'translation_missing' : 'translation_invalid',errors:[error.message]})
    }
    if (signal?.aborted || (epoch !== this._epoch || generation !== (this._generation.get(key) || 0))) throw new DOMException('Superseded','AbortError')
    if (this._overlays.has(key)) return this._overlays.get(key)
    this._overlays.set(key, overlay)
    while (this._overlays.size > 16) {const oldest=this._overlays.keys().next().value; this._overlays.delete(oldest); this._diagnostics.delete(oldest)}
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
    this._diagnostics.set(key, Object.freeze({
      code,
      scenarioId,
      locale,
      url,
      entryCount: 0,
      errors: Object.freeze([...errors]),
    }))
    while (this._diagnostics.size > 32) this._diagnostics.delete(this._diagnostics.keys().next().value)
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
    this._generation.set(key,(this._generation.get(key) || 0)+1)
    this.transport.invalidate(this._url(scenarioId,locale))
    this._overlays.delete(key)
    this._diagnostics.delete(key)
  }

  clear() {
    this._epoch++
    for (const key of this._overlays.keys()) this._generation.set(key,(this._generation.get(key) || 0)+1)
    this.transport.clear()
    this._overlays.clear()
    this._diagnostics.clear()
  }
}
