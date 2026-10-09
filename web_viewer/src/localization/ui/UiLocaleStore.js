import { ref, watch } from 'vue'

export const SUPPORTED_UI_LOCALES = Object.freeze(['zh-CN', 'ja-JP'])
export const uiLocale = ref('zh-CN')

export function setUiLocale(locale) {
  uiLocale.value = SUPPORTED_UI_LOCALES.includes(locale) ? locale : 'zh-CN'
}

// The document language follows the interface language only, never the story display mode:
// Japanese passages in story text carry their own lang="ja". index.html ships lang="zh-CN" for
// the first paint.
export function syncDocumentLanguage(doc = globalThis.document) {
  if (!doc?.documentElement) return () => {}
  return watch(uiLocale, locale => { doc.documentElement.lang = locale }, { immediate: true, flush: 'sync' })
}

syncDocumentLanguage()
