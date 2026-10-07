const HASH = /^sha256:[a-f0-9]{64}$/
export function validateReaderTitles(value) {
  if (value?.schema_version !== 1 || value.locale !== 'zh-CN' || !Array.isArray(value.titles) || !value.documents || typeof value.documents !== 'object') throw Error('Invalid Reader title index')
  for (const title of value.titles) {
    if (!title || typeof title.source !== 'string' || !title.source || typeof title.text !== 'string' || !title.text || !HASH.test(title.source_hash) || !title.unit_id?.startsWith('story-text:v1:')) throw Error('Invalid Reader title binding')
  }
  for (const [id, record] of Object.entries(value.documents)) {
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !HASH.test(record?.revision) || !Number.isInteger(record.title) || !value.titles[record.title]) throw Error('Invalid Reader document title binding')
  }
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
export function readerTitle(index, entry, source, locale = 'zh-CN') {
  if (locale === 'ja-JP') return source
  const binding = index?.documents?.[entry?.document_id]
  const title = binding && index.titles[binding.title]
  return binding?.revision === entry?.sha256 && title?.source === source ? title.text : source
}
