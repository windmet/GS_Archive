import { computed, ref } from 'vue'
import { loadTerminalManifest, readTerminalPreferences, writeTerminalPreferences } from './terminalMedia.js'
// Shared by Welcome / Portal. No network, image, or heavy-runtime work at import time.
const preferences = ref(null)
const catalogue = ref(null)
const error = ref('')
const notice = ref('')
const loading = ref(false)
const revision = ref(0)
let inFlight = null
export function useTerminalWallpaper() {
  if (!preferences.value) {
    try { preferences.value = readTerminalPreferences() }
    catch { preferences.value = { version: 1, wallpaperKey: '' } }
  }
  async function load(retry = false) {
    if (inFlight) return inFlight
    if (catalogue.value && !retry) return catalogue.value
    loading.value = true; error.value = ''
    inFlight = loadTerminalManifest('wallpapers', { retry })
      .then(value => { catalogue.value = value; return value })
      .catch(() => { error.value = 'SSR 壁纸目录暂时不可用，仍可正常浏览资料馆。'; return null })
      .finally(() => { inFlight = null; loading.value = false })
    return inFlight
  }
  function choose(id) {
    if (id && !catalogue.value?.entries.some(entry => entry.id === id)) return false
    let result
    try { result = writeTerminalPreferences(id) }
    catch { result = { preferences: { version: 1, wallpaperKey: id }, notice: '本次选择仅在当前页面有效。' } }
    preferences.value = result.preferences; notice.value = result.notice; revision.value++
    return true
  }
  const selected = computed(() => catalogue.value?.entries.find(entry => entry.id === preferences.value.wallpaperKey) || null)
  const unavailable = computed(() => Boolean(catalogue.value && preferences.value.wallpaperKey && !selected.value))
  return { preferences, catalogue, selected, unavailable, loading, error, notice, revision, load, choose }
}
