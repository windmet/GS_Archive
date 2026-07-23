import { ref } from 'vue'

export const SUPPORTED_UI_LOCALES = Object.freeze(['zh-CN', 'ja-JP'])
export const uiLocale = ref('zh-CN')

export function setUiLocale(locale) {
  uiLocale.value = SUPPORTED_UI_LOCALES.includes(locale) ? locale : 'zh-CN'
}
