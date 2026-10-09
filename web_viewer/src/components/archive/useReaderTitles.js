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
