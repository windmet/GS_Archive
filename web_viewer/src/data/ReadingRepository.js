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
  locatorResolver = null,
} = {}) {
  let manifestRequest = null
  const documents = new Map()
  const cacheKey = entry => `${entry.schema_version}:${entry.document_id}:${entry.sha256}`
  const sameEntry = (a, b) => !Object.keys(a).some(key => a[key] !== b[key]) && !Object.keys(b).some(key => b[key] !== a[key])
  function peek(documentId, entry) {
    if (!entry || entry.document_id !== documentId) return null
    const cached = documents.get(cacheKey(entry))
    if (!cached?.document || !sameEntry(entry, cached.entry)) return null
    return {status:cached.document.status,document:cached.document}
  }
  async function request(url) {
    const response = await fetchImpl(url)
    if (!response.ok) throw Error(`Reading HTTP ${response.status}`)
    if ((response.headers.get('content-type') || '').includes('text/html')) throw Error('Reading received HTML')
    return response
  }
  function manifest({ fresh = false } = {}) {
    if (!manifestRequest || fresh) {
      const pending = request('/data/reading/manifest.json').then(r => r.json())
        .then(validateReadingManifest).then(freeze).catch(error => {
          if (manifestRequest === pending) manifestRequest = null
          throw error
        })
      manifestRequest = pending
    }
    return manifestRequest
  }
  async function locator(documentId, { fresh = false } = {}) {
    if (!/^[A-Za-z0-9_-]+$/.test(documentId || '')) throw new TypeError('Invalid reading document ID')
    if (!locatorResolver) {
      const entries = (await manifest({ fresh })).entries
      return { entry: entries.find(entry => entry.document_id === documentId) || null, entries }
    }
    const result = await locatorResolver(documentId, { fresh })
    const entries = validateReadingManifest({ schema_version: 1, entries: result.entries }).entries
    const entry = entries.find(candidate => candidate.document_id === documentId)
    if (!entry && result.entry === null && entries.length === 0) return freeze({ entry: null, entries })
    if (!entry || Object.keys(entry).some(key => entry[key] !== result.entry?.[key]) ||
      Object.keys(result.entry).some(key => entry[key] !== result.entry[key])) throw Error('Reading locator identity mismatch')
    if (entries.some(candidate => candidate.logical_id !== entry.logical_id)) throw Error('Reading locator segment mismatch')
    return freeze({ entry, entries })
  }
  async function load(documentId, knownEntry = undefined) {
    if (!/^[A-Za-z0-9_-]+$/.test(documentId || '')) throw new TypeError('Invalid reading document ID')
    const entry = knownEntry === undefined ? (await locator(documentId)).entry : knownEntry
    if (entry && entry.document_id !== documentId) throw Error('Reading locator identity mismatch')
    if (!entry) return { status: 'not-generated', document: null }
    const key = cacheKey(entry)
    if (documents.has(key) && !sameEntry(entry, documents.get(key).entry)) throw Error('Reading locator identity mismatch')
    if (!documents.has(key)) {
      const cached = {entry:{...entry},document:null,promise:null}
      const pending = request(`/data/reading/${entry.file}?rev=${entry.sha256.slice(7)}`)
        .then(async response => {
          const bytes = await response.arrayBuffer()
          if (await digest(bytes) !== entry.sha256) throw Error('Reading document digest mismatch')
          cached.document = freeze(validateReadingDocument(JSON.parse(new TextDecoder().decode(bytes)), entry))
          return cached.document
        }).catch(error => {
          if (documents.get(key) === cached) documents.delete(key)
          throw error
        })
      cached.promise = pending
      documents.set(key, cached)
      if (documents.size > 16) documents.delete(documents.keys().next().value)
    }
    const document = await documents.get(key).promise
    return { status: document.status, document }
  }
  return { manifest, locator, load, peek }
}
