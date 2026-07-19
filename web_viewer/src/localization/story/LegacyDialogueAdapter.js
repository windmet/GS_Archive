const UNKNOWN_SPEAKER_NAMES = new Set(['???', '？？？', '？', '?'])

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function normalizeSpeakerKind(kind, sourceName) {
  if (typeof kind === 'string' && kind) return kind
  if (!sourceName) return 'none'
  if (sourceName === '<P>') return 'producer'
  if (UNKNOWN_SPEAKER_NAMES.has(sourceName.trim())) return 'unknown'
  return 'named'
}

/**
 * Convert current and legacy speaker shapes to the localization contract.
 * The raw source name is deliberately retained even when an entity is known.
 */
export function normalizeLegacySpeaker(dialogue) {
  const structured = dialogue?.speaker && typeof dialogue.speaker === 'object'
    ? dialogue.speaker
    : null
  const identity = dialogue?.speaker_identity && typeof dialogue.speaker_identity === 'object'
    ? dialogue.speaker_identity
    : structured
  const legacyName = typeof dialogue?.speaker === 'string' ? dialogue.speaker : ''
  const sourceName = asString(
    identity?.source_name
      ?? identity?.sourceName
      ?? identity?.source
      ?? legacyName,
  )

  return {
    kind: normalizeSpeakerKind(identity?.kind, sourceName),
    entityType: identity?.entity_type ?? identity?.entityType ?? null,
    entityId: identity?.entity_id ?? identity?.entityId ?? null,
    sourceName,
  }
}

/**
 * Normalize a dialogue without choosing a display language.
 * Inline text_cn is exposed only as a transitional overlay entry.
 */
export function normalizeLegacyDialogue(dialogue) {
  const value = dialogue && typeof dialogue === 'object' ? dialogue : {}
  const source = asString(value.source_text ?? value.text_jp ?? value.text)
  const legacyTranslation = asString(value.text_cn)
  const textRef = value.text_ref && typeof value.text_ref === 'object'
    ? value.text_ref
    : null

  return {
    source,
    textRef,
    speaker: normalizeLegacySpeaker(value),
    overlayEntry: legacyTranslation
      ? {
          source_hash: textRef?.source_hash ?? null,
          text: legacyTranslation,
          status: 'legacy-inline',
          legacy: true,
        }
      : null,
  }
}

/** Map the retired JP/CN/BILINGUAL control to the v2 resolver preferences. */
export function preferencesFromLegacyLanguageMode(mode, translationLocale = 'zh-CN') {
  switch (mode) {
    case 'CN':
      return {
        story_content_mode: 'translation',
        story_translation_locale: translationLocale,
        bilingual_primary: 'translation',
        missing_translation_policy: 'fallback-source',
      }
    case 'BILINGUAL':
      return {
        story_content_mode: 'bilingual',
        story_translation_locale: translationLocale,
        bilingual_primary: 'original',
        missing_translation_policy: 'fallback-source',
      }
    case 'JP':
    default:
      return {
        story_content_mode: 'original',
        story_translation_locale: translationLocale,
        bilingual_primary: 'original',
        missing_translation_policy: 'fallback-source',
      }
  }
}

/** Store choice identity and source evidence, never a locale-specific display string. */
export function createChoiceSelectionRecord(option, choiceId = null) {
  const value = option && typeof option === 'object' ? option : {}
  return {
    choice_id: choiceId ?? value.choice_id ?? null,
    option_id: value.option_id ?? null,
    source_text: asString(value.source_text ?? value.text ?? value.detail_source_text ?? value.detail ?? value.label),
    text_ref: value.text_ref ?? value.detail_text_ref ?? null,
  }
}

/** Accept both v2 choice records and legacy history strings. */
export function normalizeChoiceSelection(selection) {
  if (typeof selection === 'string') {
    return { source: selection, textRef: null, optionId: null, choiceId: null }
  }
  const value = selection && typeof selection === 'object' ? selection : {}
  return {
    source: asString(value.source_text ?? value.detail ?? value.text ?? value.label),
    textRef: value.text_ref && typeof value.text_ref === 'object' ? value.text_ref : null,
    optionId: value.option_id ?? null,
    choiceId: value.choice_id ?? null,
  }
}
