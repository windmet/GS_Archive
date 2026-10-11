import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { readerStoryTitle, readerTitle, readerTitleShardKey } from '../../presentation/ReaderTitle.js'
import { uiLocale } from '../../utils/LanguageStore.js'
import translationRelease from '../../../config/translation-release.json' with {type:'json'}
import { createReaderTitleRepository } from '../../data/ReaderTitleRepository.js'
const index = shallowRef(null)
// Load state shared by every consumer: a title waits for its translation only while the index or
// its shard is on the way; once either fails, the source title stands.
const indexState = shallowRef('idle')
const shardFailures = shallowRef(new Set())
const url = `/translations/zh-CN/reader-titles.json?rev=${translationRelease.release}`
const repository = createReaderTitleRepository({ url })
export function useReaderTitles() {
  return useTitleIndex((entry, source) => readerTitle(index.value, entry, source, uiLocale.value), true)
}
// Story file + source title, for pages that do not load reading entries (the portal).
export function useStoryTitles() {
  return useTitleIndex((storyFile, source) => readerStoryTitle(index.value, storyFile, source, uiLocale.value))
}
// Source title alone, for references that carry neither document nor story file (a call's unlock
// condition names a personal story chapter). Used only when every published translation of that
// source title agrees.
export function useSourceTitles() {
  return useTitleIndex((_entry, source) => {
    if (uiLocale.value !== 'zh-CN' || !source) return source
    const texts = new Set((index.value?.titles || []).filter(title => title.source === source).map(title => title.text))
    return texts.size === 1 ? [...texts][0] : source
  })
}
function useTitleIndex(lookup, documents = false) {
  const owner = new AbortController()
  const requested = new Set()
  onScopeDispose(() => owner.abort())
  watch(uiLocale, async locale => {
    if (locale !== 'zh-CN') return
    if (indexState.value !== 'ready') indexState.value = 'loading'
    try {
      const parsed = await repository.loadIndex({ signal: owner.signal })
      if (!owner.signal.aborted) { index.value = parsed; indexState.value = 'ready' }
    } catch (error) {
      // Titles are optional; a later consumer can retry a failed request.
      if (error?.name !== 'AbortError') indexState.value = 'failed'
    }
  },{immediate:true})
  const display = (entry, source) => {
    const id = entry?.document_id, key = id && readerTitleShardKey(id)
    if (documents && uiLocale.value === 'zh-CN' && !owner.signal.aborted && repository.needsDocument(id) && !requested.has(key)) {
      requested.add(key)
      repository.loadDocument(id, { signal: owner.signal }).then(parsed => {
        if (!owner.signal.aborted) index.value = parsed
      }).catch(error => {
        // Optional metadata: retain source titles; another consumer may retry.
        if (error?.name !== 'AbortError') shardFailures.value = new Set([...shardFailures.value, key])
      })
    }
    return lookup(entry, source)
  }
  // True while this title may still change from the source to its translation.
  display.pending = entry => {
    if (uiLocale.value !== 'zh-CN') return false
    if (indexState.value !== 'ready') return indexState.value !== 'failed'
    void index.value
    const id = documents ? entry?.document_id : ''
    return Boolean(id) && repository.needsDocument(id) && !shardFailures.value.has(readerTitleShardKey(id))
  }
  return display
}
export function useReaderTitle(entry, source) {
  const display = useReaderTitles()
  const title = computed(() => display(entry.value, source.value))
  title.pending = computed(() => display.pending(entry.value))
  return title
}
// Route preparation: load the index and the shards holding these documents' titles before a page
// is shown, so its first paint already carries the translations (see StoryTextReadiness).
export async function prepareReaderTitles(documentIds = [], { signal } = {}) {
  if (uiLocale.value !== 'zh-CN') return
  if (indexState.value !== 'ready') indexState.value = 'loading'
  try {
    await repository.loadIndex({ signal })
    const byShard = new Map()
    for (const id of documentIds) if (id && repository.needsDocument(id)) byShard.set(readerTitleShardKey(id), id)
    const results = await Promise.allSettled([...byShard.values()].map(id => repository.loadDocument(id, { signal })))
    results.forEach((result, i) => {
      if (result.status === 'rejected' && result.reason?.name !== 'AbortError')
        shardFailures.value = new Set([...shardFailures.value, readerTitleShardKey([...byShard.values()][i])])
    })
    index.value = await repository.loadIndex({ signal })
    indexState.value = 'ready'
  } catch (error) {
    if (error?.name !== 'AbortError') indexState.value = 'failed'
  }
}
