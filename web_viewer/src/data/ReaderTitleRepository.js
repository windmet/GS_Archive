import { createBoundedTextTransport } from '../utils/BoundedTextTransport.js'
import { READER_TITLE_BYTE_BUDGET, readerTitleShardKey, validateReaderTitles, validateReaderTitleShard } from '../presentation/ReaderTitle.js'

export function createReaderTitleRepository({ url, transport = createBoundedTextTransport({
  maxBytes: READER_TITLE_BYTE_BUDGET, cacheBytes: 256 * 1024, maxEntries: 17,
}), digest = async bytes => `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')}` } = {}) {
  let index = null
  const loaded = new Set()
  async function loadIndex({ signal } = {}) {
    signal?.throwIfAborted()
    if (index) return index
    try {
      const value = validateReaderTitles(JSON.parse(await transport.load(url, { signal })))
      signal?.throwIfAborted()
      if (!index) index = value
      return index
    } catch (error) { if (error.name !== 'AbortError') transport.invalidate(url); throw error }
  }
  function needsDocument(id) { return Boolean(index?.schema_version === 2 && id && !loaded.has(readerTitleShardKey(id))) }
  async function loadDocument(id, { signal } = {}) {
    await loadIndex({ signal })
    if (!needsDocument(id)) return index
    const key = readerTitleShardKey(id), descriptor = index.shards[key]
    const shardUrl = url.replace(/reader-titles\.json(?=\?|$)/, descriptor.file)
    try {
      const text = await transport.load(shardUrl, { signal }), bytes = new TextEncoder().encode(text)
      if (bytes.length !== descriptor.bytes || await digest(bytes) !== descriptor.sha256) throw Error('Reader title shard integrity mismatch')
      const shard = validateReaderTitleShard(JSON.parse(text), index, key)
      signal?.throwIfAborted()
      index = { ...index, documents: { ...index.documents, ...shard.documents } }
      loaded.add(key)
      return index
    } catch (error) { if (error.name !== 'AbortError') transport.invalidate(shardUrl); throw error }
  }
  return { loadIndex, loadDocument, needsDocument }
}
