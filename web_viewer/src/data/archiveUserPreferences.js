export const ARCHIVE_USER_PREFERENCES_VERSION = 2
export const ARCHIVE_USER_PREFERENCES_KEY = 'sidem:archive-user-preferences'

export const DEFAULT_ARCHIVE_USER_PREFERENCES = Object.freeze({
  version: ARCHIVE_USER_PREFERENCES_VERSION,
  homeMode: 'unset',
  startupIdol: null,
  preferredIdol: null,
  onboardingComplete: false,
})

function idolCode(value) {
  return typeof value === 'string' && /^\d{3}[a-z0-9]{3}$/.test(value) ? value : null
}

export function normalizeArchiveUserPreferences(value = {}) {
  if (![1, ARCHIVE_USER_PREFERENCES_VERSION].includes(value?.version)) return { ...DEFAULT_ARCHIVE_USER_PREFERENCES }
  return {
    version: ARCHIVE_USER_PREFERENCES_VERSION,
    homeMode: value.version === 1 ? ({ light: 'card', immersive: 'spine' }[value.startupMode] || 'unset') : (['portal', 'card', 'spine'].includes(value.homeMode) ? value.homeMode : 'unset'),
    startupIdol: idolCode(value.startupIdol),
    preferredIdol: idolCode(value.preferredIdol),
    onboardingComplete: value.onboardingComplete === true,
  }
}

export function loadArchiveUserPreferences(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    if (!target?.getItem) throw new Error('storage unavailable')
    const raw = target?.getItem?.(ARCHIVE_USER_PREFERENCES_KEY)
    if (!raw) return { preferences: { ...DEFAULT_ARCHIVE_USER_PREFERENCES }, issue: '' }
    const parsed = JSON.parse(raw)
    const preferences = normalizeArchiveUserPreferences(parsed)
    const issue = [1, ARCHIVE_USER_PREFERENCES_VERSION].includes(parsed?.version) ? '' : '启动设置版本已更新，请重新选择。'
    return { preferences, issue }
  } catch {
    return { preferences: { ...DEFAULT_ARCHIVE_USER_PREFERENCES }, issue: '无法读取本地设置，本次选择仍可使用。' }
  }
}

export function saveArchiveUserPreferences(value, storage) {
  const preferences = normalizeArchiveUserPreferences({
    ...value,
    version: ARCHIVE_USER_PREFERENCES_VERSION,
  })
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    if (!target?.setItem) throw new Error('storage unavailable')
    target?.setItem?.(ARCHIVE_USER_PREFERENCES_KEY, JSON.stringify(preferences))
    return { preferences, persisted: true, issue: '' }
  } catch {
    return { preferences, persisted: false, issue: '无法写入本地设置，本次选择仅在当前页面有效。' }
  }
}

export function clearArchiveUserPreferences(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    if (!target?.removeItem) throw new Error('storage unavailable')
    target?.removeItem?.(ARCHIVE_USER_PREFERENCES_KEY)
    return { preferences: { ...DEFAULT_ARCHIVE_USER_PREFERENCES }, persisted: true, issue: '' }
  } catch {
    return {
      preferences: { ...DEFAULT_ARCHIVE_USER_PREFERENCES },
      persisted: false,
      issue: '无法清除本地设置，当前页面已恢复为未选择状态。',
    }
  }
}
