/** Lightweight presentation metadata only. Never import Home, Player or a master index here. */
export const TERMINAL_PREFERENCES_KEY = 'sidem:archive-terminal-preferences'
const CARD_KEY = /^[a-z0-9_]+:(base|p)$/
const BG_ID = /^bg[a-z0-9_]+$/i
const cache = new Map()
export function normalizeTerminalPreferences(value) {
  return { version: 1, wallpaperKey: value?.version === 1 && CARD_KEY.test(value.wallpaperKey || '') ? value.wallpaperKey : '' }
}
export function readTerminalPreferences(storage) {
  try { const target = storage === undefined ? globalThis.localStorage : storage; return normalizeTerminalPreferences(JSON.parse(target?.getItem(TERMINAL_PREFERENCES_KEY) || 'null')) }
  catch { return normalizeTerminalPreferences(null) }
}
export function writeTerminalPreferences(wallpaperKey, storage) {
  const preferences = normalizeTerminalPreferences({ version: 1, wallpaperKey })
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    if (!target?.setItem) throw Error('Storage unavailable')
    target.setItem(TERMINAL_PREFERENCES_KEY, JSON.stringify(preferences))
    return { preferences, persisted: true, notice: '' }
  } catch { return { preferences, persisted: false, notice: '本次选择已生效；浏览器未能保存，下次打开需重新选择。' } }
}
const safeImage = url => typeof url === 'string' && /^\/assets\/(?:card-art|terminal|bg)\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpg)$/.test(url) && !url.includes('..')
export function validateTerminalManifest(value, kind) {
  if (!['wallpapers', 'backgrounds'].includes(kind)) throw Error('未知展示目录')
  if (value?.schemaVersion !== 1 || value.kind !== kind || !Array.isArray(value.entries)) throw Error('展示目录格式不匹配')
  const seen = new Set()
  for (const entry of value.entries) {
    if (!entry || seen.has(entry.id) || typeof entry.label !== 'string' || !entry.label) throw Error('展示目录存在无效或重复记录')
    seen.add(entry.id)
    if (kind === 'wallpapers') {
      if (entry.rarity !== 'SSR' || !CARD_KEY.test(entry.id) || !entry.resourceId || !['base', 'p'].includes(entry.variant)) throw Error('非 SSR 或版本身份缺失')
      if (entry.id !== `${entry.resourceId}:${entry.variant}`) throw Error('卡面身份不一致')
      for (const orientation of ['portrait', 'landscape']) {
        const media = entry[orientation]
        if (!safeImage(media?.url) || !Number.isInteger(media.width) || !Number.isInteger(media.height) || media.width <= 0 || media.height <= 0) throw Error('卡面横竖图不完整')
        if (orientation === 'portrait' ? media.width >= media.height : media.width <= media.height) throw Error('卡面方向不匹配')
      }
      if (entry.thumbnail && !safeImage(entry.thumbnail)) throw Error('缩略图路径无效')
    } else if (kind === 'backgrounds') {
      if (!BG_ID.test(entry.id) || !safeImage(entry.url) || entry.published !== true) throw Error('场景未正式发布')
      if (entry.thumbnail && !safeImage(entry.thumbnail)) throw Error('场景缩略图路径无效')
    } else throw Error('未知展示目录')
  }
  return value
}
export async function loadTerminalManifest(kind, { retry = false, fetcher = globalThis.fetch } = {}) {
  if (!['wallpapers', 'backgrounds'].includes(kind)) throw Error('未知展示目录')
  if (retry) cache.delete(kind)
  if (!cache.has(kind)) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const pending = Promise.resolve().then(async () => {
      const response = await fetcher(`/data/terminal/${kind}.json`, { signal: controller.signal })
      if (!response.ok) throw Error(`展示目录读取失败（${response.status}）`)
      const text = await response.text()
      if (text.length > 1_500_000) throw Error('展示目录超过预算')
      return validateTerminalManifest(JSON.parse(text), kind)
    }).catch(error => { if (cache.get(kind) === pending) cache.delete(kind); throw error }).finally(() => clearTimeout(timer))
    cache.set(kind, pending)
  }
  return cache.get(kind)
}
/** A pending catalogue must not erase a valid stored scene when changing idol. */
export function resolveHomeBackground(preference, entries, fallback = '', ready = true) {
  if (!preference || preference === 'cue') return fallback
  if (!BG_ID.test(preference)) return fallback
  return !ready || entries.some(entry => entry.id === preference) ? preference : fallback
}
