const HASH = /^sha256:[a-f0-9]{64}$/
export const READER_TITLE_BYTE_BUDGET = 128 * 1024
export const READER_TITLE_SHARD_COUNT = 16
export function readerTitleShardKey(id) {
  let hash = 2166136261
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ((hash >>> 0) % READER_TITLE_SHARD_COUNT).toString(16).padStart(2, '0')
}
export function validateReaderTitles(value) {
  if (![1, 2].includes(value?.schema_version) || value.locale !== 'zh-CN' || !Array.isArray(value.titles) || !value.documents || typeof value.documents !== 'object' || Array.isArray(value.documents)) throw Error('Invalid Reader title index')
  if (value.schema_version === 2) {
    if (!value.shards || Object.keys(value.shards).length !== READER_TITLE_SHARD_COUNT) throw Error('Invalid Reader title shards')
    for (let n = 0; n < READER_TITLE_SHARD_COUNT; n++) {
      const key = n.toString(16).padStart(2, '0'), shard = value.shards[key]
      if (shard?.file !== `reader-titles/${key}.json` || !HASH.test(shard.sha256) || !Number.isInteger(shard.bytes) || shard.bytes <= 0 || shard.bytes >= READER_TITLE_BYTE_BUDGET) throw Error('Invalid Reader title shard binding')
    }
  }
  const validTitle = title => title && typeof title.source === 'string' && title.source && typeof title.text === 'string' && title.text && HASH.test(title.source_hash) && title.unit_id?.startsWith('story-text:v1:')
  for (const title of value.titles) if (!validTitle(title)) throw Error('Invalid Reader title binding')
  // A binding names a shared title (index into titles) or carries a title that names only its own
  // document (record), kept in the document's shard so the root index stays small. It may also carry
  // the document's opening line (work rows show it outside the Reader), or only that.
  for (const [id, record] of Object.entries(value.documents)) {
    const metadata = record?.record, seasonal = metadata && typeof metadata.source === 'string' && metadata.source
      && typeof metadata.text === 'string' && metadata.text && HASH.test(metadata.source_hash)
      && metadata.unit_id === `metadata:v1:seasonal-title:title:${metadata.source_hash.slice(7)}`
    const shared = Number.isInteger(record?.title) && value.titles[record.title], own = metadata !== undefined && (validTitle(metadata) || seasonal)
    const opening = record?.opening
    if (opening !== undefined && !validTitle(opening)) throw Error('Invalid Reader document opening binding')
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !HASH.test(record?.revision) || (shared && own) || (!shared && !own && !opening)) throw Error('Invalid Reader document title binding')
  }
  return value
}
export function validateReaderTitleShard(value, index, key) {
  if (value?.schema_version !== 1 || value.locale !== index.locale || value.key !== key || !index.shards?.[key]) throw Error('Invalid Reader title shard')
  validateReaderTitles({ schema_version: 1, locale: index.locale, titles: index.titles, documents: value.documents })
  if (Object.keys(value.documents).some(id => readerTitleShardKey(id) !== key)) throw Error('Misrouted Reader title binding')
  return value
}
// Pages without reading entries (the portal) know only the story file. A title unit names its
// story (story-text:v1:<story>:...), so the story id plus the exact source title still binds it.
export function readerStoryTitle(index, storyFile, source, locale = 'zh-CN') {
  if (locale === 'ja-JP' || !index || !source) return source
  const story = String(storyFile || '').replace(/\.json$/, '')
  const title = story && index.titles.find(row => row.source === source && row.unit_id.startsWith(`story-text:v1:${story}:`))
  return title?.text || source
}
// A document's opening line outside the Reader (a work row): its translation binding (overlay text as
// written, for resolveStoryText) when it is for this document revision and the same source line, else
// null so the caller can fall back.
const compact = value => String(value || '').replace(/[\s　]/gu, '')
export function readerOpening(index, entry, source, locale = 'zh-CN') {
  if (locale === 'ja-JP' || !source) return null
  const binding = index?.documents?.[entry?.document_id]
  const opening = binding?.revision === entry?.sha256 ? binding.opening : null
  return opening && compact(opening.source) === compact(source) ? opening : null
}
export function readerTitle(index, entry, source, locale = 'zh-CN') {
  if (locale === 'ja-JP') return source
  const binding = index?.documents?.[entry?.document_id]
  const title = binding && (binding.record || index.titles[binding.title])
  if (title?.unit_id?.startsWith('metadata:v1:seasonal-title:title:')) {
    // Directory and chapter-picker projections carry only document_id + sha256.
    // Exact source + revision still bind them; full manifest callers also check title/domain.
    return (!entry?.domain || entry.domain === 'seasonal') && binding.revision === entry?.sha256
      && (!entry.title || title.source === entry.title) && title.source === source ? title.text : source
  }
  // The bound title row names the document; a caller passing the document's own manifest title (some
  // documents carry a synopsis line there) gets that title too.
  return binding?.revision === entry?.sha256 && title && (title.source === source || (entry?.title && source === entry.title)) ? title.text : source
}
