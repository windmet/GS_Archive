import { computed, onMounted, shallowRef } from 'vue'
import { readerTitle, validateReaderTitles } from '../../presentation/ReaderTitle.js'
import { uiLocale } from '../../utils/LanguageStore.js'
const index = shallowRef(null)
let request
function load() {
  request ||= fetch('/translations/zh-CN/reader-titles.json?rev=1').then(async response => {
    if (!response.ok) throw Error('Reader titles unavailable')
    index.value = validateReaderTitles(await response.json())
  }).catch(() => { /* Titles are optional; keep the original on invalid/missing data. */ })
  return request
}
export function useReaderTitles() {
  onMounted(load)
  return (entry, source) => readerTitle(index.value, entry, source, uiLocale.value)
}
export function useReaderTitle(entry, source) {
  const display = useReaderTitles()
  return computed(() => display(entry.value, source.value))
}
