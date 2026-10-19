import { createBoundedTextTransport } from './BoundedTextTransport.js'

// A document owns its parse and lazy digest. Derived work shares the same
// bounded cache/flight as the response, rather than an unbounded second map.
export function createStageIndexDocument(text, {
  parse = JSON.parse, digest = bytes => crypto.subtle.digest('SHA-256', bytes),
} = {}) {
  const data = parse(text)
  let hashPromise
  return { data, hash() {
    if (!hashPromise) {
      const bytes = new TextEncoder().encode(text)
      hashPromise = Promise.resolve().then(() => digest(bytes)).then(result => {
        text = null
        return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      }).catch(error => { hashPromise = null; throw error })
    }
    return hashPromise
  } }
}

export function createStageIndexTransport({parse, digest, ...options} = {}) {
  return createBoundedTextTransport({
    maxBytes: 12 * 1024 * 1024, cacheBytes: 16 * 1024 * 1024, maxEntries: 16,
    ...options, decode: text => createStageIndexDocument(text, {parse, digest}),
  })
}
