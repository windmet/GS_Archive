import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { readerStoryTitle, readerTitle, readerTitleShardKey } from '../../presentation/ReaderTitle.js'
import { uiLocale } from '../../utils/LanguageStore.js'
import translationRelease from '../../../config/translation-release.json' with {type:'json'}
import { createReaderTitleRepository } from '../../data/ReaderTitleRepository.js'
const index = shallowRef(null)
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
    try {
      const parsed = await repository.loadIndex({ signal: owner.signal })
      if (!owner.signal.aborted) index.value = parsed
    } catch (error) {
      // Titles are optional; a later consumer can retry a failed request.
    }
  },{immediate:true})
  return (entry, source) => {
    const id = entry?.document_id, key = id && readerTitleShardKey(id)
    if (documents && uiLocale.value === 'zh-CN' && !owner.signal.aborted && repository.needsDocument(id) && !requested.has(key)) {
      requested.add(key)
      repository.loadDocument(id, { signal: owner.signal }).then(parsed => {
        if (!owner.signal.aborted) index.value = parsed
      }).catch(() => { /* Optional metadata: retain source titles; another consumer may retry. */ })
    }
    return lookup(entry, source)
  }
}
export function useReaderTitle(entry, source) {
  const display = useReaderTitles()
  return computed(() => display(entry.value, source.value))
}
