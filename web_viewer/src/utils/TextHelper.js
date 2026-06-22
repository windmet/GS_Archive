import { languageMode } from './LanguageStore.js'

/**
 * Resolve display text from dialogue according to current language mode.
 *
 * Supports two data formats:
 *   - Legacy: { text: "JP text" }  (treated as Japanese)
 *   - Bilingual: { text_jp: "...", text_cn: "..." }
 *
 * @param {object|null} dialogue - step.dialogue
 * @param {string} [mode] - 'JP' | 'CN' | 'BILINGUAL' (default: from store)
 * @returns {{ speaker: string, text: string }}
 */
export function resolveText(dialogue, mode) {
  if (!dialogue) return { speaker: '', text: '' }
  const speaker = dialogue.speaker || ''
  const m = mode || languageMode.value

  // Backward compat: if text_jp absent, treat .text as Japanese
  const jp = dialogue.text_jp ?? dialogue.text ?? ''
  const cn = dialogue.text_cn ?? ''

  switch (m) {
    case 'JP':
      return { speaker, text: jp }
    case 'CN':
      return { speaker, text: cn || jp }
    case 'BILINGUAL':
      return { speaker, text: cn ? `${jp}\n${cn}` : jp }
    default:
      return { speaker, text: jp }
  }
}

/**
 * Helper for MobileUI — returns only the text portion with language resolution.
 */
export function resolveTextContent(dialogue, mode) {
  return resolveText(dialogue, mode).text
}
