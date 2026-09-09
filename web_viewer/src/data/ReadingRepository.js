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
} = {}) {
  let manifestRequest = null
  const documents = new Map()
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
  async function load(documentId) {
    if (!/^[A-Za-z0-9_-]+$/.test(documentId || '')) throw new TypeError('Invalid reading document ID')
    const entry = (await manifest()).entries.find(e => e.document_id === documentId)
    if (!entry) return { status: 'not-generated', document: null }
    const key = `${entry.schema_version}:${entry.document_id}:${entry.sha256}`
    if (!documents.has(key)) {
      const pending = request(`/data/reading/${entry.file}?rev=${entry.sha256.slice(7)}`)
        .then(async response => {
          const bytes = await response.arrayBuffer()
          if (await digest(bytes) !== entry.sha256) throw Error('Reading document digest mismatch')
          return freeze(validateReadingDocument(JSON.parse(new TextDecoder().decode(bytes)), entry))
        }).catch(error => {
          if (documents.get(key) === pending) documents.delete(key)
          throw error
        })
      documents.set(key, pending)
      if (documents.size > 16) documents.delete(documents.keys().next().value)
    }
    const document = await documents.get(key)
    return { status: document.status, document }
  }
  return { manifest, load }
}
