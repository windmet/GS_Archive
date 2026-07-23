import jaJP from './locales/ja-JP.js'
import zhCN from './locales/zh-CN.js'
import { uiLocale } from './UiLocaleStore.js'

const MESSAGES = Object.freeze({ 'ja-JP': jaJP, 'zh-CN': zhCN })

export function resolveUiText(key, params = {}, locale = uiLocale.value) {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES['zh-CN'][key] ?? key
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
    Object.hasOwn(params, name) ? String(params[name]) : match
  ))
}
