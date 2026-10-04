import { createBoundedTextTransport } from '../utils/BoundedTextTransport.js'
import { validateReadingDocument, validateReadingManifest } from '../../shared/reading/ReadingContract.js'

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

export function createReadingRepository({ fetchImpl = (...args) => fetch(...args),
  digest = async bytes => `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')}`,
  locatorResolver = null, timeoutMs = 12000,
} = {}) {
  const transport = createBoundedTextTransport({fetchImpl,timeoutMs,binary:true,maxBytes:2*1024*1024,cacheBytes:4*1024*1024,maxEntries:16})
  const documents = new Map()
  let manifestRevision = 0
  const cacheKey = entry => `${entry.schema_version}:${entry.document_id}:${entry.sha256}`
  const sameEntry = (a, b) => !Object.keys(a).some(key => a[key] !== b[key]) && !Object.keys(b).some(key => b[key] !== a[key])
  function peek(documentId, entry) {
    if (!entry || entry.document_id !== documentId) return null
    const cached = documents.get(cacheKey(entry))
    if (!cached?.document || !sameEntry(entry, cached.entry)) return null
    return {status:cached.document.status,document:cached.document}
  }
  async function manifest({ fresh = false, signal } = {}) {
    const url='/data/reading/manifest.json'
    if (fresh) {manifestRevision++; transport.invalidate(url)}
    const revision = manifestRevision
    try {return freeze(validateReadingManifest(JSON.parse(new TextDecoder().decode(await transport.load(url,{signal})))))}
    catch(error) {if (!signal?.aborted && revision === manifestRevision) transport.invalidate(url); throw error}
  }
  async function locator(documentId, { fresh = false, signal } = {}) {
    if (!/^[A-Za-z0-9_-]+$/.test(documentId || '')) throw new TypeError('Invalid reading document ID')
    if (!locatorResolver) {
      const entries = (await manifest({ fresh,signal })).entries
      return { entry: entries.find(entry => entry.document_id === documentId) || null, entries }
    }
    const result = await locatorResolver(documentId, { fresh,signal })
    const entries = validateReadingManifest({ schema_version: 1, entries: result.entries }).entries
    const entry = entries.find(candidate => candidate.document_id === documentId)
    if (!entry && result.entry === null && entries.length === 0) return freeze({ entry: null, entries })
    if (!entry || Object.keys(entry).some(key => entry[key] !== result.entry?.[key]) ||
      Object.keys(result.entry).some(key => entry[key] !== result.entry[key])) throw Error('Reading locator identity mismatch')
    if (entries.some(candidate => candidate.logical_id !== entry.logical_id)) throw Error('Reading locator segment mismatch')
    return freeze({ entry, entries })
  }
  async function load(documentId, knownEntry = undefined, {signal} = {}) {
    if (!/^[A-Za-z0-9_-]+$/.test(documentId || '')) throw new TypeError('Invalid reading document ID')
    const entry = knownEntry === undefined ? (await locator(documentId,{signal})).entry : knownEntry
    if (entry && entry.document_id !== documentId) throw Error('Reading locator identity mismatch')
    if (!entry) return { status: 'not-generated', document: null }
    const key = cacheKey(entry)
    if (documents.has(key) && !sameEntry(entry, documents.get(key).entry)) throw Error('Reading locator identity mismatch')
    signal?.throwIfAborted()
    let document = documents.get(key)?.document
    if (!document) {
      const url = `/data/reading/${entry.file}?rev=${entry.sha256.slice(7)}`
      try {
        const bytes = await transport.load(url,{signal})
        if (await digest(bytes) !== entry.sha256) throw Error('Reading document digest mismatch')
        signal?.throwIfAborted()
        document = freeze(validateReadingDocument(JSON.parse(new TextDecoder().decode(bytes)),entry))
        if (documents.has(key) && !sameEntry(entry,documents.get(key).entry)) throw Error('Reading locator identity mismatch')
        if (documents.has(key)) document=documents.get(key).document
        else documents.set(key,{entry:{...entry},document})
        while (documents.size > 16) documents.delete(documents.keys().next().value)
      } catch(error) {if (!signal?.aborted) transport.invalidate(url); throw error}
    }
    return { status: document.status, document }
  }
  return { manifest, locator, load, peek }
}
