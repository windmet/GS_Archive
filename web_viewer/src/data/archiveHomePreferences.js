export const ARCHIVE_HOME_PREFERENCES_KEY = 'sidem:archive-home-preferences'
const SCHEMA_VERSION = 2
export const DEFAULT_ARCHIVE_HOME_PREFERENCES = Object.freeze({
  background: 'cue', dialogueOrder: 'sequential', autoVoice: false, cardKey: '', interfaceOpacity: 88,
})
export function normalizeArchiveHomePreferences(value = {}) {
  value ||= {}
  return {
    background: typeof value.background === 'string' && /^bg[a-z0-9_]+$/i.test(value.background) ? value.background : 'cue',
    dialogueOrder: value.dialogueOrder === 'random' ? 'random' : 'sequential',
    autoVoice: value.autoVoice === true,
    cardKey: /^[a-z0-9_]+:(base|p)$/.test(value.cardKey || '') ? value.cardKey : '',
    interfaceOpacity: Math.min(100, Math.max(68, Number(value.interfaceOpacity) || 88)),
  }
}
export function loadArchiveHomePreferences(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    const stored = JSON.parse(target?.getItem(ARCHIVE_HOME_PREFERENCES_KEY) || 'null')
    if (![1, SCHEMA_VERSION].includes(stored?.version)) return { ...DEFAULT_ARCHIVE_HOME_PREFERENCES }
    const result = normalizeArchiveHomePreferences(stored.preferences)
    // Remove v1's theme field without clearing unrelated audio, costume or startup settings.
    if (stored.version === 1 || Object.hasOwn(stored.preferences || {}, 'theme')) saveArchiveHomePreferences(result, target)
    return result
  } catch { return { ...DEFAULT_ARCHIVE_HOME_PREFERENCES } }
}
export function saveArchiveHomePreferences(preferences, storage) {
  const normalized = normalizeArchiveHomePreferences(preferences)
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    target?.setItem(ARCHIVE_HOME_PREFERENCES_KEY, JSON.stringify({ version: SCHEMA_VERSION, preferences: normalized }))
  } catch { /* Keep session preferences usable when persistence is denied. */ }
  return normalized
}
export function resetArchiveHomePreferences(storage) { return saveArchiveHomePreferences(DEFAULT_ARCHIVE_HOME_PREFERENCES, storage) }

export function resolveHomeCard(entries, idolCode, cardKey) {
  const cards = entries.filter(entry => entry.idolCode === idolCode)
  return cards.find(entry => entry.id === cardKey) || cards.slice().sort((a, b) => a.id.localeCompare(b.id))[0] || null
}
