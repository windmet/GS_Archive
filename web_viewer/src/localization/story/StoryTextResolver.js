const VALID_MODES = new Set(['original', 'translation', 'bilingual'])
const VALID_PRIMARY = new Set(['original', 'translation'])

const DEFAULT_PREFERENCES = Object.freeze({
  story_content_mode: 'original',
  story_translation_locale: 'zh-CN',
  bilingual_primary: 'original',
  missing_translation_policy: 'fallback-source',
})

function textValue(value) {
  return typeof value === 'string' ? value : ''
}

function normalizePreferences(preferences) {
  const input = preferences && typeof preferences === 'object' ? preferences : {}
  return {
    story_content_mode: VALID_MODES.has(input.story_content_mode)
      ? input.story_content_mode
      : DEFAULT_PREFERENCES.story_content_mode,
    story_translation_locale: textValue(input.story_translation_locale)
      || DEFAULT_PREFERENCES.story_translation_locale,
    bilingual_primary: VALID_PRIMARY.has(input.bilingual_primary)
      ? input.bilingual_primary
      : DEFAULT_PREFERENCES.bilingual_primary,
    missing_translation_policy: 'fallback-source',
  }
}

function entityNameForLocale(entityNames, entityId, locale, entityType) {
  if (!entityId || !entityNames) return ''
  if (typeof entityNames === 'function') {
    return textValue(entityNames(entityId, locale, entityType))
  }
  if (entityNames instanceof Map) {
    const localeBucket = entityNames.get(locale)
    if (localeBucket instanceof Map) return textValue(localeBucket.get(entityId))
    if (localeBucket && typeof localeBucket === 'object') return textValue(localeBucket[entityId])
    const entity = entityNames.get(entityId)
    if (entity instanceof Map) return textValue(entity.get(locale))
    if (entity && typeof entity === 'object') return textValue(entity[locale] ?? entity.name)
    return textValue(entity)
  }

  if (typeof entityNames !== 'object') return ''
  const localeBucket = entityNames[locale]
  if (localeBucket && typeof localeBucket === 'object') {
    const localized = localeBucket[entityId]
    if (typeof localized === 'string') return localized
    if (localized && typeof localized === 'object') return textValue(localized.name)
  }
  const entity = entityNames[entityId]
  if (typeof entity === 'string') return entity
  if (entity && typeof entity === 'object') return textValue(entity[locale] ?? entity.name)
  return ''
}

function normalizeSpeaker(speaker) {
  const value = speaker && typeof speaker === 'object' ? speaker : {}
  return {
    kind: textValue(value.kind) || 'none',
    entityType: value.entityType ?? value.entity_type ?? null,
    entityId: value.entityId ?? value.entity_id ?? null,
    source: textValue(value.sourceName ?? value.source_name ?? value.source),
  }
}

function translationState({ overlayEntry, textRef, allowStale }) {
  const entry = overlayEntry && typeof overlayEntry === 'object' ? overlayEntry : null
  const text = textValue(entry?.text)
  const expectedHash = textValue(textRef?.source_hash)
  const entryHash = textValue(entry?.source_hash)
  const stale = Boolean(text && expectedHash && entryHash !== expectedHash)
  const structurallyUsable = Boolean(text)
  const available = structurallyUsable && (!stale || allowStale)

  return {
    text,
    available,
    status: text ? (textValue(entry?.status) || 'invalid') : 'missing',
    stale,
  }
}

function originalBlock(source) {
  return { locale: 'ja-JP', text: source, source: 'original' }
}

function translationBlock(locale, text) {
  return { locale, text, source: 'translation' }
}

/**
 * Resolve one source text unit into a presentation-only view model.
 * This function intentionally performs no fetch, storage, Vue, History or Runtime work.
 */
export function resolveStoryText({
  source,
  textRef = null,
  speaker = null,
  overlayEntry = null,
  entityNames = null,
  preferences = null,
  allowStale = false,
} = {}) {
  const sourceText = textValue(source)
  const prefs = normalizePreferences(preferences)
  const translation = translationState({ overlayEntry, textRef, allowStale })
  const original = originalBlock(sourceText)
  const localized = translationBlock(prefs.story_translation_locale, translation.text)
  const normalizedSpeaker = normalizeSpeaker(speaker)

  let primary = original
  let secondary = null
  let fallbackUsed = false

  if (prefs.story_content_mode === 'translation') {
    if (translation.available) primary = localized
    else fallbackUsed = true
  } else if (prefs.story_content_mode === 'bilingual') {
    if (translation.available) {
      if (prefs.bilingual_primary === 'translation') {
        primary = localized
        secondary = original
      } else {
        primary = original
        secondary = localized
      }
    } else {
      fallbackUsed = true
    }
  }

  const translatedSpeaker = entityNameForLocale(
    entityNames,
    normalizedSpeaker.entityId,
    prefs.story_translation_locale,
    normalizedSpeaker.entityType,
  )
  const preferTranslatedSpeaker = prefs.story_content_mode === 'translation'
    || (prefs.story_content_mode === 'bilingual' && prefs.bilingual_primary === 'translation')

  return {
    unitId: textValue(textRef?.unit_id) || null,
    speaker: {
      kind: normalizedSpeaker.kind,
      entityType: normalizedSpeaker.entityType,
      entityId: normalizedSpeaker.entityId,
      source: normalizedSpeaker.source,
      display: preferTranslatedSpeaker && translatedSpeaker
        ? translatedSpeaker
        : normalizedSpeaker.source,
    },
    primary,
    secondary,
    translation: {
      available: translation.available,
      status: translation.status,
      stale: translation.stale,
      fallbackUsed,
    },
  }
}

export { DEFAULT_PREFERENCES }
