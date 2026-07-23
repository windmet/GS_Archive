const STORAGE_KEY = 'sidem-story-player-preferences'
const SCHEMA_VERSION = 2

export const DEFAULT_PLAYER_PREFERENCES = Object.freeze({
  schema_version: SCHEMA_VERSION,
  ui_locale: 'zh-CN',
  story_content_mode: 'original',
  story_translation_locale: 'zh-CN',
  bilingual_primary: 'original',
  missing_translation_policy: 'fallback-source',
  auto_enabled: false,
  auto_delay_ms: 800,
  skip_mode: 'readOnly',
  voice_on_back: false,
  ui_hidden: false,
  volumes: Object.freeze({
    master: 0.7,
    bgm: 0.5,
    ambient: 0.4,
    voice: 1,
    se: 0.6,
  }),
})

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function finite(value, fallback, { min, max }) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function normalize(input = {}) {
  const defaults = DEFAULT_PLAYER_PREFERENCES
  const volumes = input.volumes || {}
  return {
    schema_version: SCHEMA_VERSION,
    ui_locale: ['zh-CN', 'ja-JP'].includes(input.ui_locale) ? input.ui_locale : defaults.ui_locale,
    story_content_mode: ['original', 'translation', 'bilingual'].includes(input.story_content_mode)
      ? input.story_content_mode
      : defaults.story_content_mode,
    story_translation_locale: typeof input.story_translation_locale === 'string' && input.story_translation_locale
      ? input.story_translation_locale
      : defaults.story_translation_locale,
    bilingual_primary: ['original', 'translation'].includes(input.bilingual_primary)
      ? input.bilingual_primary
      : defaults.bilingual_primary,
    missing_translation_policy: 'fallback-source',
    auto_enabled: input.auto_enabled === true,
    auto_delay_ms: finite(input.auto_delay_ms, defaults.auto_delay_ms, { min: 0, max: 10000 }),
    skip_mode: ['readOnly', 'all'].includes(input.skip_mode) ? input.skip_mode : defaults.skip_mode,
    voice_on_back: input.voice_on_back === true,
    ui_hidden: input.ui_hidden === true,
    volumes: {
      master: finite(volumes.master, defaults.volumes.master, { min: 0, max: 1 }),
      bgm: finite(volumes.bgm, defaults.volumes.bgm, { min: 0, max: 1 }),
      ambient: finite(volumes.ambient, defaults.volumes.ambient, { min: 0, max: 1 }),
      voice: finite(volumes.voice, defaults.volumes.voice, { min: 0, max: 1 }),
      se: finite(volumes.se, defaults.volumes.se, { min: 0, max: 1 }),
    },
  }
}

function migrateV1(input) {
  const language = {
    JP: { story_content_mode: 'original', bilingual_primary: 'original' },
    CN: { story_content_mode: 'translation', bilingual_primary: 'translation' },
    BILINGUAL: { story_content_mode: 'bilingual', bilingual_primary: 'original' },
  }[input?.language_mode] || {}
  return normalize({
    ...input,
    ...language,
    ui_locale: DEFAULT_PLAYER_PREFERENCES.ui_locale,
    story_translation_locale: DEFAULT_PLAYER_PREFERENCES.story_translation_locale,
  })
}

export class PlayerPreferencesRepository {
  constructor({ storage, key = STORAGE_KEY } = {}) {
    if (storage === undefined) {
      try { storage = globalThis.localStorage } catch (_) { storage = null }
    }
    this.storage = storage
    this.key = key
  }

  load() {
    try {
      const raw = this.storage?.getItem?.(this.key)
      if (!raw) return clone(DEFAULT_PLAYER_PREFERENCES)
      const parsed = JSON.parse(raw)
      if (parsed?.schema_version === 1) {
        const migrated = migrateV1(parsed)
        try { this.storage?.setItem?.(this.key, JSON.stringify(migrated)) } catch (_) {}
        return clone(migrated)
      }
      if (parsed?.schema_version !== SCHEMA_VERSION) return clone(DEFAULT_PLAYER_PREFERENCES)
      const normalized = normalize(parsed)
      if (Object.prototype.hasOwnProperty.call(parsed, 'text_speed')) {
        try { this.storage?.setItem?.(this.key, JSON.stringify(normalized)) } catch (_) {}
      }
      return normalized
    } catch (_) {
      return clone(DEFAULT_PLAYER_PREFERENCES)
    }
  }

  save(preferences) {
    const normalized = preferences?.schema_version === 1
      ? migrateV1(preferences)
      : normalize(preferences)
    try {
      this.storage?.setItem?.(this.key, JSON.stringify(normalized))
    } catch (_) {
      // Playback must remain available when storage is unavailable or full.
    }
    return clone(normalized)
  }

  update(patch) {
    const current = this.load()
    return this.save({
      ...current,
      ...patch,
      volumes: { ...current.volumes, ...(patch?.volumes || {}) },
    })
  }

  clear() {
    try { this.storage?.removeItem?.(this.key) } catch (_) {}
  }
}

export function normalizePlayerPreferences(input) {
  return input?.schema_version === 1 ? migrateV1(input) : normalize(input)
}
