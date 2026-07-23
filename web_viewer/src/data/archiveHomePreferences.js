const STORAGE_KEY = 'sidem:archive-home-preferences'
const SCHEMA_VERSION = 1

export const DEFAULT_ARCHIVE_HOME_PREFERENCES = Object.freeze({
  theme: 'day',
  background: 'cue',
  dialogueOrder: 'sequential',
  autoVoice: false,
  focusMode: false,
  interfaceOpacity: 88,
})

function normalizePreferences(value = {}) {
  return {
    theme: value.theme === 'night' ? 'night' : 'day',
    background: typeof value.background === 'string' && value.background ? value.background : 'cue',
    dialogueOrder: value.dialogueOrder === 'random' ? 'random' : 'sequential',
    autoVoice: value.autoVoice === true,
    focusMode: value.focusMode === true,
    interfaceOpacity: Math.min(100, Math.max(68, Number(value.interfaceOpacity) || 88)),
  }
}

export function loadArchiveHomePreferences() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (!stored || stored.version !== SCHEMA_VERSION) return { ...DEFAULT_ARCHIVE_HOME_PREFERENCES }
    return normalizePreferences(stored.preferences)
  } catch {
    return { ...DEFAULT_ARCHIVE_HOME_PREFERENCES }
  }
}

export function saveArchiveHomePreferences(preferences) {
  const normalized = normalizePreferences(preferences)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: SCHEMA_VERSION,
    preferences: normalized,
  }))
  return normalized
}

export function resetArchiveHomePreferences() {
  const defaults = { ...DEFAULT_ARCHIVE_HOME_PREFERENCES }
  saveArchiveHomePreferences(defaults)
  return defaults
}
