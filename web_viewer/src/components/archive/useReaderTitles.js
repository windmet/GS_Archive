import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { readerTitle, validateReaderTitles } from '../../presentation/ReaderTitle.js'
import { uiLocale } from '../../utils/LanguageStore.js'
import translationRelease from '../../../config/translation-release.json' with {type:'json'}
import { createBoundedTextTransport } from '../../utils/BoundedTextTransport.js'
const index = shallowRef(null)
const transport = createBoundedTextTransport({maxBytes:256*1024,cacheBytes:256*1024,maxEntries:1})
const url = `/translations/zh-CN/reader-titles.json?rev=${translationRelease.release}`
export function useReaderTitles() {
  const owner = new AbortController()
  onScopeDispose(() => owner.abort())
  watch(uiLocale, async locale => {
    if (locale !== 'zh-CN' || index.value) return
    try {
      const parsed = validateReaderTitles(JSON.parse(await transport.load(url,{signal:owner.signal})))
      if (!owner.signal.aborted) index.value = parsed
    } catch (error) {
      if (error.name !== 'AbortError') transport.invalidate(url)
      // Titles are optional; a later consumer can retry a failed request.
    }
  },{immediate:true})
  return (entry, source) => readerTitle(index.value, entry, source, uiLocale.value)
}
export function useReaderTitle(entry, source) {
  const display = useReaderTitles()
  return computed(() => display(entry.value, source.value))
}
