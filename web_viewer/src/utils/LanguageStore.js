import { computed, ref } from 'vue'
import { setUiLocale, uiLocale } from '../localization/ui/UiLocaleStore.js'

export { uiLocale }
export const storyContentMode = ref('original')
export const storyTranslationLocale = ref('zh-CN')
export const bilingualPrimary = ref('original')

export const storyLanguagePreferences = computed(() => ({
  story_content_mode: storyContentMode.value,
  story_translation_locale: storyTranslationLocale.value,
  bilingual_primary: bilingualPrimary.value,
  missing_translation_policy: 'fallback-source',
}))

function legacyModeFromPreferences() {
  if (storyContentMode.value === 'translation') return 'CN'
  if (storyContentMode.value === 'bilingual') return 'BILINGUAL'
  return 'JP'
}

export const languageMode = computed({
  get: legacyModeFromPreferences,
  set: mode => setLanguageMode(mode),
})

export function setLanguageMode(mode) {
  const mapped = {
    JP: { story_content_mode: 'original', bilingual_primary: 'original' },
    CN: { story_content_mode: 'translation', bilingual_primary: 'translation' },
    BILINGUAL: { story_content_mode: 'bilingual', bilingual_primary: 'original' },
  }[mode] || { story_content_mode: 'original', bilingual_primary: 'original' }
  storyContentMode.value = mapped.story_content_mode
  bilingualPrimary.value = mapped.bilingual_primary
}

export function setStoryLanguagePreferences(preferences = {}) {
  if (['zh-CN', 'ja-JP'].includes(preferences.ui_locale)) setUiLocale(preferences.ui_locale)
  if (['original', 'translation', 'bilingual'].includes(preferences.story_content_mode)) {
    storyContentMode.value = preferences.story_content_mode
  }
  if (typeof preferences.story_translation_locale === 'string' && preferences.story_translation_locale) {
    storyTranslationLocale.value = preferences.story_translation_locale
  }
  if (['original', 'translation'].includes(preferences.bilingual_primary)) {
    bilingualPrimary.value = preferences.bilingual_primary
  }
}
