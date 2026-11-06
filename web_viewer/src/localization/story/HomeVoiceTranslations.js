import { archiveNamedTranslation, loadArchiveLines } from '../../components/archive/useArchiveNamedText.js'

// Home stand and profile self-introduction voices (3_x_* scenarios) have no scenario overlay: their
// lines translate through the General TM card-lines overlay (home-voice), keyed by the exact source
// line, the same entries the home dialogue box and the idol profile show.
export const HOME_VOICE_KEYS = Object.freeze([['home-voice', 'self-intro'], ['home-voice', 'text'], ['unused-voice', 'text']])

export const isHomeVoiceScenario = compiled => /^3_x_[a-z0-9]+_\d+_\d+_\d+$/.test(compiled?.text_catalog_id || compiled?.scenario_id || '')

export function homeVoiceSources(compiled) {
  return (compiled?.steps || []).map(step => step?.dialogue?.source_text ?? step?.dialogue?.text_jp).filter(text => typeof text === 'string' && text)
}

/** Loads the card-line shards holding this scenario's lines; overlay lookups are synchronous after it. */
export function loadHomeVoiceTranslations(compiled) {
  return loadArchiveLines(homeVoiceSources(compiled))
}

// The exact source line is the binding: an entry exists only for that text, so it carries the unit's own
// hash. The overlay text keeps its Producer macros for resolveStoryText to render.
export function homeVoiceOverlayEntry(compiled, source, textRef = null, translate = archiveNamedTranslation) {
  if (!isHomeVoiceScenario(compiled) || typeof source !== 'string' || !source) return null
  const catalogue = compiled.text_catalog_id || compiled.scenario_id
  if (textRef && !textRef.unit_id?.startsWith(`story-text:v1:${catalogue}:`)) return null
  for (const [kind, field] of HOME_VOICE_KEYS) {
    const text = translate(kind, source, field)
    if (text) return { source_hash: textRef?.source_hash ?? null, text, status: 'draft' }
  }
  return null
}
