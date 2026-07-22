function textBlock(value) {
  if (!value || typeof value !== 'object' || typeof value.text !== 'string') return null
  if (!value.text) return null
  return {
    locale: typeof value.locale === 'string' ? value.locale : '',
    text: value.text,
    source: typeof value.source === 'string' ? value.source : '',
  }
}

/**
 * Normalize Resolver output for presentation components.
 *
 * New callers pass `{ text, view }`; direct resolver views are also accepted.
 * The flat `text` field remains a compatibility fallback for legacy callers,
 * but it is never split to infer primary/secondary language blocks.
 */
export function normalizeLocalizedDisplay(display) {
  const record = display && typeof display === 'object' ? display : {}
  const view = record.view && typeof record.view === 'object' ? record.view : record
  const fallback = typeof record.text === 'string'
    ? record.text
    : typeof display === 'string' ? display : ''
  const primary = textBlock(view.primary) || (fallback
    ? { locale: '', text: fallback, source: 'compatibility' }
    : null)
  const secondary = textBlock(view.secondary)

  return {
    unitId: typeof view.unitId === 'string' && view.unitId ? view.unitId : null,
    primary,
    secondary,
    bilingual: Boolean(primary && secondary),
    translation: view.translation && typeof view.translation === 'object'
      ? view.translation
      : null,
  }
}

