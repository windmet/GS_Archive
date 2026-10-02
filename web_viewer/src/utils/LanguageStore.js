import { computed, ref } from 'vue'
import { setUiLocale, uiLocale } from '../localization/ui/UiLocaleStore.js'
import { PlayerPreferencesRepository } from '../core/story-runtime/PlayerPreferencesRepository.js'

export { uiLocale }
export const storyContentMode = ref('original')
export const storyTranslationLocale = ref('zh-CN')
export const bilingualPrimary = ref('original')
const producerPreferences = new PlayerPreferencesRepository()
export const producerName = ref(producerPreferences.load().producer_name)

export function saveProducerName(value) {
  if (typeof value !== 'string') throw new TypeError('Producer name must be a string')
  producerName.value = producerPreferences.update({ producer_name: value }).producer_name
}

// Update only the shared locale; retain story mode, addressing and playback.
export function saveArchiveLocale(locale) {
  const saved = producerPreferences.update({ui_locale: locale})
  setUiLocale(saved.ui_locale)
  return saved.ui_locale
}

export const storyLanguagePreferences = computed(() => ({
  story_content_mode: storyContentMode.value,
  story_translation_locale: storyTranslationLocale.value,
  bilingual_primary: bilingualPrimary.value,
  missing_translation_policy: 'fallback-source',
  producer_name: producerName.value,
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
  if (typeof preferences.producer_name === 'string') producerName.value = preferences.producer_name
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
