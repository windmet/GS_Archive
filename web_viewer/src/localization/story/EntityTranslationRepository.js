import translationRelease from '../../../config/translation-release.json' with {type:'json'}
import { createBoundedTextTransport } from '../../utils/BoundedTextTransport.js'
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/
const ENTITY_TYPES = new Set(['idol', 'npc', 'unit', 'card', 'event', 'skill', 'story_collection'])
const ENTRY_STATUSES = new Set(['draft', 'reviewed', 'final'])
const TOP_LEVEL_KEYS = new Set(['schema_version', 'locale', 'entity_type', 'entries'])
const ENTRY_KEYS = new Set(['source_hash', 'name', 'description', 'status', 'translator', 'reviewer', 'notes'])

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function unexpectedKeys(record, allowed, path, errors) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unexpected property`)
  }
}

export function normalizeEntitySourceText(value) {
  let text = String(value ?? '')
  if (text.startsWith('\uFEFF')) text = text.slice(1)
  return text.replace(/\r\n?/gu, '\n').normalize('NFC')
}

export async function hashEntitySourceText(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('Web Crypto SHA-256 is unavailable')
  }
  const bytes = new TextEncoder().encode(normalizeEntitySourceText(value))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function validateEntityTranslationOverlay(value, { entityType, locale } = {}) {
  const errors = []
  if (!isRecord(value)) return { valid: false, errors: ['$: expected object'] }
  unexpectedKeys(value, TOP_LEVEL_KEYS, '$', errors)
  if (value.schema_version !== 1) errors.push('$.schema_version: expected 1')
  if (!LOCALE_PATTERN.test(value.locale || '')) errors.push('$.locale: invalid BCP 47 locale')
  if (locale && value.locale !== locale) errors.push(`$.locale: expected ${locale}`)
  if (!ENTITY_TYPES.has(value.entity_type)) errors.push('$.entity_type: invalid entity type')
  if (entityType && value.entity_type !== entityType) errors.push(`$.entity_type: expected ${entityType}`)
  if (!isRecord(value.entries)) {
    errors.push('$.entries: expected object')
  } else {
    for (const [entityId, entry] of Object.entries(value.entries)) {
      const path = `$.entries[${JSON.stringify(entityId)}]`
      if (!entityId) errors.push(`${path}: empty entity id`)
      if (!isRecord(entry)) {
        errors.push(`${path}: expected object`)
        continue
      }
      unexpectedKeys(entry, ENTRY_KEYS, path, errors)
      if (!HASH_PATTERN.test(entry.source_hash || '')) errors.push(`${path}.source_hash: invalid sha256`)
      if (typeof entry.name !== 'string' || entry.name.trim().length === 0) errors.push(`${path}.name: expected non-blank string`)
      if (entry.description !== undefined && typeof entry.description !== 'string') errors.push(`${path}.description: expected string`)
      if (!ENTRY_STATUSES.has(entry.status)) errors.push(`${path}.status: invalid status`)
      for (const key of ['translator', 'reviewer']) {
        if (entry[key] !== undefined && entry[key] !== null && typeof entry[key] !== 'string') {
          errors.push(`${path}.${key}: expected string or null`)
        }
      }
      if (entry.notes !== undefined && (!Array.isArray(entry.notes) || entry.notes.some(note => typeof note !== 'string'))) {
        errors.push(`${path}.notes: expected string array`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

function emptyOverlay(entityType, locale) {
  return Object.freeze({ schema_version: 1, locale, entity_type: entityType, entries: Object.freeze({}) })
}

function defaultFetch() {
  if (typeof globalThis.fetch !== 'function') throw new Error('EntityTranslationRepository requires fetch')
  return globalThis.fetch.bind(globalThis)
}

export function buildEntitySearchText({ entityId = '', sourceName = '', translatedName = '' } = {}) {
  return [...new Set([entityId, sourceName, translatedName].filter(Boolean))].join(' ').toLocaleLowerCase()
}

export class EntityTranslationRepository {
  constructor({ baseUrl = '/translations', assetRevision = translationRelease.release, fetchImpl = null, timeoutMs = 12000 } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/u, '')
    this.assetRevision = String(assetRevision)
    this.fetchImpl = fetchImpl || defaultFetch()
    this.transport = createBoundedTextTransport({fetchImpl:this.fetchImpl,timeoutMs,maxBytes:512*1024})
    this._views = new WeakMap()
    this._generation = new Map()
    this._epoch = 0
    this._states = new Map()
  }

  _key(entityType, locale) {
    return `entity-translation:1:${locale}:${entityType}:${this.assetRevision}`
  }

  _url(entityType, locale) {
    const path = `${this.baseUrl}/${encodeURIComponent(locale)}/entities/${encodeURIComponent(entityType)}s.json`
    return this.assetRevision ? `${path}?rev=${encodeURIComponent(this.assetRevision)}` : path
  }

  async loadEntity({ entityType, locale, sourceNames = {}, signal } = {}) {
    if (!ENTITY_TYPES.has(entityType)) throw new TypeError('Invalid entityType')
    if (!LOCALE_PATTERN.test(locale || '')) throw new TypeError('Invalid locale')
    const key = this._key(entityType, locale)
    const epoch = this._epoch, generation = this._generation.get(key) || 0
    const url = this._url(entityType,locale)
    let raw
    try {
      raw = JSON.parse(await this.transport.load(url,{signal}))
      const validation = validateEntityTranslationOverlay(raw,{entityType,locale})
      if (!validation.valid) throw Error(validation.errors.join('; '))
    } catch(error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error
      this.transport.invalidate(url)
      if ((epoch !== this._epoch || generation !== (this._generation.get(key) || 0))) throw new DOMException('Superseded','AbortError')
      return this._storeFailure(key,entityType,locale,url,error.status === 404 ? 'entity_translation_missing' : 'entity_translation_invalid',[error.message])
    }
    const overlay = Object.freeze({...raw,entries:Object.freeze(raw.entries)})
    const staleEntityIds = new Set()
    const unknownEntityIds = new Set()
    for (const [entityId, entry] of Object.entries(overlay.entries)) {
      if (!Object.hasOwn(sourceNames, entityId)) {
        unknownEntityIds.add(entityId)
        continue
      }
      if (entry.source_hash !== await hashEntitySourceText(sourceNames[entityId])) staleEntityIds.add(entityId)
    }
    if (signal?.aborted || (epoch !== this._epoch || generation !== (this._generation.get(key) || 0))) throw new DOMException('Superseded','AbortError')
    const state = {
      overlay,
      staleEntityIds,
      unknownEntityIds,
      diagnostics: Object.freeze({
        code: 'entity_translation_ready',
        entityType,
        locale,
        url,
        entryCount: Object.keys(overlay.entries).length,
        staleEntityIds: Object.freeze([...staleEntityIds].sort()),
        unknownEntityIds: Object.freeze([...unknownEntityIds].sort()),
        errors: Object.freeze([]),
      }),
    }
    this._views.set(overlay,state)
    this._states.set(key,state)
    while (this._states.size > 16) this._states.delete(this._states.keys().next().value)
    return overlay
  }

  _storeFailure(key, entityType, locale, url, code, errors) {
    const overlay = emptyOverlay(entityType, locale)
    this._states.set(key, {
      overlay,
      staleEntityIds: new Set(),
      unknownEntityIds: new Set(),
      diagnostics: Object.freeze({
        code,
        entityType,
        locale,
        url,
        entryCount: 0,
        staleEntityIds: Object.freeze([]),
        unknownEntityIds: Object.freeze([]),
        errors: Object.freeze([...errors]),
      }),
    })
    while (this._states.size > 16) this._states.delete(this._states.keys().next().value)
    return overlay
  }

  getEntry({ entityType, entityId, locale, allowStale = false, overlay = null } = {}) {
    const state = overlay ? this._views.get(overlay) : this._states.get(this._key(entityType, locale))
    if (!state || state.unknownEntityIds.has(entityId)) return null
    if (!allowStale && state.staleEntityIds.has(entityId)) return null
    return state.overlay.entries[entityId] || null
  }

  resolveName({ entityType, entityId, sourceName = '', locale } = {}) {
    return this.getEntry({ entityType, entityId, locale })?.name || sourceName || entityId || ''
  }

  getSearchText({ entityType, entityId, sourceName = '', locale } = {}) {
    return buildEntitySearchText({
      entityId,
      sourceName,
      translatedName: this.getEntry({ entityType, entityId, locale })?.name || '',
    })
  }

  getDiagnostics({ entityType, locale } = {}) {
    return this._states.get(this._key(entityType, locale))?.diagnostics || null
  }

  invalidate({ entityType, locale } = {}) {
    const key = this._key(entityType, locale)
    this._generation.set(key,(this._generation.get(key) || 0)+1)
    this.transport.invalidate(this._url(entityType,locale))
    this._states.delete(key)
  }

  clear() {
    this._epoch++
    for (const key of this._states.keys()) this._generation.set(key,(this._generation.get(key) || 0)+1)
    this.transport.clear()
    this._states.clear()
  }
}
