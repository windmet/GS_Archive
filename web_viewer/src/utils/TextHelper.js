import { languageMode } from './LanguageStore.js'
import {
  normalizeLegacyDialogue,
  preferencesFromLegacyLanguageMode,
} from '../localization/story/LegacyDialogueAdapter.js'
import { resolveStoryText } from '../localization/story/StoryTextResolver.js'

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
  const m = mode || languageMode.value
  const normalized = normalizeLegacyDialogue(dialogue)
  const display = resolveStoryText({
    ...normalized,
    preferences: preferencesFromLegacyLanguageMode(m),
  })

  return {
    speaker: display.speaker.display,
    text: [display.primary?.text, display.secondary?.text]
      .filter(text => typeof text === 'string' && text.length > 0)
      .join('\n'),
  }
}

/**
 * Helper for MobileUI — returns only the text portion with language resolution.
 */
export function resolveTextContent(dialogue, mode) {
  return resolveText(dialogue, mode).text
}
